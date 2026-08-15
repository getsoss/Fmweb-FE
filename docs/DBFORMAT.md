# 세력모니터 SQLite 데이터베이스 형식



## TABLE opt10081\_{jmcode}

```sqlite
CREATE TABLE opt10081_005930(일자 INT PRIMARY KEY,현재가 INT,거래량 INT,거래대금 INT,시가 INT,고가 INT,저가 INT,수정주가구분 INT,수정비율 REAL);
```

 - Kiwoom Open API+의 opt10081 : 주식일봉차트조회요청 을 호출하여 만든다. 시세는 KRX이며, 수정주가가 적용되지 않았다.
- "일자"는 항상 8자리 양의 정수이며, yyyyMMdd(4자리 년, 2자리 월, 2자리 일) 형식이다.
- "수정비율"은 double이며, 퍼센트(%) 단위이다. 0은 수정되지 않았음을 뜻한다.
- "수정주가구분"은 1:유상증자, 2:무상증자, 4:배당락, 8:액면분할, 16:액면병합, 32:기업합병, 64:감자, 256:권리락, -999999999999999:구분없음 을 뜻한다.
- 일자를 제외한 모든 INT column은 64비트 정수가 저장될 수 있다.


## TABLE opt20006\_{001|101}

```sqlite
CREATE TABLE opt20006_001(일자 INT PRIMARY KEY,현재가 INT,거래량 INT,거래대금 INT,시가 INT,고가 INT,저가 INT)
```

- Kiwoom Open API+의 opt20006 : 업종일봉조회요청 을 호출하여 만든다. 001은 KOSPI, 101은 KOSDAQ을 의미한다.


## TABLE opt10059\_{buy|sel}\_{jmcode}


```sqlite
CREATE TABLE opt10059_sel_000040(일자 INT PRIMARY KEY,개인투자자 INT,외국인투자자 INT,기관계 INT,금융투자 INT,보험 INT,투신 INT,기타금융 INT,은행 INT,연기금등 INT,사모펀드 INT,국가 INT,기타법인 INT,내외국인 INT);
```

- Kiwoom Open API+의 opt10059 : 종목별투자자기관별요청 을 호출하여 만든다. 1주 단위 수량으로 저장하며, buy는 매수량, sel은 매도량을 의미한다.

## TABLE bojong\_{yyyyMMdd}


```sqlite
CREATE TABLE bojong_20230703(종목코드 TEXT PRIMARY KEY,보유순위 INT,보유계좌수 INT,보유평균매수가 INT,보유계좌수익률 REAL);
```

- 각 table당 대략 3000개의 row가 있다.
- 키움증권의 HTS(Home Trading System)인 Windows 프로그램 "영웅문4"를 실전투자 환경에서 접속하면 "\[1331\] 키움 보유종목통계 (종합)" 이라는 창을 띄울 수 있다. 그 창을 마우스로 우클릭한 후 "Excel로 저장..." 버튼을 누르면 CSV 파일이 저장된다. 그 파일을 이용하여 table을 만들 수 있다.


## TABLE top\_{yyyyMMdd}

```sqlite
CREATE TABLE top_20220704(종목코드 TEXT PRIMARY KEY,상위순위 INT,상위매수수량 INT,상위매도수량 INT,상위순매매수량 INT,상위계좌수 INT,상위수량 INT,상위평균매입가 INT,상위수익률 REAL);
```

- 각 table당 정확히 200개의 row가 있다.
- 키움증권 영웅문4의 "\[4196\] 수익률상위고객 매매 상세 현황 (통합)"에서 Excel로 저장 버튼을 눌러 만들 수 있다.
- 세력모니터에서의 "고수관심도"는 column "상위계좌수"를 의미한다.

## TABLE opt10001

```sqlite
CREATE TABLE opt10001(종목코드 TEXT PRIMARY KEY,종목명 TEXT,결산월 INT,액면가 INT,자본금 INT,상장주식 INT,유통주식 INT,유통비율 REAL,상장일 INT);
```

- Kiwoom Open API+의 opt10001 : 주식기본정보요청 을 호출하여 만든다.
- opt10001로 받아온 유통 주식 수는 천 단위이며, TABLE opt10001에도 천 단위로 저장한다. 따라서 프로그램 상에서 정확한 유통 주식 수를 구하려면 column "유통주식"에 1000을 곱해줘야 한다.

## TABLE kospidaq

```sqlite
CREATE TABLE kospidaq(종목코드 TEXT PRIMARY KEY,시장 INT);
```

- 시장은 0일 경우 KOSPI, 10일 경우 KOSDAQ이다.

## TABLE others

```sqlite
CREATE TABLE others(skey TEXT PRIMARY KEY,svalue TEXT);
```

| skey       | svalue                                                 |
| ---------- | ------------------------------------------------------ |
| uploadtime | {int64 DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()} |


여기까지는 필수 원천 데이터를 담는 TABLE을 정의했다. 이 아래부터는 위에서 만든 TABLE들에 있는 정보만을 이용하여 추가로 만들 수 있는 TABLE들이다. SSH 서버에서 DB를 받아오고 Windows 세력모니터 클라이언트 측에서 DB를 가공하여 아래 테이블들을 만드는 것이 일반적이다.
---

## TABLE datelength

```sqlite
CREATE TABLE datelength(종목코드 TEXT PRIMARY KEY,ndate INT);
```

- TABLE opt10081 을 이용하여 만든다.
- Windows 세력모니터 프로그램에서는 이 TABLE이 필수다.

## TABLE mpt10081_{jmcode}


```sqlite
CREATE TABLE mpt10081_000020(일자 INT PRIMARY KEY,수정인수 REAL);
```

- TABLE opt10081 을 이용하여 만든다.
- 날짜 내림차순(가장 최근 날짜가 가장 앞에 오는 순서)으로 수정비율 \[0, 0, 0, -30, 0, -40, 0\]이라면 수정인수는 \[1, 1, 1, 1, 0.7, 0.7, 0.42\]이다.
- TABLE mpt10081 을 이용해 주가에 수정인수를 곱하고, 거래량을 수정인수로 나누면 수정주가를 적용할 수 있다.
- Windows 세력모니터 프로그램에서는 이 TABLE이 필수다.


## TABLE mvgtradeprice_{jmcode}

```sqlite
CREATE TABLE mvgtradeprice_000050(일자 INT PRIMARY KEY,개인투자자B REAL,개인투자자S REAL,외국인투자자B REAL,외국인투자자S REAL,기관계B REAL,기관계S REAL,금융투자B REAL,금융투자S REAL,보험B REAL,보험S REAL,투신B REAL,투신S REAL,기타금융B REAL,기타금융S REAL,은행B REAL,은행S REAL,연기금등B REAL,연기금등S REAL,사모펀드B REAL,사모펀드S REAL,국가B REAL,국가S REAL,기타법인B REAL,기타법인S REAL,내외국인B REAL,내외국인S REAL);
```
- TABLE opt10081, opt10059, mpt10081 을 이용하여 만든다. TABLE opt10081은 각 날짜의 종가를 받아오기 위해, opt10059는 각 날짜의 매수량과 매도량을 구하기 위해, mpt10081은 수정주가를 적용하기 위해 이용한다.
- 수정주가를 적용한다.
- B는 "평균매수단가", S는 "평균매도단가"를 의미한다.
- Windows 세력모니터 프로그램에서는 이 TABLE이 필수다.
