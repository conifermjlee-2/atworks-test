import * as path from 'path';
import { BaseAdapter } from '../types';
import { ReactAdapter } from './react-adapter';
import { NextAdapter } from './next-adapter';

/**
 * 기획서 4장 + 아키텍처 1단계:
 * 프로젝트 루트 경로의 package.json을 검사하여 알맞은 Adapter 인스턴스를 반환합니다.
 * 미지원 프레임워크(Vue, Svelte 등) 감지 시 명확한 안내 후 프로세스 종료(exit code).
 */
export async function detectFramework(rootDir: string): Promise<BaseAdapter | null> {
  const pkgPath = path.join(rootDir, 'package.json');
  try {
    const fs = require('fs');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // 기획서 2.1: Vue 프로젝트 예외 처리 - 명확한 안내 메시지 + exit code
    if (deps['vue']) {
      throw new Error(
        '[미지원 프레임워크] 이 프로젝트는 Vue 기반으로 감지되었습니다.\n' +
        'Vue 지원은 Phase 2에 예정되어 있으며 현재 버전(Phase 1)에서는 분석할 수 없습니다.\n' +
        '지원 범위: React, Next.js'
      );
    }

    // 기획서 2.1: 기타 미지원 프레임워크 (Svelte, Angular 등) 감지 시 안내 후 종료
    if (deps['svelte'] || deps['@sveltejs/kit']) {
      throw new Error(
        '[미지원 프레임워크] 이 프로젝트는 Svelte 기반으로 감지되었습니다.\n' +
        'Svelte 지원은 향후 확장 버전에서 예정되어 있습니다.\n' +
        '지원 범위: React, Next.js'
      );
    }

    if (deps['@angular/core']) {
      throw new Error(
        '[미지원 프레임워크] 이 프로젝트는 Angular 기반으로 감지되었습니다.\n' +
        'Angular 지원은 향후 확장 버전에서 예정되어 있습니다.\n' +
        '지원 범위: React, Next.js'
      );
    }

    // Next.js 우선 체크 (Next는 React도 포함하므로 순서 중요)
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
    // 미지원 프레임워크 에러는 그대로 상위로 전파
    if (err instanceof Error && (
      err.message.includes('[미지원 프레임워크]')
    )) {
      throw err;
    }
    console.error(`[Error] package.json을 찾을 수 없거나 분석할 수 없습니다: ${rootDir}`);
    return null;
  }
}
