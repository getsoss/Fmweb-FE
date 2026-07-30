# 평균거래단가


```python
# 평균거래단가 구하는 의사코드

# N: 일봉 개수. 1 이상의 양의 정수이며, 주로 600이다.

# S[i]: i번째 일자의 해당 투자자의 매도량. 0 또는 양의 정수다.

# B[i]: i번째 일자의 해당 투자자의 매수량. 0 또는 양의 정수다.

# C[i]: i번째 일자의 종가. 양의 정수다.

# adjust(A): 배열 A의 모든 0을 그 배열에서 처음 나오는 양수로 대체하는 함수다.
# e.g., adjust([0, 0, 2000, 2005, 2001.5])=[2000, 2000, 2000, 2005, 2001.5]

# 편의상, 아래 코드에서 어떤 수를 0으로 나눌 시 그 결과는 0으로 간주한다.

평균매수단가 = []
평균매도단가 = []
buyMoney = 0
buyVolume = 0
sellMoney = 0
sellVolume = 0

for i in range(N):
    netbuy = B[i] - S[i]
    money = C[i] * netbuy
    if netbuy > 0:
        buyVolume += netbuy
        buyMoney += money
    else:
        sellVolume += netbuy
        sellMoney += money
    평균매수단가.append(buyMoney / buyVolume)
    평균매도단가.append(sellMoney / sellVolume)

adjust(평균매수단가)
adjust(평균매도단가)
```

평균 거래 단가를 선택하면 차트에는 매수는 빨간 선, 매도는 파란 선으로 표시된다.

