const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = `
const { data } = await axiosClient.get<Product[]>(\`api/products?\${params.toString()}\`);
`;

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'decorators-legacy'],
});

const candidates = [];

traverse(ast, {
  CallExpression(pathNode) {
    const callee = pathNode.node.callee;
    
    if (callee.type === 'MemberExpression') {
      const objectName = callee.object.type === 'Identifier' ? callee.object.name : '';
      const propertyName = callee.property.type === 'Identifier' ? callee.property.name : '';
      
      console.log('MemberExpression:', { objectName, propertyName });

      const isAxiosOrApi = /axios|api|http|client/i.test(objectName);
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
      
      if (isAxiosOrApi && httpMethods.includes(propertyName.toLowerCase())) {
        candidates.push({ method: propertyName.toUpperCase(), objectName });
      }
    }
  }
});

console.log('Candidates:', candidates);
