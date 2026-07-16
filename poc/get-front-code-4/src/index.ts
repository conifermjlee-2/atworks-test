import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Analyzer } from './core/analyzer';

const program = new Command();

program
  .name('get-front-code-4')
  .description('Frontend API Analyzer v6: React/Next.js REST API 매핑 (플러그인 동적 로드)')
  .version('1.0.0')
  .argument('<targetDir>', '분석할 프로젝트 루트 경로')
  .option('-o, --output <file>', '결과물을 저장할 JSON 경로', 'api-report.json')
  .action(async (targetDir, options) => {
    const absoluteTargetDir = path.resolve(targetDir);
    console.log(`\n분석 시작: ${absoluteTargetDir}`);

    try {
      const analyzer = new Analyzer();
      const results = await analyzer.run(absoluteTargetDir);

      const report = {
        targetDir: absoluteTargetDir,
        totalApiCalls: results.length,
        results,
      };

      const outPath = path.resolve(options.output);
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

      console.log(`\n분석 완료: ${results.length}개의 API 호출 패턴 발견`);
      console.log(`결과 리포트 저장 위치: ${outPath}\n`);
    } catch (err: any) {
      console.error(`\n[오류] ${err.message}\n`);
      process.exit(1);
    }
  });

program.parse(process.argv);
