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
3. [예외 규칙] 만약 입력 IR에서 endpoint 값이 'QueryKey: unknown' 처럼 실제 URL이나 식별 가능한 키가 아닌 무의미한 초기화 코드라면 시나리오 리포트 흐름에서 완전히 제외(무시)하세요.
4. 마크다운 리포트(markdown) 출력 시 반드시 아래의 지정된 포맷을 엄격하게 지키세요.

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

4. 응답은 반드시 유효한 JSON 포맷이어야 하며, 아래 스키마를 따르세요:
{
  "scenarios": [보완된 IR 배열],
  "markdown": "최종 마크다운 리포트 텍스트"
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
