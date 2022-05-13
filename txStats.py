#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu May 12 16:07:48 2022

@author: alexlee
"""

import pandas as pd
import numpy as np
import json

f = open('txHistory.txt', 'r')
txHistory = json.loads(f.read())
f.close()

cols = ['functionName', 'tokenIn', 'tokenOut', 'amountIn', 'amountInMax', 'amountOut', 'amountOutMin', 'value']
dtypes = {'amountIn': 'float64', 'amountInMax': 'float64', 'amountOut': 'float64', 'amountOutMin': 'float64', 'value': 'float64'}
df = pd.DataFrame(txHistory, columns=cols)
df = df.astype(dtypes)
df.info()

conditions = [
    (df["functionName"] == "swapExactETHForTokens"),
    (df["functionName"] == "swapToeknsForExactETH"),
    (df["functionName"] == "swapExactTokensForETH"),
    (df["functionName"] == "swapETHForExactTokens")
    ]

values = [
    df["value"],
    df["amountOut"],
    df["amountOutMin"],
    df["value"]
    ]

df["ETH_value"] = np.select(conditions, values).astype('float64')
df.drop(['amountIn', 'amountInMax', 'amountOut', 'amountOutMin', 'value'], axis=1, inplace=True)

df.set_index("functionName", inplace=True)
df.sort_index(inplace=True)
percentage = np.count_nonzero((df["ETH_value"] > 2)) / df.shape[0]
df.to_excel("./txHistory.xlsx")
