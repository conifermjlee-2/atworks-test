import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: '분석할 경로를 제공해주세요.' }, { status: 400 });
  }

  try {
    // extract-ast.ts 스크립트를 실행하여 정적 분석 결과(JSON)를 가져옵니다.
    const scriptPath = path.resolve(process.cwd(), 'src/cli/extract-ast.ts');
    
    // 타임아웃을 넉넉히 30초 부여
    const { stdout, stderr } = await execAsync(`npx tsx "${scriptPath}" "${targetPath}"`, { timeout: 30000 });

    if (stderr && stderr.includes('error')) {
      console.warn('[AST Parser Stderr]:', stderr);
    }

    // stdout이 JSON 문자열이어야 함
    try {
      // 혹시 다른 로그가 섞여있다면 JSON 형태만 추출
      // '{' 로 시작하는 라인을 찾아서 거기서부터 끝까지 추출
      const startIndex = stdout.indexOf('{\n');
      const jsonStr = startIndex !== -1 ? stdout.substring(startIndex) : stdout;
      const parsedData = JSON.parse(jsonStr);
      return NextResponse.json(parsedData); // { results, scenarios } 반환
    } catch (parseError) {
      console.error('[JSON Parse Error]:', stdout);
      return NextResponse.json({ error: '분석 결과를 파싱할 수 없습니다.', rawOutput: stdout }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[AST Execute Error]:', error);
    return NextResponse.json({ error: error.message || 'AST 파서 실행 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
