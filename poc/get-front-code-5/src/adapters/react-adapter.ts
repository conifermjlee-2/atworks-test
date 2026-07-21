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
    return 'Client';
  }
}
