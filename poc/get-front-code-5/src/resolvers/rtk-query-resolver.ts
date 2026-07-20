import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod, HookResolver } from '../types';

export interface RtkEndpointInfo {
  name: string;
  hookName: string;
  lazyHookName: string;
  type: 'query' | 'mutation';
  method: HttpMethod;
  url: string;
}

export type RtkHookMap = Map<string, RtkEndpointInfo>;

/**
 * 기획서 6.1: RTK Query Resolver
 * - baseQuery의 baseUrl 병합
 * - injectEndpoints 분리 코드 대응
 * - useLazy[Endpoint]Query 훅 네이밍 역산
 * - Import Specifier Alias 역매핑 (ast-traverser에서 처리)
 */
export class RtkQueryResolver implements HookResolver {
  name = 'RTK Query Resolver';
  private hookMap: RtkHookMap = new Map();

  async init(rootDir: string): Promise<void> {
    // 기획서 6.1.2: injectEndpoints 패턴 및 .api.ts 파일을 모두 스캔
    const pattern1 = path.join(rootDir, 'src', '**', '*.api.ts').replace(/\\/g, '/');
    const pattern2 = path.join(rootDir, 'src', 'api', '**', '*.ts').replace(/\\/g, '/');
    const pattern3 = path.join(rootDir, 'src', 'store', '**', '*.ts').replace(/\\/g, '/');

    const apiFiles = await fg([pattern1, pattern2, pattern3], {
      ignore: ['**/*.test.*', '**/*.spec.*', '**/*.d.ts']
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

        // 기획서 6.1.1: baseQuery의 baseUrl 추출
        const baseUrl = extractBaseUrl(code);

        const endpoints = extractEndpointBlocks(code, baseUrl);
        const hookExports = extractHookExports(code);

        for (const block of endpoints) {
          // 기획서 6.1.3: 표준 훅 이름 및 lazy 변형 도출
          const hookName = hookExports.get(block.name) || generateHookName(block.name, block.type);
          const lazyHookName = block.type === 'query'
            ? generateLazyHookName(block.name)
            : hookName;

          const info: RtkEndpointInfo = {
            name: block.name,
            hookName,
            lazyHookName,
            type: block.type,
            method: block.method,
            url: block.url,
          };

          this.hookMap.set(hookName, info);
          if (lazyHookName !== hookName) {
            this.hookMap.set(lazyHookName, info);
          }
        }
      } catch (err) {
        console.warn(`[Warning] Failed to parse RTK Query file: ${filePath}`);
      }
    }

    if (this.hookMap.size > 0) {
      console.log(`[RTK Query] 사전 구축 완료: ${this.hookMap.size}개 훅 매핑됨`);
    }
  }

  resolve(calleeName: string, args: Array<t.Node | null>): ApiCallInfo | null {
    if (this.hookMap.has(calleeName)) {
      const rtkInfo = this.hookMap.get(calleeName)!;
      return {
        method: rtkInfo.method,
        endpoint: rtkInfo.url,
        isDynamic: rtkInfo.url.includes('{'),
        rawUrl: rtkInfo.url
      };
    }
    return null;
  }
}

interface EndpointBlock {
  name: string;
  type: 'query' | 'mutation';
  method: HttpMethod;
  url: string;
}

function extractBaseUrl(code: string): string {
  // 기획서 6.1.1: fetchBaseQuery({ baseUrl: '/api' }) 패턴 추출
  const baseUrlMatch = code.match(/fetchBaseQuery\s*\(\s*\{[^}]*baseUrl\s*:\s*['"`]([^'"`]+)['"`]/);
  return baseUrlMatch ? baseUrlMatch[1] : '';
}

function extractEndpointBlocks(code: string, baseUrl: string): EndpointBlock[] {
  const blocks: EndpointBlock[] = [];
  const regex = /(\w+):\s*builder\.(query|mutation)[\s\S]{0,500}?\(\s*\{/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const name = match[1];
    const type = match[2] as 'query' | 'mutation';
    const startIndex = match.index + match[0].length;

    const blockContent = extractBracketBlock(code, startIndex - 1);
    if (!blockContent) continue;

    const rawUrl = extractUrl(blockContent);
    // 기획서 6.1.1: baseUrl과 병합
    const url = baseUrl && rawUrl && !rawUrl.startsWith('http')
      ? mergeUrl(baseUrl, rawUrl)
      : rawUrl;

    const method = extractMethod(blockContent, type);

    blocks.push({ name, type, method, url });
  }

  return blocks;
}

function mergeUrl(base: string, endpoint: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  if (!cleanEndpoint) return cleanBase;
  return `${cleanBase}/${cleanEndpoint}`;
}

function extractBracketBlock(code: string, startIndex: number): string | null {
  let depth = 0;
  let started = false;

  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      depth++;
      started = true;
    } else if (code[i] === '}') {
      depth--;
    }

    if (started && depth === 0) {
      return code.substring(startIndex, i + 1);
    }
  }
  return null;
}

function extractUrl(block: string): string {
  const templateMatch = block.match(/(?:url|query)\s*[:=]\s*(\([^)]*\)\s*=>\s*)?`([\s\S]*?)`/);
  if (templateMatch) {
    return templateMatch[2].replace(/\$\{(\w+)\}/g, '{$1}');
  }

  const stringMatch = block.match(/(?:url|query)\s*[:=]\s*(\([^)]*\)\s*=>\s*)?['"]([^'"]+)['"]/);
  if (stringMatch) {
    return stringMatch[2];
  }

  return '{dynamic_url}';
}

function extractMethod(block: string, type: 'query' | 'mutation'): HttpMethod {
  const methodMatch = block.match(/method:\s*['"](\w+)['"]/);
  if (methodMatch) {
    const m = methodMatch[1].toUpperCase();
    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(m)) {
      return m as HttpMethod;
    }
  }
  return type === 'query' ? 'GET' : 'POST';
}

function extractHookExports(code: string): Map<string, string> {
  const map = new Map<string, string>();
  const exportMatch = code.match(/export\s+const\s*\{([^}]+)\}/);
  if (!exportMatch) return map;

  const hooks = exportMatch[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('//'));

  for (const hookName of hooks) {
    const cleanHook = hookName.replace(/\s+/g, '');
    const endpointName = hookToEndpointName(cleanHook);
    if (endpointName) {
      map.set(endpointName, cleanHook);
    }
  }

  return map;
}

function hookToEndpointName(hookName: string): string | null {
  // 기획서 6.1.3: useLazy 변형 포함 역산
  let name = hookName.replace(/^useLazy/, 'use');
  const queryMatch = name.match(/^use(\w+)Query$/);
  if (queryMatch) {
    return queryMatch[1].charAt(0).toLowerCase() + queryMatch[1].slice(1);
  }
  const mutationMatch = name.match(/^use(\w+)Mutation$/);
  if (mutationMatch) {
    return mutationMatch[1].charAt(0).toLowerCase() + mutationMatch[1].slice(1);
  }
  return null;
}

function generateHookName(endpointName: string, type: 'query' | 'mutation'): string {
  const capitalized = endpointName.charAt(0).toUpperCase() + endpointName.slice(1);
  return type === 'query' ? `use${capitalized}Query` : `use${capitalized}Mutation`;
}

function generateLazyHookName(endpointName: string): string {
  const capitalized = endpointName.charAt(0).toUpperCase() + endpointName.slice(1);
  return `useLazy${capitalized}Query`;
}
