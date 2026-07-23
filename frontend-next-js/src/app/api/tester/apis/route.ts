import { NextResponse } from 'next/server';

const SPRING_BOOT_URL = 'http://localhost:8080/api/registry';

export async function GET() {
  try {
    const res = await fetch(SPRING_BOOT_URL, { cache: 'no-store' });
    const data = await res.json();
    
    // Spring Boot 모델 구조를 프론트엔드 구조에 맞게 매핑
    const mappedData = data.map((api: any) => ({
      ...api,
      group: api.apiGroup, // apiGroup을 group으로 매핑
      method: api.httpMethod, // httpMethod를 method로 매핑
      rules: [] // 현재 룰 관리는 2차 구현으로 미뤄두었으므로 빈 배열로 반환
    }));
    
    return NextResponse.json(mappedData, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, group, url, method } = body;
    
    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    const res = await fetch(SPRING_BOOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || '',
        apiGroup: group || 'Default',
        url,
        httpMethod: method || 'GET',
      })
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const res = await fetch(`${SPRING_BOOT_URL}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      return NextResponse.json({ message: 'Deleted successfully' });
    } else {
      return NextResponse.json({ error: 'API not found' }, { status: res.status });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
