import React, { useState } from 'react';

type ChainInfo = {
  type: string;
  target: { method: string; url: string; line: number; file?: string };
};

type ApiNode = {
  id: string;
  method: string;
  url: string;
  library: string;
  filePath: string;
  line: number;
  chains: ChainInfo[];
};

export default function ChainingView({ 
  rootPath, 
  onAnalyzeRequired,
  collections,
  onSave,
  onClose
}: { 
  rootPath: string, 
  onAnalyzeRequired: () => void,
  collections: any[],
  onSave: () => void,
  onClose?: () => void
}) {
  const [targetPath, setTargetPath] = useState(rootPath || '');
  const [isScanning, setIsScanning] = useState(false);
  const [apis, setApis] = useState<ApiNode[]>([]);
  const [selectedApi, setSelectedApi] = useState<ApiNode | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAnalyze = async () => {
    if (!targetPath) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/analyze/chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetPath })
      });
      const data = await res.json();
      if (data.apis) {
        setApis(data.apis);
        setSelectedApi(null);
      } else {
        alert(data.error || 'Failed to analyze chaining');
      }
    } catch (err) {
      console.error(err);
      alert('Error analyzing chaining');
    }
    setIsScanning(false);
  };
  const apisWithChains = apis.filter(api => api.chains && api.chains.length > 0);
  const handleCopyChain = () => {
    if (!selectedApi) return;
    
    const relativePath = selectedApi.filePath.replace(/^.*?(src[\\/].*)$/, '$1').replace(/\\/g, '/');
    const isMutation = selectedApi.method !== 'GET';
    const hookName = selectedApi.library === 'react-query' ? (isMutation ? 'useMutation' : 'useQuery') : selectedApi.library;
    const actionIcon = isMutation ? '👆 EVENT' : '⚙ MOUNT';
    
    const cleanUrl = (url: string) => url.replace(/^\[Query\]\s*/i, '');
    
    let text = `${relativePath} (1개 시나리오)\n\n`;
    text += `[01] ${actionIcon}  ${hookName} (Line: ${selectedApi.line})\n`;
    text += `  1. ${selectedApi.method.padEnd(6)} ${cleanUrl(selectedApi.url)}\n`;
    
    if (selectedApi.chains && selectedApi.chains.length > 0) {
      const chainType = selectedApi.chains[0].type;
      let chainReason = `${chainType} → 연쇄 요청`;
      if ((chainType === 'onSuccess' || chainType === 'onSuccess → invalidateQueries') && selectedApi.library === 'react-query') {
        const transLine = selectedApi.chains[0].transitionLine;
        chainReason = `onSuccess ${transLine ? `(Line: ${transLine}) ` : ''}→ invalidateQueries → 자동 재요청`;
      }
      
      text += `  🔄 ${chainReason}\n`;
      selectedApi.chains.forEach((chain, idx) => {
        const targetPath = chain.target.file ? chain.target.file.replace(/^.*?(src[\\/].*)$/, '$1').replace(/\\/g, '/') : 'Unknown File';
        text += `     ${(idx + 1).toString()}. ${chain.target.method.padEnd(6)} ${cleanUrl(chain.target.url)}  (${targetPath}:${chain.target.line})\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      alert('전이 흐름이 복사되었습니다!');
    }).catch(err => {
      console.error('Copy failed:', err);
      alert('복사에 실패했습니다.');
    });
  };

  const handleRegisterScenario = async () => {
    if (!selectedApi || !selectedCollectionId) return;
    setIsSaving(true);
    try {
      // 0. 타겟 프로젝트의 api_logs.json 조회 (없어도 시나리오 등록은 계속 진행)
      let apiLogs: Record<string, any> = {};
      try {
        const logsRes = await fetch(`/api/logs?rootPath=${encodeURIComponent(targetPath)}`);
        if (logsRes.ok) {
          apiLogs = await logsRes.json();
        }
      } catch {
        // 로그 파일이 없거나 읽기 실패해도 무시하고 진행
      }

      // 로그 키 생성 헬퍼: "POST__api_cart" 형태로 변환
      const buildLogKey = (method: string, url: string) => {
        const cleanedUrl = url.replace(/^\[Query\]\s*/i, '').trim();
        // URL에서 host 부분 제거 후 path만 추출
        let urlPath = cleanedUrl;
        try {
          const parsed = new URL(cleanedUrl);
          urlPath = parsed.pathname;
        } catch {
          // URL 파싱 실패 시 (상대 경로일 때) 슬래시 강제 추가
          if (!urlPath.startsWith('/')) {
            urlPath = '/' + urlPath;
          }
        }
        return `${method}_${urlPath.replace(/\//g, '_')}`;
      };

      const findLogEntry = (method: string, url: string) => {
        const exactKey = buildLogKey(method, url);
        if (apiLogs[exactKey]) return apiLogs[exactKey];
        
        // Fuzzy match (e.g. mapping "cart" to "/api/cart")
        const cleanedUrl = url.replace(/^\[Query\]\s*/i, '').trim();
        let urlPath = cleanedUrl;
        try {
          urlPath = new URL(cleanedUrl).pathname;
        } catch {
          if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
        }
        const pathSuffix = urlPath.replace(/\//g, '_');
        
        const fuzzyKey = Object.keys(apiLogs).find(k => k.startsWith(method + '_') && k.endsWith(pathSuffix));
        if (fuzzyKey) return apiLogs[fuzzyKey];
        
        return null;
      };

      const getBodyFromLog = (method: string, url: string): string => {
        const logEntry = findLogEntry(method, url);
        if (logEntry?.request?.body && Object.keys(logEntry.request.body).length > 0) {
          return JSON.stringify(logEntry.request.body, null, 2);
        }
        return '';
      };

      const getFullUrlFromLog = (method: string, url: string): string => {
        const logEntry = findLogEntry(method, url);
        if (logEntry) {
          const host = logEntry.request?.headers?.host || 'localhost:3002';
          const protocol = logEntry.request?.headers?.['x-forwarded-proto'] || 'http';
          const endpoint = logEntry.endpoint || url;
          return `${protocol}://${host}${endpoint}`;
        }
        return url;
      };

      // 중복 등록 방지용 Set (로그 매칭 키를 기준으로 완벽하게 중복 제거)
      const registeredApiKeys = new Set<string>();
      
      const rootKey = buildLogKey(selectedApi.method, selectedApi.url);
      registeredApiKeys.add(rootKey);

      // 1. Save Root API (로그에서 request.body 및 full URL 주입)
      const rootBody = getBodyFromLog(selectedApi.method, selectedApi.url);
      const rootFullUrl = getFullUrlFromLog(selectedApi.method, selectedApi.url);
      const rootItem = {
        id: Math.random().toString(36).substring(7),
        collectionId: selectedCollectionId,
        name: `Step 1: ${selectedApi.method} ${rootFullUrl}`,
        method: selectedApi.method,
        url: rootFullUrl,
        body: rootBody
      };
      await fetch('http://localhost:3001/apiItems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rootItem)
      });

      // 2. Save Chained APIs sequentially (중복 제거 & 로그에서 request.body 및 full URL 주입)
      let stepCounter = 2;
      for (let i = 0; i < selectedApi.chains.length; i++) {
        const chain = selectedApi.chains[i];
        const chainKey = buildLogKey(chain.target.method, chain.target.url);
        
        // 이미 등록된 API라면 건너뜀 (중복 제거)
        if (registeredApiKeys.has(chainKey)) {
          continue;
        }
        registeredApiKeys.add(chainKey);

        const chainBody = getBodyFromLog(chain.target.method, chain.target.url);
        const chainFullUrl = getFullUrlFromLog(chain.target.method, chain.target.url);
        const chainItem = {
          id: Math.random().toString(36).substring(7),
          collectionId: selectedCollectionId,
          name: `Step ${stepCounter}: ${chain.target.method} ${chainFullUrl}`,
          method: chain.target.method,
          url: chainFullUrl,
          body: chainBody
        };
        await fetch('http://localhost:3001/apiItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chainItem)
        });
        stepCounter++;
      }

      alert('시나리오가 성공적으로 등록되었습니다!');
      onSave();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
    setIsSaving(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e]">
      <div className="p-6 border-b border-gray-800 flex flex-col space-y-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold">API 전이 (Chaining) 시각화</h2>
          <input
            type="text"
            value={targetPath}
            onChange={e => setTargetPath(e.target.value)}
            placeholder="로컬 프로젝트 경로 입력..."
            className="flex-1 bg-[#121316] text-white px-4 py-2 border border-gray-700 rounded focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={!targetPath || isScanning}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded font-medium transition-colors"
          >
            {isScanning ? '분석 중...' : '전이 추적 실행'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-1 text-2xl font-light leading-none ml-2"
              title="닫기"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Quick Examples */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-semibold mr-2">빠른 예시:</span>
          {[
            { label: 'React 게시판 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\react-board-example' },
            { label: '쇼핑몰 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js' }
          ].map(ex => (
            <button 
              key={ex.label}
              onClick={() => setTargetPath(ex.path)}
              className="bg-[#2a2b2f] hover:bg-[#35363b] text-gray-300 text-xs px-3 py-1.5 rounded transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left List */}
        <div className="w-1/3 border-r border-gray-800 overflow-y-auto p-4 space-y-2 bg-[#202124]">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            감지된 API 시나리오 ({apisWithChains.length}건)
          </h3>
          {apis.length === 0 && !isScanning && (
            <div className="text-gray-500 text-sm mt-10 text-center">경로를 입력하고 실행 버튼을 눌러주세요.</div>
          )}
          {apisWithChains.map((api, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedApi(api)}
              className={`p-3 rounded cursor-pointer transition-colors ${selectedApi?.id === api.id ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-[#2b2c2f] hover:bg-[#323438] border border-transparent'}`}
            >
              <div className="flex items-center space-x-2 text-sm font-medium">
                <span className="text-blue-400 w-12">{api.method}</span>
                <span className="truncate">{api.url}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex justify-between">
                <span>{api.filePath.split('\\').pop()}:{api.line}</span>
                <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">{api.chains.length} Chains</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right Canvas (Visualizer) */}
        <div className="flex-1 p-8 overflow-y-auto bg-[#18191b] flex justify-center">
          {selectedApi ? (
            <div className="w-full max-w-2xl flex flex-col items-center pt-10">
              
              {/* Root API */}
              <div className="bg-[#2b2c2f] border border-orange-500/50 p-4 rounded-lg shadow-lg w-full mb-8 relative">
                <div className="absolute -top-3 left-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Start API
                </div>
                <div className="flex justify-between items-start mt-2">
                  <div>
                    <div className="flex items-center space-x-3 text-lg font-bold">
                      <span className="text-blue-400">{selectedApi.method}</span>
                      <span className="text-white break-all">{selectedApi.url.replace(/^\[Query\]\s*/i, '')}</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                      <span className="bg-gray-800 px-2 py-1 rounded text-xs mr-2">{selectedApi.library}</span>
                      {selectedApi.filePath}:{selectedApi.line}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 items-end">
                    <select
                      value={selectedCollectionId}
                      onChange={e => setSelectedCollectionId(e.target.value)}
                      className="bg-[#121316] text-xs text-white px-2 py-1.5 border border-gray-700 rounded focus:outline-none"
                    >
                      <option value="" disabled>컬렉션 선택...</option>
                      {collections.map(col => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                    <div className="flex space-x-2 w-full">
                      <button
                        onClick={handleCopyChain}
                        className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors flex-1"
                        title="전이 흐름 텍스트로 복사"
                      >
                        📋 복사
                      </button>
                      <button
                        onClick={handleRegisterScenario}
                        disabled={isSaving || !selectedCollectionId}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors flex-1"
                      >
                        {isSaving ? '저장 중...' : '시나리오 등록'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chains */}
              {(() => {
                const groupedChains = selectedApi.chains.reduce((acc, chain) => {
                  if (!acc[chain.type]) acc[chain.type] = [];
                  acc[chain.type].push(chain);
                  return acc;
                }, {} as Record<string, typeof selectedApi.chains>);

                return (
                  <div className="flex flex-col items-center space-y-8 w-full pt-2">
                    {Object.entries(groupedChains).map(([groupType, chainsForGroup], gIdx) => (
                      <div key={gIdx} className="flex flex-col items-center w-full">
                        {/* Group Header Arrow/Badge */}
                        <div className="flex flex-col items-center">
                          <div className="w-[2px] h-6 bg-gray-600"></div>
                          <div className="bg-gray-800 text-[10px] text-orange-400 px-3 py-1.5 rounded border border-gray-600 uppercase font-bold tracking-wider z-10 whitespace-nowrap">
                            {groupType === 'onSuccess' ? `onSuccess ${chainsForGroup[0].transitionLine ? `(Line: ${chainsForGroup[0].transitionLine}) ` : ''}→ invalidateQueries → 자동 재요청` : groupType}
                          </div>
                          <div className="w-[2px] h-6 bg-gray-600"></div>
                        </div>

                        {/* Group Target Cards */}
                        <div className="w-full flex justify-center pb-4">
                          <div className="flex flex-col items-center">
                            <div className="w-[2px] h-6 bg-gray-600 relative">
                              <div className="absolute bottom-0 -left-[5px] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-600"></div>
                            </div>
                            
                            <div className="bg-[#252628] border border-gray-700 p-4 rounded-lg shadow-md min-w-[320px] max-w-[600px] hover:border-gray-500 transition-colors mt-1 flex flex-col space-y-4">
                              {chainsForGroup.map((chain, cIdx) => (
                                <div key={cIdx} className={`${cIdx > 0 ? 'border-t border-gray-700 pt-4' : ''} flex justify-between items-start`}>
                                  <div>
                                    <div className="flex items-center space-x-3 text-md font-semibold">
                                      <span className="text-green-400">{chain.target.method}</span>
                                      <span className="text-gray-200 break-all">{chain.target.url.replace(/^\[Query\]\s*/i, '')}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2 flex items-center space-x-2">
                                      <span className="bg-gray-800 px-2 py-1 rounded break-all">
                                        {chain.target.file ? chain.target.file.replace(/^.*?(src[\\/].*)$/, '$1') : 'Unknown File'}
                                      </span>
                                      <span className="shrink-0">Line: {chain.target.line}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="mx-auto opacity-20 mb-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <p className="text-sm">좌측 목록에서 전이가 감지된 API를 선택하면 흐름도가 나타납니다.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
