// plan-v5.md 5장: 백엔드 API 응답 및 데이터 규격

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'UNKNOWN';

export type CallType = 'Client' | 'ServerComponent' | 'ServerAction' | 'Unknown';

export interface ApiCallInfo {
  method: HttpMethod;
  endpoint: string;
  isDynamic: boolean;
  rawUrl?: string;
  calleeName?: string; // 훅/심볼 식별용 (dedupe 키, 심볼 트레이싱용)
}

export interface MappingResult {
  file: string;
  viewName: string;
  callType: CallType;
  api: ApiCallInfo;
}

// plan-v5.md 2장 (1️⃣ 프레임워크 어댑터 레이어 인터페이스)
export interface BaseAdapter {
  name: string;
  isMatch(): Promise<boolean>;
  getFilesToAnalyze(): Promise<string[]>;
  getCallType(filePath: string): CallType;
}

// plan-v5.md 2장 (3️⃣ 플러그인 리졸버 레이어 인터페이스)
export interface HookResolver {
  name: string;
  /** RTK Query처럼 사전 학습이 필요한 Resolver만 구현 */
  init?: (rootDir: string) => Promise<void>;
  /** 성공 시 ApiCallInfo 반환, 미해당/실패 시 null 반환 (책임 연쇄 패턴) */
  resolve(calleeName: string, args: any[], ast?: any): ApiCallInfo | null;
}

export interface RtkHookDefinition {
  method: HttpMethod;
  urlPattern: string;
}

export type RtkHookMap = Map<string, RtkHookDefinition[]>;

// ── 시나리오 흐름 분석 타입 ─────────────────────────────────────

export interface ScenarioApiCall {
  order: number;
  method: string;
  endpoint: string;
}

export interface ScenarioFlow {
  /** 트리거 유형: 마운트 자동 호출 vs 이벤트(클릭/서밋 등) 수동 호출 */
  triggerType: 'MOUNT' | 'EVENT';
  /** 트리거 소스: useEffect, onClick, handlePayment 등 */
  triggerSource: string;
  /** 파일 경로 */
  file: string;
  /** 화면 이름 */
  viewName: string;
  /** 순서대로 정렬된 API 호출 목록 */
  apiCalls: ScenarioApiCall[];
  /** 이 시나리오 실행 후 무효화(refetch)되는 쿼리 키 목록 */
  triggersRefetch?: string[];
}

