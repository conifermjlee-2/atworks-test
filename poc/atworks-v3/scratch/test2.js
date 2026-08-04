const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const tempDir = path.join(os.tmpdir(), `agy-test-3`);
fs.mkdirSync(tempDir, { recursive: true });

const promptFile = path.join(tempDir, 'prompt.txt');
const resultFile = path.join(tempDir, 'result.json');
const scriptFile = path.join(tempDir, 'run.ps1');

const staticReport = `# 정적 분석 결과 (프론트엔드 화면 흐름)\n\n## 📱 앱: tmp-project-5-shopping-mall (.)\n\n### 화면 목록\n\n- \`/\` → \`src/app/page.tsx\`\n  - 컴포넌트: serverApi, HomeClient\n- \`/products/:id\` → \`src/app/products/[id]/page.tsx\`\n  - 컴포넌트: serverApi, ProductDetailClient\n- \`/order-complete\` → \`src/app/order-complete/page.tsx\`\n- \`/order\` → \`src/app/order/page.tsx\`\n  - 컴포넌트: Header, Modal, Spinner, api\n\n### 화면별 API/액션 상세\n\n#### / (page.tsx)\n\n**[사용자 액션 및 컴포넌트 이벤트]**\n- (component) → HomeClient\n  - API: GET api/products?{param} (line 23)\n  - API: GET api/cart (line 29)\n  - API: POST api/cart (line 35)\n  - API: POST api/orders (line 41)\n  - API: PUT api/cart (line 46)\n  - API: DELETE api/cart?productId={productId} (line 51)\n  - API: DELETE api/cart (line 56)\n\n---\n#### /products/:id (page.tsx)\n\n**[사용자 액션 및 컴포넌트 이벤트]**\n- (component) → ProductDetailClient\n  - API: GET api/products?{param} (line 23)\n  - API: GET api/cart (line 29)\n  - API: POST api/cart (line 35)\n  - API: POST api/orders (line 41)\n  - API: PUT api/cart (line 46)\n  - API: DELETE api/cart?productId={productId} (line 51)\n  - API: DELETE api/cart (line 56)\n\n---\n#### /order-complete (page.tsx)\n\n---\n#### /order (page.tsx)\n\n**[사용자 액션 및 컴포넌트 이벤트]**\n- onSubmit → handleFinalPayment\n- (component) → Header\n  - API: GET api/products?{param} (line 23)\n  - API: GET api/cart (line 29)\n  - API: POST api/cart (line 35)\n  - API: POST api/orders (line 41)\n  - API: PUT api/cart (line 46)\n  - API: DELETE api/cart?productId={productId} (line 51)\n  - API: DELETE api/cart (line 56)\n\n**[기타 페이지 이동]**\n- → /order-complete?orderId={orderId}&amount={totalAmount}&items={itemCount}\n\n---`;

const referenceLog = ``;

const prompt = `You are an automated code analysis bot. Your ONLY function is to parse the input data and output a JSON object describing QA testing scenarios.
You must output a raw JSON object with a "scenarios" key, containing an array of scenarios.
DO NOT use markdown formatting. DO NOT output conversational text. Output ONLY valid JSON.

Data to analyze:
Project Name: shopping-mall-next-js
Static Report:
${staticReport}
Reference Log:
${referenceLog}

Generate realistic QA scenarios based on the static report (e.g., navigating to /products/:id, adding to cart via api/cart). Include "title", "description", and a "flow" array for each scenario.
Output JSON only:`;

fs.writeFileSync(promptFile, prompt, 'utf8');

const psScript = `
$ErrorActionPreference = 'Stop'
[console]::InputEncoding = [System.Text.Encoding]::UTF8
[console]::OutputEncoding = [System.Text.Encoding]::UTF8

$prompt = Get-Content -Raw -Path '${promptFile}'

& agy --print $prompt *>&1 | Out-File -FilePath '${resultFile}' -Encoding utf8
`;
fs.writeFileSync(scriptFile, psScript, 'utf8');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`);
  
  let result = fs.readFileSync(resultFile, 'utf8').trim();
  console.log("--- RAW RESULT ---");
  console.log(result);
  
  // Try parsing
  let cleanedResult = result;
  const firstMatch = result.match(/[\{\[]/);
  if (firstMatch && firstMatch.index !== undefined) {
    const startIdx = firstMatch.index;
    const lastBrace = result.lastIndexOf('}');
    const lastBracket = result.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);
    if (endIdx > startIdx) {
      cleanedResult = result.substring(startIdx, endIdx + 1);
    }
  }

  const json = JSON.parse(cleanedResult);
  if (json.scenarios && json.scenarios.length > 0) {
      console.log("--- PARSED SUCCESSFULLY ---");
      console.log(JSON.stringify(json, null, 2).substring(0, 500) + '...');
  } else {
      console.log("NO SCENARIOS FOUND IN JSON");
  }

} catch (e) {
  console.log('Exec error:', e.message);
}
