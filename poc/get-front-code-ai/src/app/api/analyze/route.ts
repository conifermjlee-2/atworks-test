import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepoWithAI } from '@/lib/analyzer';

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
    }

    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'GitHub URL is required' }, { status: 400 });
    }

    // Since AI inference takes time, we should normally use streaming,
    // but for simplicity we'll just wait for the full response here.
    // Ensure Next.js doesn't timeout the function (maxDuration in Vercel, but local is fine)
    
    const markdownResult = await analyzeRepoWithAI(url);

    return NextResponse.json({ result: markdownResult });
    
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
