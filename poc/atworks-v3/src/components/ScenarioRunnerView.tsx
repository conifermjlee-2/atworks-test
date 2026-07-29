'use client';

import React, { useState, useEffect } from 'react';
import { ApiItem } from '../app/page';

interface ScenarioRunnerViewProps {
  collectionId: string;
  apiItems: ApiItem[];
}

export default function ScenarioRunnerView({ collectionId, apiItems }: ScenarioRunnerViewProps) {
  const [steps, setSteps] = useState<any[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [results, setResults] = useState<Record<string, { status: 'idle' | 'loading' | 'success' | 'error', data?: any, error?: string }>>({});

  useEffect(() => {
    // Initialize editable states
    setSteps(apiItems.map(api => ({
      ...api,
      editableUrl: api.url,
      editableBody: api.body
    })));
  }, [apiItems]);

  const updateStep = (id: string, field: string, value: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const runStep = async (step: any) => {
    if (!step.editableUrl || step.editableUrl.includes('${')) {
      setResults(prev => ({ ...prev, [step.id]: { status: 'error', error: '유효하지 않은 URL이거나 템플릿 변수(${...})가 포함되어 있습니다. 수정해주세요.' } }));
      return false;
    }

    setResults(prev => ({ ...prev, [step.id]: { status: 'loading' } }));
    
    try {
      const options: RequestInit = {
        method: step.method,
      };
      
      if (step.method !== 'GET' && step.method !== 'HEAD' && step.method !== 'REFETCH') {
        options.body = step.editableBody;
        options.headers = {
          'Content-Type': 'application/json'
        };
      }

      // If method is REFETCH or Mutation (not real HTTP methods), we can't really fetch them directly, but let's try or show a mock.
      if (step.method === 'REFETCH') {
         setTimeout(() => {
            setResults(prev => ({ ...prev, [step.id]: { status: 'success', data: { message: 'Mock Refetch Success' } } }));
         }, 500);
         return true;
      }

      const res = await fetch(step.editableUrl, options);
      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        setResults(prev => ({ ...prev, [step.id]: { status: 'success', data } }));
        return true;
      } else {
        setResults(prev => ({ ...prev, [step.id]: { status: 'error', error: `HTTP ${res.status}: ${JSON.stringify(data)}` } }));
        return false;
      }
    } catch (err: any) {
      setResults(prev => ({ ...prev, [step.id]: { status: 'error', error: err.message || 'Network error' } }));
      return false;
    }
  };

  const runAll = async () => {
    setIsRunningAll(true);
    // Reset all statuses to idle
    const resetRes: any = {};
    steps.forEach(s => resetRes[s.id] = { status: 'idle' });
    setResults(resetRes);

    for (let i = 0; i < steps.length; i++) {
      const success = await runStep(steps[i]);
      if (!success) {
        // Stop execution if a step fails
        break;
      }
    }
    setIsRunningAll(false);
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-green-400';
      case 'POST': return 'text-orange-400';
      case 'PUT': return 'text-blue-400';
      case 'DELETE': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-y-auto">
      <div className="p-6 border-b border-gray-800 bg-[#252628] sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="text-orange-500 mr-2">▶</span> 
            시나리오 런너 (Scenario Runner)
          </h2>
          <p className="text-sm text-gray-400 mt-1">등록된 전이 API들을 순서대로 실행합니다. URL의 동적 변수를 수정한 뒤 실행하세요.</p>
        </div>
        <button
          onClick={runAll}
          disabled={isRunningAll || steps.length === 0}
          className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded font-bold shadow-lg transition-all"
        >
          {isRunningAll ? '실행 중...' : '전체 시나리오 순차 실행'}
        </button>
      </div>

      <div className="p-8 max-w-5xl mx-auto w-full flex flex-col space-y-6">
        {steps.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            이 컬렉션에는 등록된 API가 없습니다.
          </div>
        ) : (
          steps.map((step, idx) => {
            const result = results[step.id] || { status: 'idle' };
            
            return (
              <div key={step.id} className="bg-[#252628] border border-gray-700 rounded-lg overflow-hidden shadow-lg flex flex-col">
                {/* Header */}
                <div className="bg-[#2b2c2f] px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                  <div className="font-bold text-gray-300">
                    <span className="bg-gray-700 text-white px-2 py-0.5 rounded text-xs mr-3">Step {idx + 1}</span>
                    {step.name.replace(/^Step \d+: /, '')}
                  </div>
                  <div className="flex items-center space-x-3">
                    {result.status === 'loading' && <span className="text-yellow-400 text-sm font-bold animate-pulse">Running...</span>}
                    {result.status === 'success' && <span className="text-green-400 text-sm font-bold">✅ Success</span>}
                    {result.status === 'error' && <span className="text-red-400 text-sm font-bold">❌ Failed</span>}
                    <button 
                      onClick={() => runStep(step)}
                      disabled={result.status === 'loading'}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs text-white transition-colors"
                    >
                      단일 실행
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col space-y-4">
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold w-16 ${getMethodColor(step.method)}`}>{step.method}</span>
                    <input 
                      type="text" 
                      value={step.editableUrl}
                      onChange={(e) => updateStep(step.id, 'editableUrl', e.target.value)}
                      className={`flex-1 bg-[#121316] text-white px-3 py-2 border rounded focus:outline-none font-mono text-sm ${step.editableUrl.includes('${') ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'}`}
                    />
                  </div>
                  
                  {step.editableUrl.includes('${') && (
                    <div className="text-red-400 text-xs pl-18">
                      ⚠️ 주의: URL에 템플릿 변수가 포함되어 있습니다. 실제 값으로 변경해야 실행이 가능합니다.
                    </div>
                  )}

                  {(step.method === 'POST' || step.method === 'PUT' || step.method === 'PATCH') && (
                    <div className="pl-18">
                      <textarea 
                        value={step.editableBody}
                        onChange={(e) => updateStep(step.id, 'editableBody', e.target.value)}
                        placeholder="Request Body (JSON)"
                        className="w-full bg-[#121316] text-green-400 px-3 py-2 border border-gray-700 rounded focus:outline-none focus:border-orange-500 font-mono text-xs h-20 resize-none"
                      />
                    </div>
                  )}

                  {/* Result Box */}
                  {result.status !== 'idle' && (
                    <div className={`mt-4 p-3 rounded text-xs font-mono overflow-auto max-h-48 ${result.status === 'error' ? 'bg-red-900/20 text-red-300 border border-red-900/50' : 'bg-gray-900 text-gray-300 border border-gray-700'}`}>
                      {result.status === 'error' ? result.error : JSON.stringify(result.data, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
