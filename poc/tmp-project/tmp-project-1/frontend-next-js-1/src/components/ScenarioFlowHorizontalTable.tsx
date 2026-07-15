import React from 'react';
import { ApiBadge } from './ApiBadge';
import { ArrowRight, RefreshCcw } from 'lucide-react';

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
  },
];

export const ScenarioFlowHorizontalTable = () => {
  return (
    <div className="w-full bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="p-2.5 bg-blue-100 text-blue-500 rounded-xl dark:bg-blue-500/20 shadow-sm">
          <RefreshCcw size={24} />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100">
          연계 흐름 (Flow)
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-900/50 text-sm font-semibold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-4 px-5 rounded-tl-xl w-[25%]">시작 화면</th>
              <th className="py-4 px-5 w-[25%]">API</th>
              <th className="py-4 px-5 rounded-tr-xl w-[50%]">연계 흐름 (Flow)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {mockData.map((row) => (
              <tr key={row.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                <td className="py-6 px-5 align-middle">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px] mb-1.5">{row.sourceScreen}</div>
                  <div className="text-[13px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[250px] hover:max-w-none hover:text-zinc-600 transition-all cursor-default">
                    {row.sourcePath}
                  </div>
                </td>
                <td className="py-6 px-5 align-middle">
                  <ApiBadge method={row.triggerMethod} path={row.triggerPath} />
                </td>
                <td className="py-6 px-5 align-middle">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.sequence.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="font-mono text-[14px] font-bold text-zinc-700 dark:text-zinc-300">
                            [{step.method}]
                          </span>
                          <span className="text-[14px] text-zinc-700 dark:text-zinc-300">
                            {step.path}
                          </span>
                          <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            {step.actionText}
                          </span>
                        </div>
                        {idx < row.sequence.length - 1 && (
                          <div className="text-zinc-300 dark:text-zinc-700 flex-shrink-0 px-1">
                            <ArrowRight size={18} />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
