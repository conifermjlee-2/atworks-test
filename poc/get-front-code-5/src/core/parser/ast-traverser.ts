import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ApiCallInfo, HookResolver } from '../../types';
import { isAllowedUrl } from './filter';

/**
 * 기획서 6.3절 RTK: Import Specifier Alias 역매핑 테이블 수집
 * import { useGetUsersQuery as useUsers } from './api'
 * → Map { 'useUsers' => 'useGetUsersQuery' }
 */
function buildImportAliasMap(ast: t.File): Map<string, string> {
  const aliasMap = new Map<string, string>();

  traverse(ast, {
    ImportDeclaration(path) {
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          const importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
          const localName = specifier.local.name;
          if (importedName !== localName) {
            aliasMap.set(localName, importedName);
          }
        }
      }
    }
  });

  return aliasMap;
}

/**
 * 기획서 7.1절: 책임 연쇄 패턴(Chain of Responsibility) + 배타적 소유권 규칙
 * - 고수준 리졸버(React Query, RTK Query)가 먼저 낚아채면 path.skip()으로 하위 탐색 차단
 * - 고수준 리졸버가 URL 추출에 실패하면(부분 실패) 다음 리졸버에게 위임
 */
export function findApiCalls(ast: t.File, resolvers: HookResolver[] = []): ApiCallInfo[] {
  const calls: ApiCallInfo[] = [];

  // Import alias 역매핑 테이블 사전 수집
  const importAliasMap = buildImportAliasMap(ast);

  traverse(ast, {
    CallExpression(path) {
      const { node } = path;
      const callee = node.callee;
      let calleeName = '';

      if (t.isIdentifier(callee)) {
        calleeName = callee.name;
      } else if (t.isMemberExpression(callee)) {
        if (t.isIdentifier(callee.object)) {
          calleeName = callee.object.name;
        }
        if (t.isIdentifier(callee.property)) {
          calleeName += `.${callee.property.name}`;
        }
      }

      if (!calleeName) return;

      // alias 역매핑 (useUsers → useGetUsersQuery)
      const resolvedName = importAliasMap.get(calleeName) ?? calleeName;

      // 책임 연쇄 패턴
      for (const resolver of resolvers) {
        const result = resolver.resolve(resolvedName, node.arguments as any[]);
        if (result) {
          if (result.endpoint && isAllowedUrl(result.endpoint)) {
            calls.push(result);
            // 핵심: 고수준 훅 매칭 성공 → 하위 AST(queryFn 내부 axios.get 등) 중복 차단
            path.skip();
            return;
          }
          // 부분 실패 Fallback: URL 추출 실패 → 다음 리졸버에게 위임
          continue;
        }
      }
    }
  });

  return calls;
}
