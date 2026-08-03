const fs = require('fs');
const path = 'src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                    {sc.navigations.map((nav: string, ni: number) => (
                      <details key={ni} className="group cursor-pointer outline-none w-full">
                        <summary className="list-none flex items-center outline-none select-none">
                          <span className="text-[10px] font-mono bg-gray-800/60 border border-gray-700/50 text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-gray-700/60 transition-colors">
                            화면: {nav}
                            <span className="text-[8px] text-gray-500 group-open:rotate-90 transition-transform ml-1">▶</span>
                          </span>
                        </summary>
                        <div className="mt-1.5 ml-2 pl-2 border-l-2 border-green-800/30">
                          <span className="text-[10px] font-mono bg-green-900/10 text-green-400/80 px-2 py-1 rounded inline-block break-all max-w-[400px]">
                            → {nav}
                          </span>
                        </div>
                      </details>
                    ))}`;

const replacement = `                    {sc.navigations.map((nav: string, ni: number) => (
                      <div 
                        key={ni} 
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
                    ))}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content);
  console.log('Successfully replaced sc navigations block.');
} else {
  console.log('Target block not found in file.');
}
