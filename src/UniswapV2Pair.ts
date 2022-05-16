import * as _ from "lodash";
import { BigNumber, Contract, providers } from "ethers";
import { UNISWAP_PAIR_ABI, UNISWAP_QUERY_ABI } from "./abi";
import { WETH_ADDRESS, UNISWAP_LOOKUP_CONTRACT_ADDRESS } from "./addresses";
import { TokenBalances, UniswapMarket } from "./UniswapMarket";
import { UniswapV2Library } from "./UniswapV2Library";

const BATCH_COUNT_LIMIT = 100;
const UNISWAP_BATCH_SIZE = 1000;

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
                const uniswapV2Pair = new UniswapV2Pair(marketAddress, [pair[0], pair[1]], "");
                marketPairs.push(uniswapV2Pair);
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

    // static getUniswapMarketByAddress(allMarketPairs: Array<UniswapV2Pair>): MarketsByAddress {
    //     const marketsByAddress: MarketsByAddress = _.chain(allMarketPairs)
    //         .flatten()
    //         .keyBy(pair => pair.marketAddress)
    //         .value()
    //     return marketsByAddress;
    // }

    static getUniswapMarketByTokenPair(token0: string, token1: string, allMarketPairs: Array<UniswapV2Pair>): UniswapV2Pair {
        for (let i = 0; i < allMarketPairs.length; i++) {
            const pair = allMarketPairs[i]
            if (pair._tokens.includes(token0) && pair._tokens.includes(token1)) {
                return pair;
            }
        }
        throw new Error("market not found")
    }

    static getUniswapMarketsByPath(path: Array<string>, allMarketPairs: Array<UniswapV2Pair>): Array<UniswapV2Pair> {
        const marketsPairs = new Array<UniswapV2Pair>(path.length - 1)
        for (let i = 0; i < path.length - 1; i++) {
            const pair = this.getUniswapMarketByTokenPair(path[i], path[i + 1], allMarketPairs)
            marketsPairs.push(pair);
        }
        return marketsPairs;
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
        return UniswapV2Library.getAmountIn(reserveIn, reserveOut, amountOut);
    }
    
    getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber {
        const reserveIn = this._tokenBalances[tokenIn]
        const reserveOut = this._tokenBalances[tokenOut]
        return UniswapV2Library.getAmountOut(reserveIn, reserveOut, amountIn);
    }
    
    // always return the quote of token1 in term of token0 => amount of token1 per token0 => token0/token1
    getPrice(): BigNumber {
        return this._tokenBalances[1].div(this._tokenBalances[0]);
    }
    // always return the quote of token1 in term of token0 => amount of token1 per token0 => token0/token1
    // @param isSwapIn == true when exact tokenIn is specified; isSwapIn == false when exact tokenOut is sepcified
    afterSwapPrice(tokenIn: string, tokenOut: string, amount: BigNumber, isSwapIn: boolean): BigNumber {
        // confirm the maths
        let newReserveIn: BigNumber;
        let newReserveOut: BigNumber;
        if (isSwapIn) {
            newReserveIn = this._tokenBalances[tokenIn].add(amount.mul(997))
            newReserveOut =  this._tokenBalances[tokenOut].sub(this.getTokensOut(tokenIn, tokenOut, amount)) 
        }
        else {
            newReserveIn = this._tokenBalances[tokenIn].add(this.getTokensIn(tokenIn, tokenOut, amount))
            newReserveOut = this._tokenBalances[tokenOut].sub(amount)
        }
        if (this._tokens[0] === tokenIn) {
            return newReserveOut.div(newReserveIn)
        }
        else if (this._tokens[0] === tokenOut) {
            return newReserveIn.div(newReserveOut)
        }
        else {
            throw new Error("tokenIn can't be the same as tokenOut")
        }
    }

}

