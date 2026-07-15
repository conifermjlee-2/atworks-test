import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Analyzer } from './core/analyzer';

const program = new Command();

program
  .name('get-front-code')
  .description('Frontend API Analyzer Phase 1: React/Next.js REST API mapping')
  .version('1.0.0')
  .argument('<targetDir>', '분석할 프로젝트 루트 경로')
  .option('-o, --output <file>', '결과물을 저장할 JSON 경로', 'api-report.json')
  .action(async (targetDir, options) => {
    const absoluteTargetDir = path.resolve(targetDir);
    console.log(`\n분석 시작: ${absoluteTargetDir}`);

    const analyzer = new Analyzer();
    const results = await analyzer.run(absoluteTargetDir);

    const report = {
      targetDir: absoluteTargetDir,
      totalApiCalls: results.length,
      results,
    };

    const outPath = path.resolve(options.output);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`분석 완료: ${results.length}개의 API 호출 패턴 발견`);
    console.log(`결과 리포트 저장 위치: ${outPath}\n`);
  });

program.parse(process.argv);
