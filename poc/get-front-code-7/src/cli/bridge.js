const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 진행 중인 요청을 들고 있을 저장소
const pendingRequests = new Map();

// 1. 웹(Next.js)에서 에이전트(채팅창)에게 분석을 요청하는 엔드포인트
app.post('/ask-agent', (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: '경로가 필요합니다.' });
  }

  const reqId = Date.now().toString();
  
  // 요청이 들어왔음을 콘솔에 출력 (이벤트 발생) -> 에이전트가 이를 감지함
  console.log(`\n[BRIDGE_EVENT] NEW_REQUEST: ${reqId} ${path}`);

  // 응답 객체를 저장하여 나중에 에이전트가 답을 주면 바로 응답할 수 있게 대기
  pendingRequests.set(reqId, res);

  // 타임아웃 처리 (에이전트가 너무 오래 답이 없으면 실패 처리)
  setTimeout(() => {
    if (pendingRequests.has(reqId)) {
      const pendingRes = pendingRequests.get(reqId);
      pendingRes.status(504).json({ error: '에이전트 응답 시간이 초과되었습니다.' });
      pendingRequests.delete(reqId);
    }
  }, 120000); // 2분 대기
});

// 2. 에이전트(채팅창)가 분석을 마치고 결과를 다시 웹(Next.js)으로 돌려주는 엔드포인트
app.post('/reply-agent', (req, res) => {
  const { id, scenarios, markdown } = req.body;
  
  if (!pendingRequests.has(id)) {
    return res.status(404).json({ error: '요청 ID를 찾을 수 없거나 이미 만료되었습니다.' });
  }

  const pendingRes = pendingRequests.get(id);
  
  // 에이전트가 준 결과 데이터를 웹 브라우저로 쏴줌
  pendingRes.status(200).json({ scenarios, markdown });
  
  pendingRequests.delete(id);
  console.log(`[BRIDGE_EVENT] COMPLETED: ${id}`);
  
  res.status(200).json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[BRIDGE_SERVER] Listening on port ${PORT}...`);
});
