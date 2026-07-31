const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

const code = fs.readFileSync('C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt\\src\\api\\scenario.api.ts', 'utf-8');
const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['typescript', 'jsx', 'decorators-legacy']
});

traverse(ast, {
  CallExpression(pathNode) {
    const callee = pathNode.node.callee;
    if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'builder') {
      const configObj = pathNode.node.arguments[0];
      if (configObj && configObj.type === 'ObjectExpression') {
        const queryProp = configObj.properties.find(p => p.key && p.key.name === 'query');
        if (queryProp) {
          if (queryProp.value.type === 'ArrowFunctionExpression' || queryProp.value.type === 'FunctionExpression') {
            const body = queryProp.value.body;
            if (body.type === 'ObjectExpression') {
              const urlProp = body.properties.find(p => p.key && p.key.name === 'url');
              if (urlProp) {
                console.log('urlProp type:', urlProp.value.type);
                if (urlProp.value.type === 'TemplateLiteral') {
                  console.log('Found TemplateLiteral URL:', urlProp.value.quasis.map(q => q.value.raw).join('{param}'));
                }
              } else {
                console.log('urlProp not found in body');
              }
            } else {
              console.log('body is not ObjectExpression, it is', body.type);
            }
          }
        }
      }
    }
  }
});
