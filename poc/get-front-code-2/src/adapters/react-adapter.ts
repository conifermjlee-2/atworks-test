import fg from 'fast-glob';
import * as path from 'path';
import { BaseAdapter, CallType } from '../types';

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
    // src 내부의 모든 tsx, jsx 파일을 스캔 타겟으로 지정
    const pattern = path.join(this.rootDir, 'src', '**', '*.{tsx,jsx}').replace(/\\/g, '/');
    return fg(pattern, { ignore: ['**/*.test.*', '**/*.spec.*'] });
  }

  getCallType(filePath: string): CallType {
    // React SPA는 서버 컴포넌트가 없으므로 무조건 클라이언트로 간주
    return 'Client';
  }
}
