import { analyzeRepoStatically } from './src/lib/staticAnalyzer';
import * as fs from 'fs';

async function main() {
  const targetDir = 'C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt';
  const result = await analyzeRepoStatically(targetDir, 'local', 'view-api');
  fs.writeFileSync('api-flow-result.txt', result);
  console.log('Result saved to api-flow-result.txt');
}

main().catch(console.error);
