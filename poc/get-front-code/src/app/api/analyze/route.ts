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

    if (analysisType === 'scenario') {
      // 1. API 연계 흐름 기반 데이터 추출
      const apiFlowData = await analyzeRepoStatically(url, mode, 'api-flow');
      
      // 2. 추출된 데이터를 바탕으로 LLM 호출 (현재는 Mock 데이터)
      markdownResult = `## 💡 AI 시나리오 추천 결과\n\n` +
        `> **안내:** 현재는 UI 기획 및 구조를 잡기 위한 샘플 응답입니다. 향후 이 위치에 LLM(Gemini/OpenAI) 프롬프트 연동이 들어갑니다.\n\n` +
        `### 기반 데이터 (API 연계 흐름)\n<details><summary>추출된 API 흐름 원본 보기</summary>\n\n${apiFlowData}\n</details>\n\n` +
        `### 🎯 추천 통합 테스트 시나리오\n\n` +
        `**시나리오 1: 데이터 등록 후 목록 동기화 검증**\n` +
        `- **Given** 사용자가 특정 대상의 상태를 변경(POST/PUT/PATCH)했을 때\n` +
        `- **When** API 응답이 성공(200)으로 내려오면\n` +
        `- **Then** 프론트엔드에서는 \`데이터 재조회(refetch)\`가 발생하여 화면의 데이터가 최신 상태로 갱신되어야 한다.\n\n` +
        `**시나리오 2: 연계 화면 이동(Navigation) 컨텍스트 유지**\n` +
        `- **Given** 특정 셋업 과정 중 POST API를 호출하고\n` +
        `- **When** 응답 결과에 따라 새로운 상세 페이지 라우트로 이동할 때\n` +
        `- **Then** 기존에 띄워져 있던 다이얼로그/모달의 상태가 유지되면서 매끄러운 진행이 가능해야 한다.`;
    } else if (mode === 'local') {
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
