const fs = require('fs');
let code = fs.readFileSync('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\atworks-v3\\src\\app\\api\\analyze\\chain\\route.ts', 'utf-8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('// Resolve RTK Query hook to RTK Query endpoint reference'));
console.log(lines.slice(start - 5, start + 20).join('\n'));
