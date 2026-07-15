export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'UNKNOWN';

export type CallType = 'Client' | 'ServerComponent' | 'ServerAction' | 'Unknown';

export interface ApiCallInfo {
  method: HttpMethod;
  endpoint: string;
  isDynamic: boolean;
  rawUrl?: string; // 정규화 전 원본 URL
}

export interface MappingResult {
  file: string;         // 호출이 발생한 파일 경로
  viewName: string;     // 화면/라우트 이름 추정치
  callType: CallType;   // 호출 유형 (CSR, SSR 등)
  api: ApiCallInfo;     // 추출된 API 정보
  callLocation: string; // 호출 위치 (함수명이나 라인 번호)
}

export interface BaseAdapter {
  name: string;
  isMatch(): Promise<boolean>;
  getFilesToAnalyze(): Promise<string[]>;
  getCallType(filePath: string): CallType;
}

export interface AnalyzerConfig {
  rootDir: string;
  ignoreDomains?: string[];
  wrapperFunctions?: string[];
}
