const path = require('path');
const fs = require('fs');

async function testAnalyze() {
  const projects = [
    'C:/Users/lee/Desktop/atworks-test/poc/tmp-project/react-board-example',
    'C:/Users/lee/Desktop/atworks-test/poc/tmp-project/shopping-mall-next-js'
  ];

  for (const p of projects) {
    try {
      const res = await fetch('http://localhost:3005/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: p })
      });
      const data = await res.json();
      console.log(`\nProject: ${path.basename(p)} -> Candidates: ${data.candidates ? data.candidates.length : 'Error'}`);
      if (data.candidates) {
        data.candidates.forEach(c => {
          console.log(`  - [${c.method}] ${c.url}`);
          console.log(`    Location: ${c.filePath}:${c.line}`);
        });
      }
    } catch (e) {
      console.log(`Error analyzing ${p}:`, e.message);
    }
  }
}

testAnalyze();
