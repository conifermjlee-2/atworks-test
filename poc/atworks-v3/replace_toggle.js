const fs = require('fs');
const path = 'src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('{/* 뷰 모드 토글 (라우트별 그룹 상단) */}'));
if (startIdx === -1) {
  console.log('Could not find start index for toggle block');
  process.exit(1);
}

// Find the corresponding closing div (the end of the toggle block)
// The block has 17 lines roughly (up to </div> ending the inline buttons)
// We'll search for '</div>' that closes the flex items-center justify-between container
// Or we just replace from startIdx to startIdx + 16 (since it's a fixed length block)
const endIdx = startIdx + 16; 

const replacement = `            {/* 라우트별 그룹 헤더 */}
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
            </div>`;

lines.splice(startIdx, endIdx - startIdx + 1, replacement);
fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully replaced floating toggle block with dynamic index.');
