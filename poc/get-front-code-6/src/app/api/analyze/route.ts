import { NextResponse } from 'next/server';
import { analyzeProject } from '@/core/analyzer';
import { assertReadableDirectory } from '@/core/path-guard';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const targetPath = await assertReadableDirectory(body.targetPath);
    const result = await analyzeProject(targetPath);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown analysis error.' },
      { status: 400 },
    );
  }
}
