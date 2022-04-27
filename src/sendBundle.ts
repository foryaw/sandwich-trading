import * as dotenv from "dotenv"
dotenv.config()
import { BigNumber, Wallet, ethers, Signer} from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
import { TransactionRequest, TransactionResponse} from "@ethersproject/abstract-provider";
import { GWEI, getDefaultRelaySigningKey, getRawTransaction} from "./utils";

// flashbots uses goreli testnet
const CHAIN_ID = 5;
const FLAHSBOTS_ENDPOINT = "http://relay-goerli.flashbots.net";
const url = "wss://mainnet.infura.io/ws/v3/fa688e4b59db4b4ba09be0235cc4a2b5";

const PRIVATE_KEY = process.env.PRIVATE_KEY || ""
const FLASHBOTS_RELAY_SIGNING_KEY = process.env.FLASHBOTS_RELAY_SIGNING_KEY || getDefaultRelaySigningKey()

if(process.env.PRIVATE_KEY === "") {
    console.error("Please provide PRIVATE_KEY environment variable")
    process.exit(1);
}
if(process.env.FLASHBOTS_REPLAY_SIGNING_KEY === "") {
    console.error("Please provide FLASHBOTS_REPLAY_SIGNING_KEY environment variable")
    process.exit(1);
}

const provider = new ethers.providers.WebSocketProvider(url);
console.log(PRIVATE_KEY)
console.log(FLASHBOTS_RELAY_SIGNING_KEY)
const arbitrageSigningWallet = new Wallet(PRIVATE_KEY)
const flashbotsRelaySigningWallet = new Wallet(FLASHBOTS_RELAY_SIGNING_KEY)

function resolveTransactionResponse(txResponse: TransactionResponse): TransactionRequest {
    let txRequest: TransactionRequest
    txRequest = {
        to: txResponse.to,
        from: txResponse.from,
        nonce: txResponse.nonce,
        gasLimit: txResponse.gasLimit,
        gasPrice: txResponse.gasPrice,
        data: txResponse.data,
        value: txResponse.value,
        chainId: txResponse.chainId,
        type: txResponse.type!,
        accessList: txResponse.accessList,
        maxPriorityFeePerGas: txResponse.maxPriorityFeePerGas,
        maxFeePerGas: txResponse.maxFeePerGas
    }
    return txRequest;
}

function createSandwichBundle(topBread: TransactionRequest, filling: string, bottomBread: TransactionRequest, executorWallet: Signer): Array<(FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)> {
    // const bundleTransactions = new Array<(FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)>(
    //     {
    //         transaction: topBread,
    //         signer: executorWallet
    //     },
    //     {
    //         signedTransaction: filling
    //     },
    //     {
    //         transaction: bottomBread,
    //         signer: executorWallet
    //     },
    // )
    const bundleTransactions = new Array<(FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)>(
        {
            signedTransaction: filling
        },
    )
    return bundleTransactions;
}

async function main() {
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, flashbotsRelaySigningWallet, FLAHSBOTS_ENDPOINT)
    const scanTxPool = () => {
        provider.on("pending", async (txHash) => {
            const blockNumber = await provider.getBlockNumber();
            const targetTxResponse = await provider.getTransaction(txHash)
            if(targetTxResponse) {
                const raw = targetTxResponse.raw;
                console.log("raw", raw);
                const targetTxRequest = resolveTransactionResponse(targetTxResponse)
                console.log("targetTxResponse:", targetTxResponse);
                // TODO: make gas fee variable

                // create bundle
                const bundledTransactions = createSandwichBundle(targetTxRequest, raw!, targetTxRequest, arbitrageSigningWallet);
                console.log("bundle created")
                // signed bundle
                const signedBundle = await flashbotsProvider.signBundle(bundledTransactions);
                // run simulation
                const simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 1);
                if ("error" in simulation || simulation.firstRevert !== undefined) {
                    console.error(`Simulation error occured`);
                }
                // submit bundle
                const bundleSubmitResponse = await flashbotsProvider.sendRawBundle(signedBundle, blockNumber + 1)

                if ("error" in bundleSubmitResponse) {
                    console.log(bundleSubmitResponse.error.message)
                    return
                }
                }
         })

        provider.on("error", async (error) => {
            console.log(`Connection lost, Attempting reconnect in 3s...`);
            console.log(error);
            setTimeout(scanTxPool, 3000);
        })
    }
    scanTxPool()
}


main()