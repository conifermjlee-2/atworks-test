import * as path from 'path';
import { BaseAdapter } from '../types';
import { ReactAdapter } from './react-adapter';
import { NextAdapter } from './next-adapter';

/**
 * 기획서 4장 아키텍처 1단계:
 * package.json을 검사하여 알맞은 Adapter 인스턴스를 반환한다.
 * 미지원 프레임워크(Vue, Svelte 등) 감지 시 명확한 안내 후 예외를 던진다.
 */
export async function detectFramework(rootDir: string): Promise<BaseAdapter | null> {
  const pkgPath = path.join(rootDir, 'package.json');
  try {
    const fs = require('fs');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // 기획서 2.2: 스코프 아웃 - Vue, Svelte, Angular 명확한 안내
    if (deps['vue']) {
      throw new Error(
        '[미지원 프레임워크] Vue 기반 프로젝트입니다.\n' +
        'Vue 지원은 Phase 2에 예정되어 있습니다. 현재 지원: React, Next.js'
      );
    }
    if (deps['svelte'] || deps['@sveltejs/kit']) {
      throw new Error(
        '[미지원 프레임워크] Svelte 기반 프로젝트입니다.\n' +
        '현재 지원: React, Next.js'
      );
    }
    if (deps['@angular/core']) {
      throw new Error(
        '[미지원 프레임워크] Angular 기반 프로젝트입니다.\n' +
        '현재 지원: React, Next.js'
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
    if (err instanceof Error && err.message.includes('[미지원 프레임워크]')) {
      throw err;
    }
    console.error(`[Error] package.json 분석 실패: ${rootDir}`);
    return null;
  }
}
