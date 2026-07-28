const fs = require('fs');
const file = 'src/core/parser/ast-traverser.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /p\.skip\(\);\s+return;\s+\}\s+\},\s+\/\/\s+── EVENT 트리거: JSX 이벤트 핸들러/;

const replacement = `p.skip();
        return;
      }

      // ── SERVER COMPONENT 트리거 (Next.js) ─────────────────────
      // MOUNT, EVENT 훅이 아니더라도 상단 또는 임의의 함수 내에서 API를 직접 호출하는 경우 (Server Component 대응)
      if (!MOUNT_HOOKS.has(calleeName) && !EVENT_HOOKS.has(calleeName)) {
        const dummyBlock = t.blockStatement([t.expressionStatement(p.node)]);
        const apiCalls = collectApiCallsInBlock(dummyBlock, resolvers, ast, importMap, filePath, rootDir);
        if (apiCalls.length > 0) {
          scenarios.push({
            triggerType: 'MOUNT',
            triggerSource: 'ServerDataFetch',
            file: relativePath,
            viewName,
            line: p.node.loc?.start.line,
            apiCalls
          });
          p.skip();
          return;
        }
      }
    },

    // ── EVENT 트리거: JSX 이벤트 핸들러`;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code);
console.log("Success with regex");
