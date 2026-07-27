import * as fs from 'fs';
import * as pathMod from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return new Response(JSON.stringify({ error: '분석할 경로를 제공해주세요.' }), { status: 400 });
  }

  const reqId = Date.now().toString();
  const reqFile = pathMod.resolve(process.cwd(), 'tmp-request.json');
  const statusFile = pathMod.resolve(process.cwd(), `tmp-status-${reqId}.txt`);
  const replyFile = pathMod.resolve(process.cwd(), `tmp-reply-${reqId}.json`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      try {
        // 1. 상태 메시지 전송 및 에이전트 깨우기
        sendEvent('progress', JSON.stringify({ message: 'IDE 에이전트에게 분석을 요청합니다...' }));
        fs.writeFileSync(reqFile, JSON.stringify({ id: reqId, path: targetPath }), 'utf8');

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
