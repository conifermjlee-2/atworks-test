import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'log');
const LOG_FILE = path.join(LOG_DIR, 'api_logs.json');

// 로그 파일 읽기/쓰기 공통 헬퍼
async function readLogs(): Promise<Record<string, any>> {
  try {
    const fileContent = await fs.readFile(LOG_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (e) {
    return {};
  }
}

async function writeLogs(logs: Record<string, any>): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

/**
 * [Service 레이어 전용 로그 기록 함수]
 * 서버 컴포넌트 → serverApi.ts 직접 호출 경로의 데이터 접근도 로그에 남깁니다.
 * 키 형식: SERVER_COMPONENT__<functionName>
 */
export async function writeServiceLog(
  functionName: string,
  params: Record<string, any>,
  result: any
): Promise<void> {
  try {
    const logKey = `SERVER_COMPONENT__${functionName}`;
    const currentLogs = await readLogs();
    currentLogs[logKey] = {
      timestamp: new Date().toISOString(),
      source: 'server-component',
      function: functionName,
      request: { params },
      response: {
        status: 200,
        body: result,
      },
    };
    await writeLogs(currentLogs);
  } catch (err) {
    console.error('[writeServiceLog] Failed to write log:', err);
  }
}

type ApiLogData = {
  timestamp: string;
  endpoint: string;
  method: string;
  request: {
    headers: Record<string, string>;
    body: any;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
};

export function withLogging(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, ...args: any[]) => {
    // 1. Capture Request Data
    const method = request.method;
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const reqKey = `${method}_${endpoint.replace(/\//g, '_')}`;

    const reqHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      reqHeaders[key] = value;
    });

    let reqBody = null;
    try {
      const clonedReq = request.clone();
      const text = await clonedReq.text();
      reqBody = text ? JSON.parse(text) : null;
    } catch (e) {
      // Body might not be JSON or might be empty
    }

    // 2. Execute original handler
    const response = await handler(request, ...args);

    // 3. Capture Response Data
    const resHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });

    let resBody = null;
    try {
      const clonedRes = response.clone();
      const text = await clonedRes.text();
      resBody = text ? JSON.parse(text) : null;
    } catch (e) {
      // Body might not be JSON
    }

    const logEntry: ApiLogData = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      request: {
        headers: reqHeaders,
        body: reqBody,
      },
      response: {
        status: response.status,
        headers: resHeaders,
        body: resBody,
      },
    };

    // 4. Read existing log, update, and write
    try {
      const currentLogs = await readLogs();
      currentLogs[reqKey] = logEntry;
      await writeLogs(currentLogs);
    } catch (err) {
      console.error('Failed to write API log:', err);
    }

    return response;
  };
}
