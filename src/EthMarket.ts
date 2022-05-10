import { BigNumber } from "ethers";

export interface TokenBalances {
    [tokenAddress: string]: BigNumber
}

export abstract class EthMarket {
    get marketAddress(): string {
        return this._marketAddress;
    }

    get tokens(): Array<string> {
        return this._tokens;
    }

    get protocol(): string {
        return this._protocol;
    }
    
    protected readonly _marketAddress: string;
    protected readonly _tokens: Array<string>;
    protected readonly _protocol: string;

    constructor(marketAddress: string, tokens: Array<string>, protocol: string) {
        this._marketAddress = marketAddress;
        this._tokens = tokens;
        this._protocol = protocol;
    }

    abstract getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber;

    abstract getTokensIn(tokenIn: string, tokenOut: string, amountOut: BigNumber): BigNumber;
}