'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Search, FolderOpen, Globe, Copy, Check } from 'lucide-react';

type AnalysisType = 'view-api' | 'api-flow' | 'state-flow' | 'scenario';
type InputMode = 'local' | 'github';

const ANALYSIS_TABS: { type: AnalysisType; icon: string; label: string }[] = [
  { type: 'view-api', icon: '🔌', label: 'View-API 매핑' },
  { type: 'api-flow', icon: '🔄', label: 'API 연계 흐름' },
  { type: 'state-flow', icon: '📦', label: '상태 관리 흐름' },
  { type: 'scenario', icon: '💡', label: '시나리오 추천' },
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
            <div className="overflow-auto max-h-[calc(100vh-250px)] w-full rounded-b-xl border-t border-slate-200 bg-white">
              <div className="p-6 sm:p-8 prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:text-slate-800 prose-li:text-slate-800 prose-a:text-blue-600 prose-table:text-sm prose-td:whitespace-nowrap prose-th:whitespace-nowrap min-w-max [&_th]:sticky [&_th]:top-0 [&_th]:bg-slate-100 [&_th]:z-10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
