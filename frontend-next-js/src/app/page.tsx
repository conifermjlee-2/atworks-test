import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="container mx-auto p-8">
      <header className="header text-center mt-[10vh]">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-br from-purple-500 to-pink-500 bg-clip-text text-transparent">
          ATWORKS 기능 대시보드
        </h2>
        <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
          환영합니다! 좌측 사이드바에서 원하시는 기능을 선택하여 테스트 및 검증을 진행할 수 있습니다.
        </p>
      </header>

      <div className="flex justify-center mt-16 gap-8">
        <Link href="/validation" className="no-underline text-inherit group">
          <Card className="w-[300px] text-center p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <CardHeader>
              <div className="text-5xl mb-4">✅</div>
              <CardTitle className="text-2xl">값 검증기</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                API 응답 바디를 자동으로 분석하고 커스텀 검증 규칙을 테스트합니다.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
