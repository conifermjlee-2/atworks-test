const fs = require('fs');
const path = 'src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const replacement = `                        {action.navigations.map((nav: string, ni: number) => (
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
                        ))}`;

lines.splice(850, 14, replacement);
fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed action navigations');
