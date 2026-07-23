'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Clipboard, ChevronsDown, ChevronsUp, FolderOpen, Loader2, Search } from 'lucide-react';

const REAL_EXAMPLE_PATH = 'C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt';
const SAMPLE_PATH = 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-2\\frontend';

export default function Home() {
  const [targetPath, setTargetPath] = useState(SAMPLE_PATH);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'local', url: targetPath }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '분석에 실패했습니다.');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result || !result.results) return;
    let md = `## 화면별 API 매핑\n\n- 대상: \`${result.targetDir}\`\n- 검출 API: ${result.results.length}개\n\n| 화면 (View) | 파일 | API Method | API Endpoint |\n|---|---|---|---|\n`;
    
    const grouped = new Map<string, any[]>();
    for (const r of result.results) {
      const key = `${r.viewName}:${r.file}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    for (const key of Array.from(grouped.keys()).sort()) {
      const items = grouped.get(key)!;
      let isFirst = true;
      for (const item of items) {
        md += `| ${isFirst ? `**\`${item.viewName}\`**` : `〃`} | ${isFirst ? `\`${item.file}\`` : `〃`} | [${item.api.method}] | \`${item.api.endpoint}\` |\n`;
        isFirst = false;
      }
    }

    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const getMethodBadge = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'POST': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PUT': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DELETE': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'PATCH': return 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  // 기획서 9장: [모두 펼치기/접기] 기능 - DOM 내 details 엘리먼트 제어
  const handleToggleDetails = (open: boolean) => {
    const detailsElements = document.querySelectorAll('details');
    detailsElements.forEach((el) => {
      if (open) {
        el.setAttribute('open', '');
      } else {
        el.removeAttribute('open');
      }
    });
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8">
        <header className="border-b border-zinc-200 pb-5">
          <p className="text-sm font-semibold text-teal-700">v6 · Offline Static Analyzer · Plugin Dynamic Loading</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">프론트엔드 프로젝트 자동 분석기</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            React/Next.js 프로젝트를 AST로 분석해 화면 파일별 REST API 호출을 추출합니다.
            package.json 의존성을 분석하여 RTK Query, React Query, SWR, Axios, Fetch Resolver를 동적으로 로드합니다.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={handleAnalyze} className="border border-zinc-200 bg-white p-5 shadow-sm">
            <label htmlFor="targetPath" className="text-sm font-semibold text-zinc-800">
              분석 대상 로컬 폴더
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="targetPath"
                  value={targetPath}
                  onChange={(event) => setTargetPath(event.target.value)}
                  className="h-11 w-full border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  placeholder="C:\Users\...\my-react-app"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !targetPath.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                분석 실행
              </button>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTargetPath(REAL_EXAMPLE_PATH)}
                className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                실전 예제 (davis-frontend)
              </button>
              <button
                type="button"
                onClick={() => setTargetPath(SAMPLE_PATH)}
                className="inline-flex items-center gap-2 text-xs font-medium text-teal-700 hover:text-teal-900"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                샘플 예제 (sample-react)
              </button>
            </div>

            {error && (
              <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line">
                {error}
              </div>
            )}
          </form>

          <aside className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Phase 1 지원 범위</h2>
            <dl className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
              <dt className="text-zinc-500">Framework</dt>
              <dd className="font-medium">React, Next.js</dd>
              <dt className="text-zinc-500">Resolver</dt>
              <dd className="font-medium">RTK Query, React Query, SWR, Axios, Fetch</dd>
              <dt className="text-zinc-500">로드 방식</dt>
              <dd className="font-medium">package.json 기반 동적 로드</dd>
              <dt className="text-zinc-500">Network</dt>
              <dd className="font-medium">폐쇄망 로컬 분석</dd>
              <dt className="text-zinc-500">Output</dt>
              <dd className="font-medium">화면별 API 매핑 Markdown</dd>
            </dl>
          </aside>
        </section>

        {result && (
          <section className="border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">분석 결과</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDetails(true)}
                  className="inline-flex items-center gap-1.5 border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <ChevronsDown className="h-3.5 w-3.5" />
                  모두 펼치기
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDetails(false)}
                  className="inline-flex items-center gap-1.5 border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <ChevronsUp className="h-3.5 w-3.5" />
                  모두 접기
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  {copied ? <Check className="h-4 w-4 text-teal-700" /> : <Clipboard className="h-4 w-4" />}
                  {copied ? '복사됨' : 'Markdown 복사'}
                </button>
              </div>
            </div>
            <div className="p-5">
              {result.results?.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="mb-2 text-sm text-zinc-600">
                    <p>대상: <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">{result.targetDir}</code></p>
                    <p>검출 API: <span className="font-semibold text-teal-700">{result.results.length}</span>개</p>
                  </div>
                  
                  {Array.from(
                    result.results.reduce((acc: Map<string, any[]>, curr: any) => {
                      const key = `${curr.viewName}|${curr.file}`;
                      if (!acc.has(key)) acc.set(key, []);
                      acc.get(key)!.push(curr);
                      return acc;
                    }, new Map<string, any[]>()).entries()
                  ).map(([key, items], compIdx) => {
                    const [viewName, file] = key.split('|');
                    return (
                      <details key={key} className="group border border-zinc-200 rounded-md bg-white overflow-hidden" open>
                        <summary className="flex cursor-pointer items-center justify-between bg-zinc-50 px-4 py-3 hover:bg-zinc-100">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-zinc-400 shrink-0">{compIdx + 1}.</span>
                            <h3 className="font-semibold text-zinc-900">{viewName}</h3>
                            <span className="text-xs text-zinc-500 font-mono">{file}</span>
                          </div>
                          <span className="inline-flex items-center justify-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                            {items.length} APIs
                          </span>
                        </summary>
                        <div className="border-t border-zinc-200 px-4 py-3">
                          <ul className="flex flex-col gap-2">
                            {items.map((item: any, idx: number) => (
                              <li key={idx} className="flex items-center gap-3 text-sm">
                                <span className="text-zinc-400 font-mono text-[13px] w-5 text-right shrink-0">{idx + 1}.</span>
                                <span className={`inline-block w-16 shrink-0 text-center rounded border px-2 py-0.5 text-xs font-bold ${getMethodBadge(item.api.method)}`}>
                                  {item.api.method}
                                </span>
                                <code className="flex-1 rounded bg-zinc-100 px-2 py-1 font-mono text-[13px] text-zinc-800 break-all">
                                  {item.api.endpoint}
                                </code>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-sm text-zinc-500 py-10">
                  {result.message || '데이터가 없습니다.'}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
