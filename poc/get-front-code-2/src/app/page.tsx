'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Loader2, Search, FolderOpen, Globe, Copy, Check, ArrowRight, ArrowDown, Maximize2, Minimize2 } from 'lucide-react';

type AnalysisType = 'view-api' | 'api-flow' | 'state-flow' | 'scenario';
type InputMode = 'local' | 'github';

const ANALYSIS_TABS: { type: AnalysisType; icon: string; label: string; desc: string; purpose: string }[] = [
  { 
    type: 'view-api', icon: '🔌', label: 'View-API 매핑',
    desc: '각 UI 컴포넌트 파일이 어떤 API를 호출하는지 1:1로 추출하여 매핑합니다.',
    purpose: '프론트엔드 화면과 백엔드 API 간의 의존성을 직관적으로 파악하고, 특정 화면에서 어떤 데이터를 읽고 쓰는지 식별하기 위함입니다.'
  },
  { 
    type: 'api-flow', icon: '🔄', label: '연계 흐름 (Flow)',
    desc: 'API 호출 후 RTK Query의 캐시 무효화(invalidatesTags)나 명시적 재호출(refetch)로 인해 자동으로 이어지는 연쇄 호출을 추적합니다.',
    purpose: '단일 동작이 화면 전체 데이터에 미치는 파급 효과(Side-effect)를 파악하여, 데이터 동기화 누락이나 불필요한 중복 갱신을 방지하기 위함입니다.'
  },
  { 
    type: 'scenario', icon: '💡', label: '전체 시나리오 흐름 (Sequence)',
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

  const handleToggleDetails = (expand: boolean) => {
    const details = document.querySelectorAll('details');
    details.forEach(detail => {
      if (expand) detail.setAttribute('open', 'true');
      else detail.removeAttribute('open');
    });
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

            {/* 빠른 입력 (로컬 모드) */}
            {inputMode === 'local' && (
              <div className="flex flex-col gap-1.5 mt-[-10px] pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 min-w-[70px]">💡 실전 예제:</span>
                  <button
                    type="button"
                    onClick={() => setUrl('C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt')}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:underline transition-colors focus:outline-none cursor-pointer"
                  >
                    C:\Users\lee\Desktop\atworks\ai\davis-frontend\apps\agent-bt
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 min-w-[70px]">💡 샘플 예제:</span>
                  <button
                    type="button"
                    onClick={() => setUrl('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\get-front-code-2\\sample-react')}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:underline transition-colors focus:outline-none cursor-pointer"
                  >
                    C:\Users\lee\Desktop\atworks-test\poc\get-front-code-2\sample-react
                  </button>
                </div>
              </div>
            )}

            {/* 빠른 입력 (GitHub 모드) */}
            {inputMode === 'github' && (
              <div className="flex flex-col gap-1.5 mt-[-10px] pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 min-w-[70px]">💡 예제 1:</span>
                  <button
                    type="button"
                    onClick={() => setUrl('https://github.com/johnpooch/rtk-query-example-app.git')}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:underline transition-colors focus:outline-none cursor-pointer truncate text-left"
                  >
                    https://github.com/johnpooch/rtk-query-example-app.git
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 min-w-[70px]">💡 예제 2:</span>
                  <button
                    type="button"
                    onClick={() => setUrl('https://github.com/skccmygit/davis-frontend/tree/develop/apps/agent-bt')}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:underline transition-colors focus:outline-none cursor-pointer truncate text-left"
                  >
                    https://github.com/skccmygit/davis-frontend/tree/develop/apps/agent-bt
                  </button>
                </div>
              </div>
            )}

            {/* 분석 타입 탭 */}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleDetails(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> 모두 펼치기
                </button>
                <button
                  onClick={() => handleToggleDetails(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <Minimize2 className="w-3.5 h-3.5" /> 모두 접기
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '복사 완료!' : '마크다운 복사'}
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-250px)] w-full rounded-b-xl border-t border-slate-200 bg-slate-50/30">
              <div className="p-4 sm:p-6 prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-900">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    table: ({ children, ...props }: any) => (
                      <div className="w-full overflow-x-auto shadow-sm rounded-2xl border border-slate-200/80 my-6 bg-white">
                        <table className="w-full text-left border-collapse text-[15px] min-w-[800px]" {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children, ...props }: any) => (
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-semibold" {...props}>
                        {children}
                      </thead>
                    ),
                    th: ({ children, ...props }: any) => (
                      <th className="px-5 py-4 whitespace-nowrap sticky top-0 bg-slate-50/80 z-10 first:rounded-tl-2xl last:rounded-tr-2xl" {...props}>
                        {children}
                      </th>
                    ),
                    tr: ({ children, ...props }: any) => (
                      <tr className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors" {...props}>
                        {children}
                      </tr>
                    ),
                    td: ({ children, ...props }: any) => {
                      const renderTextWithBadges = (text: string) => {
                        if (typeof text !== 'string') return text;
                        // 매칭: [GET], [POST] 등을 캡처하여 분리
                        const regex = /(\[(?:GET|POST|DELETE|PUT|PATCH)\])/;
                        const parts = text.split(regex);
                        if (parts.length === 1) return text;
                        
                        return parts.map((part, i) => {
                          const methodMatch = part.match(/^\[(GET|POST|DELETE|PUT|PATCH)\]$/);
                          if (methodMatch) {
                            const method = methodMatch[1];
                            let colorClass = 'text-slate-600 bg-slate-50 border-slate-200';
                            let dotClass = 'bg-slate-500';
                            if (method === 'GET') { colorClass = 'text-blue-600 bg-blue-50 border-blue-200'; dotClass = 'bg-blue-500'; }
                            else if (method === 'POST') { colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200'; dotClass = 'bg-emerald-500'; }
                            else if (method === 'DELETE') { colorClass = 'text-rose-600 bg-rose-50 border-rose-200'; dotClass = 'bg-rose-500'; }
                            else if (method === 'PUT' || method === 'PATCH') { colorClass = 'text-amber-600 bg-amber-50 border-amber-200'; dotClass = 'bg-amber-500'; }
                            
                            return (
                              <span key={i} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[12px] font-bold tracking-wide shadow-sm transition-all hover:shadow-md mx-1 align-text-bottom ${colorClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse`}></span>
                                {method}
                              </span>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        });
                      };

                      const renderChildren = (node: any): any => {
                        if (typeof node === 'string') {
                          return renderTextWithBadges(node);
                        }
                        if (Array.isArray(node)) {
                          return node.map((n, i) => <React.Fragment key={i}>{renderChildren(n)}</React.Fragment>);
                        }
                        return node;
                      };

                      // 수직/수평 시퀀스 그룹화 로직 (⬇️ 또는 ➡️)
                      const groups: any[][] = [[]];
                      React.Children.forEach(children, (child) => {
                        let processedChild = child;
                        if (typeof child === 'string') {
                          processedChild = child.replace(/[1-9]️⃣\s*/g, '');
                        }
                        if (typeof processedChild === 'string' && (processedChild.includes('⬇️') || processedChild.includes('➡️'))) {
                          const parts = processedChild.split(/⬇️|➡️/);
                          groups[groups.length - 1].push(parts[0]);
                          for (let i = 1; i < parts.length; i++) {
                            groups.push([parts[i]]);
                          }
                        } else {
                          groups[groups.length - 1].push(processedChild);
                        }
                      });

                      if (groups.length > 1) {
                         return (
                           <td className="px-5 py-6 align-top leading-relaxed break-words max-w-xl text-slate-800" {...props}>
                             <div className="flex flex-col gap-3">
                               {groups.map((grp, i) => (
                                 <React.Fragment key={i}>
                                   <div className="flex items-start gap-3">
                                     {/* Number Badge */}
                                     <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 mt-0.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shadow-sm text-sm font-bold font-mono">
                                       {i + 1}
                                     </div>
                                     <div className="flex-1 min-w-0 mt-1 leading-relaxed break-words">
                                        {grp.map((n, j) => <React.Fragment key={j}>{renderChildren(n)}</React.Fragment>)}
                                     </div>
                                   </div>
                                   {i < groups.length - 1 && (
                                     <div className="flex w-7 justify-center text-blue-300 my-1">
                                       <ArrowDown className="w-5 h-5 animate-bounce" />
                                     </div>
                                   )}
                                 </React.Fragment>
                               ))}
                             </div>
                           </td>
                         );
                      }

                      return <td className="px-5 py-6 align-middle leading-relaxed break-words max-w-xl text-slate-800" {...props}>{renderChildren(children)}</td>;
                    },
                    strong: ({ children, ...props }: any) => {
                      const text = String(children).trim();
                      const regex = /(\[(?:GET|POST|DELETE|PUT|PATCH)\])/;
                      if (regex.test(text)) {
                        const parts = text.split(regex);
                        const mapped = parts.map((part, i) => {
                          const methodMatch = part.match(/^\[(GET|POST|DELETE|PUT|PATCH)\]$/);
                          if (methodMatch) {
                            const method = methodMatch[1];
                            let colorClass = 'text-slate-600 bg-slate-50 border-slate-200';
                            let dotClass = 'bg-slate-500';
                            if (method === 'GET') { colorClass = 'text-blue-600 bg-blue-50 border-blue-200'; dotClass = 'bg-blue-500'; }
                            else if (method === 'POST') { colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200'; dotClass = 'bg-emerald-500'; }
                            else if (method === 'DELETE') { colorClass = 'text-rose-600 bg-rose-50 border-rose-200'; dotClass = 'bg-rose-500'; }
                            else if (method === 'PUT' || method === 'PATCH') { colorClass = 'text-amber-600 bg-amber-50 border-amber-200'; dotClass = 'bg-amber-500'; }
                            
                            return (
                              <span key={i} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[12px] font-bold tracking-wide shadow-sm transition-all hover:shadow-md mx-1 align-text-bottom ${colorClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse`}></span>
                                {method}
                              </span>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        });
                        return <strong className="font-semibold text-slate-800" {...props}>{mapped}</strong>;
                      }
                      return <strong className="font-semibold text-slate-900" {...props}>{children}</strong>;
                    },
                    code: ({ inline, className, children, ...props }: any) => {
                      const text = String(children).trim();
                      
                      // HTTP Method 뱃지 매칭
                      const methodMatch = text.match(/^\[(GET|POST|DELETE|PUT|PATCH)\]/);
                      if (methodMatch) {
                        const method = methodMatch[1];
                        const rest = text.replace(`[${method}]`, '').trim();
                        
                        let colorClass = 'text-slate-600 bg-slate-50 border-slate-200';
                        let dotClass = 'bg-slate-500';
                        
                        if (method === 'GET') { colorClass = 'text-blue-600 bg-blue-50 border-blue-200'; dotClass = 'bg-blue-500'; }
                        else if (method === 'POST') { colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200'; dotClass = 'bg-emerald-500'; }
                        else if (method === 'DELETE') { colorClass = 'text-rose-600 bg-rose-50 border-rose-200'; dotClass = 'bg-rose-500'; }
                        else if (method === 'PUT' || method === 'PATCH') { colorClass = 'text-amber-600 bg-amber-50 border-amber-200'; dotClass = 'bg-amber-500'; }
                        
                        return (
                          <span className="inline-flex items-center gap-2 shrink-0 mr-1">
                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[13px] font-bold tracking-wide shadow-sm transition-all hover:shadow-md ${colorClass}`}>
                              <span className={`w-2 h-2 rounded-full ${dotClass} animate-pulse`}></span>
                              {method}
                            </span>
                            <code className="text-[14px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-medium shadow-sm border border-slate-200" {...props}>
                              {rest}
                            </code>
                          </span>
                        );
                      }
                      
                      // 파일 경로 스마트 포맷팅
                      if (text.includes('/') && text.includes('.') && !text.includes(' ')) {
                        const parts = text.split('/');
                        const filename = parts.pop();
                        const dir = parts.join('/');
                        return (
                          <div className="flex flex-col gap-0.5 w-max max-w-[280px]">
                            <span className="font-bold text-slate-900 text-[14px]" title={filename}>{filename}</span>
                            {dir && <span className="text-[12px] font-mono text-slate-400 truncate" title={dir}>{dir}/</span>}
                          </div>
                        );
                      }
                      
                      // 일반 액션 텍스트 또는 뱃지 없는 텍스트
                      return (
                        <span className="text-[14px] font-medium text-slate-700 px-1" {...props}>
                          {children}
                        </span>
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
