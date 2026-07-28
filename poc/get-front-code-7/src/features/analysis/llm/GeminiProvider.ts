import { GoogleGenAI } from '@google/genai';
import { ILlmProvider } from './ILlmProvider';
import { ScenarioIR, ScenarioReport } from '../types';

export class GeminiProvider implements ILlmProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async inferScenarios(irList: ScenarioIR[]): Promise<ScenarioReport> {
    const prompt = `
당신은 프론트엔드 API 흐름 분석 전문가입니다.
아래 제공된 중간 표현(IR) 데이터를 분석하여 사람이 읽을 수 있는 비즈니스 시나리오 마크다운 문서를 작성하고, 끊어진 흐름(예: 커스텀 래퍼, 전역 상태를 통한 간접 호출)을 문맥상 추론하여 IR을 보완하세요.

[규칙]
1. 기존에 confidence가 "detected"인 항목은 절대 훼손하지 마세요. (단, 3번 예외 규칙 참조)
2. 당신이 문맥(변수명, 주석, 함수 구조 등)을 통해 유추하여 새롭게 찾아낸 호출이나 흐름은 confidence를 "inferred"로 설정하고, evidence에 추론 근거를 반드시 남기세요.
3. [예외 규칙] 만약 입력 IR에서 endpoint 값이 'QueryKey: unknown' 처럼 무의미한 초기화 코드라면 제외하세요. 단, '(Server)' 접두사가 붙은 서버 컴포넌트 유틸 함수(예: (Server) getProductsServer)는 MOCK 데이터이더라도 절대 제외하지 말고 그대로 리포트에 포함하세요.
4. **[엔드포인트 매핑]** 래퍼 함수는 실제 엔드포인트 URL로 매핑하되, 실제 URL이 없는 '(Server)' 관련 호출은 함수명 자체를 엔드포인트 대신 기재하세요.
5. **[공통 컴포넌트 처리]** Header 등 \`/공통(Shared)\` 라우트로 분류된 컴포넌트에서 발생하는 API 호출(예: 진입 시 장바구니 목록 조회 \`GET /api/cart\`)은 모든 화면에서 동작하므로, \`[ / ] 홈 화면\` 등 주요 페이지 시나리오의 '진입 시' 내역에도 포함하여 사용자가 인지할 수 있도록 작성하세요.
6. 마크다운 리포트(markdown) 출력과 더불어, 사용자 친화적인 UI를 위한 구조화된 배열 데이터를 \`aiScenarios\` 필드로 함께 제공하세요.

[aiScenarios 작성 지침]
- 사용자가 한눈에 비즈니스 시나리오를 이해할 수 있도록, 관련된 화면이나 흐름을 묶어 하나의 \`AIScenario\` 객체로 만드세요.
- 태그(\`tags\`)에는 관련된 화면이나 도메인을 해시태그 형식으로 2~3개 작성하세요. (예: ["#장바구니", "#주문", "#메인화면"])
- \`steps\` 에는 시나리오를 이루는 개별 스텝들을 정의하세요. 각 스텝은 라우트(\`route\`), API 흐름(\`flow\`, 예: "GET api/cart ➞ POST api/cart"), 그리고 상세 설명(\`description\`)을 가져야 합니다.

[마크다운 출력 포맷 지정]
반드시 'route'(경로)를 최상위 그룹으로 묶어서 아래 포맷으로 작성하세요. 
만약 navigatesTo 값이 있다면 화살표(→) 뒤에 명시하세요.

\`\`\`
[ /경로 ] 
- 트리거명 : (메서드) /엔드포인트 → (navigatesTo가 있을 경우) /이동할경로 로 이동

- /엔드포인트 : 한 줄 설명 (조건 등)
- /엔드포인트 (추정) : 한 줄 설명 (inferred인 경우 반드시 '(추정)' 표기)
\`\`\`
(예시)
[ /products/{id} ] 상품 상세 페이지
- 진입 시 : (GET) /api/products/{id}
- 담기 버튼 : (POST) /api/cart → /cart 로 이동 (추정)

- /api/products/{id} : 상품 상세 조회
- /api/cart : 장바구니에 상품 추가
- /cart (추정) : 장바구니 페이지로 이동 (LLM이 문맥상 추론)

4. 응답은 반드시 유효한 JSON 포맷이어야 하며, 아래 스키마를 엄격히 따르세요:
{
  "scenarios": [보완된 IR 배열],
  "markdown": "마크다운 리포트 텍스트 (이전 포맷 유지)",
  "aiScenarios": [
    {
      "title": "메인 화면에서 🛒 상품 추가 후 주문 시나리오",
      "description": "사용자가 메인 화면에서 상품을 장바구니에 추가한 뒤, 주문 페이지로 이동하여 최종 주문을 완료하는 과정",
      "tags": ["#장바구니", "#주문", "#메인화면"],
      "steps": [
        {
          "route": "/",
          "flow": "GET api/cart ➞ POST api/cart",
          "description": "메인 화면 로드 시 장바구니 정보를 조회하고..."
        }
      ]
    }
  ]
}

[입력 IR 데이터]
${JSON.stringify(irList, null, 2)}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("LLM returned empty response");
      }

      const parsed = JSON.parse(resultText) as ScenarioReport;
      return parsed;
    } catch (error) {
      console.error("Gemini 추론 중 오류 발생:", error);
      throw error;
    }
  }
}
