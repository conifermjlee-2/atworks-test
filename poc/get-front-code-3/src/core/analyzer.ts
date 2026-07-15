import { detectFramework } from '../adapters';
import { parseFile } from './ast-parser';
import { findApiCalls } from './ast-traverser';
import { HookResolver } from './resolvers/types';
import { MappingResult } from '../types';
import * as path from 'path';

// Resolvers
import { RtkQueryResolver } from './resolvers/rtk-query';
import { ReactQueryResolver } from './resolvers/react-query';
import { SwrResolver } from './resolvers/swr-resolver';
import { AxiosFetchResolver } from './resolvers/axios-fetch-resolver';

export class Analyzer {
  private resolvers: HookResolver[] = [];

  constructor() {
    // 순서대로 등록 (특화된 플러그인을 먼저 배치하는 것이 좋음)
    this.resolvers.push(new RtkQueryResolver());
    this.resolvers.push(new ReactQueryResolver());
    this.resolvers.push(new SwrResolver());
    this.resolvers.push(new AxiosFetchResolver());
  }

  async run(targetDir: string): Promise<MappingResult[]> {
    // 1. 프레임워크 어댑터 로드
    const adapter = await detectFramework(targetDir);
    if (!adapter) {
      throw new Error('지원하지 않는 프레임워크이거나 package.json이 없습니다. (React/Next.js 전용)');
    }

    // 2. 플러그인(Resolver) 초기화 (예: RTK Query 파일 스캔)
    for (const resolver of this.resolvers) {
      if (resolver.init) {
        await resolver.init(targetDir);
      }
    }

    // 3. 파일 스캔
    const files = await adapter.getFilesToAnalyze();
    if (files.length === 0) {
      return [];
    }

    const results: MappingResult[] = [];
    const seen = new Set<string>();

    // 4. 순회 및 AST 분석
    for (const filePath of files) {
      const ast = parseFile(filePath);
      if (!ast) continue;
      
      const callType = adapter.getCallType(filePath);
      // 등록된 리졸버들을 Traverser에 전달
      const apiCalls = findApiCalls(ast, this.resolvers);

      const relativePath = path.relative(targetDir, filePath);
      const viewName = path.basename(filePath, path.extname(filePath));
      
      for (const call of apiCalls) {
        const dedupeKey = `${relativePath}:${call.method}:${call.endpoint}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        results.push({
          file: relativePath.replace(/\\/g, '/'),
          viewName: viewName,
          callType,
          api: call,
          callLocation: 'AST Extracted'
        });
      }
    }

    return results;
  }
}
