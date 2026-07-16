import * as t from '@babel/types';
import { ApiCallInfo } from '../../types';

export interface HookResolver {
  /**
   * 플러그인 초기화 (프로젝트 로드 시 1회 실행)
   * RTK Query 처럼 사전 스캔이 필요한 경우 여기서 처리
   */
  init?(rootDir: string): Promise<void>;

  /**
   * AST 노드를 분석하여 API 호출 정보를 추출합니다.
   * 처리할 수 없는 패턴이면 null을 반환합니다.
   */
  resolve(calleeName: string, args: Array<t.Node | null>): ApiCallInfo | null;
}
