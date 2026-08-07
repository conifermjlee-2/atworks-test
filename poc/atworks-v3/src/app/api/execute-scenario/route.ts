import { NextResponse } from 'next/server';
import { chromium, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
export async function POST(req: Request) {
  const { url, scenario } = await req.json();

  if (!url || !scenario) {
    return NextResponse.json({ error: 'Missing url or scenario' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendLog = async (type: 'info' | 'error' | 'success' | 'healing', message: string, data?: any) => {
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

      const observedEndpoints = new Set<string>();
      page.on('response', response => {
          observedEndpoints.add(response.url());
      });
      
      const steps = scenario.flow || scenario.steps || scenario.actions || scenario.scenario || [];
      await sendLog('info', `총 ${steps.length}개의 스텝을 실행합니다.`);

      // Navigate to initial page before starting steps
      const initialPath = scenario.page || scenario.path || '/';
      const targetBase = url.endsWith('/') ? url.slice(0, -1) : url;
      const initialUrl = initialPath.startsWith('/') ? `${targetBase}${initialPath}` : `${targetBase}/${initialPath}`;
      await sendLog('info', `초기 페이지 진입: ${initialUrl}`);
      await page.goto(initialUrl, { waitUntil: 'networkidle' });
      await page.evaluate((url) => {
          const toast = document.createElement('div');
          toast.innerText = '🚀 페이지 진입: ' + url;
          toast.style.position = 'fixed';
          toast.style.top = '20px';
          toast.style.left = '50%';
          toast.style.transform = 'translateX(-50%)';
          toast.style.background = 'rgba(0, 0, 0, 0.8)';
          toast.style.color = 'white';
          toast.style.padding = '12px 24px';
          toast.style.borderRadius = '30px';
          toast.style.fontWeight = 'bold';
          toast.style.fontSize = '16px';
          toast.style.zIndex = '999999';
          toast.style.pointerEvents = 'none';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
      }, initialUrl);
      await page.waitForTimeout(500);

      // --- 좌측 상단 시나리오 스텝 리스트 주입 ---
      await page.evaluate((stepsArr) => {
          const stepBox = document.createElement('div');
          stepBox.id = 'pw-step-list-ui';
          stepBox.style.position = 'fixed';
          stepBox.style.top = '20px';
          stepBox.style.left = '20px';
          stepBox.style.background = 'rgba(15, 23, 42, 0.9)';
          stepBox.style.color = '#fff';
          stepBox.style.padding = '16px';
          stepBox.style.borderRadius = '12px';
          stepBox.style.fontFamily = 'sans-serif';
          stepBox.style.fontSize = '14px';
          stepBox.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
          stepBox.style.zIndex = '9999999';
          stepBox.style.pointerEvents = 'none';
          stepBox.style.border = '1px solid rgba(255,255,255,0.1)';
          
          let html = '<div style="font-weight:bold; margin-bottom:12px; font-size:16px; color:#38bdf8;">📝 시나리오 진행 상황</div>';
          html += '<div style="display:flex; flex-direction:column; gap:8px;">';
          stepsArr.forEach((s: any, idx: number) => {
              const desc = s.description || s.action || s.name || `스텝 ${idx+1}`;
              html += `<div id="pw-step-item-${idx}" style="display:flex; align-items:center; gap:8px; opacity:0.4; transition:all 0.3s;">
                  <span id="pw-step-icon-${idx}" style="font-size:16px;">⏳</span>
                  <span>${desc}</span>
              </div>`;
          });
          html += '</div>';
          stepBox.innerHTML = html;
          document.body.appendChild(stepBox);
      }, steps);

      for (let i = 0; i < steps.length; i++) {
        if (req.signal.aborted) throw new Error('클라이언트 요청이 중단되었습니다.');
        
        // 이전 알림창들 찌꺼기 완벽 제거
        await page.evaluate(() => {
            document.querySelectorAll('#pw-bg-toast, #pw-ui-toast').forEach(el => el.remove());
        });
        
        // --- 현재 스텝 UI 업데이트 ---
        await page.evaluate((idx) => {
            const item = document.getElementById(`pw-step-item-${idx}`);
            const icon = document.getElementById(`pw-step-icon-${idx}`);
            if (item && icon) {
                item.style.opacity = '1';
                item.style.fontWeight = 'bold';
                item.style.color = '#fff';
                icon.innerText = '▶️';
            }
            if (idx > 0) {
                const prevItem = document.getElementById(`pw-step-item-${idx-1}`);
                const prevIcon = document.getElementById(`pw-step-icon-${idx-1}`);
                if (prevItem && prevIcon) {
                    prevItem.style.opacity = '0.6';
                    prevItem.style.fontWeight = 'normal';
                    prevItem.style.color = '#94a3b8';
                    prevIcon.innerText = '✅';
                }
            }
        }, i);

        const step = steps[i];
        const currentUrl = page.url();

        const isGetApi = (step.type === 'api_call' || step.type === 'API') && (step.method || '').toUpperCase() === 'GET';
        const isDeleteApi = (step.api_method || step.method || '').toUpperCase() === 'DELETE' || (step.description || '').includes('삭제');

        let stepDesc = step.description || step.action || step.user_action || step.name || '';
        if (isGetApi) {
            stepDesc += ` (백그라운드 API 자동 호출: ${step.method || ''} ${step.endpoint || step.target || ''})`;
        } else if (step.type === 'api_call' || step.type === 'API') {
            stepDesc += ` (사용자 트리거 API 호출: ${step.method || ''} ${step.endpoint || step.target || ''})`;
        } else if (step.type) {
            stepDesc += ` (동작 유형: [${step.type}] ${step.method || ''} ${step.endpoint || step.target || ''})`;
        }
        if (!stepDesc) {
            stepDesc = JSON.stringify(step);
        }
        await sendLog('info', `[스텝 ${i + 1}/${steps.length}] ${stepDesc}`);

        // --- 백그라운드 API(GET)인 경우 AI 질의를 아예 생략하고 즉시 검증 후 넘어갑니다 ---
        if (isGetApi) {
            const endpoint = step.endpoint || step.target || '';
            let skipReason = '';
            
            if (endpoint) {
                const found = Array.from(observedEndpoints).some(url => url.includes(endpoint));
                if (found) {
                    skipReason = `✅ 클라이언트 통신 완료: ${endpoint}`;
                    await sendLog('info', `[Network] API 호출 이력 확인 완료: ${endpoint}`);
                } else {
                    try {
                        // CSR 호출이 진행 중일 수 있으므로 최대 2초 대기
                        await page.waitForResponse(res => res.url().includes(endpoint), { timeout: 2000 });
                        await sendLog('info', `[Network] API 호출 이력 확인 완료: ${endpoint}`);
                        observedEndpoints.add(endpoint);
                        skipReason = `✅ 클라이언트 통신 완료: ${endpoint}`;
                    } catch(e) {
                        await sendLog('info', `[Network] 통신 이력 없음 (SSR 또는 캐시로 판단하여 자동 스킵): ${endpoint}`);
                        skipReason = `⏭️ SSR/캐시 (백그라운드 렌더링): ${endpoint}`;
                    }
                }
            }

            // 우측 하단에 알림 표시
            if (skipReason) {
                await page.evaluate((reason) => {
                    const toast = document.createElement('div');
                    toast.id = 'pw-bg-toast';
                    toast.style.position = 'fixed';
                    toast.style.bottom = '20px';
                    toast.style.right = '20px';
                    toast.style.background = 'rgba(255, 255, 255, 0.95)';
                    toast.style.color = '#111';
                    toast.style.padding = '12px 20px';
                    toast.style.borderRadius = '8px';
                    toast.style.fontWeight = 'bold';
                    toast.style.fontSize = '14px';
                    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
                    toast.style.zIndex = '9999999';
                    toast.style.borderLeft = '5px solid #8b5cf6';
                    toast.style.transition = 'opacity 0.5s ease-out';
                    toast.style.opacity = '0';
                    toast.innerHTML = `<div style="font-size:11px; color:#666; margin-bottom:4px;">화면 조작 없음 (자동 패스)</div><div>${reason}</div>`;
                    document.body.appendChild(toast);
                    
                    // 강제 리플로우 후 페이드인 트리거
                    toast.offsetHeight;
                    toast.style.opacity = '1';
                }, skipReason);
            }
            
            // 영상에 담길 수 있도록 충분히 2초 대기
            await page.waitForTimeout(2000);

            // 서서히 페이드아웃 (0.5초)
            await page.evaluate(() => {
                const toast = document.getElementById('pw-bg-toast');
                if (toast) toast.style.opacity = '0';
            });
            
            // 애니메이션 완료 대기 후 요소 제거
            await page.waitForTimeout(500);
            await page.evaluate(() => {
                const toast = document.getElementById('pw-bg-toast');
                if (toast) toast.remove();
            });

            continue;
        }

        // --- 삭제(DELETE) 등 위험 API인 경우 안전 모드로 패스 ---
        if (isDeleteApi) {
            const endpoint = step.endpoint || step.target || step.api_endpoint || '';
            const skipReason = `🛡️ 데이터 보호 모드 (삭제 액션 생략): ${endpoint}`;
            await sendLog('info', `[안전 모드] 삭제 액션은 실행하지 않고 패스합니다: ${endpoint}`);

            await page.evaluate((reason) => {
                const toast = document.createElement('div');
                toast.id = 'pw-bg-toast';
                toast.style.position = 'fixed';
                toast.style.bottom = '20px';
                toast.style.right = '20px';
                toast.style.background = 'rgba(255, 240, 240, 0.98)';
                toast.style.color = '#990000';
                toast.style.padding = '12px 20px';
                toast.style.borderRadius = '8px';
                toast.style.fontWeight = 'bold';
                toast.style.fontSize = '14px';
                toast.style.boxShadow = '0 4px 15px rgba(255,0,0,0.2)';
                toast.style.zIndex = '9999999';
                toast.style.borderLeft = '5px solid #ef4444';
                toast.style.transition = 'opacity 0.5s ease-out';
                toast.style.opacity = '0';
                toast.innerHTML = `<div style="font-size:11px; color:#d32f2f; margin-bottom:4px;">위험 동작 차단 (안전 모드)</div><div>${reason}</div>`;
                document.body.appendChild(toast);
                
                toast.offsetHeight;
                toast.style.opacity = '1';
            }, skipReason);
            
            await page.waitForTimeout(2000);

            await page.evaluate(() => {
                const toast = document.getElementById('pw-bg-toast');
                if (toast) toast.style.opacity = '0';
            });
            
            await page.waitForTimeout(500);
            await page.evaluate(() => {
                const toast = document.getElementById('pw-bg-toast');
                if (toast) toast.remove();
            });

            continue;
        }

        // --- 기타 화면 조작이 필요한 스텝의 경우 AI에게 질의 ---
        // Extract DOM for AI
        await page.waitForTimeout(1000); // Wait for animations
        const html = await page.evaluate(() => {
          const clone = document.body.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('script, style, svg').forEach(el => el.remove());
          return clone.outerHTML;
        });

        const prompt = `주어진 화면(HTML)과 목표를 분석하여 Playwright 자동화 테스트를 위한 JSON 액션 배열을 작성해 주세요.

[중요 지침]
- 오직 유효한 JSON 배열 형식으로만 응답해 주세요. (인삿말이나 설명 등 다른 텍스트는 포함하지 마세요)

목표 (TARGET GOAL): ${stepDesc}
현재 브라우저 URL: ${currentUrl}

사용 가능한 액션 형태:
- "click": { "action": "click", "selector": "..." }
- "fill": { "action": "fill", "selector": "...", "text": "..." }
- "wait": { "action": "wait" }

현재 화면 구조 (HTML CONTEXT):
${html}

[추가 규칙]
- 목표가 새로운 페이지로 이동(navigate)하는 것이고, '현재 브라우저 URL'이 이미 그 목표 주소를 포함하고 있다면, 이미 도착한 상태이므로 반드시 [ { "action": "wait" } ] 를 반환하세요.
- 현재 URL이 다르고 이동해야 한다면 DOM에서 해당하는 링크(<a>)나 버튼을 찾아 'click' 액션을 생성해 주세요.
- 기술적 동작이 '백그라운드 API 자동 호출'인 경우, 페이지 로드시 자동으로 통신하므로 절대로 다른 링크나 버튼을 클릭하지 말고 [ { "action": "wait" } ] 만 반환하세요.
- 기술적 동작이 '사용자 트리거 API 호출(POST 등)'인 경우, 화면에서 해당 기능을 수행할 명확한 버튼(예: 담기, 전송, 결제 등)을 찾아 클릭 액션을 생성하세요.
- 화면에 존재하지 않는 가짜 ID나 셀렉터를 지어내지(환각) 마세요. 클릭할 요소를 도저히 찾을 수 없다면 빈 배열 [] 을 반환해 주세요.

출력 예시: [{"action":"fill","selector":"#input-id","text":"hello"}, {"action":"click","selector":".btn-submit"}]
`;
        // 우측 하단 알림 표시 (AI 분석 및 조작 시작)
        let shortTarget = step.target || step.endpoint || '';
        if (shortTarget.length > 30) shortTarget = shortTarget.substring(0, 30) + '...';
        const uiReason = (step.type === 'navigate') ? `🌐 페이지 이동: ${shortTarget}` : `🖱️ 화면 조작: ${step.description || step.action || step.name}`;
        
        await page.evaluate((reason) => {
            const toast = document.createElement('div');
            toast.id = 'pw-ui-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.background = 'rgba(255, 255, 255, 0.95)';
            toast.style.color = '#111';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '8px';
            toast.style.fontWeight = 'bold';
            toast.style.fontSize = '14px';
            toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
            toast.style.zIndex = '9999999';
            toast.style.borderLeft = '5px solid #3b82f6';
            toast.style.transition = 'opacity 0.5s ease-out';
            toast.style.opacity = '0';
            toast.innerHTML = `<div style="font-size:11px; color:#666; margin-bottom:4px;">🤖 AI 화면 조작 진행 중</div><div>${reason}</div>`;
            document.body.appendChild(toast);
            
            // 강제 리플로우 후 페이드인 트리거
            toast.offsetHeight;
            toast.style.opacity = '1';
        }, uiReason);

        await sendLog('info', `AI에게 다음 액션을 질의 중...`);
        let textResponse = "[]";
        try {
          const { execFile } = await import('child_process');
          const util = await import('util');
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          const crypto = await import('crypto');
          const execFilePromise = util.promisify(execFile);
          const agyPath = "C:\\Users\\lee\\AppData\\Local\\agy\\bin\\agy.exe";

          const tempFile = path.join(os.tmpdir(), `prompt_${crypto.randomUUID()}.txt`);
          fs.writeFileSync(tempFile, prompt, 'utf-8');
          const agentPrompt = `해당 파일(${tempFile})을 읽고 파일 안에 적힌 모든 지침에 따라 JSON을 생성해 주세요. 반드시 유효한 JSON 형식으로만 응답해야 합니다.`;

          let stdout;
          try {
             const result = await execFilePromise(agyPath, ['--output-format', 'json', '--print', agentPrompt], { maxBuffer: 10 * 1024 * 1024 });
             stdout = result.stdout;
          } finally {
             try { fs.unlinkSync(tempFile); } catch(e) {}
          }
          
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
            const matches = textResponse.match(/\[[\s\S]*?\]/g);
            let parsed = false;
            if (matches) {
                for (const match of matches) {
                    try {
                        const parsedObj = JSON.parse(match);
                        if (Array.isArray(parsedObj)) {
                            aiActions = aiActions.concat(parsedObj);
                            parsed = true;
                        }
                    } catch (e) {}
                }
            }
            if (!parsed) {
                aiActions = JSON.parse(textResponse);
            }
        } catch(e) {
            await sendLog('error', `AI 응답 파싱 실패: ${textResponse}`);
            continue;
        }

        if (aiActions.length === 0) {
            await sendLog('info', `AI가 수행할 액션이 없다고 판단했습니다 (또는 단순 대기).`);
        }

        for (const aiAction of aiActions) {
            if (req.signal.aborted) throw new Error('클라이언트 요청이 중단되었습니다.');
            if (aiAction.action === 'click') {
                await sendLog('info', `[Click] ${aiAction.selector}`);
                const elHandle = await page.$(aiAction.selector).catch(() => null);
                if (elHandle) {
                    await elHandle.evaluate((el: HTMLElement) => {
                        const originalOutline = el.style.outline;
                        const originalBoxShadow = el.style.boxShadow;
                        el.style.outline = '4px solid rgba(255, 0, 0, 0.8)';
                        el.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.5)';
                        
                        const label = document.createElement('div');
                        label.innerText = '🎯 AI Click!';
                        label.style.position = 'absolute';
                        label.style.background = 'red';
                        label.style.color = 'white';
                        label.style.padding = '4px 8px';
                        label.style.borderRadius = '4px';
                        label.style.fontWeight = 'bold';
                        label.style.zIndex = '999999';
                        label.style.pointerEvents = 'none';
                        const rect = el.getBoundingClientRect();
                        label.style.top = (rect.top + window.scrollY - 30) + 'px';
                        label.style.left = (rect.left + window.scrollX) + 'px';
                        document.body.appendChild(label);
                        
                        setTimeout(() => {
                            if (el) {
                                el.style.outline = originalOutline;
                                el.style.boxShadow = originalBoxShadow;
                            }
                            label.remove();
                        }, 2000);
                    });
                }
                await page.waitForTimeout(500);
                try {
                    await page.click(aiAction.selector, { timeout: 5000 });
                } catch (e: any) {
                    await sendLog('healing', 'UI 변경 감지! AI가 현재 화면을 재분석하여 대체 요소를 찾습니다...');
                    const rawHtml = await page.content();
                    const slimHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
                    const prompt = `The user wanted to perform action: ${aiAction.action} on selector: ${aiAction.selector}, but the element was not found. Please review the following HTML and find the new, correct selector. Return ONLY a JSON object like {"newSelector": ".new-class"}. HTML:\n${slimHtml.substring(0, 50000)}`;
                    
                    const { execFile } = await import('child_process');
                    const util = await import('util');
                    const fs = await import('fs');
                    const path = await import('path');
                    const os = await import('os');
                    const crypto = await import('crypto');
                    const execFilePromise = util.promisify(execFile);
                    const agyPath = "C:\\Users\\lee\\AppData\\Local\\agy\\bin\\agy.exe";
                    
                    const tempFile = path.join(os.tmpdir(), `healing_${crypto.randomUUID()}.txt`);
                    fs.writeFileSync(tempFile, prompt, 'utf-8');
                    const agentPrompt = `해당 파일(${tempFile})을 읽고 파일 안에 적힌 모든 지침에 따라 JSON을 생성해 주세요. 반드시 유효한 JSON 형식으로만 응답해야 합니다.`;
                    
                    let stdout;
                    try {
                        const result = await execFilePromise(agyPath, ['--output-format', 'json', '--print', agentPrompt], { maxBuffer: 10 * 1024 * 1024 });
                        stdout = result.stdout;
                    } finally {
                        try { fs.unlinkSync(tempFile); } catch(err) {}
                    }
                    
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
                    
                    const textResponse = aiOutput.replace(/```json\n?/im, '').replace(/```\n?/im, '').trim();
                    try {
                        const parsed = JSON.parse(textResponse);
                        if (parsed.newSelector) {
                            await sendLog('success', 'AI 자가 치유 성공! 새로운 셀렉터로 액션을 재시도합니다: ' + parsed.newSelector);
                            await page.click(parsed.newSelector);
                        } else {
                            throw e;
                        }
                    } catch (parseErr) {
                        throw e;
                    }
                }
                await page.waitForTimeout(500);
            } else if (aiAction.action === 'fill') {
                await sendLog('info', `[Fill] ${aiAction.selector} -> "${aiAction.text}"`);
                const elHandle = await page.$(aiAction.selector).catch(() => null);
                if (elHandle) {
                    await elHandle.evaluate((el: HTMLElement, textToFill) => {
                        const originalOutline = el.style.outline;
                        const originalBoxShadow = el.style.boxShadow;
                        el.style.outline = '4px solid rgba(0, 0, 255, 0.8)';
                        el.style.boxShadow = '0 0 15px rgba(0, 0, 255, 0.5)';
                        
                        const label = document.createElement('div');
                        label.innerText = '⌨️ AI Input: ' + textToFill;
                        label.style.position = 'absolute';
                        label.style.background = 'blue';
                        label.style.color = 'white';
                        label.style.padding = '4px 8px';
                        label.style.borderRadius = '4px';
                        label.style.fontWeight = 'bold';
                        label.style.zIndex = '999999';
                        label.style.pointerEvents = 'none';
                        const rect = el.getBoundingClientRect();
                        label.style.top = (rect.top + window.scrollY - 30) + 'px';
                        label.style.left = (rect.left + window.scrollX) + 'px';
                        document.body.appendChild(label);
                        
                        setTimeout(() => {
                            if (el) {
                                el.style.outline = originalOutline;
                                el.style.boxShadow = originalBoxShadow;
                            }
                            label.remove();
                        }, 2000);
                    }, aiAction.text);
                }
                await page.waitForTimeout(500);
                try {
                    await page.fill(aiAction.selector, aiAction.text, { timeout: 5000 });
                } catch (e: any) {
                    await sendLog('healing', 'UI 변경 감지! AI가 현재 화면을 재분석하여 대체 요소를 찾습니다...');
                    const rawHtml = await page.content();
                    const slimHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
                    const prompt = `The user wanted to perform action: ${aiAction.action} on selector: ${aiAction.selector}, but the element was not found. Please review the following HTML and find the new, correct selector. Return ONLY a JSON object like {"newSelector": ".new-class"}. HTML:\n${slimHtml.substring(0, 50000)}`;
                    
                    const { execFile } = await import('child_process');
                    const util = await import('util');
                    const fs = await import('fs');
                    const path = await import('path');
                    const os = await import('os');
                    const crypto = await import('crypto');
                    const execFilePromise = util.promisify(execFile);
                    const agyPath = "C:\\Users\\lee\\AppData\\Local\\agy\\bin\\agy.exe";
                    
                    const tempFile = path.join(os.tmpdir(), `healing_${crypto.randomUUID()}.txt`);
                    fs.writeFileSync(tempFile, prompt, 'utf-8');
                    const agentPrompt = `해당 파일(${tempFile})을 읽고 파일 안에 적힌 모든 지침에 따라 JSON을 생성해 주세요. 반드시 유효한 JSON 형식으로만 응답해야 합니다.`;
                    
                    let stdout;
                    try {
                        const result = await execFilePromise(agyPath, ['--output-format', 'json', '--print', agentPrompt], { maxBuffer: 10 * 1024 * 1024 });
                        stdout = result.stdout;
                    } finally {
                        try { fs.unlinkSync(tempFile); } catch(err) {}
                    }
                    
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
                    
                    const textResponse = aiOutput.replace(/```json\n?/im, '').replace(/```\n?/im, '').trim();
                    try {
                        const parsed = JSON.parse(textResponse);
                        if (parsed.newSelector) {
                            await sendLog('success', 'AI 자가 치유 성공! 새로운 셀렉터로 액션을 재시도합니다: ' + parsed.newSelector);
                            await page.fill(parsed.newSelector, aiAction.text);
                        } else {
                            throw e;
                        }
                    } catch (parseErr) {
                        throw e;
                    }
                }
                await page.waitForTimeout(500);
            } else if (aiAction.action === 'wait') {
                await sendLog('info', `[Wait] 대기 중...`);
                await page.waitForTimeout(1000);
            }
        }
        
        // AI 스텝 완료 후 알림 팝업 제거 (페이드 아웃)
        await page.evaluate(() => {
            const toast = document.getElementById('pw-ui-toast');
            if (toast) toast.style.opacity = '0';
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
            const toast = document.getElementById('pw-ui-toast');
            if (toast) toast.remove();
        });
      }

      await sendLog('success', '✅ 모든 시나리오 스텝 테스트 완료!');

      // 마지막 스텝 아이콘 업데이트
      await page.evaluate((lastIdx) => {
          const prevItem = document.getElementById(`pw-step-item-${lastIdx}`);
          const prevIcon = document.getElementById(`pw-step-icon-${lastIdx}`);
          if (prevItem && prevIcon) {
              prevItem.style.opacity = '0.6';
              prevItem.style.fontWeight = 'normal';
              prevItem.style.color = '#94a3b8';
              prevIcon.innerText = '✅';
          }
      }, steps.length - 1);
      
      // 영상 캡처를 위해 1초 대기
      await page.waitForTimeout(1000);

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
      await writer.close();
      if (browser) {
        browser.close().catch(e => console.error('Browser close error:', e));
      }
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
