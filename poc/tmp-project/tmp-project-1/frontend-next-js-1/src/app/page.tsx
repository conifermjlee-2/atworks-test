import { ScenarioFlowTable } from '@/components/ScenarioFlowTable';
import { ScenarioFlowHorizontalTable } from '@/components/ScenarioFlowHorizontalTable';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 font-sans p-8 md:p-12">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        <header className="mb-4">
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-3">
            API Scenario Viewer
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            시스템 연계 흐름 및 전체 시나리오를 한 눈에 파악할 수 있습니다.
          </p>
        </header>
        
        <main className="flex flex-col gap-12">
          {/* 가로형 연계 흐름 */}
          <section>
            <ScenarioFlowHorizontalTable />
          </section>

          {/* 세로형 시나리오 흐름 */}
          <section>
            <ScenarioFlowTable />
          </section>
        </main>
      </div>
    </div>
  );
}
