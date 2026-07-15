import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod } from '../types';
import { isTargetCallee, isAllowedUrl } from './filter';
import { HookResolver } from './resolvers/types';

export function findApiCalls(ast: t.File, resolvers: HookResolver[] = []): ApiCallInfo[] {
  const calls: ApiCallInfo[] = [];

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

      // 플러그인(Resolver)들을 순회하며 처리 가능한지 확인
      for (const resolver of resolvers) {
        const result = resolver.resolve(calleeName, node.arguments);
        if (result && isAllowedUrl(result.endpoint)) {
          calls.push(result);
          return; // 매칭된 플러그인이 있으면 즉시 종료 (중복 방지)
        }
      }
    }
  });

  return calls;
}

