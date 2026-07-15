import * as path from 'path';
import { BaseAdapter } from '../types';
import { ReactAdapter } from './react-adapter';
import { NextAdapter } from './next-adapter';

/**
 * 프로젝트 루트 경로의 package.json을 검사하여 알맞은 Adapter 인스턴스를 반환합니다.
 */
export async function detectFramework(rootDir: string): Promise<BaseAdapter | null> {
  const pkgPath = path.join(rootDir, 'package.json');
  try {
    const fs = require('fs');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // [기획서 5.2] Vue 프로젝트 예외처리
    if (deps['vue']) {
      throw new Error('이 프로젝트는 Vue 기반으로 감지되었습니다. Vue 지원은 Phase 2에 예정되어 있으며 현재 버전(Phase 1)에서는 분석할 수 없습니다.');
    }

    const nextAdapter = new NextAdapter(rootDir);
    if (await nextAdapter.isMatch()) {
      return nextAdapter;
    }

    const reactAdapter = new ReactAdapter(rootDir);
    if (await reactAdapter.isMatch()) {
      return reactAdapter;
    }

    return null;
  } catch (err) {
    console.error(`[Error] package.json을 찾을 수 없거나 분석할 수 없습니다: ${rootDir}`);
    return null;
  }
}
