import { BigNumber, Wallet, ethers } from "ethers";
import { TransactionRequest, TransactionResponse} from "@ethersproject/abstract-provider";

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