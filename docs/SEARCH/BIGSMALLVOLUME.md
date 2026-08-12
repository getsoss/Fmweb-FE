
# 큰/작은 거래량

20260812 Wed 2107 최초 작성.

- 세력 무관
- 날짜 유관
- 점수 내림차순

Windows 세력모니터 프로그램의 SearchUserControl.xaml의 위에서 세 번째에 있는 버튼이다.

SearchUserControl.xaml.cs에 버튼의 동작이 정의되어 있다.

검색 일자 범위가 최소 10일이어야 한다.

"큰 거래량"의 점수 계산 식은 다음과 같다:

```python
volumes = (해당 날짜 범위의 거래량 중 0보다 큰 값들)

if len(volumes) < 5:
    return # volumes의 길이가 5보다 작으면 검색 결과에 노출시키지 않아야 한다.

latest_volume = (해당 날짜 범위에서 가장 최근에 위치한 0보다 큰 거래량)

# latest_volume이 volumes 중에서 몇 번째로 "큰가"?(작은 거래량일 경우 "작은가")
# 가장 크면 i=0, 두 번째로 크면 i=1, 세 번째로 크면 i=2, ...라고 하자.(작은 거래량일 경우 작은 순서로 i 지정)
if i >= 3:
    return # i가 3 이상일 경우 검색 결과에 노출시키지 않아야 한다.
    
score = (3 - i) * 100 + log2(2 + latest_volume) # 작은 거래량일 경우 log2(2 + latest_volume) 부분에 -1을 곱해준다.

```

