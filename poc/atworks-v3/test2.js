const parser = require('@babel/parser');
const code = 'const f = x => ({ url: x })';
const ast = parser.parse(code, { sourceType: 'module' });
const func = ast.program.body[0].declarations[0].init;
console.log('Body type:', func.body.type);
