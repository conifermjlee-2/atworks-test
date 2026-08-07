import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

async function generateScenarioWithGemini(promptText: string, staticReport: string, projectName: string, referenceLog: string): Promise<string> {
  const prompt = `주어진 프론트엔드 정적 분석 결과와 참조 로그를 바탕으로, 사용자의 아래 자연어 요청을 충족하는 단 하나의 QA 테스트 시나리오를 JSON 형식으로 작성해 주세요.

사용자 요청: "${promptText}"

[중요 지침]
- 반드시 아래 "JSON STRUCTURE TEMPLATE"과 정확히 일치하는 구조로 JSON 객체를 반환해 주세요. (가장 바깥쪽에 "scenario" 객체가 있어야 합니다.)
- "actions" 배열 안의 모든 객체는 기술적인 라우팅 필드와 사람이 읽기 쉬운 한국어 "description" 필드를 모두 포함해야 합니다.
- "type"은 'navigate', 'api_call', 'submit', 'click', 'fill' 중 하나여야 합니다.
- "type"이 'api_call'인 경우, "method" (예: GET, POST)와 "endpoint" (예: api/products)를 포함해 주세요.
- "type"이 'navigate' 또는 'submit'인 경우, "target" (예: /, /order)을 포함해 주세요.
- "type"이 'click'이나 'fill'인 경우(UI 직접 조작이 필요한 경우), "selector"를 포함하고 "fill"일 경우 "value"도 포함하세요.
- 사용자 요청 사항에 명시된 액션 흐름(예: 로그인 후, 장바구니 담고 결제)을 정적 분석 결과에 매핑하여, 어떤 페이지로 navigate하고 어떤 버튼을 click/submit 할지 논리적으로 조립해 주세요.

JSON STRUCTURE TEMPLATE:
{
  "scenario": {
    "id": "TC-PROMPT-001",
    "title": "사용자 맞춤형 시나리오",
    "description": "${promptText}",
    "page": "/",
    "actions": [
      {
        "type": "navigate",
        "target": "/",
        "description": "메인 페이지로 접속합니다."
      },
      {
        "type": "click",
        "selector": "button.login",
        "description": "로그인 버튼을 클릭합니다."
      }
    ],
    "expectedResult": "사용자 요청 동작 성공"
  }
}

분석할 데이터:
Project Name: ${projectName}
Static Report:
${staticReport}
Reference Log:
${referenceLog}

오직 완성된 JSON 코드 형식으로 응답해 주세요.`;

  try {
    const { execFile } = await import('child_process');
    const util = await import('util');
    const execFilePromise = util.promisify(execFile);
    // Use gemini CLI agent
    const agyPath = "C:\\Users\\lee\\AppData\\Local\\agy\\bin\\agy.exe";

    const tempFile = path.join(os.tmpdir(), `prompt_${crypto.randomUUID()}.txt`);
    fs.writeFileSync(tempFile, prompt, 'utf-8');

    const agentPrompt = `해당 파일(${tempFile})을 읽고 파일 안에 적힌 모든 지침에 따라 JSON을 생성해 주세요. 반드시 유효한 JSON 형식으로만 응답해야 합니다.`;

    console.log('[AgentAPI] prompt-scenario 생성을 위한 agy CLI 직접 실행 중...');
    let stdout;
    try {
      const result = await execFilePromise(agyPath, ['--print', agentPrompt], { maxBuffer: 10 * 1024 * 1024 });
      stdout = result.stdout;
    } finally {
      try { fs.unlinkSync(tempFile); } catch(e) {}
    }

    console.log(`✅ [AgentAPI] agy 응답 수신 성공! (길이: ${stdout.length}자)`);
    return stdout;
  } catch (error: any) {
    console.error('generateScenarioWithGemini CLI Error:', error);
    throw new Error(`API Execution Error: ${error.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, staticReport, projectName, referenceLog } = body;

    if (!prompt || !staticReport) {
      return NextResponse.json({ error: 'prompt and staticReport are required' }, { status: 400 });
    }

    const aiResult = await generateScenarioWithGemini(prompt, staticReport, projectName || 'Frontend Project', referenceLog || '');
    
    let parsed = null;
    let cleanedResult = aiResult;
    const firstMatch = aiResult.match(/[\{\[]/);
    if (firstMatch && firstMatch.index !== undefined) {
      const startIdx = firstMatch.index;
      const lastBrace = aiResult.lastIndexOf('}');
      const lastBracket = aiResult.lastIndexOf(']');
      const endIdx = Math.max(lastBrace, lastBracket);
      if (endIdx > startIdx) {
        cleanedResult = aiResult.substring(startIdx, endIdx + 1);
      }
    }
    
    const markdownMatch = cleanedResult.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (markdownMatch) {
      try { parsed = JSON.parse(markdownMatch[1].trim()); } catch(e) {}
    }
    
    if (!parsed) {
      try { parsed = JSON.parse(cleanedResult); } catch(e) {}
    }
    if (!parsed) {
      parsed = JSON.parse(aiResult);
    }
    
    // 템플릿에 맞춰 scenario 객체가 반환된다고 가정하지만, scenarios 배열로 반환될 수도 있음
    const scenario = parsed.scenario || (parsed.scenarios && parsed.scenarios[0]) || parsed;

    return NextResponse.json({ 
      scenario,
      rawOutput: aiResult 
    });
  } catch (error: any) {
    console.error("Failed to parse or generate Prompt AI JSON:", error);
    return NextResponse.json({ 
      error: error.message || 'AI did not return valid JSON'
    }, { status: 500 });
  }
}
