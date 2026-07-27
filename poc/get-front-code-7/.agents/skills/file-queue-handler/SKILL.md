---
name: 파일 큐 기반 에이전트 핸들러 (file-queue-handler)
description: waitForRequest.js 태스크가 완료되어 에이전트가 깨어났을 때 자동으로 분석을 수행하는 스킬입니다.
---

# 파일 큐 기반 에이전트 핸들러

당신은 백그라운드 태스크 `node waitForRequest.js`가 성공적으로 완료되었다는 메시지를 받으면, 사용자의 새로운 웹 요청이 들어왔음을 의미하므로 즉시 아래 절차를 수행해야 합니다.

## 실행 절차
1. `view_file` 툴을 사용해 최상단 디렉토리의 `tmp-request.json` 파일을 읽습니다. (내용: `{ "id": "...", "path": "..." }`)
2. 웹 화면에 "AST 파싱 및 정적 분석을 시작합니다..." 상태가 표시되도록 `write_to_file` 툴을 사용해 `tmp-status-<id>.txt` 파일에 해당 텍스트를 기록합니다.
3. `tmp-request.json` 파일을 삭제합니다 (`run_command`로 `Remove-Item tmp-request.json`).
4. 터미널 명령(`run_command`)으로 정적 분석기를 실행합니다:
   ```bash
   npx tsx src/cli/extract-ast.ts "<가져온 path>"
   ```
   (이때 동기적으로 끝나길 기다려야 하므로 WaitMsBeforeAsync 값을 넉넉히 10000 줍니다)
5. 백그라운드 태스크 로그나 출력을 통해 분석기 출력(JSON)을 확보합니다.
6. 웹 화면에 "로컬 LLM을 통한 비즈니스 시나리오 추론 중입니다..." 상태가 표시되도록 `tmp-status-<id>.txt` 파일에 해당 텍스트를 기록합니다.
7. 기획서 v1.3 규격에 맞추어 **시나리오 리포트 마크다운(markdown)**을 추론/작성합니다.
8. JSON 형식의 응답 페이로드를 만듭니다:
   \`\`\`json
   {
     "scenarios": [ JSON_IR_데이터_원본 ],
     "markdown": "생성된 마크다운 리포트 문자열"
   }
   \`\`\`
9. 해당 JSON 문자열을 `tmp-reply-<id>.json` 파일로 작성합니다 (`write_to_file`).
10. 마지막으로, 다음 요청을 기다리기 위해 `run_command`로 `node waitForRequest.js`를 다시 백그라운드에 실행시킵니다.
9. 사용자 채팅창에는 "웹 요청 분석을 성공적으로 완료하여 화면에 띄웠습니다! 다음 요청을 대기합니다." 라고 안내합니다.
