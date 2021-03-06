import { BigNumber, Wallet, ethers, Contract, providers } from "ethers";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { UNISWAP_PAIR_ABI, UNISWAP_ROUTER_ABI, ERC20_ABI } from "./abi";
import { WETH_ADDRESS } from "./addresses";
import { UniswapTransactionArgs, UniswapTransactionInfo} from "./index";

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

export function decodeUniswapRouterTransaction(transaction: TransactionResponse): UniswapTransactionInfo | undefined {
    const iface = new ethers.utils.Interface(UNISWAP_ROUTER_ABI);
    const decodedInput = iface.parseTransaction({ data: transaction.data, value: transaction.value });
    const funcName = decodedInput.name
    let txInfo: UniswapTransactionInfo;

    switch (funcName) {
        // case "swapExactTokensForTokens":
        //     txInfo = {
        //         functionName: funcName,
        //         funcArgs: {
        //             amountIn: decodedInput.args[0],
        //             amountOutMin: decodedInput.args[1],
        //             path: decodedInput.args[2],
        //             to: decodedInput.args[3],
        //             deadline: decodedInput.args[4],
        //         },
        //         value: decodedInput.value
        //     }
        //     break;
        // case "swapTokensForExactTokens":
        //     txInfo = {
        //         functionName: funcName,
        //         funcArgs: {
        //             amountOut: decodedInput.args[0],
        //             amountInMax: decodedInput.args[1],
        //             path: decodedInput.args[2],
        //             to: decodedInput.args[3],
        //             deadline: decodedInput.args[4],
        //         },
        //         value: decodedInput.value
        //     }
        //     break;
        case "swapExactETHForTokens":
            txInfo = {
                functionName: funcName,
                funcArgs: {
                    amountOutMin: decodedInput.args[0],
                    path: decodedInput.args[1],
                    to: decodedInput.args[2],
                    deadline: decodedInput.args[3],
                },
                value: decodedInput.value
            }
            break;
        case "swapTokensForExactETH":
            txInfo = {
                functionName: funcName,
                funcArgs: {
                    amountOut: decodedInput.args[0],
                    amountInMax: decodedInput.args[1],
                    path: decodedInput.args[2],
                    to: decodedInput.args[3],
                    deadline: decodedInput.args[4],
                },
                value: decodedInput.value
            }
            break;
        case "swapExactTokensForETH":
            txInfo = {
                functionName: funcName,
                funcArgs: {
                    amountIn: decodedInput.args[0],
                    amountOutMin: decodedInput.args[1],
                    path: decodedInput.args[2],
                    to: decodedInput.args[3],
                    deadline: decodedInput.args[4],
                },
                value: decodedInput.value
            }
            break;
        case "swapETHForExactTokens":
            txInfo = {
                functionName: funcName,
                funcArgs: {
                    amountOut: decodedInput.args[0],
                    path: decodedInput.args[1],
                    to: decodedInput.args[2],
                    deadline: decodedInput.args[3],
                },
                value: decodedInput.value
            }
            break;
        default:
            return;
    }
    if (!txInfo.funcArgs.path.includes(WETH_ADDRESS)) return;
    return txInfo;
}

export async function uniswapRouterTxInfoToReadable(decodedTx: UniswapTransactionInfo, provider: providers.BaseProvider) {
    const tokenIn = new Contract(decodedTx.funcArgs.path[0], ERC20_ABI, provider);
    const tokenOut = new Contract(decodedTx.funcArgs.path[decodedTx.funcArgs.path.length - 1], ERC20_ABI, provider)
    const tokenInDec = await tokenIn.functions.decimals();
    const tokenOutDec = await tokenOut.functions.decimals();

    // let txInfo: UniswapRouterTransactionInfo;

    // txInfo = {
    //     functionName: decodedTx.functionName,
    //     funcArgs: {
    //         amountIn: decodedTx.funcArgs.amountIn ? ethers.utils.formatUnits(decodedTx.funcArgs.amountIn, tokenInDec) : undefined,
    //         amountOut: decodedTx.funcArgs.amountOut ? ethers.utils.formatUnits(decodedTx.funcArgs.amountOut, tokenOutDec) : undefined,
    //         amountInMax: decodedTx.funcArgs.amountInMax ? ethers.utils.formatUnits(decodedTx.funcArgs.amountInMax, tokenInDec) : undefined,
    //         amountOutMin: decodedTx.funcArgs.amountOutMin ? ethers.utils.formatUnits(decodedTx.funcArgs.amountOutMin, tokenOutDec) : undefined,
    //         path: decodedTx.funcArgs.path,
    //         to: decodedTx.funcArgs.to,
    //         deadline: decodedTx.funcArgs.deadline.toString()
    //     },
    //     value: ethers.utils.formatEther(decodedTx.value)
    // }

    let txInfo: any = {}
    txInfo.functionName = decodedTx.functionName,
    txInfo.tokenIn = await tokenIn.functions.symbol()
    txInfo.tokenOut = await tokenOut.functions.symbol()
    txInfo.amountIn =  decodedTx.funcArgs.amountIn ? ethers.utils.formatUnits(decodedTx.funcArgs.amountIn, tokenInDec) : undefined,
    txInfo.amountOut =  decodedTx.funcArgs.amountOut ? ethers.utils.formatUnits(decodedTx.funcArgs.amountOut, tokenOutDec) : undefined,
    txInfo.amountInMax =  decodedTx.funcArgs.amountInMax ? ethers.utils.formatUnits(decodedTx.funcArgs.amountInMax, tokenInDec) : undefined,
    txInfo.amountOutMin = decodedTx.funcArgs.amountOutMin ? ethers.utils.formatUnits(decodedTx.funcArgs.amountOutMin, tokenOutDec) : undefined,
    txInfo.value = ethers.utils.formatEther(decodedTx.value)

    return txInfo
}