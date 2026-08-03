'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ApiItem } from '../app/page';

interface ScenarioRunnerViewProps {
  collectionId: string;
  apiItems: ApiItem[];
  activeApiId?: string | null;
}

export default function ScenarioRunnerView({ collectionId, apiItems, activeApiId }: ScenarioRunnerViewProps) {
  const [steps, setSteps] = useState<any[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [results, setResults] = useState<Record<string, { status: 'idle' | 'loading' | 'success' | 'error', data?: any, error?: string }>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let savedParams: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        savedParams = JSON.parse(localStorage.getItem('scenario-path-params') || '{}');
      } catch (e) {}
    }

    // Initialize editable states
    setSteps(apiItems.map(api => {
      const pathParams: Record<string, string> = {};
      const regex = /{([^}]+)}/g;
      let match;
      let newUrl = api.url;
      while ((match = regex.exec(api.url)) !== null) {
        const paramName = match[1];
        const savedVal = savedParams[paramName] || '';
        pathParams[paramName] = savedVal;
        if (savedVal) {
          newUrl = newUrl.replace(`{${paramName}}`, savedVal);
        }
      }
      return {
        ...api,
        originalUrl: api.url,
        editableUrl: newUrl,
        editableBody: api.body,
        pathParams
      };
    }));
  }, [apiItems]);

  useEffect(() => {
    if (activeApiId && steps.length > 0) {
      const el = document.getElementById(`step-${activeApiId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 15px rgba(249, 115, 22, 0.6)';
        setTimeout(() => {
          el.style.boxShadow = 'none';
        }, 2000);
      }
    }
  }, [activeApiId, steps]);

  const updateStep = (id: string, field: string, value: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updatePathParam = (stepId: string, param: string, value: string) => {
    if (typeof window !== 'undefined') {
      try {
        const savedParams = JSON.parse(localStorage.getItem('scenario-path-params') || '{}');
        savedParams[param] = value;
        localStorage.setItem('scenario-path-params', JSON.stringify(savedParams));
      } catch (e) {}
    }

    setSteps(prev => prev.map(s => {
      if (s.id !== stepId) return s;
      const newPathParams = { ...s.pathParams, [param]: value };
      
      let newUrl = s.originalUrl;
      for (const [key, val] of Object.entries(newPathParams)) {
        if (val) {
          newUrl = newUrl.replace(`{${key}}`, val as string);
        }
      }
      
      return { ...s, pathParams: newPathParams, editableUrl: newUrl };
    }));
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
      await runStep(steps[i]);
      // 사용자의 요청에 따라, 스텝이 실패하더라도 다음 스텝을 계속 실행합니다.
    }
    setIsRunningAll(false);
  };

  const handleCopyAll = () => {
    const textToCopy = steps.map((step, idx) => {
      const result = results[step.id];
      let text = `[Step ${idx + 1}] ${step.method} ${step.editableUrl}\n`;
      if (step.editableBody) {
        text += `Body:\n${step.editableBody}\n`;
      }
      if (result && result.status !== 'idle') {
        text += `Result:\n${result.status === 'error' ? result.error : JSON.stringify(result.data, null, 2)}\n`;
      }
      return text;
    }).join('\n----------------------------------------\n\n');
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast.success('전체 시나리오 내용이 복사되었습니다.'))
      .catch(err => toast.error('복사에 실패했습니다.'));
  };

  const handleCopyStep = (step: any, idx: number) => {
    const result = results[step.id];
    let text = `[Step ${idx + 1}] ${step.method} ${step.editableUrl}\n`;
    if (step.editableBody) {
      text += `Body:\n${step.editableBody}\n`;
    }
    if (result && result.status !== 'idle') {
      text += `Result:\n${result.status === 'error' ? result.error : JSON.stringify(result.data, null, 2)}\n`;
    }
    
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`Step ${idx + 1} 내용이 복사되었습니다.`))
      .catch(err => toast.error('복사에 실패했습니다.'));
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
        <div className="flex space-x-3 items-center">
          <button
            onClick={() => {
              const newExpanded: Record<string, boolean> = {};
              steps.forEach(s => newExpanded[s.id] = true);
              setExpandedSteps(newExpanded);
            }}
            className="text-gray-400 hover:text-white px-2 py-1 text-sm transition-colors"
          >
            전체 펴기
          </button>
          <button
            onClick={() => setExpandedSteps({})}
            className="text-gray-400 hover:text-white px-2 py-1 text-sm transition-colors mr-2"
          >
            전체 접기
          </button>
          <button
            onClick={handleCopyAll}
            disabled={steps.length === 0}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded font-bold shadow-lg transition-all"
          >
            전체 내용 복사
          </button>
          <button
            onClick={runAll}
            disabled={isRunningAll || steps.length === 0}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded font-bold shadow-lg transition-all"
          >
            {isRunningAll ? '실행 중...' : '전체 시나리오 순차 실행'}
          </button>
        </div>
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
              <div key={step.id} id={`step-${step.id}`} className="bg-[#252628] border border-gray-700 rounded-lg overflow-hidden shadow-lg flex flex-col">
                {/* Header */}
                <div 
                  className="bg-[#2b2c2f] px-4 py-3 border-b border-gray-700 flex justify-between items-center cursor-pointer select-none hover:bg-[#323336]"
                  onClick={() => setExpandedSteps(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                >
                  <div className="font-bold text-gray-300 flex items-center">
                    <span className="w-4 inline-block text-[10px] text-gray-500 mr-1">{expandedSteps[step.id] ? '▼' : '▶'}</span>
                    <span className="bg-gray-700 text-white px-2 py-0.5 rounded text-xs mr-3">Step {idx + 1}</span>
                    {step.name.replace(/^Step \d+: /, '')}
                  </div>
                  <div className="flex items-center space-x-3">
                    {result.status === 'loading' && <span className="text-yellow-400 text-sm font-bold animate-pulse">Running...</span>}
                    {result.status === 'success' && <span className="text-green-400 text-sm font-bold">✅ Success</span>}
                    {result.status === 'error' && <span className="text-red-400 text-sm font-bold">❌ Failed</span>}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleCopyStep(step, idx); }}
                      className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-xs text-white transition-colors"
                    >
                      내용 복사
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); runStep(step); }}
                      disabled={result.status === 'loading'}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs text-white transition-colors"
                    >
                      단일 실행
                    </button>
                  </div>
                </div>

                {/* Body */}
                {expandedSteps[step.id] && (
                  <div className="p-4 flex flex-col space-y-4">
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold w-16 ${getMethodColor(step.method)}`}>{step.method}</span>
                    <input 
                      type="text" 
                      value={step.editableUrl}
                      onChange={(e) => updateStep(step.id, 'editableUrl', e.target.value)}
                      className={`flex-1 bg-[#121316] text-white px-3 py-2 border rounded focus:outline-none font-mono text-sm ${step.editableUrl.includes('{') ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'}`}
                    />
                  </div>
                  
                  {step.editableUrl.includes('{') && (
                    <div className="text-red-400 text-xs pl-18" style={{ marginTop: '4px' }}>
                      ⚠️ 주의: URL에 동적 변수가 포함되어 있습니다. 하단의 Path Variables 폼에 값을 입력해 주세요.
                    </div>
                  )}

                  {/* Path Variables UI */}
                  {step.pathParams && Object.keys(step.pathParams).length > 0 && (
                    <div className="pl-18 mt-2 flex flex-col gap-2 bg-[#1a1b1e] p-3 rounded border border-gray-700">
                      <div className="text-xs text-gray-400 font-bold mb-1">PATH VARIABLES</div>
                      {Object.keys(step.pathParams).map(param => (
                        <div key={param} className="flex items-center space-x-2">
                          <span className="text-gray-300 font-mono text-sm w-20 flex-shrink-0 text-right">{param}</span>
                          <input 
                            type="text" 
                            value={step.pathParams[param]}
                            onChange={(e) => updatePathParam(step.id, param, e.target.value)}
                            placeholder={`Enter ${param}`}
                            className="flex-1 bg-[#121316] text-white px-2 py-1 border border-gray-700 rounded focus:outline-none focus:border-orange-500 font-mono text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {(step.method === 'POST' || step.method === 'PUT' || step.method === 'PATCH') && (
                    <div className="pl-18">
                      <textarea 
                        value={step.editableBody}
                        onChange={(e) => updateStep(step.id, 'editableBody', e.target.value)}
                        placeholder="Request Body (JSON)"
                        className="w-full bg-[#121316] text-green-400 px-3 py-2 border border-gray-700 rounded focus:outline-none focus:border-orange-500 font-mono text-xs min-h-[5rem] h-20 resize-y"
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
