'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

// ── HTTP Method 배지 색상 ───────────────────────────────────────
const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET:     { bg: '#1e3a5f', text: '#60a5fa', border: '#2563eb' },
  POST:    { bg: '#064e3b', text: '#34d399', border: '#059669' },
  PUT:     { bg: '#451a03', text: '#fb923c', border: '#ea580c' },
  DELETE:  { bg: '#4c0519', text: '#fb7185', border: '#e11d48' },
  PATCH:   { bg: '#3b0764', text: '#c084fc', border: '#9333ea' },
  UNKNOWN: { bg: '#1e293b', text: '#94a3b8', border: '#475569' },
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

function ConfidenceBadge({ level }: { level: 'detected' | 'inferred' }) {
  if (level === 'detected') {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 8px',
        borderRadius: 4, border: `1px solid #059669`,
        background: '#064e3b', color: '#34d399',
        letterSpacing: '0.5px', textAlign: 'center', display: 'inline-block'
      }}>
        ✓ Detected (AST)
      </span>
    );
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px',
      borderRadius: 4, border: `1px solid #9333ea`,
      background: '#3b0764', color: '#c084fc',
      letterSpacing: '0.5px', textAlign: 'center', display: 'inline-block'
    }}>
      ✨ Inferred (LLM)
    </span>
  );
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'ir' | 'ai'>('ir');
  const [copiedIr, setCopiedIr] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [collapsedScenarios, setCollapsedScenarios] = useState<Set<number>>(new Set());
  const [logs, setLogs] = useState<{text: string, time: number}[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLogs(prev => {
          if (prev.length === 0) return prev;
          const newLogs = [...prev];
          newLogs[newLogs.length - 1] = { ...newLogs[newLogs.length - 1], time: newLogs[newLogs.length - 1].time + 1 };
          return newLogs;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleCopyIr = () => {
    if (!result?.scenarios) return;
    navigator.clipboard.writeText(JSON.stringify(result.scenarios, null, 2));
    setCopiedIr(true);
    setTimeout(() => setCopiedIr(false), 2000);
  };

  const handleCopyAi = () => {
    if (!result?.markdown) return;
    navigator.clipboard.writeText(result.markdown);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2000);
  };

  const toggleCollapse = (idx: number) => {
    setCollapsedScenarios(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const runAnalysis = async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setActiveTab('ir');
    setLogs([{ text: '분석 요청을 준비 중입니다...', time: 0 }]);

    const eventSource = new EventSource(`/api/analyze/stream?path=${encodeURIComponent(path)}`);

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => {
          if (prev.length === 0 || prev[prev.length - 1].text !== data.message) {
            return [...prev, { text: data.message, time: 0 }];
          }
          return prev;
        });
      } catch (err) {}
    });

    eventSource.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, { text: '최종 결과물 출력! 🎉', time: 0 }]);
        setResult(data);
        eventSource.close();
        setLoading(false);
      } catch (err) {
        setError('응답 데이터를 파싱하는데 실패했습니다.');
        eventSource.close();
        setLoading(false);
      }
    });

    eventSource.addEventListener('error', (e: any) => {
      eventSource.close();
      setLoading(false);
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          setError(data.message || '스트리밍 통신 오류가 발생했습니다.');
        } catch (err) {
          setError('스트리밍 통신 중 연결이 끊어졌습니다.');
        }
      } else {
        setError('스트리밍 통신 중 연결이 끊어졌습니다.');
      }
    });
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAnalysis(targetPath);
  };

  const handleQuickRun = () => {
    const dummy = 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-5-shopping-mall';
    setTargetPath(dummy);
  };

  const totalScenarios = result?.scenarios?.length || 0;
  const totalApiCalls = result?.scenarios?.reduce((acc: number, sc: any) => acc + (sc.calls?.length || 0), 0) || 0;

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f19', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── 헤더 ──────────────────────────────────────────────── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f2937', paddingBottom: '1.5rem' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#34d399', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              v7 · AST + LLM Hybrid Analyzer
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0.5rem 0 0.4rem', color: '#f8fafc', letterSpacing: '-0.5px' }}>
              프론트엔드 API 시나리오 분석기-7
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
              React/Next.js 프로젝트 코드를 정적 분석(AST)하고, 누락된 문맥을 로컬 LLM이 추론하여 비즈니스 시나리오를 자동 생성합니다.<br />
              AST 추출 데이터는 <span style={{ color: '#34d399' }}>Detected</span>로, LLM 추론 데이터는 <span style={{ color: '#c084fc' }}>Inferred</span>로 명확히 분리합니다.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleQuickRun}
              style={{ padding: '0.6rem 1.2rem', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = '#334155'}
              onMouseOut={e => e.currentTarget.style.background = '#1e293b'}
            >
              🚀 더미 경로 로드
            </button>
          </div>
        </header>

        {/* ── 입력 폼 ────────────────────────────────────────────── */}
        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            value={targetPath}
            onChange={e => setTargetPath(e.target.value)}
            placeholder="분석할 프론트엔드 프로젝트 절대 경로 입력..."
            style={{
              flex: 1, padding: '1rem 1.25rem', fontSize: 15, borderRadius: 8,
              border: '1px solid #334155', background: '#1e293b', color: '#f8fafc',
              outline: 'none', transition: 'border-color 0.2s'
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={e => e.currentTarget.style.borderColor = '#334155'}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0 2rem', fontSize: 15, fontWeight: 600, borderRadius: 8, border: 'none',
              background: loading ? '#3b82f688' : '#3b82f6', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}
          >
            {loading ? (
              <>
                <svg style={{ animation: 'spin 1s linear infinite', width: '1.25rem', height: '1.25rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                분석 중...
              </>
            ) : '분석 실행'}
          </button>
        </form>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* 진행 상태 바 UI (기록식 로그) */}
        {logs.length > 0 && (
          <div style={{ padding: '1.25rem', background: '#0f172a', border: '1px solid #3b82f688', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: '0.25rem' }}>🤖 에이전트 작업 로그</div>
            {logs.map((log, idx) => {
              const isLast = idx === logs.length - 1;
              const isComplete = log.text === '최종 결과물 출력! 🎉';
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: (isLast || isComplete) ? 1 : 0.6 }}>
                  {isLast && loading ? (
                    <svg style={{ animation: 'spin 1s linear infinite', width: '1rem', height: '1rem', color: '#60a5fa' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span style={{ fontSize: '1rem' }}>✅</span>
                  )}
                  <div style={{ flex: 1, fontSize: 14, color: (isLast && loading) ? '#60a5fa' : (isComplete ? '#34d399' : '#cbd5e1'), fontWeight: (isLast || isComplete) ? 600 : 400 }}>
                    {log.text}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, minWidth: '35px', textAlign: 'right' }}>
                    {log.time}초
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', background: '#4c0519', border: '1px solid #e11d48', borderRadius: 8, color: '#fecdd3', fontSize: 14 }}>
            🚨 {error}
          </div>
        )}

        {/* ── 결과 탭 ─────────────────────────────────────────────── */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
            
            <div style={{ display: 'flex', background: '#0f172a', borderBottom: '1px solid #334155' }}>
              <button
                onClick={() => setActiveTab('ir')}
                style={{
                  flex: 1, padding: '1rem', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: activeTab === 'ir' ? '#1e293b' : 'transparent',
                  color: activeTab === 'ir' ? '#60a5fa' : '#94a3b8',
                  borderBottom: activeTab === 'ir' ? '2px solid #3b82f6' : '2px solid transparent'
                }}
              >
                🔍 AST 추출 데이터 (IR)
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                style={{
                  flex: 1, padding: '1rem', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: activeTab === 'ai' ? '#1e293b' : 'transparent',
                  color: activeTab === 'ai' ? '#c084fc' : '#94a3b8',
                  borderBottom: activeTab === 'ai' ? '2px solid #a855f7' : '2px solid transparent'
                }}
              >
                ✨ AI 비즈니스 시나리오 리포트
              </button>
            </div>

            <div style={{ padding: '1.5rem 2rem 2.5rem', overflowY: 'auto' }}>
              {/* IR 탭 */}
              {activeTab === 'ir' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button 
                      onClick={handleCopyIr}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {copiedIr ? '✓ 복사됨' : '📋 JSON 복사'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#0f172a', padding: '1rem 1.5rem', borderRadius: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>총 추출된 시나리오</span>
                      <span style={{ fontSize: 24, color: '#f8fafc', fontWeight: 800 }}>{totalScenarios}개</span>
                    </div>
                    <div style={{ background: '#0f172a', padding: '1rem 1.5rem', borderRadius: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>총 API 호출 포인트</span>
                      <span style={{ fontSize: 24, color: '#34d399', fontWeight: 800 }}>{totalApiCalls}개</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {result.scenarios?.map((scenario: any, idx: number) => (
                      <div key={idx} style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                              {scenario.framework}
                            </span>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.2em' }}>📍</span> {scenario.route}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', marginTop: '0.4rem' }}>
                              📄 {scenario.sourceFile}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ fontSize: 12, background: '#1e293b', padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #475569', color: '#94a3b8', fontWeight: 600 }}>
                              ⚡ {scenario.trigger.type}: {scenario.trigger.name}
                            </div>
                            <button
                              onClick={() => toggleCollapse(idx)}
                              style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '0.3rem 0.6rem', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                            >
                              {collapsedScenarios.has(idx) ? '▼ 펼치기' : '▲ 접기'}
                            </button>
                          </div>
                        </div>

                        {!collapsedScenarios.has(idx) && (
                          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {scenario.calls?.map((call: any, callIdx: number) => (
                            <div key={callIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: '#1e293b', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <MethodBadge method={call.method} />
                                <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#f8fafc' }}>
                                  {call.endpoint}
                                </span>
                                {call.navigatesTo && (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', background: '#451a03', padding: '2px 6px', borderRadius: 4, border: '1px solid #ea580c' }}>
                                    → {call.navigatesTo} 이동
                                  </span>
                                )}
                                <div style={{ marginLeft: 'auto' }}>
                                  <ConfidenceBadge level={call.confidence} />
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: '#94a3b8', background: '#0f172a', padding: '0.75rem', borderRadius: 6, border: '1px solid #334155' }}>
                                <strong style={{ color: '#cbd5e1' }}>Evidence: </strong> {call.evidence}
                              </div>
                              {call.condition && (
                                <div style={{ fontSize: 12, color: '#fb923c', fontFamily: 'monospace' }}>
                                  Condition: {call.condition}
                                </div>
                              )}
                            </div>
                          ))}
                          {(!scenario.calls || scenario.calls.length === 0) && (
                            <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: '0.5rem 0' }}>
                              감지된 API 호출 없음
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI 탭 */}
              {activeTab === 'ai' && (
                <div style={{ position: 'relative', background: '#0f172a', padding: '2rem', borderRadius: 8, border: '1px solid #334155' }}>
                  <button 
                    onClick={handleCopyAi}
                    style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', padding: '0.5rem 1rem', background: '#a855f7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {copiedAi ? '✓ 복사됨' : '📋 리포트 복사'}
                  </button>
                  <div className="prose prose-invert max-w-none prose-headings:font-bold prose-a:text-blue-400 prose-p:text-slate-300 mt-4">
                    <ReactMarkdown>{result.markdown || '생성된 리포트가 없습니다.'}</ReactMarkdown>
                  </div>
                  <style dangerouslySetInnerHTML={{__html: `
                    .prose h1 { font-size: 1.8rem; margin-bottom: 1.5rem; color: #f8fafc; }
                    .prose h2 { font-size: 1.4rem; margin-top: 2rem; margin-bottom: 1rem; color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
                    .prose h3 { font-size: 1.1rem; margin-top: 1.5rem; color: #cbd5e1; }
                    .prose ul, .prose ol { padding-left: 1.5rem; margin-bottom: 1rem; }
                    .prose li { margin-bottom: 0.5rem; }
                    .prose code { background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; color: #60a5fa; }
                    .prose pre code { background: transparent; color: inherit; padding: 0; }
                    .prose pre { background: #1e293b; padding: 1rem; border-radius: 8px; overflow-x: auto; border: 1px solid #334155; }
                  `}} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
