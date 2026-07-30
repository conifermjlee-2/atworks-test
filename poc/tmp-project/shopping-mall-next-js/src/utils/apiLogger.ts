import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'log');
const LOG_FILE = path.join(LOG_DIR, 'api_logs.json');

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
      await fs.mkdir(LOG_DIR, { recursive: true });
      
      let currentLogs: Record<string, ApiLogData> = {};
      try {
        const fileContent = await fs.readFile(LOG_FILE, 'utf-8');
        currentLogs = JSON.parse(fileContent);
      } catch (e) {
        // File doesn't exist or is invalid JSON; start fresh
      }

      currentLogs[reqKey] = logEntry;

      await fs.writeFile(LOG_FILE, JSON.stringify(currentLogs, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write API log:', err);
    }

    return response;
  };
}
