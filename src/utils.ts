import { BigNumber, Wallet, ethers } from "ethers";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { UNISWAP_PAIR_ABI, UNISWAP_ROUTER_ABI } from "./abi";
import { UniswapPairTransactionInfo, UniswapRouterTransactionInfo } from "./SandwichAttack";

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

export async function getSignedTransaction(transaction: TransactionResponse): Promise<string> {
    console.log("Getting signed transaction from raw transaction object")
    let transactionObject = {
        to: transaction.to,
        from: transaction.from,
        nonce: transaction.nonce,

        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,

        data: transaction.data,
        value: transaction.value,
        chainId: transaction.chainId,

        type: transaction.type,
        accessList: transaction.accessList,

        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        maxFeePerGas: transaction.maxFeePerGas,

    }

    let signature = {
        r: transaction.r!,
        s: transaction.s,
        v: transaction.v
    }

    let signedTransaction = ethers.utils.serializeTransaction(transactionObject, signature)

    return signedTransaction
}

export function decodeUniswapPairTransaction(transaction: TransactionResponse): UniswapPairTransactionInfo {
    const iface = new ethers.utils.Interface(UNISWAP_PAIR_ABI);
    const decodedInput = iface.parseTransaction({ data: transaction.data, value: transaction.value });
    const txInfo: UniswapPairTransactionInfo = {
        amount0Out: decodedInput.args[0],
        amount1Out: decodedInput.args[1],
        to: decodedInput.args[2],
        data: decodedInput.args[3]
    }
    return txInfo;
}

export function decodeUniswapRouterTransaction(transaction: TransactionResponse): UniswapRouterTransactionInfo | undefined {
    const iface = new ethers.utils.Interface(UNISWAP_ROUTER_ABI);
    const decodedInput = iface.parseTransaction({ data: transaction.data, value: transaction.value });
    const funcName = decodedInput.name
    let txInfo: UniswapRouterTransactionInfo;
    switch (funcName) {
        case "swapExactTokensForTokens":
            txInfo = {
                amountIn: decodedInput.args[0],
                amountOutMin: decodedInput.args[1],
                path: decodedInput.args[2],
                to: decodedInput.args[3],
                deadline: decodedInput.args[4],
                value: decodedInput.value
            }
            break;
        case "swapTokensForExactTokens":
            txInfo = {
                amountOut: decodedInput.args[0],
                amountInMax: decodedInput.args[1],
                path: decodedInput.args[2],
                to: decodedInput.args[3],
                deadline: decodedInput.args[4],
                value: decodedInput.value
            }
            break;
        case "swapExactETHForTokens":
            txInfo = {
                amountOutMin: decodedInput.args[0],
                path: decodedInput.args[1],
                to: decodedInput.args[2],
                deadline: decodedInput.args[3],
                value: decodedInput.value
            }
            break;
        case "swapToeknsForExactETH":
            txInfo = {
                amountOut: decodedInput.args[0],
                amountInMax: decodedInput.args[1],
                path: decodedInput.args[2],
                to: decodedInput.args[3],
                deadline: decodedInput.args[4],
                value: decodedInput.value
            }
            break;
        case "swapExactTokensForETH":
            txInfo = {
                amountIn: decodedInput.args[0],
                amountOutMin: decodedInput.args[1],
                path: decodedInput.args[2],
                to: decodedInput.args[3],
                deadline: decodedInput.args[4],
                value: decodedInput.value
            }
            break;
        case "swapETHForExactTokens":
            txInfo = {
                amountOut: decodedInput.args[0],
                path: decodedInput.args[1],
                to: decodedInput.args[2],
                deadline: decodedInput.args[3],
                value: decodedInput.value
            }
            break;
        default:
            return;
    }
    return txInfo;

}