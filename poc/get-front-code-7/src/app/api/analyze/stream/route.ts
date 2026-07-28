import * as fs from 'fs';
import * as pathMod from 'path';

export async function POST(request: Request) {
  let requestData;
  try {
    requestData = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: '유효한 JSON 페이로드를 제공해주세요.' }), { status: 400 });
  }

  const { path: targetPath, scenarios } = requestData;

  if (!targetPath || !scenarios) {
    return new Response(JSON.stringify({ error: '분석할 경로(path)와 IR 데이터(scenarios)를 모두 제공해주세요.' }), { status: 400 });
  }

  const reqId = Date.now().toString();
  const reqFile = pathMod.resolve(process.cwd(), 'tmp', 'tmp-request.json');
  const statusFile = pathMod.resolve(process.cwd(), 'tmp', `tmp-status-${reqId}.txt`);
  const replyFile = pathMod.resolve(process.cwd(), 'tmp', `tmp-reply-${reqId}.json`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      try {
        // 1. 상태 메시지 전송 및 에이전트 깨우기
        sendEvent('progress', JSON.stringify({ message: 'IDE 에이전트에게 AI 시나리오 작성을 요청합니다...' }));
        
        // 에이전트에게 IR 데이터 전달
        fs.writeFileSync(reqFile, JSON.stringify({ id: reqId, path: targetPath, scenarios }), 'utf8');
        fs.writeFileSync(pathMod.resolve(process.cwd(), 'tmp', 'tmp-latest-req.txt'), reqId, 'utf8');

        // 2. 에이전트의 상태 업데이트(tmp-status) 및 완료(tmp-reply) 파일 폴링 대기
        let attempts = 0;
        let lastStatus = '';

        const pollInterval = setInterval(() => {
          attempts++;

          // 상태 변경 감지
          if (fs.existsSync(statusFile)) {
            const currentStatus = fs.readFileSync(statusFile, 'utf8').trim();
            if (currentStatus !== lastStatus && currentStatus.length > 0) {
              lastStatus = currentStatus;
              sendEvent('progress', JSON.stringify({ message: currentStatus }));
            }
          }

          // 최종 답변 감지
          if (fs.existsSync(replyFile)) {
            clearInterval(pollInterval);
            const replyData = fs.readFileSync(replyFile, 'utf8');
            
            // 파일 정리
            try { fs.unlinkSync(replyFile); } catch (e) {}
            try { fs.unlinkSync(statusFile); } catch (e) {}
            
            try {
              // SSE 전송 시 줄바꿈이 들어가면 페이로드가 깨지므로 한 줄로 직렬화
              const singleLineData = JSON.stringify(JSON.parse(replyData));
              sendEvent('complete', singleLineData);
            } catch (err) {
              sendEvent('complete', replyData.replace(/\r?\n/g, ''));
            }
            
            controller.close();
            return;
          }

          if (attempts >= 120 * 2) { // 2분 제한 (0.5초 간격 * 240)
            clearInterval(pollInterval);
            sendEvent('error', JSON.stringify({ message: '에이전트 응답 시간이 초과되었습니다.' }));
            controller.close();
          }
        }, 500); // 0.5초마다 파일 체크

        // 클라이언트가 연결을 끊으면 타이머 정리
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
        });

      } catch (err: any) {
        sendEvent('error', JSON.stringify({ message: err.message || '스트리밍 서버 오류' }));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
