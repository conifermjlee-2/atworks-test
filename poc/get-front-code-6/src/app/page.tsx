'use client';

import React, { useState } from 'react';

// 기획서 9.2절: HTTP Method 배지 색상 시스템
const METHOD_BADGE: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 border-blue-200',
  POST: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PUT: 'bg-amber-100 text-amber-800 border-amber-200',
  DELETE: 'bg-rose-100 text-rose-800 border-rose-200',
  PATCH: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  UNKNOWN: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

// 기획서 5.1절: callType 배지 색상
const CALL_TYPE_BADGE: Record<string, string> = {
  Client: 'bg-sky-100 text-sky-800',
  ServerComponent: 'bg-violet-100 text-violet-800',
  ServerAction: 'bg-orange-100 text-orange-800',
  Unknown: 'bg-zinc-500',
};

const CALL_TYPE_LABEL: Record<string, string> = {
  Client: 'Client Component',
  ServerComponent: 'Server Component',
  ServerAction: 'Server Action',
  Unknown: 'Unknown',
};

function getMethodBadge(method: string) {
  return METHOD_BADGE[method?.toUpperCase()] ?? METHOD_BADGE.UNKNOWN;
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

    const grouped: Map<string, any[]> = result.results.reduce((acc: Map<string, any[]>, curr: any) => {
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
      const absoluteFile = `${result.targetDir.replace(/[/\\]$/, '')}\\${file.replace(/\//g, '\\')}`;
      let first = true;
      for (const item of items) {
        md +=
          `| ${first ? `**\`${viewName}\`**` : '〃'} ` +
          `| ${first ? (CALL_TYPE_LABEL[callType] ?? callType) : '〃'} ` +
          `| ${first ? `\`${absoluteFile}\`` : '〃'} ` +
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

  // ── 결과 그룹핑 및 통계 ──────────────────────────────────────
  const grouped: [string, any[]][] = result?.results
    ? Array.from(
      result.results.reduce((acc: Map<string, any[]>, curr: any) => {
        const key = `${curr.viewName}|${curr.file}|${curr.callType}`;
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key)!.push(curr);
        return acc;
      }, new Map<string, any[]>()) as Map<string, any[]>
    )
    : [];

  const totalFiles = result?.results ? new Set(result.results.map((r: any) => r.file)).size : 0;
  const totalViews = grouped.length;
  const totalAPIs = result?.results?.length || 0;

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f19', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── 헤더 & 통계 위젯 ──────────────────────────────────────────── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f2937', paddingBottom: '1.5rem' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#34d399', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              v6 · Premium Static Analyzer
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0.5rem 0 0.4rem', color: '#f8fafc', letterSpacing: '-0.5px' }}>
              프론트엔드 API 정적 분석기-6
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
              React와 Next.js 소스에서 화면별 REST API 호출을 추적합니다.<br />
              Fetch, Axios, React Query, SWR, RTK Query를 AST 기반으로 수집합니다.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <StatCard label="Files" value={totalFiles} />
            <StatCard label="Views" value={totalViews} />
            <StatCard label="APIs" value={totalAPIs} />
          </div>
        </header>

        {/* ── 입력 폼 & 지원 범위 ──────────────────────────────────────── */}
        <section style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 320px' }}>
          <form onSubmit={handleAnalyze}
            style={{ border: '1px solid #1f2937', background: '#111827', padding: '1.5rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
            <label htmlFor="targetPath" style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
              분석 대상 폴더
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                id="targetPath"
                value={targetPath}
                onChange={e => setTargetPath(e.target.value)}
                placeholder="C:\Users\lee\Desktop\atworks\ai\davis-frontend\apps\agent-bt"
                autoFocus
                spellCheck={false}
                style={{
                  flex: 1, height: 44, border: '1px solid #334155', borderRadius: 6, padding: '0 1rem',
                  fontSize: 14, outline: 'none', background: '#0f172a', color: '#f8fafc',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)'
                }}
              />
              <button
                type="submit"
                disabled={loading || !targetPath.trim()}
                style={{
                  height: 44, padding: '0 1.5rem', background: '#10b981', color: '#022c22',
                  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: loading || !targetPath.trim() ? 0.6 : 1, transition: 'all 0.2s',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                }}
              >
                {loading ? '분석 중…' : '분석 실행'}
              </button>
            </div>

            {/* ── 예시 원클릭 실행 버튼 ──────────────────── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>빠른 예시:</span>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt')}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
              >
                agent-bt
              </button>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-3-combinations')}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
              >
                조합 테스트 (8개)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-2\\frontend-react-1')}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
              >
                React 5대장
              </button>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-frontend-next-js')}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
              >
                Next.js 구조
              </button>
              <button
                type="button"
                onClick={() => handleQuickRun('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-5-shopping-mall')}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
              >
                쇼핑몰 예시 (Next.js)
              </button>
            </div>

            {error && (
              <div style={{ border: '1px solid rgba(244, 63, 94, 0.3)', background: 'rgba(244, 63, 94, 0.1)', borderRadius: 6, padding: '1rem', fontSize: 13, color: '#fb7185', whiteSpace: 'pre-line' }}>
                {error}
              </div>
            )}
          </form>

          {/* ── 지원 범위 사이드 패널 ────────────────────── */}
          <aside style={{ border: '1px solid #1f2937', background: 'transparent', padding: '1.5rem', borderRadius: 8 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 0.5rem', color: '#94a3b8' }}>지원 범위</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li>Next App Router, React, TS/JS</li>
              <li style={{ color: '#cbd5e1', fontSize: 13 }}>fetch · axios · useQuery · useSWR · createApi</li>
              <li style={{ color: '#cbd5e1', fontSize: 13 }}>tsconfig paths alias</li>
            </ul>
          </aside>
        </section>

        {/* ── 분석 결과 ────────────────────────────────────── */}
        {result && (
          <section style={{ border: '1px solid #1f2937', background: '#111827', borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}>
            {/* 툴바 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1f2937', padding: '1rem 1.5rem', background: '#0f172a' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  분석 결과
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  {result.targetDir}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn onClick={() => toggleDetails(true)}>모두 펼치기</Btn>
                <Btn onClick={() => toggleDetails(false)}>모두 접기</Btn>
                <Btn primary onClick={handleCopy}>{copied ? '✓ 복사됨' : 'Markdown 복사'}</Btn>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grouped.length > 0 ? grouped.map(([key, items], compIdx) => {
                const [viewName, file, callType] = key.split('|');
                const callBadge = CALL_TYPE_BADGE[callType] ?? CALL_TYPE_BADGE.Unknown;
                const callLabel = CALL_TYPE_LABEL[callType] ?? callType;

                return (
                  <details key={key} style={{ border: '1px solid #1f2937', borderRadius: 6, overflow: 'hidden', background: '#1e293b' }} open>
                    <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', padding: '0.75rem 1.25rem', cursor: 'pointer', listStyle: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700, minWidth: 20 }}>{String(compIdx + 1).padStart(2, '0')}</span>
                        <strong style={{ fontSize: 15, color: '#f8fafc' }}>{viewName}</strong>
                        {/* 기획서 5.1절: callType 배지 */}
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }} className={callBadge}>
                          {callLabel}
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.25rem' }}>
                          <button
                            type="button"
                            title="주소 복사"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const absoluteFile = `${result.targetDir.replace(/[/\\]$/, '')}\\${file.replace(/\//g, '\\')}`;
                              navigator.clipboard.writeText(absoluteFile);
                              const btn = e.currentTarget;
                              btn.innerText = '✓';
                              btn.style.color = '#10b981';
                              btn.style.borderColor = '#10b981';
                              setTimeout(() => {
                                btn.innerText = '📋';
                                btn.style.color = '#94a3b8';
                                btn.style.borderColor = '#334155';
                              }, 1000);
                            }}
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: 4,
                              padding: '2px 5px',
                              fontSize: 11,
                              color: '#94a3b8',
                              cursor: 'pointer',
                              lineHeight: 1,
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#f8fafc'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#1e293b'; if (e.currentTarget.innerText === '📋') e.currentTarget.style.color = '#94a3b8'; }}
                          >
                            📋
                          </button>
                          <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{file}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: 999, padding: '2px 10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          {items.length} APIs
                        </span>
                        <button
                          type="button"
                          title="이 카드 내용 복사"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const absoluteFile = `${result.targetDir.replace(/[/\\]$/, '')}\\${file.replace(/\//g, '\\')}`;
                            const cardLines = [
                              String(compIdx + 1).padStart(2, '0'),
                              viewName,
                              callLabel,
                              absoluteFile,
                              `${items.length} APIs`,
                              ...items.flatMap((item: any) => [
                                item.api.method,
                                item.api.endpoint,
                                item.api.isDynamic ? 'dynamic' : 'static'
                              ])
                            ];

                            navigator.clipboard.writeText(cardLines.join('\n'));

                            const btn = e.currentTarget;
                            btn.innerText = '✓ 복사됨';
                            btn.style.color = '#10b981';
                            btn.style.borderColor = '#10b981';
                            setTimeout(() => {
                              btn.innerText = '복사';
                              btn.style.color = '#cbd5e1';
                              btn.style.borderColor = '#334155';
                            }, 1000);
                          }}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#cbd5e1',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#f8fafc'; }}
                          onMouseOut={(e) => { if (e.currentTarget.innerText === '복사') { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#cbd5e1'; } }}
                        >
                          복사
                        </button>
                      </div>
                    </summary>

                    <div style={{ padding: '1rem 1.25rem' }}>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map((item: any, idx: number) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: 14, background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #1f2937' }}>
                            {/* HTTP Method 배지 */}
                            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 60, textAlign: 'center', padding: '3px 0', borderRadius: 4, border: '1px solid', letterSpacing: '0.5px' }}
                              className={getMethodBadge(item.api.method)}>
                              {item.api.method}
                            </span>
                            <code style={{ flex: 1, color: '#f1f5f9', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                              {item.api.endpoint}
                            </code>
                            <span style={{ fontSize: 11, color: '#64748b', minWidth: 70, textAlign: 'right', fontFamily: 'monospace' }}>
                              {/* 6버전 스타일로 라이브러리 메타 정보 표시 */}
                              {item.api.isDynamic ? 'dynamic' : 'static'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                );
              }) : (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14, padding: '3rem 0' }}>
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
function Btn({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        border: primary ? 'none' : '1px solid #334155',
        background: primary ? '#1e293b' : 'transparent',
        color: primary ? '#f8fafc' : '#94a3b8',
        padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
        transition: 'all 0.2s',
        boxShadow: primary ? 'inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none'
      }}
      onMouseOver={(e) => {
        if (!primary) {
          e.currentTarget.style.color = '#f8fafc';
          e.currentTarget.style.background = '#1e293b';
        }
      }}
      onMouseOut={(e) => {
        if (!primary) {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {children}
    </button>
  );
}

// ── 통계 카드 컴포넌트 ──────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #1f2937', background: '#111827', borderRadius: 8, padding: '1rem', minWidth: 100, display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 24, color: '#f8fafc', fontWeight: 700, lineHeight: 1 }}>{value}</span>
    </div>
  );
}
