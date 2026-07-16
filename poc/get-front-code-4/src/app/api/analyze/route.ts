import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { Analyzer } from '../../../core/analyzer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, mode } = body;

    if (!url) {
      return NextResponse.json({ error: '대상 폴더 경로를 입력해주세요.' }, { status: 400 });
    }

    if (mode && mode !== 'local') {
      return NextResponse.json(
        { error: '폐쇄망 POC 범위에서는 로컬 폴더 분석만 지원합니다.' },
        { status: 400 }
      );
    }

    const absoluteTargetDir = path.resolve(url);
    if (!fs.existsSync(absoluteTargetDir)) {
      return NextResponse.json(
        { error: `폴더를 찾을 수 없습니다: ${absoluteTargetDir}` },
        { status: 400 }
      );
    }

    const analyzer = new Analyzer();
    const results = await analyzer.run(absoluteTargetDir);

    if (results.length === 0) {
      return NextResponse.json({
        targetDir: absoluteTargetDir,
        results: [],
        message: '분석할 화면 컴포넌트를 찾지 못했거나 매핑 가능한 API 호출이 없습니다.'
      });
    }

    return NextResponse.json({
      targetDir: absoluteTargetDir,
      results
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
