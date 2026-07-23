import { detectFramework } from '../adapters';
import { parseFile } from './parser/ast-parser';
import { findApiCalls, findScenarios } from './parser/ast-traverser';
import { MappingResult, HookResolver, ScenarioFlow } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Resolver 임포트
import { RtkQueryResolver } from '../resolvers/rtk-query-resolver';
import { ReactQueryResolver } from '../resolvers/react-query-resolver';
import { SwrResolver } from '../resolvers/swr-resolver';
import { AxiosFetchResolver } from '../resolvers/axios-fetch-resolver';

/**
 * plan-v5.md 2장 아키텍처: 핵심 분석 파이프라인 오케스트레이터
 */
export class Analyzer {
  private resolvers: HookResolver[] = [];

  async run(targetDir: string): Promise<{ results: MappingResult[]; scenarios: ScenarioFlow[] }> {
    // [1단계] 프레임워크 판별 및 Adapter 로드 (plan-v5.md 2장 1단계)
    const adapter = await detectFramework(targetDir);
    if (!adapter) {
      throw new Error(
        '지원하지 않는 프레임워크이거나 package.json이 없습니다.\n' +
        '현재 Phase 1에서는 React 및 Next.js 프로젝트만 분석 가능합니다.'
      );
    }

    // [2단계] package.json 의존성 분석 → 필요한 Resolver만 동적 로드 (최적화)
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    this.resolvers = [];

    // RTK Query: 사전 학습(init)이 필요하므로 최우선 등록 (plan-v5.md 4장)
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
    // Axios/Fetch: 항상 기본 탑재 (가장 마지막 — 저수준 Fallback)
    this.resolvers.push(new AxiosFetchResolver());

    // [3단계] 플러그인 초기화 (RTK Query는 파일 사전 스캔으로 이름표 사전 구축)
    for (const resolver of this.resolvers) {
      if (resolver.init) {
        await resolver.init(targetDir);
      }
    }

    // [4단계] 파일 스캔 (Adapter가 프레임워크 규칙에 맞게 대상 파일 목록 반환)
    const files = await adapter.getFilesToAnalyze();
    if (files.length === 0) {
      return [];
    }

    const results: MappingResult[] = [];
    const scenarios: ScenarioFlow[] = [];
    const seen = new Set<string>();

    // [5단계] 파일별 AST 파싱 및 범용 심볼 역추적 (Symbol Tracing) 순회
    for (const filePath of files) {
      const ast = parseFile(filePath);
      if (!ast) continue;

      const callType = adapter.getCallType(filePath);
      // 범용 심볼 역추적(filePath, targetDir) 활성화
      const apiCalls = findApiCalls(ast, this.resolvers, filePath, targetDir);

      const relativePath = path.relative(targetDir, filePath);
      const viewName = path.basename(filePath, path.extname(filePath));

      for (const call of apiCalls) {
        const dedupeKey = `${relativePath}:${call.method}:${call.endpoint}:${call.calleeName ?? ''}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
          file: relativePath.replace(/\\/g, '/'),
          viewName,
          callType,
          api: call,
        });
      }

      // 시나리오 흐름 분석
      const fileScenarios = findScenarios(ast, this.resolvers, filePath, targetDir);
      scenarios.push(...fileScenarios);
    }

    return { results, scenarios };
  }
}
