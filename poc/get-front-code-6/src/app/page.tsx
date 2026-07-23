'use client';

import React, { useState } from 'react';

// ── HTTP Method 배지 색상 ───────────────────────────────────────
const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET:     { bg: '#1e3a5f', text: '#60a5fa', border: '#2563eb' },
  POST:    { bg: '#064e3b', text: '#34d399', border: '#059669' },
  PUT:     { bg: '#451a03', text: '#fb923c', border: '#ea580c' },
  DELETE:  { bg: '#4c0519', text: '#fb7185', border: '#e11d48' },
  PATCH:   { bg: '#3b0764', text: '#c084fc', border: '#9333ea' },
  UNKNOWN: { bg: '#1e293b', text: '#94a3b8', border: '#475569' },
};

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

function MethodBadge({ method }: { method: string }) {
  const key = method?.toUpperCase() ?? 'UNKNOWN';
  const c = METHOD_COLORS[key] ?? METHOD_COLORS.UNKNOWN;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px',
      borderRadius: 4, border: `1px solid ${c.border}`,
      background: c.bg, color: c.text,
      letterSpacing: '0.5px', minWidth: 60, textAlign: 'center', display: 'inline-block'
    }}>
      {key}
    </span>
  );
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'scenario'>('list');

  // ── 분석 실행 ──────────────────────────────────────────────────
  const runAnalysis = async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setActiveTab('list');

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

  // ── Markdown 복사 ───────────────────────────────────────────────
  const handleCopy = async () => {
    if (!result?.results?.length) return;
    const grouped: Map<string, any[]> = result.results.reduce((acc: Map<string, any[]>, curr: any) => {
      const key = `${curr.viewName}|${curr.file}|${curr.callType}`;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(curr);
      return acc;
    }, new Map());

    let md = `## 화면별 API 매핑\n\n- 대상: \`${result.targetDir}\`\n- 검출 API: ${result.results.length}개\n\n| 화면 (View) | callType | 파일 | Method | Endpoint |\n|---|---|---|---|---|\n`;
    for (const [key, items] of Array.from(grouped.entries()).sort()) {
      const [viewName, file, callType] = key.split('|');
      const absoluteFile = `${result.targetDir.replace(/[/\\]$/, '')}\\${file.replace(/\//g, '\\')}`;
      let first = true;
      for (const item of items) {
        md += `| ${first ? `**\`${viewName}\`**` : '〃'} | ${first ? (CALL_TYPE_LABEL[callType] ?? callType) : '〃'} | ${first ? `\`${absoluteFile}\`` : '〃'} | \`${item.api.method}\` | \`${item.api.endpoint}\` |\n`;
        first = false;
      }
    }
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const toggleDetails = (open: boolean) => {
    document.querySelectorAll('details').forEach(el => {
      open ? el.setAttribute('open', '') : el.removeAttribute('open');
    });
  };

  // ── 결과 그룹핑 ────────────────────────────────────────────────
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
  const totalScenarios = result?.scenarios?.length || 0;

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f19', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── 헤더 ──────────────────────────────────────────────── */}
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
            <StatCard label="Scenarios" value={totalScenarios} accent />
          </div>
        </header>

        {/* ── 입력 폼 & 지원 범위 ────────────────────────────────── */}
        <section style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 320px' }}>
          <form onSubmit={handleAnalyze}
            style={{ border: '1px solid #1f2937', background: '#111827', padding: '1.5rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <label htmlFor="targetPath" style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>분석 대상 폴더</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                id="targetPath"
                value={targetPath}
                onChange={e => setTargetPath(e.target.value)}
                placeholder="C:\Users\...\my-react-app"
                autoFocus spellCheck={false}
                style={{ flex: 1, height: 44, border: '1px solid #334155', borderRadius: 6, padding: '0 1rem', fontSize: 14, outline: 'none', background: '#0f172a', color: '#f8fafc', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
              />
              <button
                type="submit" disabled={loading || !targetPath.trim()}
                style={{ height: 44, padding: '0 1.5rem', background: '#10b981', color: '#022c22', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading || !targetPath.trim() ? 0.6 : 1, transition: 'all 0.2s', boxShadow: '0 0 10px rgba(16,185,129,0.3)' }}
              >
                {loading ? '분석 중…' : '분석 실행'}
              </button>
            </div>

            {/* 예시 버튼 */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>빠른 예시:</span>
              {[
                { label: '조합 테스트 (8개)', path: 'C:\\Users\\oidol\\OneDrive\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-3-combinations' },
                { label: 'React 5대장', path: 'C:\\Users\\oidol\\OneDrive\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-2\\frontend-react-1' },
                { label: 'Next.js 구조', path: 'C:\\Users\\oidol\\OneDrive\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-frontend-next-js' },
                { label: '쇼핑몰 예시', path: 'C:\\Users\\oidol\\OneDrive\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-5-shopping-mall' },
                { label: 'tmp-project-1', path: 'C:\\Users\\oidol\\OneDrive\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-1\\frontend-next-js-1' },
              ].map(({ label, path }) => (
                <QuickBtn key={label} onClick={() => handleQuickRun(path)}>{label}</QuickBtn>
              ))}
            </div>

            {error && (
              <div style={{ border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.1)', borderRadius: 6, padding: '1rem', fontSize: 13, color: '#fb7185', whiteSpace: 'pre-line' }}>
                {error}
              </div>
            )}
          </form>

          <aside style={{ border: '1px solid #1f2937', padding: '1.5rem', borderRadius: 8 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 0.5rem', color: '#94a3b8' }}>지원 범위</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li>Next App Router, React, TS/JS</li>
              <li style={{ color: '#cbd5e1', fontSize: 13 }}>fetch · axios · useQuery · useSWR · createApi</li>
              <li style={{ color: '#cbd5e1', fontSize: 13 }}>tsconfig paths alias</li>
              <li style={{ color: '#34d399', fontSize: 13, fontWeight: 600 }}>✦ 시나리오 흐름 추적 (NEW)</li>
              <li style={{ color: '#cbd5e1', fontSize: 13 }}>MOUNT / EVENT 트리거 분류</li>
              <li style={{ color: '#cbd5e1', fontSize: 13 }}>invalidateQueries Refetch 연결</li>
            </ul>
          </aside>
        </section>

        {/* ── 분석 결과 ──────────────────────────────────────────── */}
        {result && (
          <section style={{ border: '1px solid #1f2937', background: '#111827', borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>

            {/* ── 탭 네비게이션 ───────────────────────────────────── */}
            <div style={{ borderBottom: '1px solid #1f2937', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
              <div style={{ display: 'flex', gap: 0 }}>
                <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')}>
                  📋 API 리스트 <TabCount count={totalAPIs} />
                </TabButton>
                <TabButton active={activeTab === 'scenario'} onClick={() => setActiveTab('scenario')} accent>
                  ⚡ API 시나리오 흐름 <TabCount count={totalScenarios} accent />
                </TabButton>
              </div>
              {activeTab === 'list' && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 0' }}>
                  <Btn onClick={() => toggleDetails(true)}>모두 펼치기</Btn>
                  <Btn onClick={() => toggleDetails(false)}>모두 접기</Btn>
                  <Btn primary onClick={handleCopy}>{copied ? '✓ 복사됨' : 'Markdown 복사'}</Btn>
                </div>
              )}
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* ── 탭 1: API 리스트 ──────────────────────────────── */}
              {activeTab === 'list' && (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{result.targetDir}</p>
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
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }} className={callBadge}>{callLabel}</span>
                            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{file}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 999, padding: '2px 10px', border: '1px solid rgba(16,185,129,0.3)' }}>
                              {items.length} APIs
                            </span>
                          </div>
                        </summary>
                        <div style={{ padding: '1rem 1.25rem' }}>
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {items.map((item: any, idx: number) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: 14, background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #1f2937' }}>
                                <MethodBadge method={item.api.method} />
                                <code style={{ flex: 1, color: '#f1f5f9', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{item.api.endpoint}</code>
                                <span style={{ fontSize: 11, color: '#64748b', minWidth: 70, textAlign: 'right', fontFamily: 'monospace' }}>{item.api.isDynamic ? 'dynamic' : 'static'}</span>
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
                </>
              )}

              {/* ── 탭 2: 시나리오 흐름 ───────────────────────────── */}
              {activeTab === 'scenario' && (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    {result.targetDir} · 시나리오 {totalScenarios}개 검출
                  </p>
                  {result.scenarios?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {result.scenarios.map((sc: any, idx: number) => (
                        <ScenarioCard key={idx} scenario={sc} index={idx + 1} allScenarios={result.scenarios} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <p style={{ color: '#64748b', fontSize: 14, marginBottom: '0.5rem' }}>시나리오 흐름이 감지되지 않았습니다.</p>
                      <p style={{ color: '#475569', fontSize: 12 }}>useEffect, useQuery, useMutation, JSX 이벤트 핸들러 내부의 API 호출을 분석합니다.</p>
                    </div>
                  )}
                </>
              )}

            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// ── 시나리오 카드 ──────────────────────────────────────────────
function ScenarioCard({ scenario, index, allScenarios = [] }: { scenario: any; index: number; allScenarios?: any[] }) {
  const isMount = scenario.triggerType === 'MOUNT';
  const triggerColor = isMount
    ? { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.3)' }
    : { bg: 'rgba(251,146,60,0.1)', text: '#fb923c', border: 'rgba(251,146,60,0.3)' };

  // triggersRefetch 키와 일치하는 MOUNT 시나리오 찾기
  const refetchChains: { key: string; apiCalls: any[]; file: string }[] = [];
  if (scenario.triggersRefetch?.length && allScenarios.length > 0) {
    for (const key of scenario.triggersRefetch) {
      const matched = allScenarios.filter((s: any) =>
        s.triggerType === 'MOUNT' &&
        s.apiCalls?.some((c: any) =>
          c.endpoint?.toLowerCase().includes(key.toLowerCase())
        )
      );
      matched.forEach((m: any) => {
        const matchedCalls = m.apiCalls.filter((c: any) =>
          c.endpoint?.toLowerCase().includes(key.toLowerCase())
        );
        refetchChains.push({ key, apiCalls: matchedCalls, file: m.file });
      });
    }
  }

  return (
    <div style={{ border: '1px solid #1f2937', borderRadius: 8, overflow: 'hidden', background: '#1e293b' }}>
      {/* 카드 헤더 */}
      <div style={{ background: '#0f172a', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #1f2937' }}>
        <span style={{ fontSize: 13, color: '#475569', fontWeight: 700, minWidth: 20 }}>{String(index).padStart(2, '0')}</span>

        {/* MOUNT / EVENT 뱃지 */}
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
          background: triggerColor.bg, color: triggerColor.text, border: `1px solid ${triggerColor.border}`,
          letterSpacing: '0.5px', textTransform: 'uppercase'
        }}>
          {isMount ? '⚙ MOUNT' : '👆 EVENT'}
        </span>

        {/* 트리거 소스 */}
        <code style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, background: '#1e293b', padding: '2px 8px', borderRadius: 4, border: '1px solid #334155' }}>
          {scenario.triggerSource}
        </code>

        <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {scenario.file}
        </span>

        {/* 복사 버튼 — refetchChains도 함께 전달 */}
        <CopyScenarioBtn scenario={scenario} refetchChains={refetchChains} />
      </div>

      {/* 타임라인 */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {scenario.apiCalls.map((call: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
            {/* 수직 타임라인 선 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: isMount ? '#065f46' : '#7c2d12',
                border: `2px solid ${isMount ? '#10b981' : '#ea580c'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: isMount ? '#34d399' : '#fb923c', fontWeight: 700, flexShrink: 0
              }}>
                {call.order}
              </div>
              {i < scenario.apiCalls.length - 1 && (
                <div style={{ width: 2, flex: 1, background: '#1f2937', margin: '2px 0', minHeight: 16 }} />
              )}
            </div>

            {/* API 호출 내용 */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #1f2937', marginBottom: i < scenario.apiCalls.length - 1 ? 8 : 0 }}>
              <MethodBadge method={call.method} />
              <code style={{ flex: 1, color: '#f1f5f9', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                {call.endpoint}
              </code>
            </div>
          </div>
        ))}

        {/* Refetch 후행 체인 — 실제 GET 요청 타임라인으로 표시 */}
        {refetchChains.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {/* 연결 화살표 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 8, paddingLeft: 4 }}>
              <div style={{ width: 2, height: 20, background: 'rgba(99,102,241,0.5)', marginLeft: 9 }} />
            </div>
            <div style={{ border: '1px solid rgba(99,102,241,0.35)', borderRadius: 8, overflow: 'hidden' }}>
              {/* 후행 섹션 헤더 */}
              <div style={{ background: 'rgba(99,102,241,0.12)', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                <span style={{ fontSize: 13 }}>🔄</span>
                <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>onSuccess → invalidateQueries → 자동 재요청</span>
              </div>
              {/* 후행 API 콜 목록 */}
              <div style={{ padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {refetchChains.map((chain, ci) =>
                  chain.apiCalls.map((call: any, ai: number) => (
                    <div key={`${ci}-${ai}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid rgba(99,102,241,0.2)' }}>
                      <MethodBadge method={call.method} />
                      <code style={{ flex: 1, color: '#c7d2fe', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                        {call.endpoint}
                      </code>
                      <span style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', flexShrink: 0 }}>
                        {chain.file}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* refetch 체인 없을 때만 텍스트 메모 표시 */}
        {scenario.triggersRefetch?.length > 0 && refetchChains.length === 0 && (
          <div style={{ marginTop: 12, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '0.65rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 14 }}>🔄</span>
            <span style={{ fontSize: 13, color: '#a5b4fc' }}>
              이 동작 수행 후{' '}
              {scenario.triggersRefetch.map((key: string, ki: number) => (
                <React.Fragment key={ki}>
                  <code style={{ background: 'rgba(99,102,241,0.2)', borderRadius: 3, padding: '1px 5px', color: '#c7d2fe', fontSize: 12 }}>
                    [{key}]
                  </code>
                  {ki < scenario.triggersRefetch.length - 1 && ', '}
                </React.Fragment>
              ))}{' '}
              데이터가 자동 갱신됩니다.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 탭 버튼 ──────────────────────────────────────────────────────
function TabButton({ children, active, onClick, accent = false }: { children: React.ReactNode; active: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.9rem 1.25rem',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: 'none', borderBottom: active ? `2px solid ${accent ? '#f97316' : '#10b981'}` : '2px solid transparent',
        background: 'transparent',
        color: active ? (accent ? '#fb923c' : '#34d399') : '#64748b',
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
      }}
    >
      {children}
    </button>
  );
}

function TabCount({ count, accent = false }: { count: number; accent?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px',
      background: accent ? 'rgba(249,115,22,0.15)' : 'rgba(16,185,129,0.15)',
      color: accent ? '#fb923c' : '#34d399',
    }}>
      {count}
    </span>
  );
}

// ── 소형 버튼 ─────────────────────────────────────────────────────
function Btn({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      border: primary ? 'none' : '1px solid #334155',
      background: primary ? '#1e293b' : 'transparent',
      color: primary ? '#f8fafc' : '#94a3b8',
      padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4, transition: 'all 0.2s',
    }}
      onMouseOver={e => { e.currentTarget.style.color = '#f8fafc'; e.currentTarget.style.background = '#1e293b'; }}
      onMouseOut={e => { if (!primary) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; } }}
    >
      {children}
    </button>
  );
}

function QuickBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
      padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s'
    }}
      onMouseOver={e => e.currentTarget.style.background = '#334155'}
      onMouseOut={e => e.currentTarget.style.background = '#1e293b'}
    >
      {children}
    </button>
  );
}

// ── 통계 카드 ─────────────────────────────────────────────────────
function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ border: `1px solid ${accent ? 'rgba(249,115,22,0.3)' : '#1f2937'}`, background: '#111827', borderRadius: 8, padding: '1rem', minWidth: 100, display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <span style={{ fontSize: 12, color: accent ? '#fb923c' : '#64748b', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 24, color: '#f8fafc', fontWeight: 700, lineHeight: 1 }}>{value}</span>
    </div>
  );
}


// ── 시나리오 복사 버튼 ─────────────────────────────────────────────
function CopyScenarioBtn({ scenario, refetchChains = [] }: {
  scenario: any;
  refetchChains?: { key: string; apiCalls: any[]; file: string }[];
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const lines: string[] = [
      `${scenario.file}  [${scenario.triggerType}] ${scenario.triggerSource}`,
      '',
      ...scenario.apiCalls.map((c: any) => `  ${c.order}. ${c.method.padEnd(6)} ${c.endpoint}`),
    ];

    // 후행 체인(onSuccess → 자동 재요청) 포함
    if (refetchChains.length > 0) {
      lines.push('');
      lines.push('  🔄 onSuccess → invalidateQueries → 자동 재요청');
      let idx = 1;
      for (const chain of refetchChains) {
        for (const call of chain.apiCalls) {
          lines.push(`     ${idx++}. ${call.method.padEnd(6)} ${call.endpoint}  (${chain.file})`);
        }
      }
    } else if (scenario.triggersRefetch?.length) {
      lines.push('');
      lines.push(`  🔄 Refetch: [${scenario.triggersRefetch.join(', ')}]`);
    }

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="시나리오 내용 복사"
      style={{
        background: copied ? 'rgba(16,185,129,0.15)' : '#1e293b',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : '#334155'}`,
        borderRadius: 5,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        color: copied ? '#34d399' : '#94a3b8',
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      onMouseOver={e => { if (!copied) { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#f8fafc'; } }}
      onMouseOut={e => { if (!copied) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; } }}
    >
      {copied ? '✓ 복사됨' : '복사'}
    </button>
  );
}

