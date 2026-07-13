'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Search, FolderOpen, Globe, Copy, Check, ArrowRight } from 'lucide-react';

type AnalysisType = 'view-api' | 'api-flow' | 'state-flow' | 'scenario';
type InputMode = 'local' | 'github';

const ANALYSIS_TABS: { type: AnalysisType; icon: string; label: string; desc: string; purpose: string }[] = [
  { 
    type: 'view-api', icon: '🔌', label: 'View-API 매핑',
    desc: '각 UI 컴포넌트 파일이 어떤 API를 호출하는지 1:1로 추출하여 매핑합니다.',
    purpose: '프론트엔드 화면과 백엔드 API 간의 의존성을 직관적으로 파악하고, 특정 화면에서 어떤 데이터를 읽고 쓰는지 식별하기 위함입니다.'
  },
  { 
    type: 'api-flow', icon: '🔄', label: 'API 연계 흐름',
    desc: 'API 호출 후 RTK Query의 캐시 무효화(invalidatesTags)나 명시적 재호출(refetch)로 인해 자동으로 이어지는 연쇄 호출을 추적합니다.',
    purpose: '단일 동작이 화면 전체 데이터에 미치는 파급 효과(Side-effect)를 파악하여, 데이터 동기화 누락이나 불필요한 중복 갱신을 방지하기 위함입니다.'
  },
  { 
    type: 'scenario', icon: '💡', label: '시나리오 추천',
    desc: '추출된 API 연계 흐름을 바탕으로 사용자의 행동(Action)이 어떤 결과(Result)를 낳는지 E2E 시나리오 형태로 제공합니다.',
    purpose: '단순한 API 목록을 넘어 실제 비즈니스 로직 기반의 통합 테스트 시나리오를 자동 도출하고, QA 및 테스트 케이스 작성 비용을 획기적으로 줄이기 위함입니다.'
  },
  { 
    type: 'state-flow', icon: '📦', label: '상태 관리 흐름',
    desc: 'Zustand, Redux 등 프론트엔드 전역 상태(State)가 어느 컴포넌트에서 읽히고 변경되는지 추적합니다.',
    purpose: '복잡한 화면 간 상태 공유 구조를 한눈에 파악하고, 의도치 않은 전역 상태 오염으로 인한 버그를 추적 및 예방하기 위함입니다.'
  },
];

