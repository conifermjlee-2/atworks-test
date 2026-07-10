import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepo } from '@/lib/analyzer';
import { analyzeRepoStatically } from '@/lib/staticAnalyzer';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { url, mode = 'github', analysisType = 'view-api' } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL 또는 로컬 경로를 입력해 주세요.' }, { status: 400 });
    }

    let markdownResult: string;

    if (mode === 'local') {
      // 로컬 폴더 → 정적 분석기 (AI 미사용, 1초 컷)
      markdownResult = await analyzeRepoStatically(url, mode, analysisType);
    } else {
      // GitHub URL → 기존 Babel AST 분석기
      markdownResult = await analyzeRepo(url);
    }

    return NextResponse.json({ result: markdownResult });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
