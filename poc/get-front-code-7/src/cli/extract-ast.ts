import { AstParser } from '../features/analysis/ast/Parser';
import * as fs from 'fs';
import * as path from 'path';

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
  const parser = new AstParser();
  const irList = parser.analyzeDirectory(resolvedPath);
  
  // 에이전트(LLM)가 읽기 쉽도록 JSON 형태로 출력
  console.log(JSON.stringify(irList, null, 2));
} catch (error: any) {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
}