export default function Home() {
  const [url, setUrl] = useState('C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('local');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('view-api');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setResult('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mode: inputMode,
          analysisType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '분석에 실패했습니다');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[95%] mx-auto space-y-8">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            ⚡ 프론트엔드 코드 정적 분석기
          </h1>
          <p className="mt-3 text-base text-slate-500">
            AI 없이, 코드 스캐닝만으로 1초 이내에 RTK Query 기반 API 연계 구조를 분석합니다
          </p>
        </div>

        {/* 입력 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 space-y-5">
            {/* 입력 모드 토글 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInputMode('local')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'local'
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <FolderOpen className="h-4 w-4" />
                로컬 폴더
              </button>
              <button
                onClick={() => setInputMode('github')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'github'
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Globe className="h-4 w-4" />
                GitHub URL
              </button>
            </div>

            {/* URL/경로 입력 + 분석 버튼 */}
            <form onSubmit={handleAnalyze} className="flex gap-3">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                  placeholder={
                    inputMode === 'local'
                      ? 'C:\\Users\\lee\\...\\apps\\agent-bt'
                      : 'https://github.com/사용자명/저장소'
                  }
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    분석 중...
                  </>
                ) : (
                  '⚡ 분석'
                )}
              </button>
            </form>

            {/* 분석 타입 탭 (로컬 모드에서만 표시) */}
            {inputMode === 'local' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {ANALYSIS_TABS.map((tab) => (
                    <button
                      key={tab.type}
                      onClick={() => setAnalysisType(tab.type)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        analysisType === tab.type
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* 선택된 탭의 목적/설명 패널 */}
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100/60 flex gap-3.5 shadow-sm">
                  <div className="text-2xl pt-0.5 opacity-90">
                    {ANALYSIS_TABS.find(t => t.type === analysisType)?.icon}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-800">
                      {ANALYSIS_TABS.find(t => t.type === analysisType)?.label} 기능 설명
                    </p>
                    <p className="text-[13px] text-slate-600 leading-relaxed">
                      {ANALYSIS_TABS.find(t => t.type === analysisType)?.desc}
                    </p>
                    <p className="text-[13px] text-blue-700 font-semibold pt-1 border-t border-blue-100/50 mt-2">
                      🎯 작업 목적: {ANALYSIS_TABS.find(t => t.type === analysisType)?.purpose}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 에러 표시 */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* 결과 표시 */}
        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
              <span className="text-sm font-semibold text-slate-700 pl-2">분석 결과</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사 완료!' : '마크다운 복사'}
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-250px)] w-full rounded-b-xl border-t border-slate-200 bg-slate-50/30">
              <div className="p-4 sm:p-6 prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-900">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children, ...props }: any) => (
                      <div className="w-full overflow-x-auto shadow-sm rounded-xl border border-slate-200 my-4 bg-white">
                        <table className="w-full text-left border-collapse text-sm" {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children, ...props }: any) => (
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium" {...props}>
                        {children}
                      </thead>
                    ),
                    th: ({ children, ...props }: any) => (
                      <th className="px-4 py-3.5 whitespace-nowrap sticky top-0 bg-slate-50 z-10" {...props}>
                        {children}
                      </th>
                    ),
                    tr: ({ children, ...props }: any) => (
                      <tr className="border-b border-slate-100 last:border-0 even:bg-slate-50/50 hover:bg-blue-50/40 transition-colors" {...props}>
                        {children}
                      </tr>
                    ),
                    td: ({ children, ...props }: any) => {
                      const renderChildren = (node: any): any => {
                        if (typeof node === 'string' && node.includes('➡️')) {
                          const parts = node.split('➡️');
                          return parts.map((part, i) => (
                            <span key={i} className="flex items-center gap-1.5 shrink-0">
                              <span className="py-1">{part}</span>
                              {i < parts.length - 1 && (
                                <span className="text-slate-400 mx-1 flex-shrink-0">
                                  <ArrowRight className="w-4 h-4" />
                                </span>
                              )}
                            </span>
                          ));
                        }
                        if (Array.isArray(node)) {
                          const hasArrow = node.some(n => typeof n === 'string' && n.includes('➡️'));
                          const mapped = node.map((n, i) => <React.Fragment key={i}>{renderChildren(n)}</React.Fragment>);
                          return hasArrow ? <div className="flex flex-wrap items-center gap-x-1 gap-y-2">{mapped}</div> : mapped;
                        }
                        return node;
                      };

                      // ⬇️ 수직 시퀀스 그룹화 로직
                      const groups: any[][] = [[]];
                      React.Children.forEach(children, (child) => {
                        if (typeof child === 'string' && child.includes('⬇️')) {
                          const parts = child.split('⬇️');
                          groups[groups.length - 1].push(parts[0]);
                          for (let i = 1; i < parts.length; i++) {
                            groups.push([parts[i]]);
                          }
                        } else {
                          groups[groups.length - 1].push(child);
                        }
                      });

                      if (groups.length > 1) {
                         return (
                           <td className="px-4 py-4 align-middle leading-relaxed break-words max-w-xl" {...props}>
                             <div className="flex flex-col gap-4 py-2">
                               {groups.map((grp, i) => (
                                 <div key={i} className="flex flex-col gap-3">
                                   <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                                      {grp.map((n, j) => <React.Fragment key={j}>{renderChildren(n)}</React.Fragment>)}
                                   </div>
                                   {i < groups.length - 1 && (
                                     <div className="flex justify-start pl-6 w-full mt-[-4px] mb-[-4px]">
                                       <div className="bg-slate-100 p-1.5 rounded-full ring-4 ring-white shadow-sm z-10">
                                         <ArrowRight className="w-4 h-4 text-blue-500 rotate-90" />
                                       </div>
                                     </div>
                                   )}
                                 </div>
                               ))}
                             </div>
                           </td>
                         );
                      }

                      return <td className="px-4 py-3 align-middle leading-relaxed break-words max-w-xl" {...props}>{renderChildren(children)}</td>;
                    },
                    code: ({ inline, className, children, ...props }: any) => {
                      const text = String(children).trim();
                      
                      // HTTP Method 뱃지
                      const methodMatch = text.match(/^\[(GET|POST|DELETE|PUT|PATCH)\]/);
                      if (methodMatch) {
                        const method = methodMatch[1];
                        const rest = text.replace(`[${method}]`, '').trim();
                        let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
                        let dotClass = 'bg-slate-400';
                        
                        if (method === 'GET') { colorClass = 'bg-green-100 text-green-700 border-green-200'; dotClass = 'bg-green-500'; }
                        else if (method === 'POST') { colorClass = 'bg-blue-100 text-blue-700 border-blue-200'; dotClass = 'bg-blue-500'; }
                        else if (method === 'DELETE') { colorClass = 'bg-red-100 text-red-700 border-red-200'; dotClass = 'bg-red-500'; }
                        else if (method === 'PUT' || method === 'PATCH') { colorClass = 'bg-amber-100 text-amber-700 border-amber-200'; dotClass = 'bg-amber-500'; }
                        
                        return (
                          <span className="inline-flex items-center gap-2 bg-white border border-slate-100 rounded-md px-1.5 py-1 shadow-sm shrink-0">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${colorClass} border`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                              {method}
                            </span>
                            <code className="text-slate-600 bg-transparent text-[13px] pr-1" {...props}>{rest}</code>
                          </span>
                        );
                      }
                      
                      // 파일 경로 스마트 포맷팅 (디렉토리와 파일명 분리)
                      if (text.includes('/') && text.includes('.') && !text.includes(' ')) {
                        const parts = text.split('/');
                        const filename = parts.pop();
                        const dir = parts.join('/');
                        return (
                          <div className="flex flex-col gap-0.5 w-max max-w-[280px]">
                            <span className="font-semibold text-slate-800 truncate text-[13px]" title={filename}>{filename}</span>
                            {dir && <span className="text-[11px] text-slate-400 truncate" title={dir}>{dir}/</span>}
                          </div>
                        );
                      }
                      
                      // 기본 코드 블록
                      return (
                        <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-200 shrink-0" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {result}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
