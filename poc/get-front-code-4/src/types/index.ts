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
  callLocation: string;
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
