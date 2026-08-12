# 연속 매수/매도 종목

20260812 마지막 수정.

- 세력 유관
- 날짜 유관
- 점수 내림차순

Windows 세력모니터 프로그램의 SearchUserControl.xaml의 위에서 두 번째에 있는 버튼이다.

SearchUserControl.xaml.cs에 버튼의 동작이 정의되어 있다.

매수와 매도 모두 점수가 0보다 클 경우 검색 결과에 노출된다.

"연속 매수 종목"의 점수를 계산하는 의사 코드는 다음과 같다:

```python
score = 0
have_begin = 0
have_end = 0

for i in (모든 선택한 세력들):
    have_begin += (시작 날짜의 HAVE)
    have_end += (끝 날짜의 HAVE)

if have_begin >= have_end: # 매도일 경우 부등호 방향 반대
    score = -1 # 향후 계산과 관계없이 검색 결과에서 무조건 제외시킨다.
    return

for i in (모든 선택한 세력들):
    for d in (모든 선택한 날짜들):
        if abs(세력 i의 날짜 d에서의 DIRECTION) >= 70: # -70% 이하 혹은 70% 이상
            score += (세력 i의 날짜 d에서의 POWER * DIRECTION)

# 매도일 경우 score에 -1을 곱한다.
        
```



