export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'UNKNOWN';

export type CallType = 'Client' | 'ServerComponent' | 'ServerAction' | 'Unknown';

export type ResolverName = 'fetch' | 'axios' | 'react-query' | 'swr' | 'rtk-query' | 'symbol-trace';

export interface ApiCallInfo {
  method: HttpMethod;
  endpoint: string;
  isDynamic: boolean;
  rawUrl?: string;
  resolver: ResolverName;
}

export interface MappingItem {
  file: string;
  viewName: string;
  callType: CallType;
  api: ApiCallInfo;
}

export interface FileError {
  file: string;
  message: string;
}

export interface MappingResult {
  targetPath: string;
  totalFiles: number;
  totalViews: number;
  totalApis: number;
  mappings: MappingItem[];
  errors: FileError[];
}

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  viewName: string;
  callType: CallType;
}
