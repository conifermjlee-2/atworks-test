import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { BaseAdapter, CallType } from '../types';

/**
 * plan-v5.md 2장 & 3장: Next.js App Router 분리 규칙 구현
 * - Route Handler (route.ts) 스캔 시 완전 배제
 * - use client / use server 지시어 기반 컴포넌트 분류 (plan-v5.md 3장 4항)
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
        // Route Handler 완전 배제 (스캔 차단)
        '**/api/**/' + 'route.ts',
        '**/api/**/' + 'route.js',
        '**/api/**/' + 'route.tsx',
        '**/api/**/' + 'route.mjs',
      ],
      absolute: true,
    });
  }

  /**
   * plan-v5.md 3장 (4. 컴포넌트 지시어 판별)
   * - 'use client' → Client Component (브라우저 실행)
   * - 'use server' → Server Action (서버 함수)
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

  /**
   * [화면별 시나리오] Next.js App Router 진입점 식별
   * app/ 폴더 하위의 page.tsx / layout.tsx 파일을 라우트 진입점으로 인식합니다.
   * 예) src/app/products/[id]/page.tsx -> routePath: '/products/[id]'
   */
  getRouteEntryPoints(files: string[]): { routePath: string; filePath: string }[] {
    const entryPoints: { routePath: string; filePath: string }[] = [];
    const appDir = path.join(this.rootDir, 'src', 'app');
    const appDirAlt = path.join(this.rootDir, 'app');

    for (const file of files) {
      const normalizedFile = file.replace(/\\/g, '/');
      if (!/(page|layout)\.(tsx?|jsx?)$/.test(normalizedFile)) continue;

      // path.relative는 Windows에서 드라이브 문자 대소문자(C: vs c:) 차이를 알아서 처리해 줍니다.
      let relPath = path.relative(appDir, file);
      
      // 만약 src/app 하위에 없는 파일이면 (경로가 .. 으로 시작하면) app/ 기준인지 확인
      if (relPath.startsWith('..')) {
        const relPathAlt = path.relative(appDirAlt, file);
        if (relPathAlt.startsWith('..')) {
          continue; // app 폴더 하위가 아님
        }
        relPath = relPathAlt;
      }

      let routePath = relPath.replace(/\\/g, '/');
      routePath = routePath.replace(/\/?(page|layout)\.(tsx?|jsx?)$/, '') || '/';
      if (!routePath.startsWith('/')) routePath = '/' + routePath;

      entryPoints.push({ routePath, filePath: file });
    }
    return entryPoints;
  }
}
