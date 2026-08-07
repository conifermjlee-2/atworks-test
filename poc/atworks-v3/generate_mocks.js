const fs = require('fs');
const path = 'C:/Users/lee/Desktop/atworks-test/poc/atworks-v3/mock/';

let indexHtml = fs.readFileSync(path + 'index.html', 'utf8');

// Update select in indexHtml
indexHtml = indexHtml.replace(
  '<select class="bg-[#0e0f11] text-sm text-gray-200 px-3 py-2 border border-[#2a2b30] rounded-md focus:outline-none w-full shadow-sm appearance-none cursor-pointer">',
  '<select onchange="window.location.href=this.value" class="bg-[#0e0f11] text-sm text-gray-200 px-3 py-2 border border-[#2a2b30] rounded-md focus:outline-none w-full shadow-sm appearance-none cursor-pointer">'
);
indexHtml = indexHtml.replace('<option value="scenario">시나리오 with AI</option>', '<option value="index.html">시나리오 with AI</option>');
indexHtml = indexHtml.replace('<option value="test">API 테스트</option>', '<option value="api_test.html">API 테스트</option>');
indexHtml = indexHtml.replace('<option value="chaining">API 전이 (Chaining)</option>', '<option value="chaining.html">API 전이 (Chaining)</option>');
indexHtml = indexHtml.replace('<option value="flow">프론트 흐름 (Frontend Flow)</option>', '<option value="flow.html">프론트 흐름 (Frontend Flow)</option>');

// Make the browser test button click to browser_test.html
indexHtml = indexHtml.replace(
  '<button class="bg-green-600/90 hover:bg-green-500 text-white text-[11px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">\n              ▶️ 실제 브라우저 테스트 실행\n            </button>',
  '<a href="browser_test.html" class="bg-green-600/90 hover:bg-green-500 text-white text-[11px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">\n              ▶️ 실제 브라우저 테스트 실행\n            </a>'
);
// Replace the second one as well
indexHtml = indexHtml.replace(
  '<button class="bg-green-600/90 hover:bg-green-500 text-white text-[11px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">\n              ▶️ 실제 브라우저 테스트 실행\n            </button>',
  '<a href="browser_test.html" class="bg-green-600/90 hover:bg-green-500 text-white text-[11px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">\n              ▶️ 실제 브라우저 테스트 실행\n            </a>'
);

fs.writeFileSync(path + 'index.html', indexHtml, 'utf8');

// 1. browser_test.html
let browserHtml = indexHtml.replace('</body>', `
  <!-- Execution Modal -->
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
    <div class="bg-[#121316] border border-gray-700 w-[600px] rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div class="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1b1e]">
        <h3 class="text-white font-bold flex items-center gap-2"><span>▶️</span> 브라우저 테스트 자동 실행 중...</h3>
        <a href="index.html" class="text-gray-400 hover:text-white">✕</a>
      </div>
      <div class="p-4 h-[300px] overflow-y-auto font-mono text-xs text-gray-300 space-y-2 bg-black">
        <div class="text-gray-500">[System] Playwright 시작...</div>
        <div class="text-blue-400">Navigating to /products/prod-2</div>
        <div class="text-gray-400">Waiting for element .add-to-cart... found.</div>
        <div class="text-green-400">Clicking [장바구니 담기] button</div>
        <div class="text-orange-400">API Call detected: POST /api/cart -> 200 OK</div>
        <div class="text-gray-400">Waiting for element .checkout... found.</div>
        <div class="text-green-400">Clicking [결제하기] button</div>
        <div class="text-orange-400">API Call detected: POST /api/orders -> 200 OK</div>
        <div class="text-purple-400 font-bold mt-4">✨ 테스트 시나리오 성공적으로 완료됨 (Success)</div>
      </div>
    </div>
  </div>
</body>
`);
fs.writeFileSync(path + 'browser_test.html', browserHtml, 'utf8');

