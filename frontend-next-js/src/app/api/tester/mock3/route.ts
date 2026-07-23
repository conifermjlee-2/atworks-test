import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    code: "SUCCESS",
    message: "정상적으로 조회되었습니다.",
    data: {
      user: {
        profile: {
          id: 999,
          username: "tester_pro",
          level: 42,
          isPremium: true
        },
        settings: {
          theme: "dark",
          emailAlerts: false
        }
      },
      company: {
        department: {
          name: "Engineering",
          code: "ENG-001"
        }
      }
    }
  });
}
