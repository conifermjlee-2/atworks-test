import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepoWithAI } from '@/lib/analyzer';

export const maxDuration = 300; // 5 minutes max duration for Vercel/Next.js

export async function POST(req: NextRequest) {
  try {
    const { url, mode = 'github', analysisType = 'view-api' } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL or Path is required' }, { status: 400 });
    }

    // AI-based static analysis via Gemini
    const markdownResult = await analyzeRepoWithAI(url, mode, analysisType);

    return NextResponse.json({ result: markdownResult });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