// 2. api_test.html
let apiHtml = indexHtml;
apiHtml = apiHtml.replace('<option value="api_test.html">API 테스트</option>', '<option value="api_test.html" selected>API 테스트</option>');
const mainAreaRegex = /<!-- Main Area -->([\s\S]*?)<\/body>/;
const apiTestMain = `<!-- Main Area -->
  <div class="flex-1 flex flex-col min-w-0 bg-[#0e0f11]">
    <div class="p-6 flex flex-col gap-4 h-full">
      <h2 class="text-white font-bold text-lg mb-2">API 테스트</h2>
      <div class="flex gap-2">
        <select class="bg-gray-800 text-green-400 font-bold px-4 py-2 rounded-md outline-none border border-gray-700">
          <option>GET</option>
          <option>POST</option>
        </select>
        <input type="text" class="flex-1 bg-[#16171a] border border-gray-700 rounded-md px-4 text-white outline-none focus:border-purple-500" value="http://localhost:3002/api/products" />
        <button class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-md">Send</button>
      </div>
      <div class="grid grid-cols-2 gap-4 flex-1 mt-4">
        <div class="bg-[#16171a] border border-gray-700 rounded-md p-4 flex flex-col h-full">
          <div class="text-gray-400 text-xs mb-2">Request Body (JSON)</div>
          <textarea class="flex-1 bg-[#0e0f11] text-gray-300 font-mono text-xs p-3 rounded outline-none resize-none border border-gray-800"></textarea>
        </div>
        <div class="bg-[#16171a] border border-gray-700 rounded-md p-4 flex flex-col h-full">
          <div class="text-gray-400 text-xs mb-2 flex justify-between"><span>Response</span><span class="text-green-400">Status: 200 OK</span></div>
          <textarea class="flex-1 bg-[#0e0f11] text-green-300 font-mono text-xs p-3 rounded outline-none resize-none border border-gray-800" readonly>
[
  {
    "id": "prod-1",
    "name": "프리미엄 무선 노이즈캔슬링 헤드폰 X1",
    "price": 349000
  },
  {
    "id": "prod-2",
    "name": "북유럽 감성 미니멀 스탠드 조명",
    "price": 89000
  }
]
          </textarea>
        </div>
      </div>
    </div>
  </div>
</body>`;
apiHtml = apiHtml.replace(mainAreaRegex, apiTestMain);
fs.writeFileSync(path + 'api_test.html', apiHtml, 'utf8');

// 3. chaining.html
let chainingHtml = indexHtml;
chainingHtml = chainingHtml.replace('<option value="chaining.html">API 전이 (Chaining)</option>', '<option value="chaining.html" selected>API 전이 (Chaining)</option>');
const chainingMain = `<!-- Main Area -->
  <div class="flex-1 flex flex-col min-w-0 bg-[#161719] p-6 overflow-auto">
    <div class="max-w-4xl mx-auto w-full">
      <h2 class="text-white font-bold text-lg mb-6 flex items-center gap-2"><span>🔗</span> API 전이 (Chaining) 분석결과</h2>
      
      <div class="bg-card border border-gray-700/50 rounded-xl p-5 shadow-lg relative">
        <div class="flex items-center gap-3 mb-4">
          <span class="bg-orange-900/30 text-orange-400 border border-orange-800/50 px-2 py-1 rounded text-xs font-bold">POST</span>
          <span class="text-white font-mono">/api/orders</span>
          <span class="text-gray-500 text-sm">결제 주문 생성</span>
        </div>
        
        <div class="pl-6 border-l-2 border-gray-700/50 ml-4 py-2 relative">
          <div class="absolute -left-[11px] top-4 bg-[#161719] p-1 rounded-full"><span class="text-gray-400 text-xs">🔄</span></div>
          <div class="text-purple-400 text-xs font-bold mb-1">onSuccess &rarr; invalidateQueries</div>
          <div class="text-gray-400 text-[11px] mb-3">React Query의 캐시 무효화로 인한 자동 재요청 발생</div>
          
          <div class="bg-[#202124] border border-gray-700/50 rounded-lg p-3">
            <div class="flex items-center gap-3">
              <span class="bg-green-900/30 text-green-400 border border-green-800/50 px-2 py-1 rounded text-[10px] font-bold">GET</span>
              <span class="text-gray-300 font-mono text-sm">/api/products</span>
              <span class="text-gray-500 text-xs">목록 최신화</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</body>`;
chainingHtml = chainingHtml.replace(mainAreaRegex, chainingMain);
fs.writeFileSync(path + 'chaining.html', chainingHtml, 'utf8');

console.log('Mock files generated successfully.');
