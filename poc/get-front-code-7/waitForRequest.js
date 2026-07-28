const fs = require('fs');

console.log('[WATCHER] 웹 요청을 기다리는 중...');

const interval = setInterval(() => {
  if (fs.existsSync('tmp/tmp-request.json')) {
    console.log('[WATCHER] 새 요청을 발견했습니다! 에이전트를 깨웁니다!');
    clearInterval(interval);
    process.exit(0); // 태스크 종료 -> IDE가 에이전트를 깨움!
  }
}, 1000);
