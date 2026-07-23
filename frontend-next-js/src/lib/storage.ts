import fs from 'fs';
import path from 'path';

export interface ApiRule {
  fieldPath: string;
  operator: string;
  expectedValue: string;
  valueType: string;
  logicalOperator: string;
}

export interface ApiRegistryData {
  id: string;
  name: string;
  description: string;
  group: string;
  url: string;
  method: string;
  rules: ApiRule[];
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'apis.json');

// 디렉터리 및 파일 초기화
const ensureStorageExists = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([]), 'utf-8');
  }
};

export const getApis = (): ApiRegistryData[] => {
  ensureStorageExists();
  try {
    const rawData = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Failed to read APIs:', error);
    return [];
  }
};

export const saveApi = (apiData: Omit<ApiRegistryData, 'id' | 'createdAt'>): ApiRegistryData => {
  const apis = getApis();
  const newApi: ApiRegistryData = {
    ...apiData,
    id: `api_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  apis.push(newApi);
  fs.writeFileSync(FILE_PATH, JSON.stringify(apis, null, 2), 'utf-8');
  return newApi;
};

export const deleteApi = (id: string): boolean => {
  const apis = getApis();
  const filtered = apis.filter(api => api.id !== id);
  if (filtered.length !== apis.length) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
};
