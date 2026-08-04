import { NextResponse } from 'next/server';
import { chromium, Browser } from 'playwright';
import fs from 'fs';
import path from 'path';
export async function POST(req: Request) {
  const { url, scenario } = await req.json();

  if (!url || !scenario) {
    return NextResponse.json({ error: 'Missing url or scenario' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendLog = async (type: 'info' | 'error' | 'success', message: string, data?: any) => {
    await writer.write(encoder.encode(JSON.stringify({ type, message, data }) + '\n'));
  };

  const sendVideo = async (videoUrl: string) => {
    await writer.write(encoder.encode(JSON.stringify({ type: 'video', url: videoUrl }) + '\n'));
  };

  (async () => {
    let browser: Browser | null = null;
    try {
      const videoDir = path.join(process.cwd(), 'public', 'videos');
      if (fs.existsSync(videoDir)) {
        const files = fs.readdirSync(videoDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(videoDir, file));
          } catch (e) {
            console.error(`Failed to delete old video: ${file}`, e);
          }
        }
      } else {
        fs.mkdirSync(videoDir, { recursive: true });
      }

      await sendLog('info', `브라우저를 시작합니다... 타겟: ${url}`);
      browser = await chromium.launch({ headless: false, slowMo: 1000 });
      const context = await browser.newContext({
        recordVideo: { dir: './public/videos' },
        viewport: { width: 1280, height: 720 }
      });
      const page = await context.newPage();
      
      const steps = scenario.flow || scenario.steps || scenario.actions || scenario.scenario || [];
      await sendLog('info', `총 ${steps.length}개의 스텝을 실행합니다.`);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepDesc = step.description || step.action || step.user_action || step.name || 
                         (step.type ? `[${step.type}] ${step.method || ''} ${step.endpoint || step.target || ''}`.trim() : JSON.stringify(step));
        const pagePath = step.page || step.screen;

        await sendLog('info', `[스텝 ${i + 1}/${steps.length}] ${stepDesc}`);

        // Navigate if needed
        if (i === 0 && pagePath) {
          const target = url.endsWith('/') ? url.slice(0, -1) : url;
          const fullUrl = pagePath.startsWith('/') ? `${target}${pagePath}` : `${target}/${pagePath}`;
          await sendLog('info', `페이지 이동: ${fullUrl}`);
          await page.goto(fullUrl, { waitUntil: 'networkidle' });
        } else if (pagePath) {
            const currentUrl = page.url();
            if (!currentUrl.includes(pagePath) && pagePath !== '/') {
                 const target = url.endsWith('/') ? url.slice(0, -1) : url;
                 const fullUrl = pagePath.startsWith('/') ? `${target}${pagePath}` : `${target}/${pagePath}`;
                 await sendLog('info', `페이지 강제 이동: ${fullUrl}`);
                 await page.goto(fullUrl, { waitUntil: 'networkidle' });
            }
        }

        // Extract DOM for AI
        await page.waitForTimeout(1000); // Wait for animations
        const html = await page.evaluate(() => {
          const clone = document.body.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('script, style, svg').forEach(el => el.remove());
          return clone.outerHTML;
        });

        const prompt = `
당신은 웹 자동화 테스트 에이전트입니다.
현재 페이지의 HTML 구조가 주어집니다.
다음 목표(목적)를 수행하기 위해 Playwright에서 실행할 액션을 JSON 배열로 반환하세요.
목표: ${stepDesc}

가능한 액션 종류:
- "click": 특정 요소를 클릭합니다. (selector 필요)
- "fill": 특정 입력란에 텍스트를 입력합니다. (selector, text 필요)
- "wait": 특별한 상호작용 없이 대기합니다. (페이지 진입 등 단순 확인 시)

응답 예시:
[
  { "action": "fill", "selector": "input[name='title']", "text": "테스트 게시글" },
  { "action": "click", "selector": "button[type='submit']" }
]
또는 (단순 페이지 진입인 경우)
[
  { "action": "wait" }
]

현재 HTML:
${html.substring(0, 50000)} // truncate to prevent token overflow
`;

        await sendLog('info', `AI에게 다음 액션을 질의 중...`);
        let textResponse = "[]";
        try {
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          const { exec } = await import('child_process');
          const util = await import('util');
          const execPromise = util.promisify(exec);

          const promptFile = path.join(os.tmpdir(), `prompt_exec_${Date.now()}_${i}.txt`);
          fs.writeFileSync(promptFile, prompt, 'utf-8');
          
          const agentApiBat = `"C:\\Users\\lee\\AppData\\Local\\agy\\bin\\agy.exe"`;
          const resultFile = path.join(os.tmpdir(), `result_exec_${Date.now()}_${i}.json`);
          
          const psScriptFile = path.join(os.tmpdir(), `run_exec_${Date.now()}_${i}.ps1`);
          const psScriptContent = `
$prompt = Get-Content -Raw -Path '${promptFile}'
& ${agentApiBat} --output-format json --print $prompt | Out-File -FilePath '${resultFile}' -Encoding utf8
`;
          fs.writeFileSync(psScriptFile, psScriptContent, 'utf-8');
          
          const psCommand = `powershell.exe -ExecutionPolicy Bypass -File "${psScriptFile}"`;
          await execPromise(psCommand);
          
          let stdout = fs.readFileSync(resultFile, 'utf8');
          if (stdout.charCodeAt(0) === 0xFEFF) stdout = stdout.slice(1);
          stdout = stdout.trim();
          
          // Clean up
          fs.unlinkSync(promptFile);
          fs.unlinkSync(psScriptFile);
          fs.unlinkSync(resultFile);
          
          const resultObj = JSON.parse(stdout);
          let aiOutput = '';
          if (resultObj.scenarios && resultObj.scenarios.length > 0 && typeof resultObj.scenarios[0].response === 'string') {
            aiOutput = resultObj.scenarios[0].response;
          } else if (typeof resultObj.response === 'string') {
            aiOutput = resultObj.response;
          } else if (resultObj.response) {
            aiOutput = resultObj.response.content || resultObj.response.text || JSON.stringify(resultObj.response);
          } else if (resultObj.content) {
            aiOutput = resultObj.content;
          } else {
            aiOutput = stdout;
          }
          
          if (typeof aiOutput === 'string') {
            textResponse = aiOutput.replace(/```json\n?/im, '').replace(/```\n?/im, '').trim();
          }
        } catch (apiErr: any) {
          throw new Error(`AI CLI 에러: ${apiErr.message}`);
        }
        let aiActions = [];
        try {
            // AI가 설명 텍스트와 함께 응답할 경우를 대비해 JSON 배열 부분만 추출
            const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
            const pureJsonString = jsonMatch ? jsonMatch[0] : textResponse;
            aiActions = JSON.parse(pureJsonString);
        } catch(e) {
            await sendLog('error', `AI 응답 파싱 실패: ${textResponse}`);
            continue;
        }

        if (aiActions.length === 0) {
            await sendLog('info', `AI가 수행할 액션이 없다고 판단했습니다 (또는 단순 대기).`);
        }

        for (const aiAction of aiActions) {
            if (aiAction.action === 'click') {
                await sendLog('info', `[Click] ${aiAction.selector}`);
                await page.click(aiAction.selector);
                await page.waitForTimeout(500);
            } else if (aiAction.action === 'fill') {
                await sendLog('info', `[Fill] ${aiAction.selector} -> "${aiAction.text}"`);
                await page.fill(aiAction.selector, aiAction.text);
                await page.waitForTimeout(500);
            } else if (aiAction.action === 'wait') {
                await sendLog('info', `[Wait] 대기 중...`);
                await page.waitForTimeout(1000);
            }
        }
      }

      await sendLog('success', '✅ 모든 시나리오 스텝 테스트 완료!');

      // Close to save video
      await context.close();
      
      const video = await page.video();
      if (video) {
        const videoPath = await video.path();
        const videoFileName = videoPath.split(/[\/\\]/).pop();
        await sendVideo(`/videos/${videoFileName}`);
      }

    } catch (err: any) {
      await sendLog('error', `오류 발생: ${err.message}`);
    } finally {
      if (browser) await browser.close();
      await writer.close();
    }
  })();

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
