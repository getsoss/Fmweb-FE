# FMSDBV02 포맷 문서(미완성)


최초 작성일: 2026년 08월 13일 목요일

- DBConverter를 이용하여 FMSDBV01 DB를 가공하여 FMSDBV02로 만들 수 있다.
- FMSDBV02는 FMSDBV01에 있는 모든 테이블과 데이터를 상속한다.


## TABLE modifyfactor

- 종목별 날짜별 MF(Modify Factor)를 저장한다.
- MF는 수정주가가 적용되지 않은 데이터에 수정주가를 적용하기 위한 실수 값이다.
- 주가에 MF를 곱하면 수정주가가 되고, 거래량을 MF로 나누면 수정거래량이 된다. 거래량을 MF로 나눠야 하는 이유는 거래대금, 즉 주가 곱하기 거래량이 일정하게 유지되어야 하기 때문이다.
- FMSDBV01의 TABLE **opt10081**을 이용하여 MF를 구할 수 있다. 예를 들어, 날짜 내림차순(최근 날짜가 가장 앞에 오는 순서)으로 수정비율(COLUMN r)이 \[0, 0, 0, -30, 0, -40, 0\]이라면, MF는 \[1, 1, 1, 1, 0.7, 0.7, 0.42\] 이다.



```sqlite
CREATE TABLE modifyfactor( c, d, m, PRIMARY KEY(c,d) ) ;
```

| column | type   | desc.         |
| ------ | ------ | ------------- |
| c      | string | 종목코드          |
| d      | int32  | 일자            |
| m      | double | Modify Factor |

Modify Factor를 계산하는 의사 코드는 다음과 같다:

```python
for 종목코드 in opt10081의_모든_종목코드들:
	lis=[]
	modify_factor = 1
	execute("SELECT d,r FROM opt10081 WHERE j = 종목코드 ORDER BY d DESC ;")
	for row in rows:
		lis.append((row.d, modify_factor))
		modify_factor = modify_factor * (1 + (row.r / 100))

```


## TABLE avgtrdprc

- 세력모니터의 지표인 "평균거래단가"를 저장하는 테이블이다.
- 수정주가가 **적용되지 않았다**.
- TABLE **modifyfactor**, **opt10059**, **opt10081**를 이용하여 만든다.
- "평균거래단가"는 각 종목에 대해, 각 일자에 대해, 각 세력에 대해, 매수와 매도에 대해 int64 스칼라 값으로 정의된다.
- "평균거래단가"를 계산하는 의사 코드는 다음과 같다:



```python
# 모든 배열은 날짜 내림차순(최근 날짜가 가장 앞에 오는 순서)이다.
# 모든 배열은 zero-based index를 따른다.
# N: 일봉 개수. 1 이상의 양의 정수이다. 주로 600이다.
# S[i]: i번째 일자의 매도량.
# B[i]: i번째 일자의 매수량.
# C[i]: i번째 일자의 종가.
# 어떤 수를 0으로 나눌 시 그 나눗셈 계산 결과는 0으로 간주한다.


def adjust(A:배열):
    for i in range(1,N):
        if A[i]==0:
            A[i]=A[i-1]


평균매수단가 = []
평균매도단가 = []
buy_money = 0
buy_volume = 0
sell_money = 0
sell_volume = 0

for i in range(N-1, -1, -1): # [N-1, N-2, N-3, ..., 2, 1, 0]
    net_buy = abs(B[i]) - abs(S[i])
    money = abs(C[i]) * netbuy
    if net_buy > 0:
        buy_volume += net_buy
        buy_money += money
    else:
        sell_volume += net_buy
        sell_money += money
    평균매수단가.append(buy_money / buy_volume)
    평균매도단가.append(sell_money / sell_volume)

adjust(평균매수단가)
adjust(평균매도단가)
```



```sqlite
CREATE TABLE avgtrdprc ( jmcode, dat, buysell, ind, fore, org, fin, ins, inv, ofin, bank, yun, priv, nation, oco, ne, PRIMARY KEY (jmcode, dat, buysell) ) ;
```

| column  | type   | desc.                      |
| ------- | ------ | -------------------------- |
| jmcode  | string | 종목코드                       |
| dat     | int32  | 일자                         |
| buysell | int32  | 매수/매도 구분. 0이면 매수, 1이면 매도다. |
| ind     | int64  | 개인투자자                      |
| fore    | int64  | 외국인투자자                     |
| org     | int64  | 기관                         |
| fin     | int64  | 금융투자                       |
| ins     | int64  | 보험                         |
| inv     | int64  | 투신                         |
| ofin    | int64  | 기타금융                       |
| bank    | int64  | 은행                         |
| yun     | int64  | 연기금등                       |
| priv    | int64  | 사모펀드                       |
| nation  | int64  | 국가                         |
| oco     | int64  | 기타법인                       |
| ne      | int64  | 내외국인                       |

