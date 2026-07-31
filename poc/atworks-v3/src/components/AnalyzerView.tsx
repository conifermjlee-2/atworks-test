'use client';
import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function AnalyzerView({
  onClose,
  collections,
  apiItems,
  onSave
}: any) {
  // Step 1 States
  const [importPath, setImportPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [step, setStep] = useState(1);
  const [rootPath, setRootPath] = useState('');

  // Step 2 States
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [targetCollectionId, setTargetCollectionId] = useState<string>(collections[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const groupedCandidates = React.useMemo(() => {
    const groups: Record<string, typeof candidates> = {};
    candidates.forEach(c => {
      const groupName = c.filePath ? c.filePath.replace(/^.*?(src[\\/].*)$/, '$1').replace(/\\/g, '/') : 'Unknown File';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(c);
    });
    return groups;
  }, [candidates]);

  const handleScanPath = async () => {
    if (!importPath.trim()) return;
    setIsScanning(true);
    setStep(2);
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: importPath })
      });
      const data = await res.json();

      if (data.candidates) {
        setRootPath(importPath);
        setCandidates(data.candidates);
        setSelectedCandidates(data.candidates.map((c: any) => c.id));
      } else {
        toast.error(data.error || 'Failed to analyze');
        setStep(1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error analyzing path');
      setStep(1);
    }
    setIsScanning(false);
    setIsAnalyzing(false);
  };

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!targetCollectionId || selectedCandidates.length === 0) return;
    setIsSaving(true);
    try {
      const itemsToSave = candidates.filter(c => selectedCandidates.includes(c.id));
      const newItems = [];
      const duplicates = [];

      // Deduplication Check
      for (const item of itemsToSave) {
        const isDuplicate = apiItems?.some((existing: any) =>
          existing.collectionId === targetCollectionId &&
          existing.method === item.method &&
          (existing.url === item.url || existing.endpoint === item.url)
        );

        if (isDuplicate) {
          duplicates.push(item);
        } else {
          newItems.push(item);
        }
      }

      let apiLogs: Record<string, any> = {};
      try {
        const logsRes = await fetch(`/api/logs?rootPath=${encodeURIComponent(importPath)}`);
        if (logsRes.ok) {
          apiLogs = await logsRes.json();
        }
      } catch {
        // Ignore if no logs
      }

      const buildLogKey = (method: string, url: string) => {
        const cleanedUrl = url.replace(/^\[Query\]\s*/i, '').trim();
        let urlPath = cleanedUrl;
        try {
          urlPath = new URL(cleanedUrl).pathname;
        } catch {
          if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
        }
        return `${method}_${urlPath.replace(/\//g, '_')}`;
      };

      const findLogEntry = (method: string, url: string) => {
        const exactKey = buildLogKey(method, url);
        if (apiLogs[exactKey]) return apiLogs[exactKey];
        
        const cleanedUrl = url.replace(/^\[Query\]\s*/i, '').trim();
        let urlPath = cleanedUrl;
        try { urlPath = new URL(cleanedUrl).pathname; } catch { if (!urlPath.startsWith('/')) urlPath = '/' + urlPath; }
        const pathSuffix = urlPath.replace(/\//g, '_');
        
        const fuzzyKey = Object.keys(apiLogs).find(k => k.startsWith(method + '_') && k.endsWith(pathSuffix));
        if (fuzzyKey) return apiLogs[fuzzyKey];
        
        return null;
      };

      for (const item of newItems) {
        const logEntry = findLogEntry(item.method, item.url);
        
        let finalBody = '';
        if (logEntry?.request?.body && Object.keys(logEntry.request.body).length > 0) {
          finalBody = JSON.stringify(logEntry.request.body, null, 2);
        }

        let finalUrl = item.url;
        if (logEntry) {
          const host = logEntry.request?.headers?.host || 'localhost:3002';
          const protocol = logEntry.request?.headers?.['x-forwarded-proto'] || 'http';
          const endpoint = logEntry.endpoint || item.url;
          finalUrl = `${protocol}://${host}${endpoint}`;
        }

        await fetch('http://localhost:3001/apiItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Math.random().toString(36).substring(7),
            collectionId: targetCollectionId,
            name: `${item.method} ${finalUrl}`,
            method: item.method,
            url: finalUrl,
            body: finalBody
          })
        });
      }

      if (duplicates.length > 0) {
        toast.error(`중복 항목 ${duplicates.length}개 제외됨\n(예: ${duplicates[0].method} ${duplicates[0].url})`, { duration: 4000 });
      }
      if (newItems.length > 0) {
        toast.success(`${newItems.length}개 항목 자동 등록 완료!`);
      } else if (duplicates.length > 0 && newItems.length === 0) {
        // If everything was duplicate
      }

      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('저장 중 오류가 발생했습니다.');
    }
    setIsSaving(false);
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-green-400';
      case 'POST': return 'text-orange-400';
      case 'PUT': return 'text-blue-400';
      case 'DELETE': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceColor = (conf: string) => {
    switch (conf.toUpperCase()) {
      case 'HIGH': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'LOW': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
      <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#252628]">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="text-green-400 mr-2">✦</span>
            프론트엔드 API 정적 분석기
          </h2>
          {step === 2 && <p className="text-sm text-gray-400 mt-1">경로: {rootPath}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white px-4 py-2 bg-gray-800 rounded transition-colors">
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        {/* Always visible Path Input UI */}
        <div className={`w-full max-w-6xl transition-all duration-300 ${step === 1 ? 'mt-10' : 'mb-6'}`}>
          <div className="bg-[#252628] border border-gray-800 rounded-lg shadow-xl overflow-hidden">
            {step === 1 && (
              <div className="border-b border-gray-800 p-6">
                <div className="text-xs text-green-400 font-bold tracking-wider mb-2">V6 • PREMIUM STATIC ANALYZER</div>
                <h2 className="text-2xl font-bold text-white mb-3">분석할 로컬 프로젝트 경로를 입력하세요</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  React와 Next.js 소스에서 화면별 REST API 호출을 자동으로 추적합니다.<br />
                  Fetch, Axios, React Query, SWR, RTK Query를 AST 기반으로 수집하여 컬렉션에 자동 등록할 수 있습니다.
                </p>
              </div>
            )}

            <div className="p-6">
              <div className="bg-[#1e1f23] border border-gray-700 rounded-lg p-5">
                <h3 className="text-sm font-bold text-gray-300 mb-3">분석 대상 폴더</h3>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="flex-1 bg-[#121316] text-sm text-gray-300 px-4 py-3 border border-gray-700 rounded focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="C:\path\to\your\frontend-project"
                    value={importPath}
                    onChange={(e) => setImportPath(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleScanPath(); }}
                  />
                  <button
                    onClick={handleScanPath}
                    disabled={isScanning}
                    className="bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-black disabled:text-gray-400 font-bold px-6 py-3 rounded transition-colors text-sm whitespace-nowrap"
                  >
                    {isScanning ? '분석 중...' : '분석 실행'}
                  </button>
                </div>

                {/* Quick Examples */}
                <div className="mt-5 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500 font-semibold mr-2">빠른 예시:</span>
                  {[
                    { label: 'React 게시판 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\react-board-example' },
                    { label: '쇼핑몰 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js' },
                    { label: '에이전트 BT 예시', path: 'C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt' },
                    { label: '에이전트 BT', path: 'C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt' }
                  ].map(ex => (
                    <button
                      key={ex.label}
                      onClick={() => setImportPath(ex.path)}
                      className="bg-[#2a2b2f] hover:bg-[#35363b] text-gray-300 text-xs px-3 py-1.5 rounded transition-colors"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {step === 2 && (
          <div className="flex gap-6 w-full h-full max-w-6xl mx-auto">
            {/* Right Panel: Results (Now takes full width) */}
            <div className="flex-1 bg-[#252628] rounded-lg border border-gray-800 p-4 flex flex-col h-[calc(100vh-280px)] shadow-xl">
              <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                <h3 className="font-bold text-gray-300 text-sm">추출된 API 후보 ({candidates.length}건)</h3>

                {candidates.length > 0 && (
                  <div className="flex items-center space-x-3">
                    <select
                      value={targetCollectionId}
                      onChange={e => setTargetCollectionId(e.target.value)}
                      className="bg-gray-800 text-sm text-white px-3 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="" disabled>저장할 컬렉션 선택...</option>
                      {collections.filter((c: any) => c.mode !== 'chaining').map((col: any) => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || selectedCandidates.length === 0 || !targetCollectionId}
                      className="bg-blue-500 hover:bg-blue-400 disabled:bg-gray-700 text-white font-bold px-4 py-1.5 rounded text-sm transition-colors"
                    >
                      {isSaving ? '저장 중...' : `${selectedCandidates.length}개 선택항목 저장`}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {candidates.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                    {isAnalyzing ? '코드를 파싱하고 API를 탐지하는 중입니다...' : '좌측에서 프로젝트를 선택하고 분석을 시작하세요.'}
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-800/50 sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedCandidates.length === candidates.length && candidates.length > 0}
                            onChange={() => {
                              if (selectedCandidates.length === candidates.length) setSelectedCandidates([]);
                              else setSelectedCandidates(candidates.map(c => c.id));
                            }}
                            className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-3 py-3 font-semibold">Method</th>
                        <th className="px-3 py-3 font-semibold">URL</th>
                        <th className="px-3 py-3 font-semibold">Confidence</th>
                        <th className="px-3 py-3 font-semibold">출처 (파일:라인)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedCandidates).map(([groupName, groupCands]) => {
                        const isCollapsed = collapsedGroups[groupName];
                        const allSelected = groupCands.every(c => selectedCandidates.includes(c.id));
                        const someSelected = groupCands.some(c => selectedCandidates.includes(c.id));
                        
                        return (
                          <React.Fragment key={groupName}>
                            {/* Group Header */}
                            <tr className="bg-[#1a1b1d] border-y border-gray-700/80 cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleGroup(groupName)}>
                              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={allSelected}
                                  ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const newIds = groupCands.map(c => c.id).filter(id => !selectedCandidates.includes(id));
                                      setSelectedCandidates(prev => [...prev, ...newIds]);
                                    } else {
                                      const groupIds = groupCands.map(c => c.id);
                                      setSelectedCandidates(prev => prev.filter(id => !groupIds.includes(id)));
                                    }
                                  }}
                                  className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                                />
                              </td>
                              <td colSpan={4} className="px-3 py-2.5 text-sm font-semibold text-gray-200">
                                <span className="mr-2 inline-block w-4 text-center">{isCollapsed ? '▶' : '▼'}</span>
                                📁 {groupName} 
                                <span className="ml-2 text-xs font-normal text-gray-500">({groupCands.length}건)</span>
                              </td>
                            </tr>
                            
                            {/* Group Items */}
                            {!isCollapsed && groupCands.map((c: any) => (
                              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors bg-[#252628]">
                                <td className="px-3 py-2.5 pl-5">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedCandidates.includes(c.id)}
                                    onChange={() => toggleCandidate(c.id)}
                                    className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                                  />
                                </td>
                                <td className={`px-3 py-2.5 font-bold text-xs ${getMethodColor(c.method)}`}>{c.method}</td>
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-200">{c.url}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${getConfidenceColor(c.confidence)}`}>
                                    {c.confidence}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[200px]" title={`${c.library} · Line ${c.line}`}>
                                  {c.library} · Line {c.line}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
