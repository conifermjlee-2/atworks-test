import re

file_path = "C:/Users/lee/Desktop/atworks-test/poc/atworks-v3/src/components/ScenarioWithAIView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

func = """
  const renderRouteDetails = (screensList: any[]) => {
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
      const componentActions = (sc.actions || []).filter((a: any) => a.trigger === '(component)' || a.trigger === '(handler)');

      return (
        <div key={idx} id={`route-block-${sc.route}`} className="border border-gray-700/60 rounded-xl overflow-hidden scroll-mt-24 transition-all duration-500">
          {/* ── 라우트 헤더 ── */}
          <div className="flex items-center justify-between bg-[#252628] px-4 py-3 border-b border-gray-700/60">
            <div className="flex items-center gap-3">
              <span className="text-purple-400 font-bold text-sm">🗺</span>
              <code className="text-purple-300 font-mono font-bold text-sm tracking-wide">{sc.route || '/'}</code>
              <span className="text-gray-600 text-xs">→</span>
              <span className="text-gray-300 text-sm font-semibold">{sc.page}</span>
              <span className="text-xs text-gray-600 font-mono">{sc.filePath}</span>
            </div>
            <div className="flex gap-1.5">
              {onEnterApis.length > 0 && (
                <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded-full">API {onEnterApis.length}</span>
              )}
              {userActions.length > 0 && (
                <span className="text-xs bg-orange-900/40 text-orange-300 border border-orange-700/30 px-2 py-0.5 rounded-full">액션 {userActions.length}</span>
              )}
              {allNavs.length > 0 && (
                <span className="text-xs bg-green-900/40 text-green-300 border border-green-700/30 px-2 py-0.5 rounded-full">이동 {allNavs.length}</span>
              )}
              <button 
                onClick={() => handleCopyRoute(sc, userActions, componentActions)}
                className="ml-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded border border-gray-600 transition-colors flex items-center gap-1"
                title="이 라우트의 정보를 복사합니다"
              >
                📋 복사
              </button>
            </div>
          </div>

          {/* ── 컴포넌트 트리 뷰 ── */}
          <div className="bg-[#1a1b1e] p-4">
            {/* 루트: page.tsx 노드 */}
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <div 
                  className="w-7 h-7 rounded-md bg-purple-900/60 border border-purple-600/50 flex items-center justify-center text-xs text-purple-300 shrink-0 shadow-[0_0_8px_rgba(168,85,247,0.2)] cursor-help active:scale-95 transition-transform"
                  title="라우트 경로 (Page Route)"
                  onClick={(e) => { e.stopPropagation(); toast('📄 라우트 경로 (Page Route) 노드입니다.', { icon: 'ℹ️' }); }}
                >📄</div>
                {(onEnterApis.length > 0 || userActions.length > 0 || componentActions.length > 0 || allNavs.length > 0) && (
                  <div className="w-px flex-1 bg-gray-700/50 mt-1 min-h-[12px]" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-purple-200 font-mono">{sc.page}</span>
                  <span className="text-[10px] text-gray-600 font-mono">{sc.filePath}</span>
                </div>

                {/* 진입 시 API (page 레벨) */}
                {onEnterApis.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {onEnterApis.map((api: any, ai: number) => (
                      <ApiChip key={ai} api={api} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 사용자 액션들 (page 레벨 onClick 등) */}
            {userActions.map((action: any, ai: number) => (
              <div key={ai} className="flex items-start gap-2 ml-3.5 mt-1">
                <div className="flex flex-col items-center">
                  <div className="w-px h-3 bg-gray-700/50" />
                  <div className="w-4 h-px bg-gray-700/50" />
                </div>
                <div className="flex items-start gap-2 pb-2 flex-1">
                  <div 
                    className="w-6 h-6 rounded bg-yellow-900/40 border border-yellow-700/40 flex items-center justify-center text-[10px] text-yellow-400 shrink-0 cursor-help active:scale-95 transition-transform mt-0.5"
                    title="액션 이벤트 (Action Event)"
                    onClick={(e) => { e.stopPropagation(); toast('⚡ 액션 이벤트 (Action Event) 노드입니다.', { icon: 'ℹ️' }); }}
                  >⚡</div>
                  <details className={`flex-1 group outline-none ${(action.apis?.length > 0 || action.navigations?.length > 0) ? 'cursor-pointer' : ''}`}>
                    <summary className="list-none flex items-center gap-1.5 mb-1 outline-none select-none">
                      <span className="text-[10px] font-mono text-yellow-500">{action.trigger}</span>
                      {action.handlerName && action.handlerName !== '(inline)' && (
                        <span className="text-[10px] text-gray-500">→ <span className="font-mono text-gray-400">{action.handlerName}</span></span>
                      )}
                      {(action.apis?.length > 0 || action.navigations?.length > 0) && (
                        <span className="text-[8px] text-gray-500 group-open:rotate-90 transition-transform ml-1">▶</span>
                      )}
                    </summary>
                    {action.apis?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {action.apis.map((api: any, apii: number) => (
                          <ApiChip key={apii} api={api} />
                        ))}
                      </div>
                    )}
                    {action.navigations?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {action.navigations.map((nav: string, ni: number) => (
                          <details key={ni} className="group/nav cursor-pointer outline-none w-full">
                            <summary className="list-none flex items-center outline-none select-none">
                              <span className="text-[10px] font-mono bg-gray-800/60 border border-gray-700/50 text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-gray-700/60 transition-colors">
                                화면: {resolveNextjsRoute(nav)}
                                <span className="text-[8px] text-gray-500 group-open:rotate-90 transition-transform ml-1">▶</span>
                              </span>
                            </summary>
                            <div className="mt-1.5 ml-2 pl-2 border-l-2 border-green-800/30">
                              <span className="text-[10px] font-mono bg-green-900/10 text-green-400/80 px-2 py-1 rounded inline-block break-all max-w-[400px]">
                                → {nav}
                              </span>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </details>
                </div>
              </div>
            ))}

            {/* 하위 컴포넌트 트리: 컴포넌트 → 파일(sourceFile) → API */}
            {componentActions.map((action: any, ci: number) => {
              // sourceFile별로 API 그룹핑
              const fileGroups: Record<string, any[]> = {};
              for (const api of (action.apis || [])) {
                const key = api.sourceFile || '(unknown)';
                if (!fileGroups[key]) fileGroups[key] = [];
                fileGroups[key].push(api);
              }
              const fileEntries = Object.entries(fileGroups);
              return (
              <div key={ci} className="flex items-start gap-2 ml-3.5 mt-1">
                <div className="flex flex-col items-center">
                  <div className="w-px h-3 bg-gray-700/50" />
                  <div className="w-4 h-px bg-gray-700/50" />
                </div>
                <div className="flex items-start gap-2 pb-2 flex-1">
                  <div className="flex flex-col items-center">
                    <div 
                      className="w-6 h-6 rounded bg-cyan-900/40 border border-cyan-700/40 flex items-center justify-center text-[10px] text-cyan-400 shrink-0 cursor-help active:scale-95 transition-transform"
                      title="컴포넌트 (React Component)"
                      onClick={(e) => { e.stopPropagation(); toast('🧩 컴포넌트 (React Component) 노드입니다.', { icon: 'ℹ️' }); }}
                    >🧩</div>
                    {fileEntries.length > 0 && <div className="w-px flex-1 bg-gray-700/40 mt-1 min-h-[10px]" />}
                  </div>
                  <details className={`flex-1 group outline-none ${fileEntries.length > 0 ? 'cursor-pointer' : ''}`}>
                    {/* 컴포넌트 이름 */}
                    <summary className="list-none flex items-center gap-1.5 mb-1.5 outline-none select-none">
                      <span className="text-xs font-bold font-mono text-cyan-300">{action.handlerName}</span>
                      {fileEntries.length > 0 && (
                        <span className="text-[8px] text-gray-500 group-open:rotate-90 transition-transform ml-1">▶</span>
                      )}
                    </summary>
                    {/* sourceFile별 파일 노드 + 그 아래 API들 */}
                    {fileEntries.map(([srcFile, apis], fi) => (
                      <div key={fi} className="flex items-start gap-2 ml-3 mt-1">
                        <div className="flex flex-col items-center mt-0.5">
                          <div className="w-px h-3 bg-gray-700/40" />
                          <div className="w-3 h-px bg-gray-700/40" />
                        </div>
                        <details className={`flex flex-col gap-1.5 flex-1 pb-1 group/file outline-none ${(apis as any[]).length > 0 ? 'cursor-pointer' : ''}`}>
                          {/* 파일 노드 */}
                          <summary className="list-none flex items-center gap-1.5 mb-0.5 outline-none select-none">
                            <div 
                              className="w-5 h-5 rounded bg-gray-800/80 border border-gray-600/50 flex items-center justify-center text-[9px] text-gray-400 shrink-0 cursor-help active:scale-95 transition-transform"
                              title="소스 파일 (Source File)"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toast('📦 소스 파일 (Source File) 노드입니다.', { icon: 'ℹ️' }); }}
                            >📦</div>
                            <span className="text-[10px] font-mono text-gray-500">{srcFile.split('/').pop()}</span>
                            <span className="text-[9px] text-gray-700 font-mono truncate max-w-[120px]">{srcFile}</span>
                            {(apis as any[]).length > 0 && (
                              <span className="text-[8px] text-gray-500 group-open/file:rotate-90 transition-transform ml-1">▶</span>
                            )}
                          </summary>
                          {/* 이 파일의 API들 */}
                          {apis.map((api: any, apii: number) => (
                            <div key={apii} className="flex items-center gap-2 ml-5 mt-1">
                              <div className="flex items-center gap-1">
                                <div className="w-px h-3 bg-gray-700/40" />
                                <div className="w-3 h-px bg-gray-700/40" />
                              </div>
                              <ApiChip api={api} dimmed />
                            </div>
                          ))}
                        </details>
                      </div>
                    ))}
                  </details>
                </div>
              </div>
              );
            })}

            {/* 페이지 이동 노드 */}
            {sc.navigations?.length > 0 && (
              <div className="flex items-start gap-2 ml-3.5 mt-1">
                <div className="flex flex-col items-center">
                  <div className="w-px h-3 bg-gray-700/50" />
                  <div className="w-4 h-px bg-gray-700/50" />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <div 
                    className="w-6 h-6 rounded bg-green-900/40 border border-green-700/40 flex items-center justify-center text-[10px] text-green-400 shrink-0 cursor-help active:scale-95 transition-transform"
                    title="페이지 이동 (Page Navigation)"
                    onClick={(e) => { e.stopPropagation(); toast('🧭 페이지 이동 (Page Navigation) 노드입니다.', { icon: 'ℹ️' }); }}
                  >🧭</div>
                  <div className="flex flex-wrap gap-1.5">
                    {sc.navigations.map((nav: string, ni: number) => (
                      <details key={ni} className="group cursor-pointer outline-none w-full">
                        <summary className="list-none flex items-center outline-none select-none">
                          <span className="text-[10px] font-mono bg-gray-800/60 border border-gray-700/50 text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-gray-700/60 transition-colors">
                            화면: {resolveNextjsRoute(nav)}
                            <span className="text-[8px] text-gray-500 group-open:rotate-90 transition-transform ml-1">▶</span>
                          </span>
                        </summary>
                        <div className="mt-1.5 ml-2 pl-2 border-l-2 border-green-800/30">
                          <span className="text-[10px] font-mono bg-green-900/10 text-green-400/80 px-2 py-1 rounded inline-block break-all max-w-[400px]">
                            → {nav}
                          </span>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 빈 화면 */}
            {onEnterApis.length === 0 && userActions.length === 0 && componentActions.length === 0 && allNavs.length === 0 && (
              <div className="text-xs text-gray-600 italic py-1">추출된 API / 액션 없음</div>
            )}
          </div>
        </div>
      );
    });
  };
"""

