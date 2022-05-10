import { BigNumber, Contract, ethers, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

export interface UniswapRouterTransactionInfo {
    amountIn?: BigNumber,
    amountOut?: BigNumber,
    amountInMax?: BigNumber,
    amountOutMin?: BigNumber,
    path: string[],
    to: string,
    deadline: BigNumber,
    value: BigNumber
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

