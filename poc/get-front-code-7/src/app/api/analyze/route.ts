import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as pathMod from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const targetPath = body.path || body.targetPath;

    if (!targetPath) {
      return NextResponse.json({ error: '분석할 경로를 제공해주세요.' }, { status: 400 });
    }

    const reqId = Date.now().toString();
    const reqFile = pathMod.resolve(process.cwd(), 'tmp-request.json');
    const replyFile = pathMod.resolve(process.cwd(), `tmp-reply-${reqId}.json`);

    // 1. 에이전트가 읽을 수 있도록 파일로 요청 저장
    console.log(`[API] IDE 에이전트에게 분석을 요청합니다...`);
    fs.writeFileSync(reqFile, JSON.stringify({ id: reqId, path: targetPath }), 'utf8');

    // 2. 에이전트가 답변(reply) 파일을 만들어줄 때까지 최대 2분간 대기
    let attempts = 0;
    while (attempts < 120) {
      if (fs.existsSync(replyFile)) {
        const data = fs.readFileSync(replyFile, 'utf8');
        fs.unlinkSync(replyFile); // 읽고 나서 삭제
        console.log(`[API] 에이전트로부터 답변을 받았습니다!`);
        return NextResponse.json(JSON.parse(data));
      }
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    // 시간 초과
    return NextResponse.json({ error: '에이전트가 시간 내에 응답하지 않았습니다.' }, { status: 504 });

  } catch (error: any) {
    console.error('분석 API 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
