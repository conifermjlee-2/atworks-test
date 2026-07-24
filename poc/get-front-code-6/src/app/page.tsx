'use client';

import React, { useState, useRef } from 'react';

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
  const [activeTab, setActiveTab] = useState<'list' | 'scenario' | 'route' | 'ai'>('list');
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [collapsedRoutes, setCollapsedRoutes] = useState<Set<string>>(new Set());
  const [collapsedAiScenarios, setCollapsedAiScenarios] = useState<Set<number>>(new Set());
  const [aiCopied, setAiCopied] = useState(false);
  const [aiElapsedTime, setAiElapsedTime] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setAllScenarioCollapsed = (collapse: boolean) => {
    if (!result?.scenarios) return;
    if (collapse) {
      const allFiles: string[] = Array.from(
        new Set(result.scenarios.map((s: any) => s.file))
      );
      setCollapsedFiles(new Set(allFiles));
    } else {
      setCollapsedFiles(new Set());
    }
  };

  const toggleFileCollapse = (file: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

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

  const handleGenerateAI = async () => {
    console.log('✨ AI 번역 생성 시작...');
    const allE2EScenarios = result?.routeScenarios?.flatMap((r: any) => r.e2eScenarios || []) || [];
    console.log('추출된 E2EScenarios:', allE2EScenarios);
    
    if (allE2EScenarios.length === 0) {
      console.warn('분석된 E2E 시나리오 데이터가 없습니다. (allE2EScenarios is empty)');
      alert('분석된 E2E 시나리오 데이터가 없습니다. 먼저 분석을 정상적으로 실행하여 E2E 시나리오 탭에 시나리오가 나오는지 확인해주세요.');
      return;
    }

    setAiLoading(true);
    console.log('aiLoading 상태 true로 변경됨');
    abortControllerRef.current = new AbortController();
    
    try {
      console.log('/api/analyze-ai 로 POST 요청 시작...');
      const res = await fetch('/api/analyze-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e2eScenarios: allE2EScenarios }),
        signal: abortControllerRef.current.signal,
      });
      console.log('AI 응답 상태코드:', res.status);
      
      const data = await res.json();
      console.log('AI 응답 데이터:', data);
      
      if (!res.ok) throw new Error(data.error || 'AI 분석에 실패했습니다.');
      setAiResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('AI 분석 요청이 취소되었습니다.');
      } else {
        console.error('AI 분석 중 에러 발생:', err);
        alert('에러 발생: ' + err.message);
      }
    } finally {
      setAiLoading(false);
      abortControllerRef.current = null;
      console.log('aiLoading 상태 false로 변경됨');
    }
  };

  const handleCopyAI = () => {
    if (!aiResult?.scenarios) return;
    let md = '# 🤖 AI 비즈니스 시나리오\n\n';
    aiResult.scenarios.forEach((sc: any) => {
      md += `## ${sc.title}\n`;
      if (sc.tags?.length) {
        md += `**태그:** ${sc.tags.map((t: string) => `#${t}`).join(' ')}\n\n`;
      }
      md += `${sc.summary}\n\n`;
      
      sc.steps?.forEach((step: any, idx: number) => {
        md += `### ${idx + 1}. [ ${step.route} ]\n`;
        if (step.apiFlow && step.apiFlow !== 'API 호출 없음') {
          md += `- **API 흐름:** \`${step.apiFlow}\`\n`;
        }
        md += `- **설명:** ${step.description}\n\n`;
      });
      md += `---\n\n`;
    });
    navigator.clipboard.writeText(md).then(() => {
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    });
  };

  const handleCancelAI = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAnalysis(targetPath);
  };

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (aiLoading) {
      setAiElapsedTime(0);
      timer = setInterval(() => {
        setAiElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [aiLoading]);

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
                { label: 'Agent BT', path: 'C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt' },
                { label: '조합 테스트 (8개)', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-3-combinations' },
                { label: 'React 5대장', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-2\\frontend-react-1' },
                { label: 'Next.js 구조', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-frontend-next-js' },
                { label: '쇼핑몰 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-5-shopping-mall' },
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
          <section style={{ border: '1px solid #1f2937', background: '#111827', borderRadius: 8, overflow: 'clip', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>

            {/* ── 탭 네비게이션 ───────────────────────────────────── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #1f2937', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')}>
                  📋 컴포넌트 API 리스트 <TabCount count={totalAPIs} />
                </TabButton>
                <TabButton active={activeTab === 'scenario'} onClick={() => setActiveTab('scenario')} accent>
                  ⚡ 컴포넌트 API 시나리오 흐름 <TabCount count={totalScenarios} accent />
                </TabButton>
                <TabButton active={activeTab === 'route'} onClick={() => setActiveTab('route')} accent>
                  🖥️ 화면별 시나리오 <TabCount count={result?.routeScenarios?.length || 0} accent />
                </TabButton>
                <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} accent>
                  🤖 AI 추천 비즈니스 시나리오
                </TabButton>
              </div>
              {activeTab === 'list' && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 0', marginLeft: 'auto' }}>
                  <Btn onClick={() => toggleDetails(true)}>모두 펼치기</Btn>
                  <Btn onClick={() => toggleDetails(false)}>모두 접기</Btn>
                  <Btn primary onClick={handleCopy}>{copied ? '✓ 복사됨' : 'Markdown 복사'}</Btn>
                </div>
              )}
              {activeTab === 'scenario' && result?.scenarios?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 0', marginLeft: 'auto' }}>
                  <Btn onClick={() => setAllScenarioCollapsed(false)}>모두 펼치기</Btn>
                  <Btn onClick={() => setAllScenarioCollapsed(true)}>모두 접기</Btn>
                </div>
              )}
              {activeTab === 'route' && result?.routeScenarios?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 0', marginLeft: 'auto' }}>
                  <Btn onClick={() => setCollapsedRoutes(new Set())}>모두 펼치기</Btn>
                  <Btn onClick={() => {
                    const singleRoutes = result.routeScenarios.map((r: any) => r.route);
                    const e2eScenarioRoutes = result.routeScenarios.flatMap((r: any) => 
                      r.e2eScenarios?.map((j: any) => `e2eScenario-${j.e2eScenarioId}`) || []
                    );
                    setCollapsedRoutes(new Set([...singleRoutes, ...e2eScenarioRoutes]));
                  }}>모두 접기</Btn>
                </div>
              )}
              {activeTab === 'ai' && aiResult?.scenarios?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 0', marginLeft: 'auto' }}>
                  <Btn onClick={() => setCollapsedAiScenarios(new Set())}>모두 펼치기</Btn>
                  <Btn onClick={() => setCollapsedAiScenarios(new Set(aiResult.scenarios.map((_: any, i: number) => i)))}>모두 접기</Btn>
                  <Btn primary onClick={handleCopyAI}>{aiCopied ? '✓ 복사됨' : 'Markdown 복사'}</Btn>
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
                  {result.scenarios?.length > 0 ? (() => {
                    // 파일별로 그룹핑
                    const grouped: Map<string, any[]> = result.scenarios.reduce((acc: Map<string, any[]>, sc: any) => {
                      if (!acc.has(sc.file)) acc.set(sc.file, []);
                      acc.get(sc.file)!.push(sc);
                      return acc;
                    }, new Map<string, any[]>());

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {Array.from(grouped.entries()).map(([file, scenarios]) => {
                          const isCollapsed = collapsedFiles.has(file);
                          return (
                            <div key={file} style={{ border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' }}>
                              {/* 파일 그룹 헤더 — 클릭하면 접기/펼치기 */}
                              <div
                                onClick={() => toggleFileCollapse(file)}
                                style={{ background: '#0f172a', padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: isCollapsed ? 'none' : '1px solid #1f2937', cursor: 'pointer', userSelect: 'none' }}
                              >
                                <span style={{ fontSize: 11, color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                                <span style={{ fontSize: 13 }}>📄</span>
                                <code style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{file}</code>
                                <span style={{ fontSize: 12, background: 'rgba(100,116,139,0.15)', color: '#64748b', borderRadius: 99, padding: '1px 8px', border: '1px solid #334155' }}>
                                  {scenarios.length}개 시나리오
                                </span>
                                {/* 파일 절대경로 복사 및 전체 복사 — 이벤트 버블링 차단 */}
                                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                                  <CopyAbsoluteBtn file={file} targetDir={result.targetDir} />
                                  <CopyFileScenariosBtn file={file} scenarios={scenarios} allScenarios={result.scenarios} />
                                </div>
                              </div>
                              {/* 해당 파일의 시나리오들 */}
                              {!isCollapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem' }}>
                                  {scenarios.map((sc: any, idx: number) => (
                                    <ScenarioCard key={idx} scenario={sc} index={idx + 1} allScenarios={result.scenarios} targetDir={result.targetDir} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <p style={{ color: '#64748b', fontSize: 14, marginBottom: '0.5rem' }}>시나리오 흐름이 감지되지 않았습니다.</p>
                      <p style={{ color: '#475569', fontSize: 12 }}>useEffect, useQuery, useMutation, JSX 이벤트 핸들러 내부의 API 호출을 분석합니다.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── 탭 3: 화면(Route)별 시나리오 ──────────────────────── */}
              {activeTab === 'route' && (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    {result.targetDir} · 화면 라우트 {result.routeScenarios?.length || 0}개 검출
                  </p>
                  {result.routeScenarios?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                      {/* ── [섹션 1] 단일 화면 시나리오 ──────────────────────── */}
                      <div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #1e1b4b' }}>
                          🖥️ 단일 화면 시나리오
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {result.routeScenarios.map((routeData: any) => {
                            const isCollapsed = collapsedRoutes.has(routeData.route);
                            return (
                              <div key={routeData.route} style={{ border: '1px solid #4f46e5', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                {/* 라우트 그룹 헤더 */}
                                <div
                                  onClick={() => {
                                    setCollapsedRoutes(prev => {
                                      const next = new Set(prev);
                                      if (next.has(routeData.route)) next.delete(routeData.route);
                                      else next.add(routeData.route);
                                      return next;
                                    });
                                  }}
                                  style={{ background: '#1e1b4b', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: isCollapsed ? 'none' : '1px solid #3730a3', cursor: 'pointer', userSelect: 'none' }}
                                >
                                  <span style={{ fontSize: 11, color: '#818cf8', transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                                  <span style={{ fontSize: 15 }}>🖥️</span>
                                  <code style={{ fontSize: 15, color: '#c7d2fe', fontFamily: 'monospace', fontWeight: 700 }}>{routeData.route}</code>
                                  <span style={{ fontSize: 12, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', borderRadius: 99, padding: '2px 10px', border: '1px solid #4f46e5', marginLeft: '0.5rem' }}>
                                    {routeData.scenarios.length}개 시나리오
                                  </span>
                                  {/* 시나리오 존재 여부 뱃지 */}
                                  {routeData.e2eScenarios?.length > 0 && (
                                    <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.1)', color: '#34d399', borderRadius: 99, padding: '2px 8px', border: '1px solid rgba(16,185,129,0.3)' }}>
                                      🔗 {routeData.e2eScenarios.length}개 시나리오 연결됨
                                    </span>
                                  )}
                                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                                    <CopyFileScenariosBtn file={routeData.route} scenarios={routeData.scenarios} allScenarios={result.scenarios} />
                                  </div>
                                </div>
                                {/* 해당 라우트의 시나리오들 */}
                                {!isCollapsed && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: '#0b0f19' }}>
                                    {routeData.scenarios
                                      .sort((a: any, b: any) => {
                                        // 1. 파일 이름(경로) 기준으로 먼저 그룹핑
                                        const fileA = a.file || '';
                                        const fileB = b.file || '';
                                        if (fileA !== fileB) return fileA.localeCompare(fileB);
                                        
                                        // 2. 같은 파일 안에서는 MOUNT가 위로 오도록
                                        if (a.triggerType === 'MOUNT' && b.triggerType !== 'MOUNT') return -1;
                                        if (a.triggerType !== 'MOUNT' && b.triggerType === 'MOUNT') return 1;
                                        return 0;
                                      })
                                      .map((sc: any, idx: number) => (
                                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <CompactScenarioCard scenario={sc} index={idx + 1} allScenarios={result.scenarios} showSource={true} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── [섹션 2] E2E 사용자 시나리오 ──────────────── */}
                      {result.routeScenarios.some((r: any) => r.e2eScenarios?.length > 0) && (
                        <div>
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#34d399', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #064e3b' }}>
                            🔗 E2E 사용자 시나리오
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {result.routeScenarios
                              .filter((r: any) => r.e2eScenarios?.length > 0)
                              .flatMap((r: any) => r.e2eScenarios)
                              .map((e2eScenario: any, jIdx: number) => {
                                const e2eScenarioKey = `e2eScenario-${e2eScenario.e2eScenarioId}`;
                                const isCollapsed = collapsedRoutes.has(e2eScenarioKey);
                                return (
                                  <div key={e2eScenarioKey} style={{ border: '1px solid #065f46', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                                    {/* 시나리오 헤더 */}
                                    <div
                                      onClick={() => {
                                        setCollapsedRoutes(prev => {
                                          const next = new Set(prev);
                                          if (next.has(e2eScenarioKey)) next.delete(e2eScenarioKey);
                                          else next.add(e2eScenarioKey);
                                          return next;
                                        });
                                      }}
                                      style={{ background: '#022c22', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: isCollapsed ? 'none' : '1px solid #065f46', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                      <span style={{ fontSize: 11, color: '#34d399', transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                                      <span style={{ fontSize: 15 }}>🗺️</span>
                                      {/* 시나리오 경로: [ / ] ➞ [ /products/[id] ] */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {e2eScenario.steps.map((step: any, sIdx: number) => (
                                          <React.Fragment key={step.route}>
                                            {sIdx > 0 && <span style={{ fontSize: 13, color: '#6b7280' }}>➞</span>}
                                            <code style={{ fontSize: 13, color: '#6ee7b7', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>
                                              {step.route}
                                            </code>
                                          </React.Fragment>
                                        ))}
                                      </div>
                                      <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: 99, padding: '2px 10px', border: '1px solid rgba(16,185,129,0.3)', marginLeft: 'auto' }}>
                                        총 {e2eScenario.steps.reduce((acc: number, s: any) => acc + s.scenarios.length, 0)}개 시나리오
                                      </span>
                                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                        <CopyE2EScenarioBtn e2eScenario={e2eScenario} allScenarios={result.scenarios} />
                                      </div>
                                    </div>
                                    {/* 시나리오 단계별 시나리오 */}
                                    {!isCollapsed && (
                                      <div style={{ background: '#0b0f19', padding: '0.75rem' }}>
                                        {e2eScenario.steps.map((step: any, sIdx: number) => (
                                          <div key={step.route} style={{ marginBottom: sIdx < e2eScenario.steps.length - 1 ? '1.25rem' : 0 }}>
                                            {/* 단계 헤더 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.4rem 0.75rem', background: '#111827', borderRadius: 6, border: '1px solid #1f2937' }}>
                                              <span style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', background: 'rgba(16,185,129,0.1)', borderRadius: 99, padding: '1px 8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                STEP {sIdx + 1}
                                              </span>
                                              <span style={{ fontSize: 13 }}>🖥️</span>
                                              <code style={{ fontSize: 13, color: '#a7f3d0', fontFamily: 'monospace', fontWeight: 700 }}>{step.route}</code>
                                              {sIdx < e2eScenario.steps.length - 1 && (
                                                <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>이 화면에서 다음 화면으로 이동 ➞</span>
                                              )}
                                            </div>
                                            {/* 단계 시나리오 */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '1rem' }}>
                                              {step.scenarios.length > 0 ? step.scenarios.map((sc: any, idx: number) => (
                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                  <CompactScenarioCard scenario={sc} index={idx + 1} allScenarios={result.scenarios} />
                                                </div>
                                              )) : (
                                                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>이 화면에서는 API 시나리오가 없습니다.</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <p style={{ color: '#64748b', fontSize: 14, marginBottom: '0.5rem' }}>화면별 시나리오를 구성할 수 없습니다.</p>
                      <p style={{ color: '#475569', fontSize: 12 }}>page.tsx나 layout.tsx 같은 라우트 진입점을 찾을 수 없거나 의존성 트리에 시나리오가 없습니다.</p>
                    </div>
                  )}
                </>
              )}

          {/* ── AI 탭 ────────────────────────────────────────────── */}
          {activeTab === 'ai' && (
            <section style={{ padding: '2rem' }}>
              {!aiResult && !aiLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', background: '#0f172a', borderRadius: 8, border: '1px solid #1f2937' }}>
                  <h3 style={{ fontSize: 18, color: '#f8fafc', margin: 0 }}>✨ AI 비즈니스 시나리오 번역</h3>
                  <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
                    추출된 E2E 시나리오 데이터를 Gemini 2.5 Flash 모델에게 전달하여<br/>자연어 기반의 기획서용 비즈니스 시나리오로 변환합니다.
                  </p>
                  <button onClick={handleGenerateAI} style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', marginTop: '1rem', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' }}>
                    ✨ AI 번역 생성하기
                  </button>
                </div>
              )}

              {aiLoading && (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginBottom: '1rem', fontSize: '2rem' }}>⚙️</div>
                  <p style={{ margin: '0 0 1rem' }}>
                    AI가 코드를 기획자의 언어로 해석하고 있습니다... <br/>
                    <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600 }}>({aiElapsedTime}초 경과)</span>
                  </p>
                  <button onClick={handleCancelAI} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
                    중지 (Cancel)
                  </button>
                </div>
              )}

              {aiResult?.scenarios && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {aiResult.scenarios.map((sc: any, idx: number) => (
                    <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                      <div 
                        style={{ background: '#0f172a', padding: '1.25rem', borderBottom: '1px solid #334155', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => {
                          const next = new Set(collapsedAiScenarios);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          setCollapsedAiScenarios(next);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: 14, color: '#64748b', width: 14 }}>
                                {collapsedAiScenarios.has(idx) ? '▶' : '▼'}
                              </span>
                              <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700, background: '#334155', padding: '2px 8px', borderRadius: 12 }}>
                                {idx + 1}
                              </span>
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0 }}>{sc.title}</h3>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {sc.tags?.map((tag: string) => (
                              <span key={tag} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontSize: 12, padding: '3px 10px', borderRadius: 12, fontWeight: 700, border: '1px solid rgba(99, 102, 241, 0.2)' }}>#{tag}</span>
                            ))}
                            <CopyAiScenarioBtn scenario={sc} />
                          </div>
                        </div>
                        <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6, paddingLeft: '1.5rem' }}>{sc.summary}</p>
                      </div>
                      {!collapsedAiScenarios.has(idx) && (
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {sc.steps?.map((step: any, sIdx: number) => (
                            <div key={sIdx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                              <div style={{ background: '#10b981', color: '#022c22', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
                                {sIdx + 1}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <code style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 700, padding: '2px 6px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 4 }}>
                                    {step.route}
                                  </code>
                                  {step.apiFlow && step.apiFlow !== 'API 호출 없음' && (
                                    <code style={{ fontSize: 12, color: '#93c5fd', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 4 }}>
                                      {step.apiFlow}
                                    </code>
                                  )}
                                </div>
                                <p style={{ fontSize: 14, color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>
                                  {step.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// ── 시나리오 카드 ──────────────────────────────────────────────
function ScenarioCard({ scenario, index, allScenarios = [], targetDir = '' }: { scenario: any; index: number; allScenarios?: any[]; targetDir?: string }) {
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

        {scenario.line && (
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginLeft: 'auto', background: '#1e293b', border: '1px solid #334155', padding: '1px 7px', borderRadius: 4 }}>
            :{scenario.line}
          </span>
        )}

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

// ── 심플한 시나리오 카드 (흐름 파악용) ──────────────────────────────
function CompactScenarioCard({ scenario, index, allScenarios = [], showSource = false }: { scenario: any; index: number; allScenarios?: any[]; showSource?: boolean }) {
  const isMount = scenario.triggerType === 'MOUNT';
  const triggerColor = isMount
    ? { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.3)' }
    : { bg: 'rgba(251,146,60,0.1)', text: '#fb923c', border: 'rgba(251,146,60,0.3)' };

  // triggersRefetch 키와 일치하는 MOUNT 시나리오 찾기
  const refetchChains: { key: string; apiCalls: any[]; file: string }[] = [];
  const seenEndpoints = new Set<string>();
  if (scenario.triggersRefetch?.length && allScenarios.length > 0) {
    for (const key of scenario.triggersRefetch) {
      const matched = allScenarios.filter((s: any) =>
        s.triggerType === 'MOUNT' &&
        s.apiCalls?.some((c: any) =>
          c.endpoint?.toLowerCase().includes(key.toLowerCase())
        )
      );
      matched.forEach((m: any) => {
        const matchedCalls = m.apiCalls.filter((c: any) => {
          if (!c.endpoint?.toLowerCase().includes(key.toLowerCase())) return false;
          const sig = `${c.method}:${c.endpoint}`;
          if (seenEndpoints.has(sig)) return false;
          seenEndpoints.add(sig);
          return true;
        });
        if (matchedCalls.length > 0) {
          refetchChains.push({ key, apiCalls: matchedCalls, file: m.file });
        }
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', background: '#0f172a', borderRadius: '6px', border: '1px solid #1f2937' }}>
      {/* Trigger Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#475569', fontWeight: 700, minWidth: 16 }}>{String(index).padStart(2, '0')}</span>
        <span style={{
          fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: 99,
          background: triggerColor.bg, color: triggerColor.text, border: `1px solid ${triggerColor.border}`,
          letterSpacing: '0.5px', textTransform: 'uppercase'
        }}>
          {isMount ? '⚙ MOUNT' : '👆 EVENT'}
        </span>
        <code style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>{scenario.triggerSource}</code>
        {showSource && scenario.file && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>
            {scenario.file}
          </span>
        )}
      </div>
      
      {/* API Calls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '32px' }}>
        {scenario.apiCalls.map((call: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MethodBadge method={call.method} />
            <code style={{ fontSize: '13px', color: '#f8fafc', fontFamily: 'monospace' }}>{call.endpoint}</code>
          </div>
        ))}
        {/* Refetch Chains */}
        {refetchChains.map((chain, ci) => 
          chain.apiCalls.map((call: any, ai: number) => (
            <div key={`refetch-${ci}-${ai}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
              <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 700 }}>↳ 🔄 재요청</span>
              <MethodBadge method={call.method} />
              <code style={{ fontSize: '13px', color: '#c7d2fe', fontFamily: 'monospace' }}>{call.endpoint}</code>
            </div>
          ))
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
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        whiteSpace: 'nowrap',
        flexShrink: 0
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
      padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4, transition: 'all 0.2s', whiteSpace: 'nowrap',
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


function CopyAbsoluteBtn({ file, line, targetDir }: { file: string; line?: number; targetDir?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!targetDir) return;
    const absolutePath = `${targetDir.replace(/[/\\]$/, '')}\\${file.replace(/\//g, '\\')}${line ? `:${line}` : ''}`;
    await navigator.clipboard.writeText(absolutePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      title="절대 경로 복사"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: copied ? '#10b981' : '#64748b',
        padding: '2px 6px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        fontSize: 14,
        transition: 'all 0.2s',
      }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      {copied ? '✓' : '🔗'}
    </button>
  );
}

function CopyFileScenariosBtn({ file, scenarios, allScenarios = [] }: { file: string; scenarios: any[]; allScenarios?: any[] }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = `${file} (${scenarios.length}개 시나리오)\n\n`;

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      const isMount = scenario.triggerType === 'MOUNT';
      
      const refetchChains: { key: string; apiCalls: any[]; file: string }[] = [];
      const seenEndpoints = new Set<string>();
      if (scenario.triggersRefetch?.length && allScenarios.length > 0) {
        for (const key of scenario.triggersRefetch) {
          const matched = allScenarios.filter((s: any) =>
            s.triggerType === 'MOUNT' &&
            s.apiCalls?.some((c: any) => c.endpoint?.toLowerCase().includes(key.toLowerCase()))
          );
          matched.forEach((m: any) => {
            const matchedCalls = m.apiCalls.filter((c: any) => {
              if (!c.endpoint?.toLowerCase().includes(key.toLowerCase())) return false;
              const sig = `${c.method}:${c.endpoint}`;
              if (seenEndpoints.has(sig)) return false;
              seenEndpoints.add(sig);
              return true;
            });
            if (matchedCalls.length > 0) {
              refetchChains.push({ key, apiCalls: matchedCalls, file: m.file });
            }
          });
        }
      }

      const lines: string[] = [
        `[${String(i + 1).padStart(2, '0')}] ${isMount ? '⚙ MOUNT' : '👆 EVENT'}  ${scenario.triggerSource}${scenario.line ? ` (Line: ${scenario.line})` : ''}`,
        ...scenario.apiCalls.map((c: any) => `  ${c.order}. ${c.method.padEnd(6)} ${c.endpoint}`),
      ];

      if (refetchChains.length > 0) {
        lines.push('  🔄 onSuccess → invalidateQueries → 자동 재요청');
        let idx = 1;
        for (const chain of refetchChains) {
          for (const call of chain.apiCalls) {
            lines.push(`     ${idx++}. ${call.method.padEnd(6)} ${call.endpoint}  (${chain.file})`);
          }
        }
      } else if (scenario.triggersRefetch?.length) {
        lines.push(`  🔄 Refetch: [${scenario.triggersRefetch.join(', ')}]`);
      }

      textToCopy += lines.join('\n') + '\n\n';
    }

    await navigator.clipboard.writeText(textToCopy.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="이 파일의 전체 시나리오 복사"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: copied ? '#10b981' : '#64748b',
        padding: '2px 8px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        fontSize: 12,
        fontWeight: 600,
        transition: 'all 0.2s',
      }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      {copied ? '✓ 복사됨' : '📋 전체 복사'}
    </button>
  );
}

// ── 시나리오 전체 복사 버튼 ───────────────────────────────────────────
function CopyE2EScenarioBtn({ e2eScenario, allScenarios = [] }: { e2eScenario: any; allScenarios?: any[] }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const title = e2eScenario.steps.map((s: any) => `[ ${s.route} ]`).join(' ➞ ');
    let textToCopy = `E2E 시나리오: ${title}\n\n`;

    e2eScenario.steps.forEach((step: any, sIdx: number) => {
      textToCopy += `[STEP ${sIdx + 1}] 🖥️ ${step.route}\n`;
      
      if (step.scenarios.length === 0) {
        textToCopy += `  (API 호출 없음)\n\n`;
        return;
      }

      step.scenarios.forEach((scenario: any, i: number) => {
        const isMount = scenario.triggerType === 'MOUNT';
        
        const refetchChains: { key: string; apiCalls: any[]; file: string }[] = [];
        const seenEndpoints = new Set<string>();
        if (scenario.triggersRefetch?.length && allScenarios.length > 0) {
          for (const key of scenario.triggersRefetch) {
            const matched = allScenarios.filter((s: any) =>
              s.triggerType === 'MOUNT' &&
              s.apiCalls?.some((c: any) => c.endpoint?.toLowerCase().includes(key.toLowerCase()))
            );
            matched.forEach((m: any) => {
              const matchedCalls = m.apiCalls.filter((c: any) => {
                if (!c.endpoint?.toLowerCase().includes(key.toLowerCase())) return false;
                const sig = `${c.method}:${c.endpoint}`;
                if (seenEndpoints.has(sig)) return false;
                seenEndpoints.add(sig);
                return true;
              });
              if (matchedCalls.length > 0) {
                refetchChains.push({ key, apiCalls: matchedCalls, file: m.file });
              }
            });
          }
        }

        const triggerPrefix = `  [${String(i + 1).padStart(2, '0')}] ${isMount ? '⚙ MOUNT' : '👆 EVENT'}  ${scenario.triggerSource}`;
        textToCopy += `${triggerPrefix}\n`;
        
        scenario.apiCalls.forEach((c: any) => {
          textToCopy += `    - ${c.method.padEnd(6)} ${c.endpoint}\n`;
        });

        if (refetchChains.length > 0) {
          refetchChains.forEach(chain => {
            chain.apiCalls.forEach(call => {
              textToCopy += `    ↳ 🔄 재요청\n`;
              textToCopy += `      - ${call.method.padEnd(6)} ${call.endpoint}\n`;
            });
          });
        }
      });
      textToCopy += '\n';
    });

    await navigator.clipboard.writeText(textToCopy.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="이 시나리오 흐름 전체 복사"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: copied ? '#10b981' : '#34d399',
        padding: '2px 8px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        fontSize: 12,
        fontWeight: 600,
        transition: 'all 0.2s',
      }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      {copied ? '✓ 복사 완료' : '📋 시나리오 전체 복사'}
    </button>
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
      `${scenario.file}${scenario.line ? `:${scenario.line}` : ''}  [${scenario.triggerType}] ${scenario.triggerSource}`,
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


// ── AI 시나리오 복사 버튼 ─────────────────────────────────────────────
function CopyAiScenarioBtn({ scenario }: { scenario: any }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let text = '▼\n' + scenario.title + '\n';
    scenario.tags?.forEach((t: string) => { text += '#' + t + '\n' });
    text += scenario.summary + '\n\n';

    scenario.steps?.forEach((step: any, idx: number) => {
      text += (idx + 1) + '\n' + step.route + '\n';
      if (step.apiFlow && step.apiFlow !== 'API 호출 없음') {
        text += step.apiFlow + '\n';
      }
      text += step.description + '\n\n';
    });

    await navigator.clipboard.writeText(text.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="이 AI 시나리오 복사"
      style={{
        background: copied ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
        border: 'none',
        borderRadius: 5,
        padding: '3px 6px',
        fontSize: 14,
        color: copied ? '#818cf8' : '#64748b',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        marginLeft: '4px'
      }}
      onMouseOver={e => { if (!copied) { e.currentTarget.style.color = '#f8fafc'; } }}
      onMouseOut={e => { if (!copied) { e.currentTarget.style.color = '#64748b'; } }}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}
