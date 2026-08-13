# 세력모니터 웹 버전 SQLite DB 포맷 문서(미완성)


최초 작성일: 2026년 08월 13일 목요일

- [Windows용 세력모니터 프로그램의 DB format](DBFORMAT)을 개선하여 FMSDBV01 포맷을 정의한다. 
- FMSDBV01는 세력모니터 서버 DB의 버전 1 포맷(Force Monitor Server DataBase Version 01)이라는 의미이다.
- DB를 파일 형태로 저장할 시 가능하면 FMSDBV01.db 와 같은 이름을 사용한다.


## TABLE complete_tables


- 완성된 테이블의 이름을 저장한다.
- 한번 자료를 완벽하게 저장한 테이블을 지우고 다시 구성하는 비효율을 방지한다.

```sqlite
CREATE TABLE IF NOT EXISTS complete_tables ( n PRIMARY KEY ) ;
```

## TABLE opt10081


- 개별 종목의 일봉 차트 데이터다.
- 키움증권 Open API+에서 opt10081을 호출하여 얻을 수 있다.
- 수정주가가 적용되지 않았다.

```sqlite
CREATE TABLE opt10081 ( d, j, c, v, u, o, h, l, m, r, PRIMARY KEY (d, j) ) ;
```

| column | type   | desc.  |
| ------ | ------ | ------ |
| d      | int32  | 일자     |
| j      | string | 종목코드   |
| c      | int64  | 종가     |
| v      | int64  | 거래량    |
| u      | int64  | 거래대금   |
| o      | int64  | 시가     |
| h      | int64  | 고가     |
| l      | int64  | 저가     |
| m      | int64  | 수정주가구분 |
| r      | double | 수정비율   |


## TABLE opt20006


- 코스피와 코스닥의 지수 차트를 저장하기 위한 테이블이다.
- 키움증권 Open API+에서 opt20006을 호출하여 얻을 수 있다.

```sqlite
CREATE TABLE opt20006 ( d, p, c, v, u, o, h, l, PRIMARY KEY (d, p) ) ;
```

| column | type   | desc.                         |
| ------ | ------ | ----------------------------- |
| d      | int32  | 일자                            |
| p      | string | 업종코드(001: KOSPI, 101: KOSDAQ) |
| c      | int64  | 종가                            |
| v      | int64  | 거래량                           |
| u      | int64  | 거래대금                          |
| o      | int64  | 시가                            |
| h      | int64  | 고가                            |
| l      | int64  | 저가                            |

## TABLE opt10059

- 투자자별 매수/매도 거래량을 저장하기 위한 테이블이다.
- 거래량 단위는 1주다.
- 키움증권 Open API+에서 opt10059를 호출하여 얻을 수 있다.
- 수정주가가 적용되지 않았다.

```sqlite
CREATE TABLE opt10059 ( dat, jmcode, buysell, ind, fore, org, fin, ins, inv, ofin, bank, yun, priv, nation, oco, ne, PRIMARY KEY (dat, jmcode, buysell) ) ;
```

| column  | type   | desc.                      |
| ------- | ------ | -------------------------- |
| dat     | int32  | 일자                         |
| jmcode  | string | 종목코드                       |
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


## TABLE bojong


키움증권의 HTS(Home Trading System)인 Windows 프로그램 "영웅문4"를 실전투자 환경에서 접속하면 "\[1331\] 키움 보유종목통계 (종합)" 이라는 창을 띄울 수 있다. 그 창을 우클릭한 후 "Excel로 저장..." 버튼을 누르면 CSV 파일이 저장된다. 이를 이용하여 테이블을 만들 수 있다.


```sqlite
CREATE TABLE bojong ( d, j, r, n, a, p, PRIMARY KEY (d, j) ) ;
```

| column | type   | desc.   |
| ------ | ------ | ------- |
| d      | int32  | 일자      |
| j      | string | 종목코드    |
| r      | int64  | 보유순위    |
| n      | int64  | 보유계좌수   |
| a      | int64  | 보유평균매수가 |
| p      | double | 보유계좌수익률 |


## TABLE top

