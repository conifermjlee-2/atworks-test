import { NextResponse } from 'next/server';

export async function GET() {
  // 테스트를 위해 문자(String), 숫자(Number), 불리언(Boolean)이 
  // 골고루 섞여있는 3개의 배열(Array) 형태의 목업(Mock) 데이터를 반환합니다.
  const mockData = [
    {
      id: 1,
      name: "Alice",
      score: 95.5,
      isPassed: true
    },
    {
      id: 2,
      name: "Bob",
      score: 42.0,
      isPassed: false
    },
    {
      id: 3,
      name: "Charlie",
      score: 78.3,
      isPassed: true
    }
  ];

  return NextResponse.json(mockData);
}
