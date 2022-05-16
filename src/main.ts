import { uniswapRouterTxInfoToReadable, decodeUniswapRouterTransaction } from "./utils";
import { UniswapV2Pair } from "./UniswapV2Pair";
import { UNISWAP_FACTORY_ADDRESS } from "./addresses";
import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv"
dotenv.config()


const provider = ethers.getDefaultProvider("wss://mainnet.infura.io/ws/v3/b670b9df27be49ae81a19596df574761")
const txHistory: any = []
const scan = async() => {
    let blockNumber = await provider.getBlockNumber()
    const allMarketPairs = await UniswapV2Pair.getUniswapMarkets(provider, UNISWAP_FACTORY_ADDRESS);

    provider.on("pending", async(txHash) => {
        const currentBlockNumber = await provider.getBlockNumber()
        if (currentBlockNumber > blockNumber) {
            blockNumber = currentBlockNumber
            await UniswapV2Pair.updateReserves(provider, allMarketPairs);
        }
        const txResponse = await provider.getTransaction(txHash);
        if (!txResponse) return;
        if (txResponse.to !== "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D") return;

        const decodedTx = decodeUniswapRouterTransaction(txResponse);
        if (!decodedTx) return;

        const decodedTxReadable = await uniswapRouterTxInfoToReadable(decodedTx, provider);
        txHistory.push(decodedTxReadable)
        console.log(txHistory);
        fs.writeFile("./txHistory.txt", JSON.stringify(txHistory), (err) => {
            if (err) throw err;
        })
    })
}

scan()