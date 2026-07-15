import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { detectFramework } from './adapters';
import { parseFile } from './core/ast-parser';
import { findApiCalls } from './core/ast-traverser';
import { MappingResult } from './types';

const program = new Command();

program
  .name('get-front-code')
  .description('Frontend API Analyzer (Phase 1)')
  .version('1.0.0')
  .argument('<targetDir>', '분석할 프로젝트 루트 경로 (예: ../my-react-app)')
  .option('-o, --output <file>', '결과물을 저장할 JSON 경로', 'api-report.json')
  .action(async (targetDir, options) => {
    const absoluteTargetDir = path.resolve(targetDir);
    
    console.log(`\n🔍 분석 시작: ${absoluteTargetDir}`);
    
    // 1. 프레임워크 판별 및 어댑터 로드
    const adapter = await detectFramework(absoluteTargetDir);
    if (!adapter) {
      console.error('❌ 지원하지 않는 프레임워크이거나 package.json이 없습니다. (React/Next.js 전용)');
      process.exit(1);
    }
    
    console.log(`✅ 감지된 프레임워크: ${adapter.name}`);

    // 2. 파일 스캔
    const files = await adapter.getFilesToAnalyze();
    console.log(`📂 분석 대상 파일 수: ${files.length}개\n`);

    if (files.length === 0) {
      console.warn('⚠️ 분석할 화면 컴포넌트를 찾지 못했습니다.');
      process.exit(0);
    }

    const results: MappingResult[] = [];
    let successCount = 0;
    let failCount = 0;

    // 3. 파일 순회 및 AST 분석
    for (const filePath of files) {
      const ast = parseFile(filePath);
      if (!ast) {
        failCount++;
        continue; // 파싱 실패 시 스킵 (Fail-safe)
      }
      
      successCount++;
      const callType = adapter.getCallType(filePath);
      const apiCalls = findApiCalls(ast);

      const relativePath = path.relative(absoluteTargetDir, filePath);
      const viewName = path.basename(filePath, path.extname(filePath)); // 단순 파일명 추정

      for (const api of apiCalls) {
        results.push({
          file: relativePath,
          viewName,
          callType,
          api,
          callLocation: 'AST Extracted'
        });
      }
    }

    // 4. 결과 리포트 출력
    const report = {
      coverage: {
        totalFiles: files.length,
        successFiles: successCount,
        failedFiles: failCount,
        successRate: files.length > 0 ? `${((successCount / files.length) * 100).toFixed(1)}%` : '0%'
      },
      results
    };

    const outPath = path.resolve(options.output);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('--- 분석 완료 ---');
    console.log(`📊 분석 커버리지: ${report.coverage.successRate} (${successCount}/${files.length} 성공)`);
    console.log(`📝 총 ${results.length}개의 API 호출 패턴 발견`);
    console.log(`💾 결과 리포트 저장 위치: ${outPath}\n`);
  });

program.parse(process.argv);
