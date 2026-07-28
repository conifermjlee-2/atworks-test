import { Analyzer } from '../core/analyzer';
import { ScenarioIR } from '../features/analysis/types';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error(JSON.stringify({ error: '대상 경로가 제공되지 않았습니다.' }));
    process.exit(1);
  }

  const resolvedPath = path.resolve(targetPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(JSON.stringify({ error: '유효하지 않은 경로입니다.' }));
    process.exit(1);
  }

  try {
    const analyzer = new Analyzer();
    const { results, routeScenarios } = await analyzer.run(resolvedPath);

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
        ...(sc.triggersRefetch && sc.triggersRefetch.length > 0 && { triggersRefetch: sc.triggersRefetch }),
      }))
    );


    // 컴포넌트별 매핑 결과(results)와 라우트별 IR(scenarios)을 함께 반환
    console.log(JSON.stringify({ results, scenarios: irList }, null, 2));
  } catch (error: any) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

main();
