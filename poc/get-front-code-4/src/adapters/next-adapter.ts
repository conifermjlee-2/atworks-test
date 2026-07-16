import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { BaseAdapter, CallType } from '../types';

/**
 * 기획서 5.1: Next.js App Router 서버/클라이언트 구분 어댑터
 * Server Component / Client Component / Server Action / Route Handler 분리 표기
 */
export class NextAdapter implements BaseAdapter {
  name = 'Next.js Adapter';

  constructor(private rootDir: string) {}

  async isMatch(): Promise<boolean> {
    const pkgPath = path.join(this.rootDir, 'package.json');
    try {
      const fs = require('fs');
      if (!fs.existsSync(pkgPath)) return false;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!deps['next'];
    } catch {
      return false;
    }
  }

  async getFilesToAnalyze(): Promise<string[]> {
    const pattern = path.join(this.rootDir, '**', '*.{tsx,jsx,ts,js}').replace(/\\/g, '/');
    return fg(pattern, {
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
        '**/*.test.*',
        '**/*.spec.*',
        // 기획서 5.1: Route Handler는 분석 타겟에서 분리
        // (JSDoc 내 */ 충돌 방지: 문자열로 나눠서 처리)
        '**/api/**/' + 'route.ts',
        '**/api/**/' + 'route.js',
        '**/api/**/' + 'route.tsx',
      ]
    });
  }

  /**
   * 기획서 5.1: 파일의 use client/use server 지시어 및 경로로 컴포넌트 유형 판별
   */
  getCallType(filePath: string): CallType {
    try {
      const code = fs.readFileSync(filePath, 'utf-8');

      // 파일 최상단 지시어 검사
      if (code.includes('"use client"') || code.includes("'use client'")) {
        return 'Client';
      }
      if (code.includes('"use server"') || code.includes("'use server'")) {
        return 'ServerAction';
      }

      // 지시어 없이 app 디렉토리 하위라면 Server Component
      if (filePath.replace(/\\/g, '/').includes('/app/')) {
        return 'ServerComponent';
      }

      return 'Client';
    } catch {
      return 'Unknown';
    }
  }
}
