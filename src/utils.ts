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

export function getRawTransaction(tx: any) {
    function addKey(accum: any, key: any) {
      if (tx[key]) { accum[key] = tx[key]; }
      return accum;
    }
  
    // Extract the relevant parts of the transaction and signature
    const txFields = "accessList chainId data gasPrice gasLimit maxFeePerGas maxPriorityFeePerGas nonce to type value".split(" ");
    const sigFields = "v r s".split(" ");
  
    // Seriailze the signed transaction
    const raw = ethers.utils.serializeTransaction(txFields.reduce(addKey, { }), sigFields.reduce(addKey, { }));
  
    // Double check things went well
    if (ethers.utils.keccak256(raw) !== tx.hash) { throw new Error("serializing failed!"); }
  
    return raw;
  }