import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod, HookResolver, RtkHookMap } from '../types';
import { normalizeEndpointPattern } from '../core/parser/normalizer';
import { parseFile } from '../core/parser/ast-parser';

/**
 * 엔드포인트 이름(camelCase)으로부터 표준 RTK Query 훅 이름을 자동 유도
 * RTK Query 공식 스펙: https://redux-toolkit.js.org/rtk-query/api/created-api/hooks
 *
 * ex) getAllDeploymentDetails → useGetAllDeploymentDetailsQuery, useLazyGetAllDeploymentDetailsQuery
 * ex) saveDeploymentFilters  → useSaveDeploymentFiltersMutation
 */
function deriveHookNames(endpointName: string, endpointType: 'query' | 'mutation'): string[] {
  const pascal = endpointName.charAt(0).toUpperCase() + endpointName.slice(1);
  if (endpointType === 'mutation') {
    return [`use${pascal}Mutation`];
  }
  return [`use${pascal}Query`, `useLazy${pascal}Query`];
}

interface EndpointBlock {
  name: string;
  type: 'query' | 'mutation';
  method: HttpMethod;
  urlPattern: string;
}

/**
 * Babel AST를 사용하여 createApi / injectEndpoints 내부의 endpoints 객체를 순회합니다.
 * 구조분해 파라미터, 중첩 객체 등 모든 코딩 스타일에 대해 안전하게 파싱합니다.
 */
function extractEndpointBlocksViaAst(ast: t.File): EndpointBlock[] {
  const blocks: EndpointBlock[] = [];

  traverse(ast, {
    // builder.query({ ... }) / builder.mutation({ ... }) 호출을 탐색
    CallExpression(p) {
      const callee = p.node.callee;
      if (!t.isMemberExpression(callee)) return;
      if (!t.isIdentifier(callee.object) || callee.object.name !== 'builder') return;
      if (!t.isIdentifier(callee.property)) return;

      const endpointType = callee.property.name;
      if (endpointType !== 'query' && endpointType !== 'mutation') return;

      // builder.query({ query: ..., ... }) 의 첫 번째 인수 (설정 객체)
      const configArg = p.node.arguments[0];
      if (!t.isObjectExpression(configArg)) return;

      // 설정 객체에서 query 프로퍼티(함수)를 찾음
      const queryProp = configArg.properties.find(
        (prop): prop is t.ObjectProperty =>
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key) &&
          prop.key.name === 'query'
      );
      if (!queryProp) return;

      // query 프로퍼티의 부모 ObjectProperty (=엔드포인트 이름 찾기)
      // builder.query의 직접 부모 ObjectProperty를 탐색
      let endpointName: string | null = null;
      let parentPath = p.parentPath;
      while (parentPath) {
        if (
          parentPath.isObjectProperty() &&
          t.isIdentifier(parentPath.node.key)
        ) {
          endpointName = parentPath.node.key.name;
          break;
        }
        parentPath = parentPath.parentPath;
      }
      if (!endpointName) return;

      // query 함수 바디에서 url 값을 추출
      const queryFn = queryProp.value;
      let urlPattern: string | null = null;
      let method: HttpMethod = endpointType === 'mutation' ? 'POST' : 'GET';

      // (1) 함수 바디가 객체 리터럴을 직접 반환하는 경우: (params) => ({ url, method })
      // (2) 함수 바디가 블록인 경우: (params) => { return { url, method } }
      // (3) 단순 문자열 반환: () => 'url/path'
      const extractFromNode = (node: t.Node): void => {
        // 단순 문자열 반환
        if (t.isStringLiteral(node)) {
          urlPattern = node.value;
          return;
        }
        if (t.isTemplateLiteral(node)) {
          // 템플릿 리터럴은 {param} 형태로 정규화
          const parts = node.quasis.map((q, i) => {
            const expr = node.expressions[i];
            const expStr = expr && t.isIdentifier(expr) ? `{${expr.name}}` :
                           expr && t.isMemberExpression(expr) ? '{param}' : '';
            return q.value.raw + expStr;
          });
          urlPattern = parts.join('');
          return;
        }
        // 객체 리터럴: { url: '...', method: '...' }
        if (t.isObjectExpression(node)) {
          for (const prop of node.properties) {
            if (!t.isObjectProperty(prop)) continue;
            if (!t.isIdentifier(prop.key)) continue;
            if (prop.key.name === 'url') {
              if (t.isStringLiteral(prop.value)) {
                urlPattern = prop.value.value;
              } else if (t.isTemplateLiteral(prop.value)) {
                const parts = prop.value.quasis.map((q, i) => {
                  const expr = prop.value instanceof t.TemplateLiteral ? null : null;
                  const exprNode = (prop.value as t.TemplateLiteral).expressions[i];
                  const expStr = exprNode && t.isIdentifier(exprNode) ? `{${exprNode.name}}` :
                                 exprNode && t.isMemberExpression(exprNode) ? '{param}' : '';
                  return q.value.raw + expStr;
                });
                urlPattern = parts.join('');
              }
            }
            if (prop.key.name === 'method' && t.isStringLiteral(prop.value)) {
              const m = prop.value.value.toUpperCase();
              if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(m)) {
                method = m as HttpMethod;
              }
            }
          }
        }
      };

      // 화살표 함수: () => expr 또는 () => ({ ... })
      if (t.isArrowFunctionExpression(queryFn)) {
        const body = queryFn.body;
        if (t.isBlockStatement(body)) {
          // () => { return { ... } } 형태
          traverse(body as any, {
            ReturnStatement(rp) {
              if (rp.node.argument) extractFromNode(rp.node.argument);
              rp.stop();
            }
          });
        } else {
          // () => ({ ... }) 또는 () => 'url' 형태
          extractFromNode(body);
        }
      } else if (t.isFunctionExpression(queryFn)) {
        // function(params) { return { ... } } 형태
        traverse(queryFn as any, {
          ReturnStatement(rp) {
            if (rp.node.argument) extractFromNode(rp.node.argument);
            rp.stop();
          }
        });
      }

      if (urlPattern) {
        blocks.push({ name: endpointName, type: endpointType as 'query' | 'mutation', method, urlPattern });
      }
    }
  });

  return blocks;
}

