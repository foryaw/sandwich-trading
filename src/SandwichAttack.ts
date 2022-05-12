import { BigNumber, Contract, ethers, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

export type UniswapRouterTransactionArgs = {
    amountIn?: BigNumber | string,
    amountOut?: BigNumber | string,
    amountInMax?: BigNumber | string,
    amountOutMin?: BigNumber | string,
    path: string[],
    to: string,
    deadline: BigNumber | string,
}

export interface UniswapRouterTransactionInfo {
    functionName: string,
    funcArgs: UniswapRouterTransactionArgs,
    value: BigNumber | string
}

export interface UniswapPairTransactionInfo {
    amount0Out: BigNumber,
    amount1Out: BigNumber,
    to: string,
    data: string
}

export class SandwichAttack {
    private flashbotsProvider: FlashbotsBundleProvider;
    private bundleExecutorContract: Contract;
    private executorWallet: Wallet;

    constructor(flashbotsProvider: FlashbotsBundleProvider, bundleExecutorContract: Contract, executorWallet: Wallet) {
        this.flashbotsProvider = flashbotsProvider,
        this.bundleExecutorContract = bundleExecutorContract,
        this.executorWallet = executorWallet
    }



    
}

