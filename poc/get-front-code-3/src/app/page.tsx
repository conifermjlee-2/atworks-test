'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Clipboard, FolderOpen, Loader2, Search } from 'lucide-react';

const SAMPLE_PATH = 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\get-front-code-3\\sample-react';

export default function Home() {
  const [targetPath, setTargetPath] = useState(SAMPLE_PATH);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult('');
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

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8">
        <header className="border-b border-zinc-200 pb-5">
          <p className="text-sm font-semibold text-teal-700">Offline static analyzer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">프론트엔드 프로젝트 자동 분석기</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            React/Next.js 프로젝트를 AST로 분석해 화면 파일별 REST API 호출을 추출합니다. RTK Query,
            React Query, SWR, Axios, Fetch Resolver를 플러그인 체인으로 실행합니다.
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
                  placeholder="C:\Users\lee\...\my-react-app"
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
            <button
              type="button"
              onClick={() => setTargetPath(SAMPLE_PATH)}
              className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-teal-700 hover:text-teal-900"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              샘플 프로젝트 경로 입력
            </button>

            {error && (
              <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                {copied ? <Check className="h-4 w-4 text-teal-700" /> : <Clipboard className="h-4 w-4" />}
                {copied ? '복사됨' : 'Markdown 복사'}
              </button>
            </div>
            <div className="overflow-auto p-5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <table className="w-full min-w-[860px] border-collapse text-left text-sm">{children}</table>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-zinc-300 bg-zinc-100 px-3 py-2 font-semibold text-zinc-700">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => <td className="border-b border-zinc-100 px-3 py-2 align-top">{children}</td>,
                  code: ({ children }) => (
                    <code className="bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-900">{children}</code>
                  ),
                  li: ({ children }) => <li className="ml-5 list-disc text-sm leading-6 text-zinc-700">{children}</li>,
                  h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold text-zinc-950">{children}</h2>,
                }}
              >
                {result}
              </ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
