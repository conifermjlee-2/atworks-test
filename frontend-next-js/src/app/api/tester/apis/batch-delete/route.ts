import { NextResponse } from 'next/server';

const SPRING_BOOT_URL = 'http://localhost:8080/api/registry/batch';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const res = await fetch(SPRING_BOOT_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids)
    });
    
    if (res.ok) {
      return NextResponse.json({ message: 'Batch delete successful' });
    } else {
      return NextResponse.json({ error: 'Failed to batch delete' }, { status: res.status });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
