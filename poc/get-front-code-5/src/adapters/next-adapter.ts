import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { BaseAdapter, CallType } from '../types';

/**
 * 기획서 5.1절: Next.js App Router 분리 규칙 구현
 * - Route Handler (route.ts) 완전 배제
 * - use client / use server 지시어 기반 컴포넌트 분류
 * - 모노레포 Workspace/Alias 지원 (기획서 4.1절)
 */
export class NextAdapter implements BaseAdapter {
  name = 'Next.js Adapter';

  constructor(private rootDir: string) {}

  async isMatch(): Promise<boolean> {
    const pkgPath = path.join(this.rootDir, 'package.json');
    try {
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
        '**/*.d.ts',
        // 기획서 5.1절: Route Handler 완전 배제 (스캔 차단)
        // JSDoc 내 */ 충돌 방지를 위해 문자열 분리
        '**/api/**/' + 'route.ts',
        '**/api/**/' + 'route.js',
        '**/api/**/' + 'route.tsx',
        '**/api/**/' + 'route.mjs',
      ],
      absolute: true,
    });
  }

  /**
   * 기획서 5.1절: 지시어(Directive) 기반 컴포넌트 분리 표기
   * - 'use client' → Client Component (브라우저 실행)
   * - 'use server' → Server Action (폼 제출 등 서버 함수)
   * - 없음(기본값) → Server Component (서버 렌더링)
   */
  getCallType(filePath: string): CallType {
    try {
      // 첫 1KB만 읽어 지시어 확인 (성능 최적화)
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(1024);
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);
      const head = buffer.toString('utf-8');

      if (head.includes('"use client"') || head.includes("'use client'")) {
        return 'Client';
      }
      if (head.includes('"use server"') || head.includes("'use server'")) {
        return 'ServerAction';
      }

      // 지시어 없이 app/ 디렉토리 하위라면 Server Component
      if (filePath.replace(/\\/g, '/').includes('/app/')) {
        return 'ServerComponent';
      }

      return 'Client';
    } catch {
      return 'Unknown';
    }
  }
}
