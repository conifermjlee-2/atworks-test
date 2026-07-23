import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { Analyzer } from '../../../core/analyzer';

/**
 * plan-v5.md 3장 & 5장: 백엔드(API) 역할 — 순수 JSON 데이터만 반환 (SoC 원칙)
 * 프론트엔드(UI) 렌더링은 page.tsx가 전담
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetDir } = body;

    if (!targetDir) {
      return NextResponse.json(
        { error: '분석할 폴더 경로(targetDir)를 입력해주세요.' },
        { status: 400 }
      );
    }

    const absoluteDir = path.resolve(targetDir);
    if (!fs.existsSync(absoluteDir)) {
      return NextResponse.json(
        { error: `폴더를 찾을 수 없습니다: ${absoluteDir}` },
        { status: 404 }
      );
    }

    const analyzer = new Analyzer();
    const { results, scenarios } = await analyzer.run(absoluteDir);

    // plan-v5.md 5장: API JSON 응답 규격
    return NextResponse.json({
      targetDir: absoluteDir,
      results,
      scenarios,
      ...(results.length === 0 && {
        message: '분석할 화면 컴포넌트를 찾지 못했거나 매핑 가능한 API 호출이 없습니다.',
      }),
    });
  } catch (error: any) {
    console.error('[API] 분석 오류:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
