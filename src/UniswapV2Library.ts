import { BigNumber } from "ethers";
import { UniswapV2Pair } from "./UniswapV2Pair";

export class UniswapV2Library {
    static quote(amountA: BigNumber, reserveA: BigNumber, reserveB: BigNumber): BigNumber {
        return amountA.mul(reserveB).div(reserveA);
    }
    
    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    static getAmountIn(reserveIn: BigNumber, reserveOut: BigNumber, amountOut: BigNumber): BigNumber {
        const numerator = reserveIn.mul(amountOut).mul(1000);
        const denominator = reserveOut.sub(amountOut).mul(997);
        return numerator.div(denominator).add(1);
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    static getAmountOut(reserveIn: BigNumber, reserveOut: BigNumber, amountIn: BigNumber): BigNumber {
        const amountInWithFee = amountIn.mul(997);
        const numerator = amountInWithFee.mul(reserveOut);
        const denominator = reserveIn.mul(1000).add(amountInWithFee);
        return numerator.div(denominator);
    }

    static getAmountsIn(amountOut: BigNumber, path: Array<string>, allMarketPairs: Array<UniswapV2Pair>): Array<BigNumber> {
        if (path.length < 2) throw new Error("invalid path");
        const amounts = new Array<BigNumber>(path.length);
        amounts[amounts.length - 1] = amountOut

        for (let i = path.length - 1; i > 0; i--) {
            const pair = UniswapV2Pair.getUniswapMarketByTokenPair(path[i], path[i - 1], allMarketPairs)
            if (!pair) throw new Error()
            amounts[i - 1] = pair.getTokensIn(path[i - 1], path[i], amountOut)
        }
        return amounts;
    }

    static getAmountsOut(amountIn: BigNumber, path: Array<string>, allMarketPairs: Array<UniswapV2Pair>): Array<BigNumber> {
        if (path.length < 2) throw new Error("invalid path")
        const amounts = new Array<BigNumber>(path.length);
        amounts[0] = amountIn;
        for (let i = 0; i < path.length - 1; i++) {
            const pair = UniswapV2Pair.getUniswapMarketByTokenPair(path[i], path[i + 1], allMarketPairs)
            if (!pair) throw new Error()
            amounts[i + 1] = pair.getTokensOut(path[i], path[i - 1], amountIn)
        }
        return amounts;
    }
}