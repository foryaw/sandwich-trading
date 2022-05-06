import * as _ from "lodash";
import { UNISWAP_PAIR_ABI, UNISWAP_QUERY_ABI } from "./abi";
import { WETH_ADDRESS, UNISWAP_LOOKUP_CONTRACT_ADDRESS } from "./addresses";
import { BigNumber, Contract, providers } from "ethers";
import { EthMarket, TokenBalances } from "./EthMarket";

const BATCH_COUNT_LIMIT = 100;
const UNISWAP_BATCH_SIZE = 1000;

// Not necessary, slightly speeds up loading initialization when we know tokens are bad
// Estimate gas will ensure we aren't submitting bad bundles, but bad tokens waste time
const blacklistTokens = [
    '0xD75EA151a61d06868E31F8988D28DFE5E9df57B4'
  ]

export class UniswapV2EthPair extends EthMarket {
    private _tokenBalances: TokenBalances;

    constructor(marketAddress: string, tokens: Array<string>, protocol: string) {
        super(marketAddress, tokens, protocol);
        // tokens = [token1, token2]
        this._tokenBalances = _.zipObject(tokens,[BigNumber.from(0), BigNumber.from(0)])
    }

    receiveDirectly(tokenAddress: string): boolean {
        return tokenAddress in this._tokenBalances;
    }

    static async getUniswapMarkets(provider: providers.BaseProvider, factoryAddress: string): Promise<Array<UniswapV2EthPair>> {
        // LOOKUP CONTRACT is the UniswapFlashQuery
        const uniswapQuery = new Contract(UNISWAP_LOOKUP_CONTRACT_ADDRESS, UNISWAP_QUERY_ABI, provider);

        let marketPairs = new Array<UniswapV2EthPair>()
        for (let i = 0; i < BATCH_COUNT_LIMIT * UNISWAP_BATCH_SIZE; i += UNISWAP_BATCH_SIZE) {
            const pairs: Array<Array<string>> = (await uniswapQuery.functions.getPairByIndexRange(factoryAddress, i, i + UNISWAP_BATCH_SIZE));
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
                    const uniswapV2EthPair = new UniswapV2EthPair(marketAddress, [pair[0], pair[1]], "");
                    marketPairs.push(uniswapV2EthPair);
                }
            }
            if (pairs.length < UNISWAP_BATCH_SIZE) {
                break;
            }
        }
        return marketPairs;
    }

    static async updateReserves(provider: providers.BaseProvider, allMarketPairs: Array<UniswapV2EthPair>): Promise<void> {
        const uniswapQuery = new Contract(UNISWAP_LOOKUP_CONTRACT_ADDRESS, UNISWAP_QUERY_ABI, provider);
        const pairAddresses = allMarketPairs.map(marketPair => marketPair.marketAddress);
        console.log("Updating markets, count:", pairAddresses.length);
        const reserves: Array<Array<BigNumber>> = (await uniswapQuery.functions.getReservesByPairs(pairAddresses))
        for (let i = 0; i < allMarketPairs.length; i++) {
            const marketPair = allMarketPairs[i];
            const reserve = reserves[i];
            marketPair._setReservesViaOrderedBalances([reserve[0], reserve[1]]);
        }
    }

    static getMarketAddresses(allMarketPairs: Array<UniswapV2EthPair>): Array<string> {
        let marketAddresses = new Array<string>()
        for (let i = 0; i < allMarketPairs.length; i++) {
            const marketAddress = allMarketPairs[i].marketAddress;
            marketAddresses.push(marketAddress);
        }
        return marketAddresses;
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
        return this._getAmountIn(reserveIn, reserveOut, amountOut);
    }
    
    getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber {
        const reserveIn = this._tokenBalances[tokenIn]
        const reserveOut = this._tokenBalances[tokenOut]
        return this._getAmountOut(reserveIn, reserveOut, amountIn);
    }
    
    estimatePriceAfterSwapIn(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber {
        const newReserveIn = this._tokenBalances[tokenIn].sub(amountIn.mul(997));
        const newReserveOut = this._tokenBalances[tokenOut].sub(this.getTokensOut(tokenIn, tokenOut, amountIn));
        if (tokenIn === WETH_ADDRESS) {
            return newReserveOut.div(newReserveIn)
        }
    }
    // UniswapV2Router01 function

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    _getAmountIn(reserveIn: BigNumber, reserveOut: BigNumber, amountOut: BigNumber): BigNumber {
        const numerator: BigNumber = reserveIn.mul(amountOut).mul(1000);
        const denominator: BigNumber = reserveOut.sub(amountOut).mul(997);
        return numerator.div(denominator).add(1);
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    _getAmountOut(reserveIn: BigNumber, reserveOut: BigNumber, amountIn: BigNumber): BigNumber {
        const amountInWithFee: BigNumber = amountIn.mul(997);
        const numerator = amountInWithFee.mul(reserveOut);
        const denominator = reserveIn.mul(1000).add(amountInWithFee);
        return numerator.div(denominator);
    }


}

