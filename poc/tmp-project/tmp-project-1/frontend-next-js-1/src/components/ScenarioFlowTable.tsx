import React from 'react';
import { ApiBadge } from './ApiBadge';
import { ArrowDown, Lightbulb } from 'lucide-react';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Step {
  method: Method;
  path: string;
  actionText: string;
}

interface ScenarioData {
  id: string;
  sourceScreen: string;
  sourcePath: string;
  triggerMethod: Method;
  triggerPath: string;
  sequence: Step[];
  description: string;
}

const mockData: ScenarioData[] = [
  {
    id: '1',
    sourceScreen: 'add-test-case-modal.tsx',
    sourcePath: 'src/features/main/components/add-test-case-modal/',
    triggerMethod: 'POST',
    triggerPath: '/tasks/{taskCode}/scenarios',
    sequence: [
      { method: 'POST', path: '/tasks/{taskCode}/scenarios', actionText: '호출' },
      { method: 'GET', path: '/tasks/{taskCode}/scenarios', actionText: '수동 갱신' },
      { method: 'GET', path: '/tasks/{taskCode}/scenarios/{scenarioId}/cases/{caseId}', actionText: '자동 갱신' },
    ],
    description: 'scenario 생성 시나리오',
  },
  {
    id: '2',
    sourceScreen: 'bt-my-task-view-modal.tsx',
    sourcePath: 'src/features/main/components/',
    triggerMethod: 'DELETE',
    triggerPath: '/tasks/{taskCode}/scenarios/{scenarioId}/cases',
    sequence: [
      { method: 'DELETE', path: '/tasks/{taskCode}/scenarios/{scenarioId}/cases', actionText: '호출' },
      { method: 'GET', path: 'me/tasks', actionText: '자동 갱신' },
    ],
    description: 'Task 케이스 삭제 시나리오',
  },
];

export const ScenarioFlowTable = () => {
  return (
    <div className="w-full bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="p-2.5 bg-amber-100 text-amber-500 rounded-xl dark:bg-amber-500/20 shadow-sm">
          <Lightbulb size={24} />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100">
          전체 시나리오 흐름 (Sequence)
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-900/50 text-sm font-semibold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-4 px-5 rounded-tl-xl w-[25%]">시작 화면</th>
              <th className="py-4 px-5 w-[25%]">트리거 API</th>
              <th className="py-4 px-5 w-[35%]">전체 시나리오 흐름 (Sequence)</th>
              <th className="py-4 px-5 rounded-tr-xl w-[15%]">목적/설명</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {mockData.map((row) => (
              <tr key={row.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                <td className="py-6 px-5 align-top">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px] mb-1.5">{row.sourceScreen}</div>
                  <div className="text-[13px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[200px] hover:max-w-none hover:text-zinc-600 transition-all cursor-default">
                    {row.sourcePath}
                  </div>
                </td>
                <td className="py-6 px-5 align-top">
                  <ApiBadge method={row.triggerMethod} path={row.triggerPath} />
                </td>
                <td className="py-6 px-5 align-top">
                  <div className="flex flex-col gap-3">
                    {row.sequence.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 text-sm font-bold font-mono">
                            {idx + 1}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-mono text-[15px] font-bold text-zinc-700 dark:text-zinc-300">
                              [{step.method}]
                            </span>
                            <code className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[13px] text-rose-600 dark:text-rose-400 font-mono shadow-sm border border-zinc-200 dark:border-zinc-700">
                              {step.path}
                            </code>
                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                              {step.actionText}
                            </span>
                          </div>
                        </div>
                        {idx < row.sequence.length - 1 && (
                          <div className="pl-3.5 text-blue-300 dark:text-blue-700">
                            <ArrowDown size={18} className="animate-bounce" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </td>
                <td className="py-6 px-5 align-top text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {row.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
