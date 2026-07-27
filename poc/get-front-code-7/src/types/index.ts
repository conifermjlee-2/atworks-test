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
  /**
   * [화면별 시나리오 기능] 프레임워크별 라우트 진입점 식별 로직 (Optional)
   * - 이 메서드를 구현하면 3번째 탭(화면별 시나리오)이 활성화됩니다.
   * - 구현하지 않아도 기존 1번째(API 리스트), 2번째(시나리오) 탭은 정상 동작합니다.
   * @param files 어댑터가 반환한 전체 분석 대상 파일 목록 (절대경로)
   * @returns { routePath: 라우트 URL, filePath: 파일 절대경로 }[] 형태
   */
  getRouteEntryPoints?(files: string[]): { routePath: string; filePath: string }[];
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
  line?: number;
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
  /** 소스 상의 라인 넘버 */
  line?: number;
  /** 순서대로 정렬된 API 호출 목록 */
  apiCalls: ScenarioApiCall[];
  /** 이 시나리오 실행 후 무효화(refetch)되는 쿼리 키 목록 */
  triggersRefetch?: string[];
}
}

export interface RouteScenarioFlow {
  route: string;
  entryFile: string;
  files: string[];
  scenarios: ScenarioFlow[];
  /**
   * [E2E 시나리오] 이 라우트에서 다른 라우트로 연결되는 시나리오 항목 목록
   * - 비어있으면: 단독 화면 항목
   * - 원소가 있으면: 시나리오 항목 목록
   */
  e2eScenarios?: E2EScenario[];
}

/**
 * [E2E 시나리오]
 * 여러 화면을 넘나다니는 연속된 사용자 시나리오를 표현합니다.
 * 예: 홈 (➞) 상세 (➞) 장바구니 등록
 */
export interface E2EScenario {
  /** 시나리오 ID: 여러 라우트 경로를 '➞'로 연결한 문자열. 예: '/ ➞ /products/[id]' */
  e2eScenarioId: string;
  /** 시나리오를 구성하는 라우트 단계 목록 (순서대로) */
  steps: E2EStep[];
}

export interface E2EStep {
  /** 이 단계의 라우트 경로. 예: '/', '/products/[id]', '/checkout' */
  route: string;
  /** 이 단계에서 발생하는 API 시나리오 목록 */
  scenarios: ScenarioFlow[];
}
