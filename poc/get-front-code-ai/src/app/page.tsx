'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Search, BrainCircuit, HelpCircle } from 'lucide-react';

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

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
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '저장소 분석에 실패했습니다');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex justify-center items-center gap-4">
            <Github className="h-12 w-12 text-slate-900" />
            <BrainCircuit className="h-12 w-12 text-blue-600" />
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              <span className="text-blue-600">(Local AI)</span> 프론트엔드 코드 분석기
            </h1>
            <button 
              onClick={() => setShowHelp(!showHelp)} 
              className="text-slate-400 hover:text-blue-500 transition-colors focus:outline-none" 
              title="AI 분석 설명 보기"
            >
              <HelpCircle className="h-7 w-7" />
            </button>
          </div>
          <p className="mt-4 text-lg text-slate-600">
            내장된 로컬 AI(Qwen Coder)를 통해 React/Next.js 저장소를 분석하여 <br/>뷰-API 매핑 및 컴포넌트 흐름을 추출합니다.
          </p>

          {showHelp && (
            <div className="mt-6 max-w-2xl mx-auto p-5 bg-blue-50 rounded-xl text-left text-sm text-slate-700 border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                🤖 로컬 AI 분석 방식이란?
              </p>
              <p className="mb-3 text-slate-600">정적 분석기로는 찾기 힘든 복잡한 흐름을 AI가 문맥을 파악해 찾아냅니다:</p>
              <ul className="space-y-2">
                <li className="flex flex-wrap items-center gap-2">
                  <code className="bg-white border border-blue-100 px-1.5 py-0.5 rounded text-blue-700 font-mono text-xs">
                    추상화된 컴포넌트 파악
                  </code> 
                  <span>➡️ 훅(Hook)이나 공통 함수로 숨겨져 있는 API 호출까지 문맥을 읽고 추출합니다.</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <code className="bg-white border border-blue-100 px-1.5 py-0.5 rounded text-blue-700 font-mono text-xs">
                    동적 주소 유추
                  </code> 
                  <span>➡️ 문자열 조합으로 생성되는 복잡한 라우팅 주소를 맥락상으로 유추합니다.</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <code className="bg-white border border-blue-100 px-1.5 py-0.5 rounded text-red-600 font-mono text-xs text-opacity-80">
                    주의: 토큰 제한 (Max 30k)
                  </code> 
                  <span>➡️ 한 번에 너무 거대한 프로젝트를 넣으면 일부 코드가 잘려 분석이 누락될 수 있습니다.</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleAnalyze} className="flex gap-4">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                  placeholder="https://github.com/사용자명/저장소"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    AI 추론 중...
                  </>
                ) : (
                  '분석'
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:text-slate-800 prose-li:text-slate-800 prose-a:text-blue-600">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
