const fs = require('fs');
const path = 'src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// 1. Add staticViewTab and graphFocusRoute states
const phaseStateIdx = lines.findIndex(l => l.includes('const [phase, setPhase] = useState'));
if (phaseStateIdx !== -1 && !content.includes('const [staticViewTab')) {
    lines.splice(phaseStateIdx + 1, 0, 
        `  const [staticViewTab, setStaticViewTab] = useState<'graph' | 'list'>('graph');`,
        `  const [graphFocusRoute, setGraphFocusRoute] = useState<string | null>(null);`
    );
} else if (phaseStateIdx !== -1 && !content.includes('const [graphFocusRoute')) {
    const staticViewTabIdx = lines.findIndex(l => l.includes('const [staticViewTab'));
    lines.splice(staticViewTabIdx + 1, 0, 
        `  const [graphFocusRoute, setGraphFocusRoute] = useState<string | null>(null);`
    );
}

// Write back to use index-based replacement for the next steps
fs.writeFileSync(path, lines.join('\n'));
content = fs.readFileSync(path, 'utf8');

// 2. We need to find the start and end of the OLD layout.
// Start is '{/* 라우트별 그룹 */}'
// End is the closing div before '{isAnalyzing && phase === 'static' && ('
const oldLines = content.split('\n');
const startLayoutIdx = oldLines.findIndex(l => l.includes('{/* 라우트별 그룹 */}'));
let endLayoutIdx = -1;

for (let i = startLayoutIdx; i < oldLines.length; i++) {
    if (oldLines[i].includes('isAnalyzing && phase === \'static\'')) {
        // The closing div is usually a few lines before this
        endLayoutIdx = i - 1;
        while (oldLines[endLayoutIdx].trim() === '' || oldLines[endLayoutIdx].trim() === '}' || oldLines[endLayoutIdx].trim() === ')}') {
            endLayoutIdx--;
        }
        // find the last </div> before isAnalyzing
        while (oldLines[endLayoutIdx].trim() !== '</div>') {
            endLayoutIdx--;
        }
        // go back one more </div> to be safe? 
        // Actually, let's just replace from `{/* 라우트별 그룹 */}` down to the line before `isAnalyzing && phase === 'static'`
        break;
    }
}

if (startLayoutIdx !== -1 && endLayoutIdx !== -1) {
    const newLayoutLines = `{/* 라우트별 그룹 헤더 */}
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
          </div>
        )}
`.split('\n');

    // We replace from startLayoutIdx to the line BEFORE `isAnalyzing`
    const replaceEndIdx = oldLines.findIndex(l => l.includes('isAnalyzing && phase === \'static\'')) - 1;
    
    oldLines.splice(startLayoutIdx, replaceEndIdx - startLayoutIdx + 1, ...newLayoutLines);
    fs.writeFileSync(path, oldLines.join('\n'));
    console.log("Replaced layout block!");
} else {
    console.log("Could not find layout bounds:", startLayoutIdx, endLayoutIdx);
}
