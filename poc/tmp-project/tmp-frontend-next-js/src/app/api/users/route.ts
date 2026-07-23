import { NextResponse } from 'next/server';
import { getQuery, runQuery } from '@/lib/db';

export async function GET() {
  try {
    const users = await getQuery('SELECT * FROM users ORDER BY id DESC');
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required' }, { status: 400 });
    }

    await runQuery('INSERT INTO users (name, password) VALUES (?, ?)', [name, password]);
    
    return NextResponse.json({ success: true, message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
