const fs = require('fs');
const path = 'src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add staticViewTab state if not present
if (!content.includes("const [staticViewTab")) {
    const phaseStateTarget = "const [phase, setPhase] = useState<'upload' | 'analyzing' | 'static'>('upload');";
    content = content.replace(
        phaseStateTarget,
        `const [phase, setPhase] = useState<'upload' | 'analyzing' | 'static'>('upload');\n  const [staticViewTab, setStaticViewTab] = useState<'graph' | 'list'>('graph');`
    );
}

// 2. Define renderRouteDetails function right before the main return statement
const returnTarget = "  return (\n    <div className=";
if (!content.includes("const renderRouteDetails = (screensList: any[]) => {")) {
    const renderFunc = `  const renderRouteDetails = (screensList: any[]) => {
    return screensList.map((sc: any, idx: number) => {
      const onEnterApis: any[] = sc.onEnterApis || [];
      const allNavs: string[] = [
        ...(sc.navigations || []),
        ...((sc.actions || []).flatMap((a: any) => a.navigations || [])),
      ];
      const userActions = (sc.actions || []).filter((a: any) => 
        a.trigger && 
        a.trigger !== '(component)' && 
        a.trigger !== '(handler)' &&
        (
          (a.apis && a.apis.length > 0) || 
          (a.navigations && a.navigations.length > 0) || 
          (a.handlerName && a.handlerName !== '(inline)')
        )
      );
      
      return (
        <div 
          key={idx} 
          id={\`route-block-\${sc.path}\`}
          className="bg-[#1a1c21] p-4 rounded-xl border border-gray-700/50 shadow-sm transition-all duration-500 cursor-pointer hover:border-purple-500/30"
          onClick={() => {
            const el = document.getElementById(\`route-block-\${sc.path}\`);
            if (el) {
              el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-900/10');
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-900/10');
              }, 1500);
            }
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="outline" className="bg-purple-900/20 text-purple-400 border-purple-800/50">
              Screen {idx + 1}
            </Badge>
            <h5 className="font-mono text-sm font-bold text-gray-200">
              {sc.path}
            </h5>
          </div>

          <div className="space-y-4">
            {/* 진입 시 자동 호출 API */}
            {onEnterApis.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🚀 진입 시 호출 (onEnter)</h6>
                <div className="space-y-2">
                  {onEnterApis.map((api: any, ai: number) => (
                    <div key={ai} className="flex flex-col gap-1.5 p-2.5 rounded bg-gray-800/50 border border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800/50">
                          {api.method}
                        </span>
                        <span className="font-mono text-xs text-blue-200 break-all">
                          {api.endpoint}
                        </span>
                      </div>
                      {api.purpose && (
                        <p className="text-[10px] text-gray-400 leading-snug">
                          {api.purpose}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 사용자 액션 */}
            {userActions.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🖱 사용자 인터랙션</h6>
                <div className="space-y-2">
                  {userActions.map((act: any, aci: number) => (
                    <div key={aci} className="flex flex-col gap-2 p-2.5 rounded bg-gray-800/30 border border-gray-700/30">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-gray-700/50 text-gray-300 text-[10px] hover:bg-gray-700/50">
                          {act.trigger}
                        </Badge>
                        {act.handlerName && act.handlerName !== '(inline)' && (
                          <span className="font-mono text-[10px] text-orange-300/80">
                            {act.handlerName}
                          </span>
                        )}
                        <span className="text-xs text-gray-300">
                          {act.description}
                        </span>
                      </div>
                      
                      {act.apis && act.apis.length > 0 && (
                        <div className="ml-2 pl-2 border-l border-gray-700 space-y-1.5">
                          {act.apis.map((api: any, aai: number) => {
                            const methodColor = 
                              api.method === 'GET' ? 'text-blue-400 bg-blue-900/30 border-blue-800/50' : 
                              api.method === 'POST' ? 'text-green-400 bg-green-900/30 border-green-800/50' :
                              api.method === 'PUT' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50' :
                              api.method === 'DELETE' ? 'text-red-400 bg-red-900/30 border-red-800/50' :
                              'text-gray-400 bg-gray-900/30 border-gray-800/50';
                              
                            return (
                              <div key={aai} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className={\`text-[9px] font-bold px-1 py-0.5 rounded border \${methodColor}\`}>
                                    {api.method}
                                  </span>
                                  <span className="font-mono text-[11px] text-gray-300 break-all">
                                    {api.endpoint}
                                  </span>
                                </div>
                                {api.purpose && (
                                  <p className="text-[10px] text-gray-500 pl-1">
                                    {api.purpose}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {act.navigations && act.navigations.length > 0 && (
                        <div className="ml-2 pl-2 mt-2 border-l-2 border-green-800/50 space-y-2">
                          <span className="text-[9px] font-bold text-green-500/70 uppercase tracking-wider">Navigates To</span>
                          <div className="flex flex-wrap gap-2">
                            {act.navigations.map((nav: string, ani: number) => (
                              <div 
                                key={ani} 
                                className="flex items-center group/nav bg-gradient-to-r from-green-900/20 to-transparent border border-green-800/30 rounded-lg px-2.5 py-1.5 w-fit hover:border-green-500/50 hover:from-green-900/40 transition-all cursor-pointer relative overflow-hidden"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGraphFocusRoute(nav.split('?')[0].replace(/\\{[^}]+\\}/g, ':param'));
                                  setStaticViewTab('graph');
                                }}
                                title="클릭하여 맵에서 해당 화면 위치로 이동"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                <div className="w-5 h-5 rounded-md bg-green-900/50 flex items-center justify-center mr-2.5 z-10 shrink-0">
                                  <span className="text-green-400 text-[10px]">🧭</span>
                                </div>
                                <div className="flex flex-col z-10">
                                  <span className="text-[8px] font-bold text-green-500/70 uppercase tracking-widest leading-none mb-0.5">
                                    Navigate To
                                  </span>
                                  <span className="text-[10px] font-mono text-green-300 break-all max-w-[280px]">
                                    {nav}
                                  </span>
                                </div>
                                <div className="ml-3 z-10 text-green-600 group-hover:text-green-400 group-hover:translate-x-1 transition-all">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 독립적인 화면 이동 (actions 없이 정의된 경우) */}
            {sc.navigations && sc.navigations.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🔗 화면 이동</h6>
                <div className="flex flex-wrap gap-2">
                  {sc.navigations.map((nav: string, ni: number) => (
                    <div 
                      key={ni} 
                      className="flex items-center group/nav bg-gradient-to-r from-green-900/20 to-transparent border border-green-800/30 rounded-lg px-2.5 py-1.5 w-fit hover:border-green-500/50 hover:from-green-900/40 transition-all cursor-pointer relative overflow-hidden mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGraphFocusRoute(nav.split('?')[0].replace(/\\{[^}]+\\}/g, ':param'));
                        setStaticViewTab('graph');
                      }}
                      title="클릭하여 맵에서 해당 화면 위치로 이동"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                      <div className="w-5 h-5 rounded-md bg-green-900/50 flex items-center justify-center mr-2.5 z-10 shrink-0">
                        <span className="text-green-400 text-[10px]">🧭</span>
                      </div>
                      <div className="flex flex-col z-10">
                        <span className="text-[8px] font-bold text-green-500/70 uppercase tracking-widest leading-none mb-0.5">
                          Navigate To
                        </span>
                        <span className="text-[10px] font-mono text-green-300 break-all max-w-[280px]">
                          {nav}
                        </span>
                      </div>
                      <div className="ml-3 z-10 text-green-600 group-hover:text-green-400 group-hover:translate-x-1 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

`;
    content = content.replace(returnTarget, renderFunc + returnTarget);
}