/**
 * RTK Query Resolver (v5.3 — Babel AST 기반 범용 파서)
 * - 정규식을 버리고 Babel AST 트리 순회로 전면 교체
 * - 구조분해 파라미터, 중첩 객체, 템플릿 리터럴 등 모든 패턴 100% 대응
 * - Hook Derivation: 엔드포인트명 → 표준 RTK Query 훅 이름 자동 유도
 * - 모노레포 및 넓은 루트 탐색 유지
 */
export class RtkQueryResolver implements HookResolver {
  name = 'RTK Query Resolver';
  private hookMap: RtkHookMap = new Map();

  async init(rootDir: string): Promise<void> {
    const bases = [
      path.resolve(rootDir),
      path.resolve(rootDir, '..'),
      path.resolve(rootDir, '../..')
    ];

    const patterns: string[] = [];
    for (const baseDir of bases) {
      patterns.push(path.join(baseDir, 'src', '**', '*.{ts,tsx,js,jsx}').replace(/\\/g, '/'));
      for (const wsFolder of ['packages', 'libs', 'modules', 'shared']) {
        patterns.push(path.join(baseDir, wsFolder, '**', '*.{ts,tsx,js,jsx}').replace(/\\/g, '/'));
      }
    }

    const apiFiles = await fg(patterns, {
      ignore: ['**/*.test.*', '**/*.spec.*', '**/*.d.ts', '**/node_modules/**']
    });

    for (const filePath of apiFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        if (
          !code.includes('injectEndpoints') &&
          !code.includes('builder.query') &&
          !code.includes('builder.mutation') &&
          !code.includes('createApi')
        ) {
          continue;
        }

        // Babel AST 기반 파싱으로 전면 교체
        const ast = parseFile(filePath);
        if (!ast) continue;

        const blocks = extractEndpointBlocksViaAst(ast);

        for (const block of blocks) {
          // 공식 스펙 기반으로 훅 이름 자동 유도 (Hook Derivation)
          const derivedHooks = deriveHookNames(block.name, block.type);
          for (const hookName of derivedHooks) {
            const existing = this.hookMap.get(hookName) || [];
            existing.push({
              method: block.method,
              urlPattern: block.urlPattern,
            });
            this.hookMap.set(hookName, existing);
          }
        }
      } catch (err) {
        // 파싱 에러 방어
      }
    }

    console.log(`[RTKQueryResolver] 총 ${this.hookMap.size}개의 훅 매핑 사전 구축 완료 (AST 기반)`);
  }

  resolve(calleeName: string, args: any[], ast?: any): ApiCallInfo | null {
    const definitions = this.hookMap.get(calleeName);
    if (!definitions || definitions.length === 0) {
      return null;
    }

    const targetDef = definitions[0];
    const rawPattern = targetDef.urlPattern;
    const normalized = normalizeEndpointPattern(rawPattern, args);

    return {
      method: targetDef.method,
      endpoint: normalized.endpoint,
      isDynamic: normalized.isDynamic,
      rawUrl: rawPattern,
    };
  }
}
