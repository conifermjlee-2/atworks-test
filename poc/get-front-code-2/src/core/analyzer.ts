import { detectFramework } from '../adapters';
import { parseFile } from './ast-parser';
import { findApiCalls } from './ast-traverser';
import { HookResolver } from './resolvers/types';
import { MappingResult } from '../types';
import * as path from 'path';
import * as fs from 'fs';

// Resolvers
import { RtkQueryResolver } from './resolvers/rtk-query';
import { ReactQueryResolver } from './resolvers/react-query';
import { SwrResolver } from './resolvers/swr-resolver';
import { AxiosFetchResolver } from './resolvers/axios-fetch-resolver';

export class Analyzer {
  private resolvers: HookResolver[] = [];

  constructor() {
    // 동적 로드를 위해 생성자에서는 아무것도 하지 않습니다.
  }

  async run(targetDir: string): Promise<MappingResult[]> {
    // 1. 프레임워크 어댑터 로드
    const adapter = await detectFramework(targetDir);
    if (!adapter) {
      throw new Error('지원하지 않는 프레임워크이거나 package.json이 없습니다. (React/Next.js 전용)');
    }

    // 1.5. package.json 분석 및 동적 플러그인(Resolver) 로드
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    this.resolvers = [];
    if (deps['@reduxjs/toolkit'] || deps['@rtk-query/core']) {
      this.resolvers.push(new RtkQueryResolver());
    }
    if (deps['@tanstack/react-query'] || deps['react-query']) {
      this.resolvers.push(new ReactQueryResolver());
    }
    if (deps['swr']) {
      this.resolvers.push(new SwrResolver());
    }
    // 순수 HTTP 클라이언트(Axios/Fetch)는 항상 기본으로 등록
    this.resolvers.push(new AxiosFetchResolver());

    // 2. 로드된 플러그인(Resolver) 초기화 (예: RTK Query 파일 스캔)
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
