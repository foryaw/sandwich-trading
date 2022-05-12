import { decodedUniswapRouterTransactionToString, decodeUniswapRouterTransaction } from "./utils";
import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv"
dotenv.config()


const provider = ethers.getDefaultProvider("wss://mainnet.infura.io/ws/v3/b670b9df27be49ae81a19596df574761")
const txHistory: any = []
const scan = async() => {
    provider.on("pending", async(txHash) => {
        const txResponse = await provider.getTransaction(txHash);
        if (!txResponse) return;
        if (txResponse.to === "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D") {
            const decodedTx = decodeUniswapRouterTransaction(txResponse);
            if (decodedTx) {
                const decodedTxToString = await decodedUniswapRouterTransactionToString(decodedTx, provider);
                txHistory.push(decodedTxToString)
                console.log(txHistory);
                fs.writeFile("./txHistory.txt", JSON.stringify(txHistory), (err) => {
                    if (err) throw err;
                })
            }
        }
    })
}

scan()