// 3. Replace the actual layout rendering logic with split view and floating toggle
const layoutStartStr = "{/* 라우트별 그룹 */}";
const layoutEndStr = "            </div>\n          </div>\n        )}\n\n\n        {isAnalyzing && phase === 'static'";

const startIdx = content.indexOf(layoutStartStr);
const endIdx = content.indexOf(layoutEndStr);

if (startIdx !== -1 && endIdx !== -1) {
    const newLayout = `{/* 라우트별 그룹 헤더 */}
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">라우트별 상세</h4>
            </div>
            
            {/* 뷰 모드 토글 (플로팅) */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center bg-[#121316]/80 backdrop-blur-md p-1.5 rounded-full border border-gray-700/50 shadow-2xl">
              <button
                onClick={() => setStaticViewTab('graph')}
                className={\`px-5 py-2 rounded-full text-xs font-bold transition-all \${staticViewTab === 'graph' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}\`}
              >
                🗺 플로우 맵 뷰
              </button>
              <button
                onClick={() => setStaticViewTab('list')}
                className={\`px-5 py-2 rounded-full text-xs font-bold transition-all \${staticViewTab === 'list' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}\`}
              >
                📄 리스트 뷰
              </button>
            </div>

            {/* 그래프 뷰 (스플릿 레이아웃) */}
            {staticViewTab === 'graph' && (
              <div className="flex gap-4 h-[700px] items-stretch">
                <div className="flex-1 rounded-xl overflow-hidden border border-gray-700/60 h-full relative">
                  <RouteGraphView 
                    screens={screens} 
                    onGoToDetails={(route) => {
                      const el = document.getElementById(\`route-block-\${route}\`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-900/40', 'z-10', 'relative');
                        setTimeout(() => {
                          el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-900/40', 'z-10', 'relative');
                        }, 2000);
                      }
                    }}
                    focusRoute={graphFocusRoute}
                  />
                </div>
                <div className="w-[450px] shrink-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar h-full bg-[#161719] border border-gray-700/60 rounded-xl p-3 scroll-smooth">
                   {renderRouteDetails(screens)}
                </div>
              </div>
            )}

            {/* 리스트 뷰 */}
            {staticViewTab === 'list' && (
              <div className="space-y-4">
                {renderRouteDetails(screens)}
              </div>
            )}
`;
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    content = before + newLayout + after;
}

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully applied all UI layout and toggle changes!");
