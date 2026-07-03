import { NextResponse } from 'next/server';

const SPRING_BOOT_URL = 'http://localhost:8080/api/registry/pull';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { swaggerUrl } = body;
    
    if (!swaggerUrl) {
      return NextResponse.json({ error: 'swaggerUrl is required' }, { status: 400 });
    }

    const res = await fetch(SPRING_BOOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swaggerUrl })
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
