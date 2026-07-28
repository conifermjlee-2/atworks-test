import * as fs from 'fs';
import * as pathMod from 'path';
import { Analyzer } from '../core/analyzer';
import { GeminiProvider } from '../features/analysis/llm/GeminiProvider';
import { ScenarioIR } from '../features/analysis/types';

async function main() {
  const reqId = process.argv[2];
  const targetPath = process.argv[3];

  if (!reqId || !targetPath) {
    console.error('Usage: run-agent.ts <reqId> <targetPath>');
    process.exit(1);
  }

  const statusFile = pathMod.resolve(process.cwd(), 'tmp', `tmp-status-${reqId}.txt`);
  const replyFile = pathMod.resolve(process.cwd(), 'tmp', `tmp-reply-${reqId}.json`);

  try {
    fs.writeFileSync(statusFile, 'AST 파싱 및 정적 분석을 시작합니다...', 'utf8');

    // 1. Analyzer(Babel 기반 신버전) 실행
    console.log(`[AGENT] Analyzer 실행 시작: ${targetPath}`);
    const analyzer = new Analyzer();
    const { routeScenarios } = await analyzer.run(targetPath);

    fs.writeFileSync(statusFile, '분석 완료. LLM을 통한 비즈니스 시나리오 추론 중입니다...', 'utf8');

    // 2. Analyzer 결과를 ScenarioIR 형식으로 변환 (Gemini 입력 형식)
    const irList: ScenarioIR[] = routeScenarios.flatMap(rs =>
      rs.scenarios.map((sc: any) => ({
        framework: 'nextjs' as const,
        route: rs.route,
        sourceFile: sc.file,
        trigger: {
          type: (sc.triggerType === 'MOUNT' ? 'lifecycle' : 'event') as 'lifecycle' | 'event',
          name: sc.triggerSource,
        },
        calls: sc.apiCalls.map((c: any) => ({
          order: c.order,
          method: c.method,
          endpoint: c.endpoint,
          callerType: 'component' as const,
          confidence: 'detected' as const,
          evidence: `${sc.file} (line ${sc.line ?? '?'}) / trigger: ${sc.triggerSource}`,
          navigatesTo: sc.navigatesTo ?? null,
        })),
      }))
    );

    console.log(`[AGENT] IR 데이터 ${irList.length}개 시나리오 추출 완료`);

    if (irList.length === 0) {
      fs.writeFileSync(replyFile, JSON.stringify({ error: '분석 가능한 API 호출을 찾지 못했습니다.' }), 'utf8');
      return;
    }

    // 3. LLM 추론
    console.log(`[AGENT] LLM 추론 시작...`);
    const llmProvider = new GeminiProvider();
    const report = await llmProvider.inferScenarios(irList);

    // 4. 결과 저장
    fs.writeFileSync(replyFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[AGENT] 완료! tmp-reply-${reqId}.json 생성`);

  } catch (err: any) {
    console.error('[AGENT] 에러 발생:', err);
    fs.writeFileSync(replyFile, JSON.stringify({ error: err.message }), 'utf8');
  }
}

main();

