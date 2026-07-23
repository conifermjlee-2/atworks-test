import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ApiCallInfo } from '../types';
import { isAllowedUrl } from './filter';
import { HookResolver } from './resolvers/types';

/**
 * 기획서 6.1.4: Import Specifier Alias 역매핑 테이블 수집
 * import { useGetScenariosQuery as useScenarios } from './api'
 * => { 'useScenarios' => 'useGetScenariosQuery' } 형태로 저장
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
          // 이름이 다를 때만(alias가 있을 때만) 저장
          if (importedName !== localName) {
            aliasMap.set(localName, importedName);
          }
        }
      }
    }
  });

  return aliasMap;
}

export function findApiCalls(ast: t.File, resolvers: HookResolver[] = []): ApiCallInfo[] {
  const calls: ApiCallInfo[] = [];

  // 기획서 6.1.4: 파일 내 import alias 역매핑 테이블을 먼저 수집
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

      // 기획서 6.1.4: alias 역매핑 적용 (useScenarios → useGetScenariosQuery)
      const resolvedName = importAliasMap.get(calleeName) ?? calleeName;

      // 기획서 7.1: 책임 연쇄 패턴 + 배타적 소유권 규칙
      for (const resolver of resolvers) {
        const result = resolver.resolve(resolvedName, node.arguments);
        if (result) {
          // 고수준 훅이 매칭했지만 URL 추출에 성공한 경우 -> 즉시 채택, 중복 차단
          if (result.endpoint && isAllowedUrl(result.endpoint)) {
            calls.push(result);
            path.skip(); // 핵심: 하위 AST(예: queryFn 내부의 axios.get) 탐색을 원천 차단하여 중복 추출 방지
            return;
          }
          // 고수준 훅이 매칭했으나 URL 추출 실패(부분 실패) -> 배타적 차단 해제, 다음 resolver 시도
          // (기획서 7.1: 부분 실패 예외 Fallback - 조용히 유실되지 않도록)
          continue;
        }
      }
    }
  });

  return calls;
}