- 한 날짜당 정확히 200개의 row가 있다.
- 세력모니터 프로그램에서의 "고수관심도"는 데이터베이스 상의 "상위계좌수"를 의미한다.
- 키움증권 영웅문4의 "\[4196\] 수익률상위고객 매매 상세 현황 (통합)"에서 Excel로 저장 버튼을 눌러

```
매매 상세,,,현재가,,,,,매매내역,,,보유현황,,,
순위,종목코드,종목명,현재가,전일대비,,등락률,거래량,매수수량,매도수량,순매매수량,계좌수,수량,평균 매입가,수익률
```

와 같은 CSV 헤더를 얻을 수 있다.

```sqlite
CREATE TABLE top ( dat, jmcode, rank, buy, sell, net, nacc, qty, avg, pr, PRIMARY KEY (dat, jmcode) ) ;
```

| column | type   | desc.  |
| ------ | ------ | ------ |
| dat    | int32  | 일자     |
| jmcode | string | 종목코드   |
| rank   | int64  | 순위     |
| buy    | int64  | 매수수량   |
| sell   | int64  | 매도수량   |
| net    | int64  | 순매매수량  |
| nacc   | int64  | 계좌수    |
| qty    | int64  | 수량     |
| avg    | int64  | 평균 매입가 |
| pr     | double | 수익률    |


### 테이블 이름: opt10001

종목코드 TEXT PRIMARY KEY

종목명 TEXT

결산월 int

액면가 int

자본금 int

상장주식 int

유통주식 int

유통비율 real

상장일 int

### 테이블 이름: kospidaq

시장은 0일 경우 KOSPI, 10일 경우 KOSDAQ이다.

CREATE TABLE IF NOT EXISTS kospidaq(

종목코드 TEXT PRIMARY KEY,

시장 int

);

### 테이블 이름: others

CREATE TABLE IF NOT EXISTS others(

skey TEXT PRIMARY KEY,

svalue TEXT

);

skey=uploadtime, svalue={long DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}

## 세력모니터 Windows C# 클라이언트 측에서 추가로 만들 수 있는 tables

### 테이블 이름: datelength

- opt10081 tables를 이용하여 만든다.
- CREATE TABLE IF NOT EXISTS datelength(종목코드 TEXT PRIMARY KEY, ndate int);

### 테이블 이름: mpt10081_{jmcode}

- forcemonitor.db의 opt10081 table에 수정주가를 적용하고 가공한다.
- opt10081_{jmcode}를 가공하여 만든다.
- 날짜 내림차순으로 수정비율 [0, 0, 0, -30, 0, -40, 0]이라면 수정인수는 [1, 1, 1, 1, 0.7, 0.7, 0.42]이다.
- mpt10081 table을 이용해 주가에 수정인수를 곱하고, 거래량을 수정인수로 나누면 수정주가를 적용할 수 있다.
- CREATE TABLE IF NOT EXISTS mpt10081_{jmcode}(

일자 int PRIMARY KEY,

수정인수 real);

### 테이블 이름: mvgtradeprice_{jmcode}

- 🧡 mpt10081 table이 먼저 만들어진 상태여야만 이 table을 만들 수 있다.
- DB의 opt10081, opt10059 table에 mpt10081의 수정주가를 적용하고 가공한다.
- opt10081_{jmcode}, opt10059_{buy&sel}\_{jmcode}, mpt10081_{jmcode}를 가공하여 만든다.
- 날짜 내림차순으로 수정비율 [0, 0, 0, -30, 0, -40, 0]이라면 수정인수는 [1, 1, 1, 1, 0.7, 0.7, 0.42]이다.

```sql
CREATE TABLE IF NOT EXISTS mvgtradeprice_{jmcode}(
일자 int PRIMARY KEY,
개인투자자B real,
개인투자자S real,
외국인투자자B real,
외국인투자자S real,
기관계B real,
기관계S real,
금융투자B real,
금융투자S real,
보험B real,
보험S real,
투신B real,
투신S real,
기타금융B real,
기타금융S real,
은행B real,
은행S real,
연기금등B real,
연기금등S real,
사모펀드B real,
사모펀드S real,
국가B real,
국가S real,
기타법인B real,
기타법인S real,
내외국인B real,
내외국인S real);
```


