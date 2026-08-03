const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/lee/Desktop/atworks-test/poc/atworks-v3/src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStart = "{/* 라우트별 그룹 */}";
const targetEnd = "            </div>\n          </div>\n        )}\n\n\n        {isAnalyzing && phase === 'static'";

const startIdx = content.indexOf(targetStart);
const endIdx = content.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const newLayout = `{/* 라우트별 그룹 및 플로우 맵 */}
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">라우트별 상세</h4>
              <div className="flex items-center bg-[#121316] p-1 rounded-lg border border-gray-700/50">
                <button
                  onClick={() => setStaticViewTab('graph')}
                  className={\`px-4 py-1.5 rounded-md text-xs font-bold transition-colors \${staticViewTab === 'graph' ? 'bg-purple-600/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}\`}
                >
                  플로우 맵 뷰
                </button>
                <button
                  onClick={() => setStaticViewTab('list')}
                  className={\`px-4 py-1.5 rounded-md text-xs font-bold transition-colors \${staticViewTab === 'list' ? 'bg-purple-600/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}\`}
                >
                  리스트 뷰
                </button>
              </div>
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
  fs.writeFileSync(filePath, before + newLayout + after, 'utf8');
  console.log("Success");
} else {
  console.log("Failed to find targets");
}
