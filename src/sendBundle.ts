import * as dotenv from "dotenv"
dotenv.config()
import { BigNumber, Wallet, ethers, Signer} from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
import { GWEI, getDefaultRelaySigningKey, getSignedTransaction } from "./utils";

// flashbots uses goreli testnet
const NETWORK = "goerli"

const PRIVATE_KEY = process.env.PRIVATE_KEY || ""
const FLASHBOTS_RELAY_SIGNING_KEY = process.env.FLASHBOTS_RELAY_SIGNING_KEY || getDefaultRelaySigningKey()

if(process.env.PRIVATE_KEY === "") {
    console.error("Please provide PRIVATE_KEY environment variable")
    process.exit(1);
}

const provider = ethers.getDefaultProvider(process.env.GOERLI_RPC_URL);
const arbitrageSigningWallet = new Wallet(PRIVATE_KEY, provider)
const flashbotsRelaySigningWallet = new Wallet(FLASHBOTS_RELAY_SIGNING_KEY)

function createSandwichBundle(filling: string, executorWallet: Signer): Array<(FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)> {
    const bundleTransactions = new Array<(FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)>(
        {
            signedTransaction: filling
        },
    )
    return bundleTransactions;
}

async function main() {
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, flashbotsRelaySigningWallet, process.env.FLASHBOTS_GOERLI_ENDPOINT, NETWORK)
    const scanTxPool = () => {
        provider.on("pending", async (txHash) => {
            const blockNumber = await provider.getBlockNumber();
            const txResponse = await provider.getTransaction(txHash);
            if(txResponse) {
                console.log("sender", txResponse.from);
                console.log(txResponse);
                const signedTx = await getSignedTransaction(txResponse);
                // TODO: make gas fee variable

                // create bundle
                const bundledTransactions = createSandwichBundle(signedTx , arbitrageSigningWallet);
                console.log(bundledTransactions)
                console.log("bundle created")

                // signed bundle
                const signedBundle = await flashbotsProvider.signBundle(bundledTransactions);

                // run simulation
                const simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 1);
                if ('error' in simulation) {
                    // throw new Error(`Simulation Error: ${simulation.error.message}`)
                    console.warn(`Simulation Error: ${simulation.error.message}`)
                    return
                  } else {
                    console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`)
                  }

                // submit bundle
                const bundleSubmitResponse = await flashbotsProvider.sendRawBundle(signedBundle, blockNumber + 1)
                if ("error" in bundleSubmitResponse) {
                    console.warn(bundleSubmitResponse.error.message)
                    return
                }
                else {
                    console.log("submitted")
                }
            }
         })

        provider.on("error", async (error) => {
            console.log(`Connection lost, Attempting reconnect in 3s...`);
            console.error(error);
            setTimeout(scanTxPool, 3000);
        })
    }
    scanTxPool()
}


main()