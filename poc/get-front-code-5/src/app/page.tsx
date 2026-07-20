'use client';

import React, { useState } from 'react';

// 기획서 9.2절: HTTP Method 배지 색상 시스템
const METHOD_BADGE: Record<string, string> = {
  GET:     'bg-blue-100 text-blue-800 border-blue-200',
  POST:    'bg-emerald-100 text-emerald-800 border-emerald-200',
  PUT:     'bg-amber-100 text-amber-800 border-amber-200',
  DELETE:  'bg-rose-100 text-rose-800 border-rose-200',
  PATCH:   'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  UNKNOWN: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

// 기획서 5.1절: callType 배지 색상
const CALL_TYPE_BADGE: Record<string, string> = {
  Client:          'bg-sky-100 text-sky-800',
  ServerComponent: 'bg-violet-100 text-violet-800',
  ServerAction:    'bg-orange-100 text-orange-800',
  Unknown:         'bg-zinc-100 text-zinc-500',
};

const CALL_TYPE_LABEL: Record<string, string> = {
  Client:          'Client Component',
  ServerComponent: 'Server Component',
  ServerAction:    'Server Action',
  Unknown:         'Unknown',
};

function getMethodBadge(method: string) {
  return METHOD_BADGE[method?.toUpperCase()] ?? METHOD_BADGE.UNKNOWN;
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [error, setError]           = useState('');
  const [copied, setCopied]         = useState(false);

  // ── 분석 실행 (경로 직접 지정 실행 지원) ───────────────────────────
  const runAnalysis = async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDir: path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석에 실패했습니다.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAnalysis(targetPath);
  };

  const handleQuickRun = (path: string) => {
    setTargetPath(path);
    runAnalysis(path);
  };

  // ── Markdown 클립보드 복사 (callType 포함) ────────────────────
  const handleCopy = async () => {
    if (!result?.results?.length) return;

    const grouped = result.results.reduce((acc: Map<string, any[]>, curr: any) => {
      const key = `${curr.viewName}|${curr.file}|${curr.callType}`;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(curr);
      return acc;
    }, new Map<string, any[]>());

    let md =
      `## 화면별 API 매핑\n\n` +
      `- 대상: \`${result.targetDir}\`\n` +
      `- 검출 API: ${result.results.length}개\n\n` +
      `| 화면 (View) | callType | 파일 | Method | Endpoint |\n` +
      `|---|---|---|---|---|\n`;

    for (const [key, items] of Array.from(grouped.entries()).sort()) {
      const [viewName, file, callType] = key.split('|');
      let first = true;
      for (const item of items) {
        md +=
          `| ${first ? `**\`${viewName}\`**` : '〃'} ` +
          `| ${first ? (CALL_TYPE_LABEL[callType] ?? callType) : '〃'} ` +
          `| ${first ? `\`${file}\`` : '〃'} ` +
          `| \`${item.api.method}\` ` +
          `| \`${item.api.endpoint}\` |\n`;
        first = false;
      }
    }

    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // ── 모두 펼치기/접기 ─────────────────────────────────────────
  const toggleDetails = (open: boolean) => {
    document.querySelectorAll('details').forEach(el => {
      open ? el.setAttribute('open', '') : el.removeAttribute('open');
    });
  };

  // ── 결과 그룹핑 ──────────────────────────────────────────────
  const grouped: [string, any[]][] = result?.results
    ? Array.from(
        result.results.reduce((acc: Map<string, any[]>, curr: any) => {
          const key = `${curr.viewName}|${curr.file}|${curr.callType}`;
          if (!acc.has(key)) acc.set(key, []);
          acc.get(key)!.push(curr);
          return acc;
        }, new Map<string, any[]>())
      )
    : [];

  return (
    <main style={{ minHeight: '100vh', background: '#f9fafb', color: '#09090b', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── 헤더 ──────────────────────────────────────────── */}
        <header style={{ borderBottom: '1px solid #e4e4e7', paddingBottom: '1.25rem' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', margin: 0 }}>
            v6 · Offline Static Analyzer · Plugin Dynamic Loading
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0.5rem 0 0.4rem' }}>
            프론트엔드 프로젝트 자동 분석기
          </h1>
          <p style={{ fontSize: 13, color: '#71717a', margin: 0, lineHeight: 1.7 }}>
            React/Next.js 프로젝트를 AST로 분석하여 화면별 REST API 호출을 추출합니다.<br />
            RTK Query · React Query · SWR · Axios · Fetch — package.json 의존성 기반 동적 로드
          </p>
        </header>

        {/* ── 입력 폼 ──────────────────────────────────────── */}
        <section style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 320px' }}>
          <form onSubmit={handleAnalyze}
            style={{ border: '1px solid #e4e4e7', background: '#fff', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label htmlFor="targetPath" style={{ fontSize: 13, fontWeight: 600 }}>
              분석 대상 로컬 폴더 경로
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="targetPath"
                value={targetPath}
                onChange={e => setTargetPath(e.target.value)}
                placeholder="C:\Users\lee\Desktop\atworks\ai\davis-frontend\apps\agent-bt"
                autoFocus
                spellCheck={false}
                style={{
                  flex: 1, height: 42, border: '1px solid #d4d4d8', padding: '0 0.75rem',
                  fontSize: 13, outline: 'none', background: '#fff',
                }}
              />
              <button
                type="submit"
                disabled={loading || !targetPath.trim()}
                style={{
                  height: 42, padding: '0 1.25rem', background: '#18181b', color: '#fff',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: loading || !targetPath.trim() ? 0.5 : 1,
                }}
              >
                {loading ? '분석 중…' : '분석 실행 (↵ Enter)'}
              </button>
            </div>

            {/* ── 예시 원클릭 실행 버튼 ──────────────────── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>빠른 예시 선택:</span>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt')}
                style={{
                  background: '#f4f4f5', border: '1px solid #d4d4d8', borderRadius: 4,
                  padding: '3px 8px', fontSize: 12, color: '#09090b', cursor: 'pointer', fontWeight: 500
                }}
              >
                📁 agent-bt (davis-frontend)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-2\\frontend')}
                style={{
                  background: '#f4f4f5', border: '1px solid #d4d4d8', borderRadius: 4,
                  padding: '3px 8px', fontSize: 12, color: '#09090b', cursor: 'pointer', fontWeight: 500
                }}
              >
                📁 샘플 예제 (sample-react)
              </button>
            </div>

            {error && (
              <div style={{ border: '1px solid #fecaca', background: '#fef2f2', padding: '0.75rem', fontSize: 13, color: '#b91c1c', whiteSpace: 'pre-line' }}>
                {error}
              </div>
            )}
          </form>

          {/* ── 지원 범위 사이드 패널 ────────────────────── */}
          <aside style={{ border: '1px solid #e4e4e7', background: '#fff', padding: '1.25rem' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 0.75rem' }}>Phase 1 지원 범위</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.5rem 0.75rem', fontSize: 13, margin: 0 }}>
              <dt style={{ color: '#71717a' }}>Framework</dt><dd style={{ margin: 0, fontWeight: 500 }}>React, Next.js</dd>
              <dt style={{ color: '#71717a' }}>Resolver</dt><dd style={{ margin: 0, fontWeight: 500 }}>RTK Query, React Query, SWR, Axios, Fetch</dd>
              <dt style={{ color: '#71717a' }}>로드 방식</dt><dd style={{ margin: 0, fontWeight: 500 }}>package.json 기반 동적 로드</dd>
              <dt style={{ color: '#71717a' }}>Network</dt><dd style={{ margin: 0, fontWeight: 500 }}>폐쇄망 로컬 분석</dd>
            </dl>
          </aside>
        </section>

        {/* ── 분석 결과 ────────────────────────────────────── */}
        {result && (
          <section style={{ border: '1px solid #e4e4e7', background: '#fff' }}>
            {/* 툴바 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', padding: '0.6rem 1.25rem' }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                분석 결과 &nbsp;
                <span style={{ color: '#0d9488', fontWeight: 700 }}>
                  {result.results?.length ?? 0}
                </span>
                <span style={{ fontWeight: 400, color: '#71717a' }}>개</span>
              </h2>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Btn onClick={() => toggleDetails(true)}>모두 펼치기</Btn>
                <Btn onClick={() => toggleDetails(false)}>모두 접기</Btn>
                <Btn onClick={handleCopy}>{copied ? '✓ 복사됨' : 'Markdown 복사'}</Btn>
              </div>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* 메타 */}
              <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
                대상: <code style={{ background: '#f4f4f5', padding: '1px 6px', borderRadius: 3 }}>{result.targetDir}</code>
              </p>

              {grouped.length > 0 ? grouped.map(([key, items], compIdx) => {
                const [viewName, file, callType] = key.split('|');
                const callBadge = CALL_TYPE_BADGE[callType] ?? CALL_TYPE_BADGE.Unknown;
                const callLabel = CALL_TYPE_LABEL[callType] ?? callType;

                return (
                  <details key={key} style={{ border: '1px solid #e4e4e7', borderRadius: 6, overflow: 'hidden' }} open>
                    <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', padding: '0.55rem 1rem', cursor: 'pointer', listStyle: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, minWidth: 20 }}>{compIdx + 1}.</span>
                        <strong style={{ fontSize: 13 }}>{viewName}</strong>
                        {/* 기획서 5.1절: callType 배지 */}
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999 }} className={callBadge}>
                          {callLabel}
                        </span>
                        <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace' }}>{file}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, background: '#ccfbf1', color: '#0f766e', borderRadius: 999, padding: '2px 10px' }}>
                        {items.length} APIs
                      </span>
                    </summary>

                    <div style={{ borderTop: '1px solid #e4e4e7', padding: '0.75rem 1rem' }}>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {items.map((item: any, idx: number) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 13 }}>
                            <span style={{ color: '#a1a1aa', fontFamily: 'monospace', fontSize: 12, minWidth: 18, textAlign: 'right' }}>{idx + 1}.</span>
                            {/* HTTP Method 배지 */}
                            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 56, textAlign: 'center', padding: '2px 0', borderRadius: 4, border: '1px solid' }}
                              className={getMethodBadge(item.api.method)}>
                              {item.api.method}
                            </span>
                            <code style={{ flex: 1, background: '#f4f4f5', borderRadius: 4, padding: '3px 8px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                              {item.api.endpoint}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                );
              }) : (
                <p style={{ textAlign: 'center', color: '#71717a', fontSize: 13, padding: '2.5rem 0' }}>
                  {result.message || '데이터가 없습니다.'}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// ── 소형 버튼 컴포넌트 ──────────────────────────────────────────
function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ border: '1px solid #d4d4d8', background: '#fff', padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}>
      {children}
    </button>
  );
}
