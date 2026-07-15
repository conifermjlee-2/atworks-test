import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { BaseAdapter, CallType } from '../types';

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
    // Pages Router 및 App Router 내의 모든 컴포넌트 스캔
    const pattern = path.join(this.rootDir, '**', '*.{tsx,jsx,ts,js}').replace(/\\/g, '/');
    return fg(pattern, { 
      ignore: [
        '**/node_modules/**', 
        '**/.next/**', 
        '**/*.test.*', 
        '**/api/**/route.*' // 기획서 6장: API 자체 라우트는 분석 대상에서 제외
      ] 
    });
  }

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
      
      // 지시어가 없고 app 디렉토리 하위라면 서버 컴포넌트로 추정
      if (filePath.replace(/\\/g, '/').includes('/app/')) {
         return 'ServerComponent';
      }
      
      return 'Client';
    } catch {
      return 'Unknown';
    }
  }
}
