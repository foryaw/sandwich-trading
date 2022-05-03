import { BigNumber, Wallet, ethers } from "ethers";
import { TransactionResponse } from "@ethersproject/abstract-provider";

export const ETHER = BigNumber.from(10).pow(18)
export const GWEI = BigNumber.from(10).pow(9)

export function bigNumberToDecimal(value: BigNumber, decimals = 18): number {
    const scaler = 10000
    const divisor = BigNumber.from(10).pow(decimals)
    return value.mul(scaler).div(divisor).toNumber() / scaler;
}

export function getDefaultRelaySigningKey(): string {
    console.warn("You have not specified an explicity FLASHBOTS_RELAY_SIGNING_KEY environment variable. Creating random signing key, this searcher will not be building a reputation for next run")
    return Wallet.createRandom().privateKey;
}

export async function getSignedTransaction(transaction: TransactionResponse) {
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