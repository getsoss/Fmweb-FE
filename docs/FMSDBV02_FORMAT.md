# FMSDBV02 포맷 문서(미완성)


최초 작성일: 2026년 08월 13일 목요일

- DBConverter를 이용하여 FMSDBV01 DB를 가공하여 FMSDBV02로 만들 수 있다.
- FMSDBV02는 FMSDBV01에 있는 모든 테이블과 데이터를 상속한다.


## TABLE modifyfactor

- 종목별 날짜별 MF(Modify Factor)를 저장한다.
- MF는 수정주가가 적용되지 않은 데이터에 수정주가를 적용하기 위한 실수 값이다.
- 주가에 MF를 곱하면 수정주가가 되고, 거래량을 MF로 나누면 수정거래량이 된다. 거래량을 MF로 나눠야 하는 이유는 거래대금, 즉 주가 곱하기 거래량이 일정하게 유지되어야 하기 때문이다.
- FMSDBV01의 TABLE **opt10081**을 이용하여 MF를 구할 수 있다. 예를 들어, 날짜 내림차순(최근 날짜가 가장 앞에 오는 순서)으로 수정비율(COLUMN r)이 \[0, 0, 0, -30, 0, -40, 0\]이라면, MF는 \[1, 1, 1, 1, 0.7, 0.7, 0.42\] 이다.



### 테이블 이름: mpt10081_{jmcode}

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