views = """
              {/* 그래프 뷰 (스플릿 레이아웃) */}
              {staticViewTab === 'graph' && (
                <div className="flex gap-4 h-[700px] items-stretch">
                  <div className="flex-1 rounded-xl overflow-hidden border border-gray-700/60 h-full relative">
                    <RouteGraphView 
                      screens={screens} 
                      onGoToDetails={(route) => {
                        const el = document.getElementById(`route-block-${route}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-900/40', 'z-10', 'relative');
                          setTimeout(() => {
                            el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-900/40', 'z-10', 'relative');
                          }, 2000);
                        }
                      }}
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
"""

content = content.replace("  return (\n    <div \n      className={`flex-1", func + "\n\n  return (\n    <div \n      className={`flex-1")

start_str = "{/* 그래프 뷰 */}"
end_str = "{/* 빈 화면 */}"

start_index = content.find(start_str)
end_index = content.find(end_str, start_index)
end_index = content.find('</div>', end_index) + 6
end_index = content.find('</div>', end_index) + 6
end_index = content.find('</div>', end_index) + 6
end_index = content.find(');', end_index) + 2
end_index = content.find('})}', end_index) + 3
end_index = content.find('</div>', end_index) + 6
end_index = content.find(')}', end_index) + 2

if start_index != -1 and end_index != -1:
    chunk_to_replace = content[start_index:end_index]
    content = content.replace(chunk_to_replace, views)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Success")
else:
    print("Could not find blocks to replace.")
