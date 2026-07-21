# 🧪 조합(Combinations) 테스트 프로젝트

이 폴더는 `get-front-code-5` 프론트엔드 API 정적 분석기가 **5대 라이브러리(Fetch, Axios, React Query, SWR, RTK Query)**의 조합을 얼마나 완벽하게 분리하고 추출해 내는지 검증하기 위해 만들어졌습니다.

## 🎯 테스트 시나리오
분석기 대시보드에 현재 디렉토리 경로를 넣고 **[분석하기]**를 눌러주세요.

## 📊 예상 결과 (8개 파일)
1. **`Combo1_Base`**: (2개) Fetch, Axios
2. **`Combo2_ReactQuery`**: (3개) Fetch, Axios, React Query
3. **`Combo3_SWR`**: (3개) Fetch, Axios, SWR
4. **`Combo4_RTKQuery`**: (3개) Fetch, Axios, RTK Query
5. **`Combo5_RQ_SWR`**: (4개) Fetch, Axios, React Query, SWR
6. **`Combo6_RQ_RTK`**: (4개) Fetch, Axios, React Query, RTK Query
7. **`Combo7_SWR_RTK`**: (4개) Fetch, Axios, SWR, RTK Query
8. **`Combo8_All`**: (5개) Fetch, Axios, React Query, SWR, RTK Query

각 화면(View)마다 위 괄호 안에 적힌 개수만큼 뱃지가 정확히 나타난다면, 시스템의 코어 로직과 "책임 연쇄 패턴"이 100% 무결점으로 동작한다는 증거입니다!
