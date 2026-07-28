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

function AIScenarioCard({ scenario, idx }: { scenario: any; idx: number }) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent collapse toggle
    const textToCopy = `[${scenario.title}]\n${scenario.description}\n\n` + 
      scenario.steps.map((s: any, i: number) => `${i+1}. ${s.route} : ${s.flow}\n   ${s.description}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden', marginBottom: '1.5rem' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{isOpen ? '▼' : '▶'}</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#334155', width: 24, height: 24, borderRadius: '50%', fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              {idx + 1}
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {scenario.title}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {scenario.tags?.map((tag: string, i: number) => (
              <span key={i} style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '3px 8px', borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600 }}>
                {tag}
              </span>
            ))}
            <button 
              onClick={handleCopy}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
              title="시나리오 복사"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', paddingLeft: '2.5rem' }}>
          {scenario.description}
        </p>
      </div>

      {isOpen && (
        <div style={{ padding: '1.5rem 1.25rem 1.5rem 3.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#1e293b' }}>
          {scenario.steps?.map((step: any, sIdx: number) => (
            <div key={sIdx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10b981', width: 24, height: 24, borderRadius: '50%', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: '2px' }}>
                {sIdx + 1}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
                    {step.route}
                  </span>
                  <span style={{ fontSize: 13, background: 'rgba(51, 65, 85, 0.5)', padding: '4px 10px', borderRadius: 4, color: '#94a3b8', fontFamily: 'monospace', border: '1px solid #475569' }}>
                    {step.flow}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'component' | 'screen' | 'ai'>('component');
  const [copiedIr, setCopiedIr] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [collapsedScenarios, setCollapsedScenarios] = useState<Set<number>>(new Set());
  const [logs, setLogs] = useState<{text: string, time: number}[]>([]);
  const eventSourceRef = React.useRef<EventSource | null>(null);

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
    if (result?.aiScenarios && result.aiScenarios.length > 0) {
      const textToCopy = result.aiScenarios.map((scenario: any) => {
        return `[${scenario.title}]\n${scenario.description}\n\n` + 
          scenario.steps.map((s: any, i: number) => `${i+1}. ${s.route} : ${s.flow}\n   ${s.description}`).join('\n');
      }).join('\n\n----------------------------------------\n\n');
      navigator.clipboard.writeText(textToCopy);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
      return;
    }
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

  const runAstAnalysis = async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setActiveTab('component');
    setLogs([{ text: '정적 분석(AST)을 시작합니다...', time: 0 }]);

    try {
      const res = await fetch(`/api/analyze/ast?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '정적 분석 중 오류가 발생했습니다.');
      }
      
      setResult(data);
      setLogs(prev => [...prev, { text: '정적 분석 완료! 🎉', time: 0 }]);
    } catch (err: any) {
      setError(err.message || '서버 통신 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!result?.scenarios || !targetPath) return;
    
    setLoading(true);
    setActiveTab('ai');
    setLogs([{ text: 'AI 비즈니스 시나리오 생성을 요청합니다...', time: 0 }]);

    const eventSource = new EventSource('about:blank'); // Fetch API does not support EventSource POST easily, but we can use fetch for stream.
    
    try {
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, scenarios: result.scenarios })
      });
      
      if (!response.ok) throw new Error('스트리밍 서버 오류');
      if (!response.body) throw new Error('스트리밍 응답이 없습니다.');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventMatch = line.match(/event: (.*)\ndata: (.*)/);
            if (eventMatch) {
              const event = eventMatch[1];
              const data = eventMatch[2];
              
              if (event === 'progress') {
                try {
                  const parsed = JSON.parse(data);
                  setLogs(prev => {
                    if (prev.length === 0 || prev[prev.length - 1].text !== parsed.message) {
                      return [...prev, { text: parsed.message, time: 0 }];
                    }
                    return prev;
                  });
                } catch(e) {}
              } else if (event === 'complete') {
                try {
                  const parsed = JSON.parse(data);
                  setLogs(prev => [...prev, { text: '최종 결과물 출력! 🎉', time: 0 }]);
                  setResult((prev: any) => ({ ...prev, markdown: parsed.markdown, aiScenarios: parsed.aiScenarios }));
                } catch(e) {}
              } else if (event === 'error') {
                try {
                  const parsed = JSON.parse(data);
                  setError(parsed.message);
                } catch(e) {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || '스트리밍 통신 중 연결이 끊어졌습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAstAnalysis(targetPath);
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setLoading(false);
    setError('사용자에 의해 분석이 중지되었습니다.');
  };

  const handleQuickRun = () => {
    const dummy = 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\tmp-project-5-shopping-mall';
    setTargetPath(dummy);
  };

  const groupedScenarios = React.useMemo(() => {
    if (!result?.scenarios) return [];
    const groups: Record<string, any[]> = {};
    result.scenarios.forEach((sc: any) => {
      if (!groups[sc.route]) groups[sc.route] = [];
      groups[sc.route].push(sc);
    });
    return Object.entries(groups).map(([route, items]) => ({ route, items }));
  }, [result?.scenarios]);

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
            ) : '정적 분석 (AST) 실행'}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleStop}
              style={{
                padding: '0 2rem', fontSize: 15, fontWeight: 600, borderRadius: 8, border: 'none',
                background: '#e11d48', color: '#fff', cursor: 'pointer',
                transition: 'background 0.2s', minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              중지
            </button>
          )}
        </form>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* 진행 상태 바 UI (기록식 로그) */}
        {logs.length > 0 && (
          <div style={{ padding: '1.25rem', background: '#0f172a', border: '1px solid #3b82f688', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: '0.25rem' }}>🤖 시스템 및 에이전트 작업 로그</div>
            {logs.map((log, idx) => {
              const isLast = idx === logs.length - 1;
              const isComplete = log.text.includes('완료! 🎉') || log.text.includes('출력! 🎉');
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
                onClick={() => setActiveTab('component')}
                style={{
                  flex: 1, padding: '1rem', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: activeTab === 'component' ? '#1e293b' : 'transparent',
                  color: activeTab === 'component' ? '#34d399' : '#94a3b8',
                  borderBottom: activeTab === 'component' ? '2px solid #10b981' : '2px solid transparent'
                }}
              >
                1단계: 컴포넌트 단위 추출 (AST)
              </button>
              <button
                onClick={() => setActiveTab('screen')}
                style={{
                  flex: 1, padding: '1rem', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: activeTab === 'screen' ? '#1e293b' : 'transparent',
                  color: activeTab === 'screen' ? '#60a5fa' : '#94a3b8',
                  borderBottom: activeTab === 'screen' ? '2px solid #3b82f6' : '2px solid transparent'
                }}
              >
                2단계: 화면별 흐름 묶음 (AST)
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
                3단계: AI 비즈니스 시나리오
              </button>
            </div>

            <div style={{ padding: '1.5rem 2rem 2.5rem', overflowY: 'auto' }}>
              
              {/* COMPONENT 탭 */}
              {activeTab === 'component' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#0f172a', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1.1rem' }}>컴포넌트 단위 정적 분석 결과</h3>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>AST 파서가 각 파일에서 발견한 순수 API 호출 포인트들입니다.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('screen')}
                      style={{ padding: '0.75rem 1.5rem', background: '#334155', color: '#fff', border: '1px solid #475569', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      다음 단계: 화면별 흐름 보기 ➔
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#0f172a', padding: '1rem 1.5rem', borderRadius: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>총 추출된 컴포넌트(파일)</span>
                      <span style={{ fontSize: 24, color: '#f8fafc', fontWeight: 800 }}>{result?.results?.length || 0}개</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {result?.results?.map((res: any, idx: number) => (
                      <div key={idx} style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', background: '#1e293b' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>📄 {res.file}</div>
                        </div>
                        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {res.apiCalls?.length > 0 ? res.apiCalls.map((call: any, cIdx: number) => (
                            <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#1e293b', padding: '1rem', borderRadius: 8, border: '1px solid #475569' }}>
                              <MethodBadge method={call.method} />
                              <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#f8fafc' }}>{call.endpoint}</span>
                              <div style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
                                [ {call.type} ] {call.hook ? `hook: ${call.hook}` : ''}
                              </div>
                            </div>
                          )) : <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>API 호출 없음</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SCREEN 탭 */}
              {activeTab === 'screen' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#0f172a', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1.1rem' }}>화면(라우트) 단위 선후행 흐름</h3>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>컴포넌트들이 화면별로 묶여 실행되는 순서입니다. 완벽하다면 AI에게 전달하세요.</p>
                    </div>
                    <button 
                      onClick={runAiAnalysis}
                      disabled={loading}
                      style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    >
                      ✨ AI 비즈니스 시나리오 생성하기 ➔
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button onClick={handleCopyIr} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {copiedIr ? '✓ 복사됨' : '📋 JSON 복사'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#0f172a', padding: '1rem 1.5rem', borderRadius: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>총 추출된 라우트(화면)</span>
                      <span style={{ fontSize: 24, color: '#3b82f6', fontWeight: 800 }}>{groupedScenarios.length}개</span>
                    </div>
                    <div style={{ background: '#0f172a', padding: '1rem 1.5rem', borderRadius: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>총 추출된 이벤트/라이프사이클</span>
                      <span style={{ fontSize: 24, color: '#34d399', fontWeight: 800 }}>{totalScenarios}개</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {groupedScenarios.map((group, groupIdx) => (
                      <div key={groupIdx} style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #3b82f6', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.1)' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.2em' }}>📍</span> {group.route}
                          </div>
                          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                            관련 이벤트 {group.items.length}개
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {group.items.map((scenario: any, idx: number) => (
                            <div key={idx} style={{ background: '#1e293b', borderRadius: 8, border: '1px solid #475569', padding: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>📄 {scenario.sourceFile}</div>
                                <div style={{ fontSize: 12, background: '#0f172a', padding: '0.3rem 0.6rem', borderRadius: 4, color: '#94a3b8', border: '1px solid #334155' }}>
                                  ⚡ {scenario.trigger.type}: {scenario.trigger.name}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {scenario.calls?.length > 0 ? scenario.calls.map((call: any, callIdx: number) => (
                                  <div key={callIdx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#0f172a', padding: '0.8rem', borderRadius: 6, border: '1px solid #334155' }}>
                                    <MethodBadge method={call.method} />
                                    <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#f8fafc' }}>{call.endpoint}</span>
                                    {call.navigatesTo && (
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', background: '#451a03', padding: '2px 6px', borderRadius: 4, border: '1px solid #ea580c' }}>
                                        → {call.navigatesTo} 이동
                                      </span>
                                    )}
                                    <div style={{ marginLeft: 'auto' }}>
                                      <ConfidenceBadge level={call.confidence} />
                                    </div>
                                  </div>
                                )) : <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>호출 없음</div>}
                                
                                {scenario.triggersRefetch && scenario.triggersRefetch.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem', paddingLeft: '1.5rem', borderLeft: '2px dashed #475569' }}>
                                    <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                      <span>🔄 onSuccess → invalidateQueries → 자동 재요청</span>
                                    </div>
                                    {scenario.triggersRefetch.map((key: string, kIdx: number) => (
                                      <div key={kIdx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#0f172a', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #334155', opacity: 0.8 }}>
                                        <MethodBadge method="GET" />
                                        <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#94a3b8' }}>QueryKey: {key}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
                    style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', padding: '0.5rem 1rem', background: '#a855f7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', zIndex: 10 }}
                  >
                    {copiedAi ? '✓ 복사됨' : '📋 리포트 복사'}
                  </button>
                  
                  {result.aiScenarios && result.aiScenarios.length > 0 ? (
                    <div style={{ marginTop: '2rem' }}>
                      {result.aiScenarios.map((scenario: any, idx: number) => (
                        <AIScenarioCard key={idx} scenario={scenario} idx={idx} />
                      ))}
                    </div>
                  ) : result.markdown ? (
                    <div className="prose prose-invert max-w-none prose-headings:font-bold prose-a:text-blue-400 prose-p:text-slate-300 mt-4">
                      <ReactMarkdown>{result.markdown}</ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', gap: '1.5rem' }}>
                      <div style={{ fontSize: '3rem' }}>🤖</div>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>아직 생성된 AI 리포트가 없습니다</h3>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>아래 버튼을 눌러 로컬 LLM에게 비즈니스 시나리오 추론을 맡겨보세요.</p>
                      </div>
                      <button 
                        onClick={runAiAnalysis}
                        disabled={loading}
                        style={{ padding: '0.8rem 2rem', background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)', transition: 'transform 0.2s' }}
                      >
                        {loading ? 'AI가 열심히 리포트를 작성하는 중입니다...' : '✨ AI 비즈니스 시나리오 생성하기'}
                      </button>
                    </div>
                  )}
                  
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
