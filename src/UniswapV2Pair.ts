import * as _ from "lodash";
import { UNISWAP_PAIR_ABI, UNISWAP_QUERY_ABI } from "./abi";
import { WETH_ADDRESS, UNISWAP_LOOKUP_CONTRACT_ADDRESS } from "./addresses";
import { BigNumber, BigNumberish, Contract, providers } from "ethers";
import { TokenBalances, UniswapMarket } from "./UniswapMarket";
import { BaseProvider } from "@ethersproject/providers";

const BATCH_COUNT_LIMIT = 100;
const UNISWAP_BATCH_SIZE = 1000;

// Not necessary, slightly speeds up loading initialization when we know tokens are bad
// Estimate gas will ensure we aren't submitting bad bundles, but bad tokens waste time
const blacklistTokens = [
    '0xD75EA151a61d06868E31F8988D28DFE5E9df57B4'
  ]

export type MarketsByAddress = { [marketAddress: string]: UniswapV2Pair }
export class UniswapV2Pair extends UniswapMarket {
    private _tokenBalances: TokenBalances;

    constructor(marketAddress: string, tokens: Array<string>, protocol: string) {
        super(marketAddress, tokens, protocol);
        // tokens = [token1, token2]
        this._tokenBalances = _.zipObject(tokens,[BigNumber.from(0), BigNumber.from(0)])
    }

