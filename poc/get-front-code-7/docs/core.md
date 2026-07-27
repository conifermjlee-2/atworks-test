# 🚀 get-front-code-5: 주요 코드 구현체 (Implementation Details)

### 1. 프레임워크 어댑터 레이어 (컴포넌트 지시어 탐지)
**👉 위치: `src/adapters/next-adapter.ts` 등**
파일을 읽어 파일 최상단에 `"use client"`나 `"use server"` 지시어가 있는지 확인하여 컴포넌트 타입을 식별합니다.

```typescript
export class NextAdapter implements BaseAdapter {
  // ...
  getCallType(filePath: string): CallType {
    const code = fs.readFileSync(filePath, 'utf-8');
    if (code.includes('use client')) {
      return 'Client';
    } else if (code.includes('use server')) {
      return 'ServerAction';
    }
    return 'ServerComponent';
  }
}
```

### 2. AST 파서 & 순회 레이어 (@babel/traverse 활용)
**👉 위치: `src/core/parser/ast-traverser.ts`**
코드에서 모든 함수 호출(`CallExpression`)을 순회하며, 고수준 훅(React Query 등)에서 분석이 성공하면 `path.skip()`을 호출해 그 내부의 하위 `axios` 호출 등을 중복 수집하지 않도록 차단합니다.

```typescript
traverse(ast, {
  CallExpression(path) {
    const { node } = path;
    // ... 식별자 이름 추출 후 리졸버 체인에 전달
    for (const resolver of resolvers) {
      const result = resolver.resolve(resolvedName, node.arguments as any[]);
      if (result && result.endpoint) {
        calls.push(result);
        // 핵심 로직: 중복 카운트 방지를 위해 하위 AST 탐색 차단
        path.skip(); 
        return;
      }
    }
  }
});
```

### 3. 플러그인 리졸버 레이어 (HookResolver 및 심볼 역추적)
**👉 위치: `src/types/index.ts` (인터페이스) 및 `src/resolvers/*` (구현체)**
각 리졸버 플러그인은 동일한 인터페이스 구조를 가집니다. 역추적 시 무한 루프를 막기 위해 `visited` Set을 활용합니다.

```typescript
export interface HookResolver {
  name: string;
  init?: (rootDir: string) => Promise<void>;
  // AST 노드와 심볼 맵을 받아 API 호출 정보 반환
  resolve(node: any, importAliasMap: Map<string, string>): ApiCallInfo | null;
}
```

### 4. 프리젠테이션 & API 레이어 (Next.js Route Handler)
**👉 위치: `src/app/api/analyze/route.ts`**
API 엔드포인트는 전달받은 경로를 바탕으로 분석기를 돌려 **순수 JSON** 데이터만 반환합니다. UI는 신경 쓰지 않습니다.

```typescript
export async function POST(request: Request) {
  const { targetPath } = await request.json();
  const analyzer = new Analyzer();
  
  // 분석 실행 후 결과값 반환
  const results = await analyzer.run(targetPath);
  return NextResponse.json({
    totalApis: results.length,
    data: results
  });
}
```

### 5. 동적 URL 파싱의 한계 방어 (템플릿 리터럴 추출)
**👉 위치: `src/core/parser/normalizer.ts` (`normalizeTemplateLiteral` 함수)**
런타임 변수(`id`, `userId` 등)를 완벽히 알 수 없으므로, 변수명 자체(Identifier)를 추출하여 `"{변수명}"` 텍스트 형태로 보존합니다.

```typescript
export function normalizeTemplateLiteral(node: t.TemplateLiteral): string {
  let result = '';
  const quasis = node.quasis;
  const expressions = node.expressions;

  for (let i = 0; i < quasis.length; i++) {
    result += quasis[i].value.raw; // 정적 텍스트 부분 (ex. "/api/users/")
    
    if (i < expressions.length) {
      const expr = expressions[i];
      // 변수일 경우 변수 이름을 문자열 괄호로 보존 (ex. {id})
      if (t.isIdentifier(expr)) {
        result += `{${expr.name}}`;
      } else {
        result += `{param}`;
      }
    }
  }
  return result; // 결과: "/api/users/{id}"
}
```
