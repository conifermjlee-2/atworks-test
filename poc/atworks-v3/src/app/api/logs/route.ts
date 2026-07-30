import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rootPath = searchParams.get('rootPath');

  if (!rootPath) {
    return NextResponse.json({ error: 'rootPath is required' }, { status: 400 });
  }

  try {
    const logFilePath = path.join(rootPath, 'log', 'api_logs.json');
    const fileContent = await fs.readFile(logFilePath, 'utf-8');
    const logs = JSON.parse(fileContent);
    return NextResponse.json(logs);
  } catch (err) {
    // 파일이 없거나 파싱 실패 시 빈 객체 반환 (시나리오 등록은 계속 진행)
    return NextResponse.json({});
  }
}
