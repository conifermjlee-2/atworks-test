import { Project, SyntaxKind, CallExpression, Node } from 'ts-morph';
import { ApiCall, ScenarioIR, Trigger } from '../types';

export class AstParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: { allowJs: true, jsx: 1 /* Preserve */ }
    });
  }

  public analyzeDirectory(dirPath: string): ScenarioIR[] {
    this.project.addSourceFilesAtPaths([
      `${dirPath}/**/*.{ts,tsx,js,jsx}`,
      `!${dirPath}/**/node_modules/**`,
      `!${dirPath}/**/.next/**`,
      `!${dirPath}/**/dist/**`,
      `!${dirPath}/**/build/**`
    ]);
    const sourceFiles = this.project.getSourceFiles();
    const scenarios: ScenarioIR[] = [];

    for (const sourceFile of sourceFiles) {
      // 컴포넌트나 함수 단위로 트리거를 찾고 내부의 API 호출을 추적
      const filePath = sourceFile.getFilePath().replace(dirPath, '');
      const calls = this.extractApiCalls(sourceFile);
      
      if (calls.length > 0) {
        scenarios.push({
          framework: this.detectFramework(filePath, sourceFile.getText()),
          route: this.extractRoute(filePath),
          sourceFile: filePath,
          trigger: this.extractTrigger(sourceFile, calls),
          calls: calls
        });
      }
    }

    return scenarios;
  }

  private detectFramework(filePath: string, content: string): 'react' | 'nextjs' | 'vue' | 'unknown' {
    if (filePath.includes('app/') && filePath.includes('route.ts')) return 'nextjs';
    if (content.includes('use server') || content.includes('getServerSideProps')) return 'nextjs';
    if (content.includes('useState') || content.includes('useEffect') || content.includes('useQuery')) return 'react';
    return 'unknown'; // 현재 Phase 1이므로 Vue는 보류 또는 unknown 처리
  }

  private extractRoute(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.includes('/app/')) {
      const match = normalized.match(/\/app\/(?:(.*)\/)?(page|route)\.(tsx|ts|jsx|js)$/);
      if (match) {
        let route = match[1] ? '/' + match[1] : '/';
        route = route.replace(/\[([^\]]+)\]/g, ':$1'); // [id] -> :id
        return route;
      }
    } else if (normalized.includes('/pages/')) {
      const match = normalized.match(/\/pages\/(.*)\.(tsx|ts|jsx|js)$/);
      if (match) {
        let route = '/' + match[1];
        if (route.endsWith('/index')) route = route.replace(/\/index$/, '') || '/';
        if (route === '/_app' || route === '/_document') return '/공통(Shared)';
        route = route.replace(/\[([^\]]+)\]/g, ':$1'); // [id] -> :id
        return route;
      }
    }
    return '/공통(Shared)';
  }

  private extractTrigger(sourceFile: Node, calls: ApiCall[]): Trigger {
    // 가장 넓은 범위의 이벤트 핸들러나 생명주기 훅을 찾아서 트리거로 삼음 (간이 구현)
    const text = sourceFile.getText();
    if (text.includes('useEffect')) return { type: 'lifecycle', name: 'useEffect' };
    if (text.includes('onClick')) return { type: 'event', name: 'onClick' };
    if (text.includes('getServerSideProps')) return { type: 'route', name: 'getServerSideProps' };
    return { type: 'unknown', name: 'Component Render / Unknown' };
  }

  private extractApiCalls(node: Node): ApiCall[] {
    const calls: ApiCall[] = [];
    const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);
    let order = 1;

    for (const callExpr of callExpressions) {
      const expressionText = callExpr.getExpression().getText();
      const argsText = callExpr.getArguments().map(a => a.getText()).join(', ');

      let isApi = false;
      let method = 'GET';
      let endpoint = 'unknown';

      if (expressionText === 'fetch') {
        isApi = true;
        endpoint = callExpr.getArguments()[0]?.getText() || 'unknown';
        if (argsText.includes('POST')) method = 'POST';
      } else if (expressionText.includes('axios')) {
        isApi = true;
        if (expressionText.includes('.post')) method = 'POST';
        else if (expressionText.includes('.put')) method = 'PUT';
        else if (expressionText.includes('.delete')) method = 'DELETE';
        endpoint = callExpr.getArguments()[0]?.getText() || 'unknown';
      } else if (expressionText.includes('useQuery') || expressionText.includes('useMutation')) {
        isApi = true;
        method = expressionText.includes('useMutation') ? 'MUTATION' : 'GET';
        endpoint = 'QueryKey: ' + (callExpr.getArguments()[0]?.getText() || 'unknown');
      }

      if (isApi) {
        // 호출 컨텍스트(Evidence) 확보 (부모 함수의 이름이나 주석)
        const parentFunc = callExpr.getFirstAncestorByKind(SyntaxKind.ArrowFunction) || 
                           callExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
        
        let navigatesTo: string | null = null;
        if (parentFunc) {
          const pushCalls = parentFunc.getDescendantsOfKind(SyntaxKind.CallExpression)
            .filter(c => c.getExpression().getText() === 'router.push' || c.getExpression().getText() === 'router.replace');
          if (pushCalls.length > 0) {
            navigatesTo = pushCalls[0].getArguments()[0]?.getText().replace(/['"`]/g, '') || null;
          }
        }

        calls.push({
          order: order++,
          method,
          endpoint,
          callerType: 'component', // 상세 구현 시 부모 노드 타입으로 분기
          confidence: 'detected', // 정적 분석으로 찾았으므로 무조건 detected
          evidence: `Line ${callExpr.getStartLineNumber()}: ${expressionText}(...) in ${parentFunc ? 'function' : 'root'}`,
          navigatesTo
        });
      }
    }
    return calls;
  }
}
