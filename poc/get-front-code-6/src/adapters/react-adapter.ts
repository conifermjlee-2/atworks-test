import fg from 'fast-glob';
import * as path from 'path';
import { BaseAdapter, CallType } from '../types';

/**
 * plan-v5.md 2장 (1️⃣ 프레임워크 어댑터 레이어): React SPA 어댑터
 */
export class ReactAdapter implements BaseAdapter {
  name = 'React SPA Adapter';

  constructor(private rootDir: string) {}

  async isMatch(): Promise<boolean> {
    const pkgPath = path.join(this.rootDir, 'package.json');
    try {
      const fs = require('fs');
      if (!fs.existsSync(pkgPath)) return false;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!deps['react'] && !deps['next'];
    } catch {
      return false;
    }
  }

  async getFilesToAnalyze(): Promise<string[]> {
    const pattern = path.join(this.rootDir, 'src', '**', '*.{tsx,jsx}').replace(/\\/g, '/');
    return fg(pattern, { ignore: ['**/*.test.*', '**/*.spec.*'] });
  }

  getCallType(_filePath: string): CallType {
    // 순수 React SPA는 Server Component/Action 개념이 없으므로 항상 Client
    return 'Client';
  }

  /**
   * [화면별 시나리오] 일반 React(Vite/CRA) 진입점 식별
   * 관습적으로 화면 컴포넌트가 위치하는 src/pages/ 또는 src/views/ 폴더를 진입점으로 인식합니다.
   * 예) src/pages/products/detail.tsx -> routePath: '/products/detail'
   */
  getRouteEntryPoints(files: string[]): { routePath: string; filePath: string }[] {
    const entryPoints: { routePath: string; filePath: string }[] = [];
    const pagesDir = path.join(this.rootDir, 'src', 'pages');
    const viewsDir = path.join(this.rootDir, 'src', 'views');

    for (const file of files) {
      // Node.js path.relative가 드라이브 문자 대소문자나 구분자를 안전하게 처리해 줌
      let relPath = path.relative(pagesDir, file);
      
      // 만약 src/pages 하위에 없는 파일이면 (경로가 .. 으로 시작) src/views 기준인지 확인
      if (relPath.startsWith('..')) {
        const relPathAlt = path.relative(viewsDir, file);
        if (relPathAlt.startsWith('..')) {
          continue; // 둘 다 하위가 아님
        }
        relPath = relPathAlt;
      }

      let routePath = relPath.replace(/\\/g, '/');
      // index.tsx/jsx 등 파일명 제거 → 순수 URL 만 남김
      routePath = routePath.replace(/\/?(index)?\.(tsx?|jsx?)$/, '') || '/';
      if (!routePath.startsWith('/')) routePath = '/' + routePath;

      entryPoints.push({ routePath, filePath: file });
    }
    return entryPoints;
  }
}
