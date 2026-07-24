import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const e2eScenarios = body.e2eScenarios;

    if (!e2eScenarios || e2eScenarios.length === 0) {
      return NextResponse.json({ error: 'No e2eScenario data provided' }, { status: 400 });
    }

    // AI에게 전달할 데이터 압축 (토큰 절약을 위해 불필요한 필드 제거)
    const promptData = e2eScenarios.map((j: any) => ({
      e2eScenarioId: j.e2eScenarioId,
      steps: j.steps.map((s: any) => ({
        route: s.route,
        apiCalls: s.scenarios.map((sc: any) => ({
          type: sc.triggerType,
          apis: sc.apiCalls.map((c: any) => `${c.method} ${c.endpoint}`),
          refetches: sc.triggersRefetch
        }))
      }))
    }));

    const prompt = `
다음은 쇼핑몰/웹 애플리케이션의 프론트엔드 E2E 화면 이동 및 API 호출 흐름(JSON)입니다.
이 흐름을 바탕으로, 화면별로 '어떤 API들이 호출되는지' 그 흐름(Flow)을 명확히 보여주고, 해당 동작이 비즈니스적으로 어떤 의미인지 1줄로 간결하게 요약해 주세요.

[제공된 데이터]
${JSON.stringify(promptData, null, 2)}

[출력 요구사항]
다음 JSON 포맷에 맞추어 응답을 작성해 주세요. 어떠한 마크다운 백틱(\`\`\`json)이나 추가 설명 없이 순수한 JSON 문자열만 반환해야 합니다.
{
  "scenarios": [
    {
      "e2eScenarioId": "입력받은 e2eScenarioId와 동일하게 유지",
      "title": "이모지가 포함된 직관적인 시나리오 제목 (예: 🛒 상품 탐색 및 주문 시나리오)",
      "summary": "이 시나리오의 전체 목적을 설명하는 1~2줄의 간결한 요약",
      "tags": ["장바구니", "주문", "상품조회" 등 핵심 키워드 배열],
      "steps": [
        {
          "route": "입력받은 route 값",
          "apiFlow": "해당 화면에서 발생하는 핵심 API 흐름 (예: GET /api/cart ➞ POST /api/orders). 없으면 'API 호출 없음'으로 작성",
          "description": "이 API 흐름이 비즈니스적으로 어떤 동작인지 핵심만 1줄로 요약 (예: 장바구니에 담긴 상품을 확인한 뒤, 주문 및 결제를 요청합니다.)"
        }
      ]
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('No response from AI');
    }
    
    // JSON 파싱 (간혹 포맷이 틀어질 수 있으므로 try-catch)
    const result = JSON.parse(text);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze with AI' }, { status: 500 });
  }
}
