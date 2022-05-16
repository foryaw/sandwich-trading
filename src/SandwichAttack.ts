import { BigNumber, Contract, ethers, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

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

