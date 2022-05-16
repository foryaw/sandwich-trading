import { BigNumber } from "ethers"

export type UniswapTransactionArgs = {
    amountIn?: BigNumber | string,
    amountOut?: BigNumber | string,
    amountInMax?: BigNumber | string,
    amountOutMin?: BigNumber | string,
    path: string[],
    to: string,
    deadline: BigNumber | string,
}

export interface UniswapTransactionInfo {
    functionName: string,
    funcArgs: UniswapTransactionArgs,
    value: BigNumber | string
}
