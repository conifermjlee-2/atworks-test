import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepoWithAI } from '@/lib/analyzer';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // AI-based static analysis via Gemini
    const markdownResult = await analyzeRepoWithAI(url);

    return NextResponse.json({ result: markdownResult });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
