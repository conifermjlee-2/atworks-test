import { NextResponse } from 'next/server';
import { getApis, saveApi, deleteApi } from '@/lib/storage';

export async function GET() {
  try {
    const apis = getApis();
    // Sort by createdAt descending
    apis.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(apis);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, group, url, method, rules } = body;
    
    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    const newApi = saveApi({
      name,
      description: description || '',
      group: group || 'Default',
      url,
      method: method || 'GET',
      rules: rules || []
    });

    return NextResponse.json(newApi, { status: 201 });
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

    const success = deleteApi(id);
    if (success) {
      return NextResponse.json({ message: 'Deleted successfully' });
    } else {
      return NextResponse.json({ error: 'API not found' }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
