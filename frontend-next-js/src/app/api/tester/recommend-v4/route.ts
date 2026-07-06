import { NextResponse } from 'next/server';

const SPRING_BOOT_URL = 'http://localhost:8080/api/tester/recommend-v4';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const swaggerUrl = searchParams.get('swaggerUrl');
    const targetUrl = searchParams.get('targetUrl');
    const targetMethod = searchParams.get('targetMethod');
    
    if (!swaggerUrl || !targetUrl || !targetMethod) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const res = await fetch(
      `${SPRING_BOOT_URL}?swaggerUrl=${encodeURIComponent(swaggerUrl)}&targetUrl=${encodeURIComponent(targetUrl)}&targetMethod=${encodeURIComponent(targetMethod)}`,
      { method: 'GET' }
    );
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
