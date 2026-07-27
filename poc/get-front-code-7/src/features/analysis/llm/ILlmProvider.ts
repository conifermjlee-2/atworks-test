import { ScenarioIR, ScenarioReport } from '../types';

export interface ILlmProvider {
  /**
   * AST로 추출된 IR 데이터를 프롬프트와 함께 전송하여 최종 시나리오를 추론합니다.
   * @param irList AST에서 추출된 중간 표현(IR) 목록
   * @returns 문맥이 추론/보완된 최종 시나리오 결과 객체
   */
  inferScenarios(irList: ScenarioIR[]): Promise<ScenarioReport>;
}
