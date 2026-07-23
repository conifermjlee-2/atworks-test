import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    id: 1,
    name: "DeGreen",
    score: 23,
    isPassed: true
  });
}
