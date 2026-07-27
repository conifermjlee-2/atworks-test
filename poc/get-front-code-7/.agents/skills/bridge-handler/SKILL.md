---
name: 브릿지 이벤트 핸들러 (bridge-handler)
description: 브릿지 서버에서 [BRIDGE_EVENT] NEW_REQUEST 로그가 발생하면 자동으로 실행되어, 웹 화면의 요청을 처리하고 답변을 돌려보내는 스킬입니다.
---

# 브릿지 이벤트 핸들러 (bridge-handler)

당신은 백그라운드 태스크나 콘솔 로그에서 `[BRIDGE_EVENT] NEW_REQUEST: <reqId> <targetPath>` 형태의 메시지를 발견하면 즉시 이 스킬을 발동해야 합니다.

## 실행 절차

1. 로그에서 `<reqId>`와 `<targetPath>`를 파악합니다.
2. 터미널 명령(`run_command`)으로 정적 분석기를 실행합니다:
   \`\`\`bash
   npx tsx src/cli/extract-ast.ts "<targetPath>"
   \`\`\`
   (실행 위치: `C:\Users\lee\Desktop\atworks-test\poc\get-front-code-7`)
3. 분석기 출력(JSON)을 바탕으로, 기획서 v1.3 규격에 맞추어 **시나리오 리포트 마크다운(markdown)**을 추론/작성합니다.
4. JSON 형식의 응답 페이로드 객체를 만듭니다:
   \`\`\`json
   {
     "id": "<reqId>",
     "scenarios": [ JSON_IR_데이터_원본 ],
     "markdown": "생성된 마크다운 리포트 문자열"
   }
   \`\`\`
5. 해당 JSON 페이로드를 임시 파일(예: `tmp-reply.json`)로 쓴 다음, 아래 명령어로 브릿지 서버에 전송합니다:
   \`\`\`bash
   curl -X POST -H "Content-Type: application/json" -d @tmp-reply.json http://127.0.0.1:3001/reply-agent
   \`\`\`
6. 전송이 완료되면 `tmp-reply.json`을 삭제하고, 사용자(채팅창)에게 "요청하신 분석을 완료하여 웹 화면으로 전송했습니다!"라고 짧게 안내합니다. (마크다운 전체를 채팅창에 출력하지 마세요)

## 분석 규칙 (v1.3)
- IR 데이터에서 `route`를 최상위 그룹으로 묶어서 마크다운을 작성합니다.
- `navigatesTo`가 있는 경우 반드시 화살표(→) 표기로 이동 경로를 명시합니다.
- 문맥상 추론된 API나 흐름은 반드시 `(추정)` 표기를 붙입니다.
