# RS (Relative Strength)


KOSPI 종목이면 KOSPI 지수, KOSDAQ 종목이면 KOSDAQ 지수를 기준으로 RS를 계산한다.

C(i): i번째 날의 해당 종목의 종가. 0번째 날이 최초이다.

M(i): i번째 날의 지수 종가.

R(i): i번째 날의 RS.

$$ R(i) := { C(i) \over C(0) }
\div { M(i) \over M(0) } $$



R(i)는 0 이상의 실수이다. 1이면 지수 추종, 1보다 작으면 종목이 시장보다 약세, 1보다 크면 종목이 시장보다 강세다.

