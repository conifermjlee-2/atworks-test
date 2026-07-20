// 기획서 9.1절: API JSON 응답 규격

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'UNKNOWN';

export type CallType = 'Client' | 'ServerComponent' | 'ServerAction' | 'Unknown';

export interface ApiCallInfo {
  method: HttpMethod;
  endpoint: string;
  isDynamic: boolean;
  rawUrl?: string;
}

export interface MappingResult {
  file: string;
  viewName: string;
  callType: CallType;
  api: ApiCallInfo;
}

// 기획서 4절: Adapter 레이어 인터페이스
export interface BaseAdapter {
  name: string;
  isMatch(): Promise<boolean>;
  getFilesToAnalyze(): Promise<string[]>;
  getCallType(filePath: string): CallType;
}

// 기획서 6절: Resolver(Plugin) 레이어 인터페이스
export interface HookResolver {
  name: string;
  /** RTK Query처럼 사전 학습이 필요한 Resolver만 구현 */
  init?: (rootDir: string) => Promise<void>;
  /** 성공 시 ApiCallInfo 반환, 미해당/실패 시 null 반환 (Chain of Responsibility) */
  resolve(node: any, importAliasMap: Map<string, string>): ApiCallInfo | null;
}