    static async getUniswapMarkets(provider: providers.BaseProvider, factoryAddress: string): Promise<Array<UniswapV2Pair>> {
        // LOOKUP CONTRACT is the UniswapFlashQuery
        const uniswapQuery = new Contract(UNISWAP_LOOKUP_CONTRACT_ADDRESS, UNISWAP_QUERY_ABI, provider);

        let marketPairs = new Array<UniswapV2Pair>()
        for (let i = 0; i < BATCH_COUNT_LIMIT * UNISWAP_BATCH_SIZE; i += UNISWAP_BATCH_SIZE) {
            const pairs: Array<Array<string>> = (await uniswapQuery.functions.getPairsByIndexRange(factoryAddress, i, i + UNISWAP_BATCH_SIZE))[0];
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                const marketAddress = pair[2];
                let tokenAddress: string;

                if(pair[0] === WETH_ADDRESS) {
                    tokenAddress = pair[1];
                }
                else if (pair[1] === WETH_ADDRESS) {
                    tokenAddress = pair[0]
                }
                else continue;

                if (!blacklistTokens.includes(tokenAddress)) {
                    const uniswapV2Pair = new UniswapV2Pair(marketAddress, [pair[0], pair[1]], "");
                    marketPairs.push(uniswapV2Pair);
                }
            }
            if (pairs.length < UNISWAP_BATCH_SIZE) {
                break;
            }
        }
        return marketPairs;
    }

    static async updateReserves(provider: providers.BaseProvider, allMarketPairs: Array<UniswapV2Pair>): Promise<void> {
        const uniswapQuery = new Contract(UNISWAP_LOOKUP_CONTRACT_ADDRESS, UNISWAP_QUERY_ABI, provider);
        const pairAddresses = allMarketPairs.map(marketPair => marketPair.marketAddress);
        console.log("Updating markets, count:", pairAddresses.length);
        const reserves: Array<Array<BigNumber>> = (await uniswapQuery.functions.getReservesByPairs(pairAddresses))[0];
        for (let i = 0; i < allMarketPairs.length; i++) {
            const marketPair = allMarketPairs[i];
            const reserve = reserves[i];
            marketPair._setReservesViaOrderedBalances([reserve[0], reserve[1]]);
        }
    }

    static updateSingleMarketReserve(marketAddress: string, tokenIn: string, tokenOut: string, amountIn: BigNumber, allMarketPairs: Array<UniswapV2Pair>): void {
        for (let i = 0; i < allMarketPairs.length; i++) {
            const marketPair = allMarketPairs[i]
            if (marketPair.marketAddress === marketAddress) {
                const amountInWithFee = amountIn.mul(997).div(1000)
                const amountOut = marketPair.getTokensOut(tokenIn, tokenOut, amountInWithFee)
                const newReserveIn = marketPair._tokenBalances[tokenIn].add(amountInWithFee);
                const newReserveOut = marketPair._tokenBalances[tokenOut].sub(amountOut);

                if (tokenIn < tokenOut) {
                    marketPair._setReservesViaOrderedBalances([newReserveIn, newReserveOut]);
                }
                else if (tokenOut < tokenIn) {
                    marketPair._setReservesViaOrderedBalances([newReserveOut, newReserveIn]);
                }
                else throw new Error("tokenIn and tokenOut can't have the same address");
                return;
            }
        }
    }

    static getUniswapMarketByAddress(allMarketPairs: Array<UniswapV2Pair>): MarketsByAddress {
        const marketsByAddress: MarketsByAddress = _.chain(allMarketPairs)
            .flatten()
            .keyBy(pair => pair.marketAddress)
            .value()
        return marketsByAddress;
    }

    static getUniswapMarketByTokenPair(token0: string, token1: string, allMarketPairs: Array<UniswapV2Pair>): UniswapV2Pair | undefined {
        for (let i = 0; i < allMarketPairs.length; i++) {
            const pair = allMarketPairs[i]
            if (pair._tokens.includes(token0) && pair._tokens.includes(token1)) {
                return pair;
            }
        }
        return;
    } 

    getBalance(tokenAddress: string): BigNumber {
        const balance = this._tokenBalances[tokenAddress]
        if (balance === undefined) throw new Error("bad token")
        return balance;
    }

    _setReservesViaOrderedBalances(balances: Array<BigNumber>): void {
        this._setReservesViaMatchingArray(this._tokens, balances)
      }
    
    _setReservesViaMatchingArray(tokens: Array<string>, balances: Array<BigNumber>): void {
        const tokenBalances = _.zipObject(tokens, balances)
        if (!_.isEqual(this._tokenBalances, tokenBalances)) {
            this._tokenBalances = tokenBalances
        }
    }
    getTokensIn(tokenIn: string, tokenOut: string, amountOut: BigNumber): BigNumber {
        const reserveIn = this._tokenBalances[tokenIn]
        const reserveOut = this._tokenBalances[tokenOut]
        return this.getAmountIn(reserveIn, reserveOut, amountOut);
    }
    
    getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber {
        const reserveIn = this._tokenBalances[tokenIn]
        const reserveOut = this._tokenBalances[tokenOut]
        return this.getAmountOut(reserveIn, reserveOut, amountIn);
    }
    
    // always quote in WETH, such as USDT/WETH
    priceAfterSwapInExactToken(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber | undefined {
        // confirm the maths
        const newReserveIn = this._tokenBalances[tokenIn].add(amountIn.mul(997))
        const newReserveOut =  this._tokenBalances[tokenOut].sub(this.getTokensOut(tokenIn, tokenOut, amountIn))
        if (tokenIn === "WETH") {
            return newReserveOut.div(newReserveIn);
        }
        else if (tokenOut === "WETH") {
            return newReserveIn.div(newReserveOut);
        }
        else return;
    }

    priceAfterSwapOutExactToken(tokenIn: string, tokenOut: string, amountOut: BigNumber): BigNumber | undefined {
        // confirm the maths
        const newReserveIn = this._tokenBalances[tokenIn].add(this.getTokensIn(tokenIn, tokenOut, amountOut))
        const newReserveOut = this._tokenBalances[tokenOut].sub(amountOut)
        if (tokenIn === "WETH") {
            return newReserveIn.div(newReserveOut)
        }
        else if (tokenOut === "WETH") {
            return newReserveOut.div(newReserveIn)
        }
        else return;
    }
    // UniswapV2Router function
    quote(amountA: BigNumber, reserveA: BigNumber, reserveB: BigNumber): BigNumber {
        return amountA.mul(reserveB).div(reserveA);
    }
    
    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    getAmountIn(reserveIn: BigNumber, reserveOut: BigNumber, amountOut: BigNumber): BigNumber {
        const numerator = reserveIn.mul(amountOut).mul(1000);
        const denominator = reserveOut.sub(amountOut).mul(997);
        return numerator.div(denominator).add(1);
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    getAmountOut(reserveIn: BigNumber, reserveOut: BigNumber, amountIn: BigNumber): BigNumber {
        const amountInWithFee = amountIn.mul(997);
        const numerator = amountInWithFee.mul(reserveOut);
        const denominator = reserveIn.mul(1000).add(amountInWithFee);
        return numerator.div(denominator);
    }

    getAmountsIn(amountOut: BigNumber, path: Array<string>, allMarketPairs: Array<UniswapV2Pair>): Array<BigNumber> {
        if (path.length < 2) throw new Error("invalid path");
        const amounts = new Array<BigNumber>(path.length);
        amounts[amounts.length - 1] = amountOut

        for (let i = path.length - 1; i > 0; i--) {
            const pair = UniswapV2Pair.getUniswapMarketByTokenPair(path[i], path[i - 1], allMarketPairs)
            if (!pair) throw new Error()
            const reserveIn = pair._tokenBalances[path[i - 1]]
            const reserveOut = pair._tokenBalances[path[i]]
            amounts[i - 1] = this.getAmountIn(reserveIn, reserveOut, amountOut)
        }
        return amounts;
    }

    getAmountsOut(amountIn: BigNumber, path: Array<string>, allMarketPairs: Array<UniswapV2Pair>): Array<BigNumber> {
        if (path.length < 2) throw new Error("invalid path")
        const amounts = new Array<BigNumber>(path.length);
        amounts[0] = amountIn;
        for (let i = 0; i < path.length - 1; i++) {
            const pair = UniswapV2Pair.getUniswapMarketByTokenPair(path[i], path[i + 1], allMarketPairs)
            if (!pair) throw new Error()
            const reserveIn = pair._tokenBalances[path[i]]
            const reserveOut = pair._tokenBalances[path[i + 1]]
            amounts[i + 1] = this.getAmountOut(reserveIn, reserveOut, amountIn)
        }
        return amounts;
    }
}

