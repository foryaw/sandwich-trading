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

async function getSignedTransaction(transaction: TransactionResponse) {
    console.log("Getting signed transaction from raw transaction object")
    let transactionObject = {
        to: transaction.to,
        nonce: transaction.nonce,
        gasLimit: ethers.BigNumber.from(transaction.gasLimit),
        gasPrice: ethers.BigNumber.from(transaction.gasPrice),
        data: transaction.data,
        value: ethers.BigNumber.from(transaction.value),
        chainId: transaction.chainId
    }

    let signature = {
        r: transaction.r!,
        s: transaction.s,
        v: transaction.v
    }

    let signedTransaction = ethers.utils.serializeTransaction(transactionObject, signature)

    return signedTransaction
}


function createSandwichBundle(filling: string, executorWallet: Signer): Array<(FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)> {
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
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, flashbotsRelaySigningWallet)
    const scanTxPool = () => {
        provider.on("pending", async (txHash) => {
            const blockNumber = await provider.getBlockNumber();
            const targetTxResponse = await provider.getTransaction(txHash);
            if(targetTxResponse) {
                const signedTx = await getSignedTransaction(targetTxResponse);
                // TODO: make gas fee variable

                // create bundle
                const bundledTransactions = createSandwichBundle(signedTx , arbitrageSigningWallet);
                console.log(bundledTransactions)
                console.log("bundle created")
                // signed bundle
                const signedBundle = await flashbotsProvider.signBundle(bundledTransactions);
                // run simulation
                const simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 1);
                console.log(simulation)
                if ("error" in simulation) {
                    throw new Error(simulation.error.message)
                }
                if(simulation.firstRevert !== undefined) {
                    console.log("simulation.firstRevert:", simulation.firstRevert)
                    process.exit(1)
                }
                // submit bundle
                const bundleSubmitResponse = await flashbotsProvider.sendRawBundle(signedBundle, blockNumber + 1)

                if ("error" in bundleSubmitResponse) {
                    throw new Error(bundleSubmitResponse.error.message)
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