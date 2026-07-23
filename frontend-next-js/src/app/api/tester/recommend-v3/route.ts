import { NextResponse } from 'next/server';

const SPRING_BOOT_URL = 'http://localhost:8080/api/validation-v3/recommend';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { swaggerUrl, targetPath, targetMethod } = body;
    
    if (!swaggerUrl || !targetPath || !targetMethod) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const res = await fetch(
      `${SPRING_BOOT_URL}?swaggerUrl=${encodeURIComponent(swaggerUrl)}&targetUrl=${encodeURIComponent(targetPath)}&targetMethod=${encodeURIComponent(targetMethod)}`,
      { method: 'GET' }
    );
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
