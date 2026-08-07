import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { scenario, userInstruction, referenceLog } = await req.json();

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario object is required' }, { status: 400 });
    }

    if (!userInstruction || typeof userInstruction !== 'string') {
      return NextResponse.json({ error: 'Valid user instruction is required' }, { status: 400 });
    }

    const currentFlow = Array.isArray(scenario.flow) 
      ? [...scenario.flow] 
      : Array.isArray(scenario.steps) 
      ? [...scenario.steps] 
      : Array.isArray(scenario.actions) 
      ? [...scenario.actions] 
      : [];

    let updatedFlow = [...currentFlow];
    let aiExplanation = '';

    const instruction = userInstruction.trim().toLowerCase();

    // 1. Check for Gemini API key if available for LLM inference
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const prompt = `You are an expert E2E Quality Assurance Engineer.
Modify the following E2E Scenario flow based on the User Instruction.

Current Scenario Title: ${scenario.title || 'Scenario'}
Current Scenario Flow: ${JSON.stringify(currentFlow, null, 2)}
Reference API Logs: ${referenceLog ? referenceLog.slice(0, 1000) : 'None'}

User Instruction: "${userInstruction}"

Respond ONLY with a valid JSON object matching this schema:
{
  "explanation": "Brief Korean explanation of changes made",
  "updatedTitle": "Updated scenario title if applicable",
  "updatedFlow": [
    {
      "action": "action name or description",
      "type": "click | fill | navigate | assert | api_call | exception",
      "target": "target selector or endpoint",
      "isAdded": true/false (true if this step is newly added),
      "isModified": true/false (true if this step was altered)
    }
  ]
}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const geminiData = await res.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed && parsed.updatedFlow) {
              return NextResponse.json({
                success: true,
                aiExplanation: parsed.explanation || '사용자의 지시사항에 따라 시나리오를 재구성했습니다.',
                updatedScenario: {
                  ...scenario,
                  title: parsed.updatedTitle || scenario.title,
                  flow: parsed.updatedFlow,
                  steps: parsed.updatedFlow,
                  actions: parsed.updatedFlow
                }
              });
            }
          }
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to rule-based engine:', geminiError);
      }
    }

    // 2. Rule-based Smart Fallback Engine (Reliable & Instant)
    if (instruction.includes('삭제') || instruction.includes('지워') || instruction.includes('remove') || instruction.includes('delete')) {
      if (updatedFlow.length > 1) {
        const removed = updatedFlow.pop();
        aiExplanation = `마지막 단계("${typeof removed === 'string' ? removed : (removed.description || removed.action || 'Step')}")를 삭제했습니다.`;
      } else {
        aiExplanation = `더 이상 삭제할 스텝이 없습니다.`;
      }
    } else if (instruction.includes('예외') || instruction.includes('실패') || instruction.includes('에러') || instruction.includes('fail') || instruction.includes('error') || instruction.includes('404') || instruction.includes('500') || instruction.includes('팝업') || instruction.includes('얼럿')) {
      const newStep = {
        action: `[예외 처리] ${userInstruction} - 경고 팝업 및 에러 메세지 검증`,
        description: `[예외 처리] ${userInstruction} - 경고 팝업 및 에러 메세지 검증`,
        type: 'exception',
        isAdded: true,
        apis: [
          { method: 'POST', endpoint: '/api/error-log', purpose: '예외 발생 로그 전송' }
        ]
      };
      
      // Insert in middle or at end
      const insertIdx = Math.max(1, Math.floor(updatedFlow.length / 2));
      updatedFlow.splice(insertIdx, 0, newStep);
      aiExplanation = `요청하신 예외 처리 단계("${userInstruction}")를 시나리오 ${insertIdx + 1}번째 스텝에 추가했습니다.`;
    } else if (instruction.includes('검증') || instruction.includes('assert') || instruction.includes('확인') || instruction.includes('강화')) {
      const newStep = {
        action: `[검증 강화] ${userInstruction} - API 응답 200 OK 및 UI 랜더링 조건 확인`,
        description: `[검증 강화] ${userInstruction} - API 응답 200 OK 및 UI 랜더링 조건 확인`,
        type: 'assert',
        isAdded: true
      };
      updatedFlow.push(newStep);
      aiExplanation = `시나리오 마지막 단계에 검증 강화 스텝("${userInstruction}")을 새로 추가했습니다.`;
    } else {
      // General step addition / modification
      const newStep = {
        action: `[AI 추가 스텝] ${userInstruction}`,
        description: `[AI 추가 스텝] ${userInstruction}`,
        type: 'action',
        isAdded: true
      };
      
      // Mark last step as modified
      if (updatedFlow.length > 0) {
        const lastStep = updatedFlow[updatedFlow.length - 1];
        if (typeof lastStep === 'object') {
          lastStep.isModified = true;
        }
      }
      
      updatedFlow.push(newStep);
      aiExplanation = `요청하신 지시사항("${userInstruction}")을 반영하여 새 행동 스텝을 추가했습니다.`;
    }

    return NextResponse.json({
      success: true,
      aiExplanation,
      updatedScenario: {
        ...scenario,
        title: scenario.title ? `${scenario.title} (AI 커스텀)` : 'AI 커스텀 시나리오',
        flow: updatedFlow,
        steps: updatedFlow,
        actions: updatedFlow
      }
    });

  } catch (error: any) {
    console.error('Error in edit-scenario route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
