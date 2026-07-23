import { detectFramework } from '../adapters';
import { parseFile } from './ast-parser';
import { findApiCalls } from './ast-traverser';
import { HookResolver } from './resolvers/types';
import { MappingResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Resolver 임포트
import { RtkQueryResolver } from './resolvers/rtk-query';
import { ReactQueryResolver } from './resolvers/react-query';
import { SwrResolver } from './resolvers/swr-resolver';
import { AxiosFetchResolver } from './resolvers/axios-fetch-resolver';

export class Analyzer {
  private resolvers: HookResolver[] = [];

  async run(targetDir: string): Promise<MappingResult[]> {
    // 1. 프레임워크 어댑터 로드 (미지원 프레임워크는 내부에서 throw)
    const adapter = await detectFramework(targetDir);
    if (!adapter) {
      throw new Error(
        '지원하지 않는 프레임워크이거나 package.json이 없습니다.\n' +
        '현재 Phase 1에서는 React 및 Next.js 프로젝트만 분석 가능합니다.'
      );
    }

    // 2. 기획서 2장: package.json 의존성 분석하여 최적화된 Resolver만 동적 로드
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    this.resolvers = [];

    if (deps['@reduxjs/toolkit'] || deps['@rtk-query/core']) {
      console.log('[Analyzer] RTK Query Resolver 로드됨');
      this.resolvers.push(new RtkQueryResolver());
    }
    if (deps['@tanstack/react-query'] || deps['react-query']) {
      console.log('[Analyzer] React Query Resolver 로드됨');
      this.resolvers.push(new ReactQueryResolver());
    }
    if (deps['swr']) {
      console.log('[Analyzer] SWR Resolver 로드됨');
      this.resolvers.push(new SwrResolver());
    }
    // Axios/Fetch는 항상 기본 탑재 (기획서: 기본 활성화)
    this.resolvers.push(new AxiosFetchResolver());

    // 3. 로드된 플러그인 초기화 (RTK Query는 .api.ts 사전 스캔)
    for (const resolver of this.resolvers) {
      if (resolver.init) {
        await resolver.init(targetDir);
      }
    }

    // 4. 파일 스캔 (Adapter가 프레임워크별 규칙에 맞게 대상 파일 목록 반환)
    const files = await adapter.getFilesToAnalyze();
    if (files.length === 0) {
      return [];
    }

    const results: MappingResult[] = [];
    // 기획서 7.2: 단일 화면 내 중복 제거 (화면+메서드+엔드포인트 기준)
    const seen = new Set<string>();

    // 5. 파일별 AST 파싱 및 순회
    for (const filePath of files) {
      const ast = parseFile(filePath);
      if (!ast) continue;

      const callType = adapter.getCallType(filePath);
      const apiCalls = findApiCalls(ast, this.resolvers);

      const relativePath = path.relative(targetDir, filePath);
      const viewName = path.basename(filePath, path.extname(filePath));

      for (const call of apiCalls) {
        // 동일 화면에서 동일한 API 중복 방지
        const dedupeKey = `${relativePath}:${call.method}:${call.endpoint}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        results.push({
          file: relativePath.replace(/\\/g, '/'),
          viewName,
          callType,
          api: call,
          callLocation: 'AST Extracted'
        });
      }
    }

    return results;
  }
}
