import { NextResponse } from 'next/server';
import * as path from 'path';
import { Analyzer } from '../../../core/analyzer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, analysisType } = body;

    if (!url) {
      return NextResponse.json({ error: '대상 폴더 경로나 URL을 입력해주세요.' }, { status: 400 });
    }

    // Phase 1 POC: 현재는 로컬 절대 경로만 분석 지원
    const absoluteTargetDir = path.resolve(url);
    
    const analyzer = new Analyzer();
    const results = await analyzer.run(absoluteTargetDir);

    if (results.length === 0) {
      return NextResponse.json({ result: '⚠️ 분석할 화면 컴포넌트를 찾지 못했거나 매핑 가능한 API 호출이 없습니다.' });
    }

    // 결과 생성
    let md = `## 🔌 화면별 API 매핑 (총 ${results.length}개의 API 호출 발견)\n\n`;

    // 동일 화면별 그룹핑
    const grouped = new Map<string, typeof results>();
    for (const r of results) {
      if (!grouped.has(r.viewName)) grouped.set(r.viewName, []);
      grouped.get(r.viewName)!.push(r);
    }

    const sortedLabels = Array.from(grouped.keys()).sort();
    let index = 1;
    for (const label of sortedLabels) {
      const items = grouped.get(label)!;
      
      md += `<details>\n`;
      md += `<summary style="cursor: pointer; padding: 8px; font-size: 16px; background-color: #f8fafc; border-radius: 6px; margin-bottom: 8px;">\n`;
      md += `  <b>${index++}. <code>${label}</code></b> <span style="color: #64748b; font-size: 14px; margin-left: 8px;">(${items.length}개의 API)</span>\n`;
      md += `</summary>\n\n`;
      md += `| API Method | API Endpoint |\n`;
      md += `|---|---|\n`;
      for (const item of items) {
        md += `| [${item.api.method}] | \`${item.api.endpoint}\` |\n`;
      }
      md += `\n</details>\n\n`;
    }

    return NextResponse.json({ result: md });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
