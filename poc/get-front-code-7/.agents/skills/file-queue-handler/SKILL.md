---
name: 파일 큐 기반 에이전트 핸들러 (file-queue-handler)
description: waitForRequest.js 태스크가 완료되어 에이전트가 깨어났을 때 자동으로 분석을 수행하는 스킬입니다.
---

# 파일 큐 기반 에이전트 핸들러

당신은 백그라운드 태스크 `node waitForRequest.js`가 성공적으로 완료되었다는 메시지를 받으면, 사용자의 새로운 웹 요청이 들어왔음을 의미하므로 즉시 아래 절차를 수행해야 합니다.

## 실행 절차
1. `view_file` 툴을 사용해 최상단 디렉토리의 `tmp/tmp-request.json` 파일을 읽습니다. (내용: `{ "id": "...", "path": "...", "scenarios": [...] }`)
2. 웹 화면에 "로컬 LLM을 통한 비즈니스 시나리오 추론 중입니다..." 상태가 표시되도록 `write_to_file` 툴을 사용해 `tmp/tmp-status-<id>.txt` 파일에 해당 텍스트를 기록합니다.
3. `tmp/tmp-request.json` 파일을 삭제합니다 (`run_command`로 `Remove-Item tmp/tmp-request.json`).
4. 파일에서 추출한 `scenarios` (IR 데이터)를 분석합니다.
5. 기획서 v1.3 규격에 맞추어 **시나리오 리포트 마크다운(markdown)**을 추론/작성합니다.
6. JSON 데이터에 `(Server)` 접두사가 붙은 엔드포인트(예: `(Server) getProductsServer`)가 있다면, 이는 서버 컴포넌트의 MOCK API 호출이므로 **절대 무시하거나 삭제하지 말고 반드시 시나리오 리포트에 포함**시켜야 합니다.
7. JSON 형식의 응답 페이로드를 만듭니다. `aiScenarios` 배열을 반드시 생성하여 UI가 카드 형태로 렌더링할 수 있게 합니다:
   ```json
   {
     "scenarios": [ JSON_IR_데이터_원본 ],
     "markdown": "생성된 마크다운 리포트 문자열",
     "aiScenarios": [
       {
         "title": "시나리오 제목",
         "description": "시나리오 설명",
         "tags": ["#장바구니", "#주문"],
         "steps": [
           {
             "route": "/products/[id]",
             "flow": "POST api/cart ➞ POST api/orders",
             "description": "상품 상세 페이지에서 장바구니에 상품을 추가하고 주문합니다."
           }
         ]
       }
     ]
   }
   ```
8. 해당 JSON 문자열을 `tmp/tmp-reply-<id>.json` 파일로 작성합니다 (`write_to_file`).
9. 마지막으로, 다음 요청을 기다리기 위해 `run_command`로 `node waitForRequest.js`를 다시 백그라운드에 실행시킵니다.
10. 사용자 채팅창에는 "AI 시나리오 분석을 성공적으로 완료하여 화면에 띄웠습니다! 다음 요청을 대기합니다." 라고 안내합니다.
