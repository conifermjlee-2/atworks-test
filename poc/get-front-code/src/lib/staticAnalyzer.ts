import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

// ─── 타입 정의 ─────────────────────────────────────────────

interface EndpointInfo {
  name: string;           // 엔드포인트 이름 (예: getTask)
  hookName: string;       // 훅 이름 (예: useGetTaskQuery)
  type: 'query' | 'mutation';
  method: string;         // GET, POST, PATCH, DELETE, PUT
  url: string;            // /tasks/{taskCode}
  providesTags: string[];
  invalidatesTags: string[];
  sourceFile: string;     // 정의된 파일 경로
}

interface ViewApiMapping {
  viewFile: string;       // 화면 파일 경로
  viewLabel: string;      // 표시용 라벨
  hookName: string;
  endpoint: EndpointInfo;
}

interface ApiFlowItem {
  viewFile: string;
  viewLabel: string;
  triggerApi: string;     // [POST] /tasks
  flowSteps: string[];    // ['API 실행', '상세페이지 이동', '셋업 모달 유지']
}

interface StateFlowItem {
  triggerApi: string;
  invalidatedTags: string[];
  affectedQueries: string[];
  affectedViews: string[];
}

// ─── 메인 진입점 ─────────────────────────────────────────────

export async function analyzeRepoStatically(
  inputUrl: string,
  mode: 'github' | 'local' = 'local',
  analysisType: 'view-api' | 'api-flow' | 'state-flow' = 'view-api'
): Promise<string> {
  const normalizedInput = inputUrl.replace(/\\/g, '/');

  if (mode === 'local') {
    if (!fs.existsSync(inputUrl)) {
      throw new Error('입력하신 로컬 폴더 경로가 존재하지 않습니다.');
    }
    return runStaticAnalysis(normalizedInput, analysisType);
  }

  // GitHub 모드는 기존 analyzer.ts에 위임 (이 파일에서는 로컬만 처리)
  throw new Error('GitHub 모드는 기존 분석기(analyzer.ts)를 사용해 주세요.');
}

// ─── 정적 분석 실행 ─────────────────────────────────────────

async function runStaticAnalysis(
  targetDir: string,
  analysisType: 'view-api' | 'api-flow' | 'state-flow'
): Promise<string> {

  // 모놀레포 감지: /apps/ 가 포함되면 루트를 추론
  let baseDir = targetDir;
  const scanDirs: string[] = [targetDir];
  const appsIndex = targetDir.lastIndexOf('/apps/');
  if (appsIndex !== -1) {
    baseDir = targetDir.substring(0, appsIndex);
    // 공통 패키지 폴더도 스캔 대상에 추가
    for (const folder of ['packages', 'libs', 'shared', 'common']) {
      const sharedPath = path.join(baseDir, folder).replace(/\\/g, '/');
      if (fs.existsSync(sharedPath)) {
        scanDirs.push(sharedPath);
      }
    }
  }

  // 1. 소스 파일 수집
  let allFiles: string[] = [];
  for (const dir of scanDirs) {
    const found = await glob('**/*.{ts,tsx}', {
      cwd: dir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    });
    allFiles = allFiles.concat(found.map(f => path.join(dir, f).replace(/\\/g, '/')));
  }

  // 2. 파일 분류
  const apiFiles = allFiles.filter(f => f.endsWith('.api.ts') || f.includes('/api/'));
  
  const normalizedTargetDir = targetDir.replace(/\\/g, '/');

  // View 파일: 순수하게 UI를 그리는 .tsx 컴포넌트만!
  const viewFiles = allFiles.filter(f => {
    if (!f.startsWith(normalizedTargetDir)) return false; 
    if (!f.endsWith('.tsx')) return false;
    return true;
  });

  // Hook 파일: 로직이 분리된 커스텀 훅 (.ts)
  const hookFiles = allFiles.filter(f => {
    if (!f.startsWith(normalizedTargetDir)) return false; 
    if (!f.endsWith('.ts')) return false;
    if (f.endsWith('.d.ts')) return false;
    if (f.endsWith('.api.ts') || f.endsWith('-api.ts') || f.includes('/api/')) return false;
    if (f.endsWith('index.ts')) return false; 
    if (f.includes('type.ts') || f.includes('types.ts') || f.includes('/types/')) return false;
    if (f.endsWith('.slice.ts')) return false; 
    return true;
  });

  // 3. RTK Query 엔드포인트 추출
  const endpoints = extractAllEndpoints(apiFiles, baseDir);

  // 4. 훅-엔드포인트 매핑 구축
  const hookMap = new Map<string, EndpointInfo>();
  for (const ep of endpoints) {
    hookMap.set(ep.hookName, ep);
  }

  // 5. 분석 타입별 실행
  switch (analysisType) {
    case 'view-api':
      return generateViewApiMarkdown(viewFiles, hookFiles, hookMap, baseDir);
    case 'api-flow':
      return generateApiFlowMarkdown(endpoints, viewFiles, hookMap, baseDir);
    case 'state-flow':
      return generateStateFlowMarkdown(endpoints, viewFiles, hookMap, baseDir);
    case 'scenario':
      return generateScenarioMarkdown(endpoints, viewFiles, hookMap, baseDir);
    default:
      return '알 수 없는 분석 타입입니다.';
  }
}

// ─── RTK Query 엔드포인트 파싱 ─────────────────────────────

function extractAllEndpoints(apiFiles: string[], baseDir: string): EndpointInfo[] {
  const allEndpoints: EndpointInfo[] = [];

  for (const filePath of apiFiles) {
    const code = fs.readFileSync(filePath, 'utf-8');

    // injectEndpoints 패턴이 없으면 RTK Query 파일이 아니므로 스킵
    if (!code.includes('injectEndpoints') && !code.includes('builder.query') && !code.includes('builder.mutation')) {
      continue;
    }

    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');

    // 1) 엔드포인트 블록 추출
    const endpointBlocks = extractEndpointBlocks(code);

    // 2) 훅 이름 추출 (export const { useXxxQuery, ... } = api;)
    const hookExports = extractHookExports(code);

    for (const block of endpointBlocks) {
      const hookName = hookExports.get(block.name) || generateHookName(block.name, block.type);

      allEndpoints.push({
        name: block.name,
        hookName,
        type: block.type,
        method: block.method,
        url: block.url,
        providesTags: block.providesTags,
        invalidatesTags: block.invalidatesTags,
        sourceFile: relPath,
      });
    }
  }

  return allEndpoints;
}

interface EndpointBlock {
  name: string;
  type: 'query' | 'mutation';
  method: string;
  url: string;
  providesTags: string[];
  invalidatesTags: string[];
}

function extractEndpointBlocks(code: string): EndpointBlock[] {
  const blocks: EndpointBlock[] = [];

  // 패턴: endpointName: builder.query<...>({ 또는 builder.mutation<...>({
  const regex = /(\w+):\s*builder\.(query|mutation)\s*<[^>]*>\s*\(\s*\{/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const name = match[1];
    const type = match[2] as 'query' | 'mutation';
    const startIndex = match.index + match[0].length;

    // 중괄호 매칭으로 블록 전체 내용 추출
    const blockContent = extractBracketBlock(code, startIndex - 1); // { 부터 시작

    if (!blockContent) continue;

    // URL 추출
    const url = extractUrl(blockContent);

    // HTTP Method 추출
    const method = extractMethod(blockContent, type);

    // providesTags 추출
    const providesTags = extractTags(blockContent, 'providesTags');

    // invalidatesTags 추출
    const invalidatesTags = extractTags(blockContent, 'invalidatesTags');

    blocks.push({ name, type, method, url, providesTags, invalidatesTags });
  }

  return blocks;
}

/** 중괄호({})를 카운팅하여 매칭되는 블록 전체를 추출 */
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

/** 블록 내에서 url 속성 추출 */
function extractUrl(block: string): string {
  // 패턴 1: url: `/tasks/${taskCode}` 또는 query: (id) => `/tasks/${id}`
  const templateMatch = block.match(/(?:url|query)\s*[:=].*?`([^`]+)`/s);
  if (templateMatch) {
    return templateMatch[1].replace(/\$\{(\w+)\}/g, '{$1}');
  }

  // 패턴 2: url: '/tasks' (문자열 리터럴)
  const stringMatch = block.match(/(?:url|query)\s*[:=].*?['"]([^'"]+)['"]/s);
  if (stringMatch) {
    return stringMatch[1];
  }

  // 패턴 3: 문자열 내에 슬래시(/)가 포함된 경로 형태 찾기 (예: `${baseUrl}/tasks/preset`)
  // 공백이나 줄바꿈이 없는 경로 형태의 문자열을 찾아 URL로 간주
  const fallbackMatch = block.match(/[`'"]([^`'"\n\s]*?\/[^`'"\n\s]+)[`'"]/);
  if (fallbackMatch) {
    let extracted = fallbackMatch[1].replace(/\$\{(\w+)\}/g, '{$1}');
    // {baseUrl} 같은 변수가 앞에 붙은 경우 깔끔하게 / 로 치환
    extracted = extracted.replace(/^\{[a-zA-Z0-9_]+\}\/?/, '/');
    return extracted.startsWith('/') ? extracted : `/${extracted}`;
  }

  // 패턴 4: 그 외 동적 변수나 표현식 (예: url: arg.url)
  const dynamicMatch = block.match(/url:\s*([^,}\n]+)/);
  if (dynamicMatch) {
    return `(동적: ${dynamicMatch[1].trim()})`;
  }

  return '(동적 URL)';
}

/** 블록 내에서 HTTP method 추출 */
function extractMethod(block: string, type: 'query' | 'mutation'): string {
  const methodMatch = block.match(/method:\s*['"](\w+)['"]/);
  if (methodMatch) {
    return methodMatch[1].toUpperCase();
  }
  // 메서드가 명시되지 않은 경우 query=GET, mutation=POST
  return type === 'query' ? 'GET' : 'POST';
}

/** providesTags 또는 invalidatesTags에서 태그 타입 이름들 추출 */
function extractTags(block: string, tagType: 'providesTags' | 'invalidatesTags'): string[] {
  const tags: string[] = [];

  // tagType 키워드 위치 찾기
  const tagIndex = block.indexOf(tagType);
  if (tagIndex === -1) return tags;

  // tagType 이후의 관련 코드 영역 추출 (다음 속성이나 블록 끝까지)
  const afterTag = block.substring(tagIndex);
  // 다음 최상위 속성(줄 시작의 key:)이나 })가 나올때까지
  const tagSection = afterTag.substring(0, findNextPropertyOrEnd(afterTag));

  // 패턴 1: { type: 'Task', id: ... }
  const typeMatches = tagSection.matchAll(/type:\s*['"](\w+)['"]/g);
  for (const m of typeMatches) {
    if (!tags.includes(m[1])) tags.push(m[1]);
  }

  // 패턴 2: 'BTTask' (단순 문자열 태그)
  const stringMatches = tagSection.matchAll(/(?<!\w)['"]([A-Z]\w+)['"]/g);
  for (const m of stringMatches) {
    // type: 에 이미 매치된 것 제외, 실제 태그인지 필터링
    if (!tags.includes(m[1]) && m[1] !== tagType && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m[1])) {
      tags.push(m[1]);
    }
  }

  return tags;
}

/** 다음 최상위 속성이 시작되는 위치를 찾음 */
function findNextPropertyOrEnd(code: string): number {
  // 첫 줄(tagType 자체)을 넘기고, 그 이후 depth=0인 쉼표나 닫는 괄호를 찾음
  let depth = 0;
  let i = code.indexOf(':'); // tagType: 의 : 이후부터
  if (i === -1) return code.length;
  i++;

  for (; i < code.length; i++) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return i;
      depth--;
    } else if (ch === ',' && depth === 0) {
      return i;
    }
  }
  return code.length;
}

/** export const { useXxxQuery, ... } = scenarioApi; 에서 훅 이름 → 엔드포인트 이름 매핑 */
function extractHookExports(code: string): Map<string, string> {
  const map = new Map<string, string>(); // endpointName → hookName

  // 여러 줄에 걸친 export const { ... } = api; 패턴
  const exportMatch = code.match(/export\s+const\s*\{([^}]+)\}/s);
  if (!exportMatch) return map;

  const hooks = exportMatch[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('//'));

  for (const hookName of hooks) {
    const cleanHook = hookName.replace(/\s+/g, '');
    // useGetTaskQuery → getTask, useCreateScenarioMutation → createScenario
    const endpointName = hookToEndpointName(cleanHook);
    if (endpointName) {
      map.set(endpointName, cleanHook);
    }
  }

  return map;
}

/** 훅 이름에서 엔드포인트 이름을 역추론 */
function hookToEndpointName(hookName: string): string | null {
  // useLazyGetXxxQuery → getXxx
  let name = hookName.replace(/^useLazy/, 'use');
  // useGetTaskQuery → getTask
  const queryMatch = name.match(/^use(\w+)Query$/);
  if (queryMatch) {
    return queryMatch[1].charAt(0).toLowerCase() + queryMatch[1].slice(1);
  }
  // useCreateScenarioMutation → createScenario
  const mutationMatch = name.match(/^use(\w+)Mutation$/);
  if (mutationMatch) {
    return mutationMatch[1].charAt(0).toLowerCase() + mutationMatch[1].slice(1);
  }
  return null;
}

/** 엔드포인트 이름으로 훅 이름 자동 생성 (export에서 못 찾은 경우 폴백) */
function generateHookName(endpointName: string, type: 'query' | 'mutation'): string {
  const capitalized = endpointName.charAt(0).toUpperCase() + endpointName.slice(1);
  return type === 'query' ? `use${capitalized}Query` : `use${capitalized}Mutation`;
}

// ─── 1. View-API 매핑 생성 ──────────────────────────────────

function generateViewApiMarkdown(
  viewFiles: string[],
  hookFiles: string[],
  hookMap: Map<string, EndpointInfo>,
  baseDir: string
): string {
  // 1. 커스텀 훅 파일(.ts)이 어떤 RTK Query 엔드포인트를 쓰는지 매핑
  const customHookToEndpoints = new Map<string, EndpointInfo[]>();
  for (const filePath of hookFiles) {
    const code = safeReadFile(filePath);
    if (!code) continue;
    
    const usedEndpoints: EndpointInfo[] = [];
    for (const [hookName, endpoint] of hookMap) {
       const regex = new RegExp(`\\b${hookName}\\s*(?:\\(|<)`);
       if (regex.test(code)) {
         usedEndpoints.push(endpoint);
       }
    }
    if (usedEndpoints.length > 0) {
      customHookToEndpoints.set(filePath, usedEndpoints);
    }
  }

  // 2. View 파일(.tsx) 분석
  const mappings: ViewApiMapping[] = [];

  for (const filePath of viewFiles) {
    const code = safeReadFile(filePath);
    if (!code) continue;

    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const viewLabel = formatViewLabel(relPath, fileName);

    // a) RTK Query 직접 호출
    for (const [hookName, endpoint] of hookMap) {
      const hookUsageRegex = new RegExp(`\\b${hookName}\\s*(?:\\(|<)`);
      if (hookUsageRegex.test(code)) {
        mappings.push({
          viewFile: relPath,
          viewLabel,
          hookName,
          endpoint,
        });
      }
    }

    // b) 커스텀 훅(.ts)을 통한 간접 호출 탐지
    for (const [hookFilePath, endpoints] of customHookToEndpoints) {
      const hookBaseName = path.basename(hookFilePath, '.ts'); // ex) use-modal-actions
      const camelHookName = hookBaseName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // ex) useModalActions
      
      // 실제로 이 훅을 "호출"하는지 확인 (import type만 있는 건 무시!)
      // 1) import type { ... } from '...use-modal-actions' → 타입만 가져온 것 (무시해야 함)
      // 2) import { useModalActions } from '...' → 실제 함수 import (유효!)
      // 3) const { ... } = useModalActions() → 실제 호출 (유효!)
      
      // import type만 있는지 체크: "import type"으로 시작하는 줄에서만 등장하면 skip
      const lines = code.split('\n');
      let hasRealUsage = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        // import type 문은 건너뜀
        if (trimmed.startsWith('import type ')) continue;
        // 타입 어노테이션(: UseModalActionsReturn)도 건너뜀
        if (trimmed.includes(`: ${camelHookName}`) || trimmed.includes(`: ${hookBaseName}`)) continue;
        // 인터페이스/타입 정의 내부의 타입 참조도 건너뜀
        const typeRefRegex = new RegExp(`:\\s*${camelHookName}(Return)?[;,\\s]`);
        if (typeRefRegex.test(trimmed)) continue;
        
        // 실제 훅 호출 패턴: useModalActions( 또는 from '../hooks/use-modal-actions'
        if (trimmed.includes(`${camelHookName}(`) || 
            (trimmed.includes(hookBaseName) && trimmed.startsWith('import ') && !trimmed.startsWith('import type '))) {
          hasRealUsage = true;
          break;
        }
      }
      
      if (hasRealUsage) {
        for (const endpoint of endpoints) {
          // 중복 추가 방지
          if (!mappings.some(m => m.viewFile === relPath && m.endpoint.name === endpoint.name)) {
            mappings.push({
              viewFile: relPath,
              viewFile: relPath,
              viewLabel: viewLabel,
              hookName: camelHookName,
              endpoint,
            });
          }
        }
      }
    }
  }

  if (mappings.length === 0) {
    return '## 🔌 화면별 API 매핑 (View-API Mapping)\n\n> RTK Query 훅 사용이 발견되지 않았습니다.\n';
  }

  // 마크다운 표 생성
  let md = '## 🔌 화면별 API 매핑 (View-API Mapping)\n\n';
  md += '| 화면 (경로 또는 UI 컴포넌트) | 호출 API (Swagger 형식) | 목적/설명 |\n';
  md += '|---|---|---|\n';

  // 화면별로 그룹핑하여 정렬 (알파벳순)
  const grouped = groupBy(mappings, m => m.viewLabel);
  const sortedKeys = Array.from(grouped.keys()).sort();
  for (const viewLabel of sortedKeys) {
    const items = grouped.get(viewLabel)!;
    let isFirst = true;
    for (const item of items) {
      const apiStr = `\`[${item.endpoint.method}] ${item.endpoint.url}\``;
      const desc = generateDescription(item.endpoint);
      const displayLabel = isFirst ? `**\`${viewLabel}\`**` : `〃`;
      md += `| ${displayLabel} | ${apiStr} | ${desc} |\n`;
      isFirst = false;
    }
  }

  return md;
}

// ─── 2. API Flow 생성 ───────────────────────────────────────

function generateApiFlowMarkdown(
  endpoints: EndpointInfo[],
  viewFiles: string[],
  hookMap: Map<string, EndpointInfo>,
  baseDir: string
): string {
  // tag → 영향을 받는 query 매핑 사전 (자동 갱신 추론용)
  const tagToQueries = new Map<string, EndpointInfo[]>();
  for (const ep of endpoints) {
    if (ep.type === 'query' && ep.providesTags.length > 0) {
      for (const tag of ep.providesTags) {
        if (!tagToQueries.has(tag)) tagToQueries.set(tag, []);
        tagToQueries.get(tag)!.push(ep);
      }
    }
  }

  const flows: ApiFlowItem[] = [];

  for (const filePath of viewFiles) {
    const code = safeReadFile(filePath);
    if (!code) continue;

    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const viewLabel = formatViewLabel(relPath, fileName);

    // .unwrap() 호출이 있는 파일만 분석
    if (!code.includes('.unwrap()')) continue;

    // 이 파일에서 사용 중인 mutation 및 query 훅 식별
    const usedMutations: EndpointInfo[] = [];
    const usedQueries: EndpointInfo[] = [];
    for (const [hookName, endpoint] of hookMap) {
      if (code.includes(hookName)) {
        if (endpoint.type === 'mutation') usedMutations.push(endpoint);
        if (endpoint.type === 'query') usedQueries.push(endpoint);
      }
    }

    if (usedMutations.length === 0) continue;

    // .unwrap() 뒤에 이어지는 UI 액션 패턴 탐지
    // 코드를 줄 단위로 분석하여 unwrap 이후의 패턴을 찾음
    const lines = code.split('\n');
    let currentMutationContext: EndpointInfo | null = null;
    let flowSteps: string[] = [];
    let inUnwrapBlock = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // mutation 변수 사용 감지 (예: await createTask().unwrap())
      if (line.includes('.unwrap()')) {
        // 어떤 mutation의 unwrap인지 식별
        for (const mut of usedMutations) {
          // endpointName을 카멜케이스로 변환하여 변수명으로 매칭
          const varPatterns = [mut.name, hookToVarName(mut.hookName)];
          if (varPatterns.some(v => v && line.includes(v))) {
            currentMutationContext = mut;
            flowSteps = [`**[${mut.method}] ${mut.url} 호출**`];
            inUnwrapBlock = true;
            braceDepth = 0;
            break;
          }
        }
        // 특정 mutation 매칭 실패 시, 첫번째 mutation으로 폴백
        if (!currentMutationContext && usedMutations.length > 0) {
          currentMutationContext = usedMutations[0];
          flowSteps = [`**[${currentMutationContext.method}] ${currentMutationContext.url} 호출**`];
          inUnwrapBlock = true;
          braceDepth = 0;
        }
      }

      if (inUnwrapBlock && currentMutationContext) {
        // 불필요한 UI 동작(모달 닫기, 알림 등)은 기획 관점에서 노이즈가 되므로 제거
        // 오로지 API -> API 연쇄 흐름만 추출합니다.

        // 수동 refetch 호출 감지 (최대 1개만 기록)
        const refetchMatch = line.match(/refetch(\w*)\(/);
        if (refetchMatch && !flowSteps.some(s => s.includes('수동 갱신'))) {
          const queryName = refetchMatch[1];
          if (queryName) {
            let foundEp = hookMap.get(`use${queryName}Query`) || hookMap.get(`useGet${queryName}Query`);
            if (!foundEp) {
              for (const [hName, ep] of hookMap) {
                if (ep.type === 'query' && hName.toLowerCase().includes(queryName.toLowerCase())) {
                  foundEp = ep;
                  break;
                }
              }
            }
            if (foundEp) {
              flowSteps.push(`**[GET] ${foundEp.url} 수동 갱신**`);
            } else {
              flowSteps.push(`**[GET] ${queryName} 수동 갱신**`);
            }
          } else {
            flowSteps.push(`**[GET] 연관 데이터 수동 갱신**`);
          }
        }

        // 블록 종료 감지 (try-catch의 } catch 등)
        if (line.includes('} catch') || line.includes('} finally')) {
          if (currentMutationContext && flowSteps.length > 0) {
            // RTK Query invalidatesTags로 인한 자동 연계 API 추가 (대표 1개만)
            let autoAdded = false;
            for (const tag of currentMutationContext.invalidatesTags) {
               if (autoAdded) break;
               const queries = tagToQueries.get(tag) || [];
               for (const q of queries) {
                 if (usedQueries.some(uq => uq.name === q.name)) {
                   flowSteps.push(`**[GET] ${q.url} 자동 갱신**`);
                   autoAdded = true;
                   break;
                 }
               }
            }
            
            // 현재 화면에서 갱신되는 쿼리가 없다면 가장 대표적인 1개만 노출
            if (!autoAdded && currentMutationContext.invalidatesTags.length > 0) {
               const firstTag = currentMutationContext.invalidatesTags[0];
               const firstQuery = (tagToQueries.get(firstTag) || [])[0];
               if (firstQuery) {
                 flowSteps.push(`**[GET] ${firstQuery.url} 등 백그라운드 갱신**`);
               }
            }

            if (flowSteps.length > 1) {
              flows.push({
                viewFile: relPath,
                viewLabel,
                triggerApi: `\`[${currentMutationContext.method}] ${currentMutationContext.url}\``,
                flowSteps: [...flowSteps],
              });
            }
          }
          currentMutationContext = null;
          flowSteps = [];
          inUnwrapBlock = false;
        }
      }
    }

    // 블록이 끝나지 않은 채 파일이 끝난 경우
    if (currentMutationContext && flowSteps.length > 0) {
      // RTK Query invalidatesTags로 인한 자동 연계 API 추가 (대표 1개만)
      let autoAdded = false;
      for (const tag of currentMutationContext.invalidatesTags) {
         if (autoAdded) break;
         const queries = tagToQueries.get(tag) || [];
         for (const q of queries) {
           if (usedQueries.some(uq => uq.name === q.name)) {
             flowSteps.push(`**[GET] ${q.url} 자동 갱신**`);
             autoAdded = true;
             break;
           }
         }
      }
      
      if (!autoAdded && currentMutationContext.invalidatesTags.length > 0) {
         const firstTag = currentMutationContext.invalidatesTags[0];
         const firstQuery = (tagToQueries.get(firstTag) || [])[0];
         if (firstQuery) {
           flowSteps.push(`**[GET] ${firstQuery.url} 등 백그라운드 갱신**`);
         }
      }

      if (flowSteps.length > 1) {
        flows.push({
          viewFile: relPath,
          viewLabel,
          triggerApi: `\`[${currentMutationContext.method}] ${currentMutationContext.url}\``,
          flowSteps: [...flowSteps],
        });
      }
    }
  }

  if (flows.length === 0) {
    return '## 🔄 API 연계 흐름 (Cross-Screen Flow)\n\n> API 호출 후 연계 동작이 발견되지 않았습니다.\n';
  }

  // 중복 제거
  const uniqueFlows = deduplicateFlows(flows);

  let md = '## 🔄 API 연계 흐름 (Cross-Screen Flow)\n\n';
  md += '| 시작 화면 | API | 연계 흐름 (Flow) |\n';
  md += '|---|---|---|\n';

  // 시작 화면 기준 그룹핑
  const groupedFlows = groupBy(uniqueFlows, f => f.viewLabel);
  const sortedFlowKeys = Array.from(groupedFlows.keys()).sort();

  for (const viewLabel of sortedFlowKeys) {
    const items = groupedFlows.get(viewLabel)!;
    let isFirst = true;
    for (const flow of items) {
      const flowStr = flow.flowSteps.join(' ➡️ ');
      const displayLabel = isFirst ? `**\`${flow.viewLabel}\`**` : `〃`;
      md += `| ${displayLabel} | ${flow.triggerApi} | ${flowStr} |\n`;
      isFirst = false;
    }
  }

  return md;
}

// ─── 3. State Flow 생성 ─────────────────────────────────────

function generateStateFlowMarkdown(
  endpoints: EndpointInfo[],
  viewFiles: string[],
  hookMap: Map<string, EndpointInfo>,
  baseDir: string
): string {
  const stateFlows: StateFlowItem[] = [];

  // mutation 중 invalidatesTags가 있는 것만 추출
  const mutations = endpoints.filter(ep => ep.type === 'mutation' && ep.invalidatesTags.length > 0);

  // query 중 providesTags가 있는 것을 태그별로 인덱싱
  const tagToQueries = new Map<string, EndpointInfo[]>();
  for (const ep of endpoints) {
    if (ep.type === 'query' && ep.providesTags.length > 0) {
      for (const tag of ep.providesTags) {
        if (!tagToQueries.has(tag)) tagToQueries.set(tag, []);
        tagToQueries.get(tag)!.push(ep);
      }
    }
  }

  // 각 화면 파일에서 어떤 query 훅을 사용하는지 맵 구축
  const queryToViews = new Map<string, string[]>(); // hookName → viewLabels[]
  for (const filePath of viewFiles) {
    const code = safeReadFile(filePath);
    if (!code) continue;
    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const viewLabel = formatViewLabel(relPath, fileName);

    for (const [hookName, endpoint] of hookMap) {
      if (endpoint.type === 'query' && code.includes(hookName)) {
        if (!queryToViews.has(hookName)) queryToViews.set(hookName, []);
        const views = queryToViews.get(hookName)!;
        if (!views.includes(viewLabel)) views.push(viewLabel);
      }
    }
  }

  // mutation → invalidatesTags → 영향받는 query → 영향받는 화면 연결
  for (const mut of mutations) {
    const affectedQueries: string[] = [];
    const affectedViews: string[] = [];

    for (const tag of mut.invalidatesTags) {
      const queries = tagToQueries.get(tag) || [];
      for (const q of queries) {
        if (!affectedQueries.includes(q.hookName)) {
          affectedQueries.push(q.hookName);
        }
        const views = queryToViews.get(q.hookName) || [];
        for (const v of views) {
          if (!affectedViews.includes(v)) affectedViews.push(v);
        }
      }
    }

    stateFlows.push({
      triggerApi: `\`[${mut.method}] ${mut.url}\``,
      invalidatedTags: mut.invalidatesTags,
      affectedQueries,
      affectedViews,
    });
  }

  if (stateFlows.length === 0) {
    return '## 📦 상태 관리 흐름 (State Update Flow)\n\n> RTK Query 캐시 무효화 패턴이 발견되지 않았습니다.\n';
  }

  let md = '## 📦 상태 관리 흐름 (State Update Flow)\n\n';
  md += '| API (Mutation) | 연계 흐름 (Cache Update Flow) |\n';
  md += '|---|---|\n';

  // API 기준 정렬
  stateFlows.sort((a, b) => a.triggerApi.localeCompare(b.triggerApi));
  
  let lastTriggerApi = '';
  for (const flow of stateFlows) {
    const tagsStr = flow.invalidatedTags.map(t => `\`${t}\``).join(', ');
    const viewsStr = flow.affectedViews.length > 0
      ? flow.affectedViews.map(v => `\`${v}\``).join(', ') + ' 자동 리렌더링'
      : '(사용처 미발견)';
      
    const displayLabel = (flow.triggerApi === lastTriggerApi) ? `〃` : flow.triggerApi;
    md += `| ${displayLabel} | **API 실행** ➡️ **${tagsStr} 캐시 무효화** ➡️ **${viewsStr}** |\n`;
    lastTriggerApi = flow.triggerApi;
  }

  return md;
}

// ─── 유틸리티 함수들 ─────────────────────────────────────────

function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** 파일 경로를 표시용 라벨로 변환 */
function formatViewLabel(relPath: string, fileName: string): string {
  // src/... 부터 보여주기 위해 경로 축소
  const srcIndex = relPath.indexOf('src/');
  if (srcIndex !== -1) {
    return relPath.substring(srcIndex);
  }
  return relPath;
}

/** 엔드포인트 이름에서 설명 자동 생성 */
function generateDescription(ep: EndpointInfo): string {
  const name = ep.name;
  // camelCase를 분리하여 한국어 설명 생성
  const words = name.replace(/([A-Z])/g, ' $1').toLowerCase().trim().split(' ');

  const actionMap: Record<string, string> = {
    get: '조회', create: '생성', update: '수정', delete: '삭제',
    save: '저장', execute: '실행', test: '테스트', ignore: '무시',
    complete: '완료', connect: '연결', change: '변경',
  };

  const action = actionMap[words[0]] || words[0];
  const target = words.slice(1).join(' ');

  return `${target} ${action}`;
}

/** use 훅 이름을 변수명으로 변환 (useCreateTaskMutation → createTask) */
function hookToVarName(hookName: string): string | null {
  const m = hookName.match(/^use(\w+?)(Query|Mutation)$/);
  if (m) return m[1].charAt(0).toLowerCase() + m[1].slice(1);
  return null;
}

/** camelCase를 한국어 라벨로 변환 */
function camelToKorean(str: string): string {
  // AddDialogOpen → 추가 다이얼로그
  // CompleteModalOpen → 완료 모달
  const words = str.replace(/([A-Z])/g, ' $1').trim().split(' ').map(w => w.toLowerCase());

  const koreanMap: Record<string, string> = {
    add: '추가', dialog: '다이얼로그', open: '', close: '',
    modal: '모달', filter: '필터', complete: '완료',
    scenario: '시나리오', form: '폼', visible: '',
    setup: '셋업', detail: '상세',
  };

  return words.map(w => koreanMap[w] ?? w).filter(w => w.length > 0).join(' ');
}

/** modal 메서드명을 한국어로 변환 */
function getModalLabel(method: string): string {
  const map: Record<string, string> = {
    info: '안내', delete: '삭제 확인', confirm: '확인',
    warning: '경고', success: '성공',
  };
  return map[method] || method;
}

/** 배열을 키 기준으로 그룹핑 */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

/** API Flow 중복 제거 */
function deduplicateFlows(flows: ApiFlowItem[]): ApiFlowItem[] {
  const seen = new Set<string>();
  return flows.filter(f => {
    const key = `${f.viewLabel}|${f.triggerApi}|${f.flowSteps.join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── 4. 시나리오 추천 생성 (AI 배제) ──────────────────────────

function generateScenarioMarkdown(
  endpoints: EndpointInfo[],
  viewFiles: string[],
  hookMap: Map<string, EndpointInfo>,
  baseDir: string
): string {
  const tagToQueries = new Map<string, EndpointInfo[]>();
  for (const ep of endpoints) {
    if (ep.type === 'query' && ep.providesTags.length > 0) {
      for (const tag of ep.providesTags) {
        if (!tagToQueries.has(tag)) tagToQueries.set(tag, []);
        tagToQueries.get(tag)!.push(ep);
      }
    }
  }

  interface ScenarioItem {
    viewLabel: string;
    triggerApi: string;
    flowSteps: string[];
    purpose: string;
  }
  const flows: ScenarioItem[] = [];

  for (const filePath of viewFiles) {
    const code = safeReadFile(filePath);
    if (!code) continue;

    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const viewLabel = formatViewLabel(relPath, fileName);

    if (!code.includes('.unwrap()')) continue;

    const usedMutations: EndpointInfo[] = [];
    const usedQueries: EndpointInfo[] = [];
    for (const [hookName, endpoint] of hookMap) {
      if (code.includes(hookName)) {
        if (endpoint.type === 'mutation') usedMutations.push(endpoint);
        if (endpoint.type === 'query') usedQueries.push(endpoint);
      }
    }

    if (usedMutations.length === 0) continue;

    const lines = code.split('\n');
    let currentMutationContext: EndpointInfo | null = null;
    let flowSteps: string[] = [];
    let inUnwrapBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('.unwrap()')) {
        for (const mut of usedMutations) {
          const varPatterns = [mut.name, hookToVarName(mut.hookName)];
          if (varPatterns.some(v => v && line.includes(v))) {
            currentMutationContext = mut;
            flowSteps = [`**[${mut.method}]** \`${mut.url}\` 호출`];
            inUnwrapBlock = true;
            break;
          }
        }
        if (!currentMutationContext && usedMutations.length > 0) {
          currentMutationContext = usedMutations[0];
          flowSteps = [`**[${currentMutationContext.method}]** \`${currentMutationContext.url}\` 호출`];
          inUnwrapBlock = true;
        }
      }

      if (inUnwrapBlock && currentMutationContext) {
        const refetchMatch = line.match(/refetch(\w*)\(/);
        if (refetchMatch && !flowSteps.some(s => s.includes('수동 갱신'))) {
          const queryName = refetchMatch[1];
          if (queryName) {
            let foundEp = hookMap.get(`use${queryName}Query`) || hookMap.get(`useGet${queryName}Query`);
            if (!foundEp) {
              for (const [hName, ep] of hookMap) {
                if (ep.type === 'query' && hName.toLowerCase().includes(queryName.toLowerCase())) {
                  foundEp = ep;
                  break;
                }
              }
            }
            if (foundEp) {
              flowSteps.push(`**[GET]** \`${foundEp.url}\` 수동 갱신`);
            } else {
              flowSteps.push(`**[GET]** \`${queryName}\` 수동 갱신`);
            }
          } else {
            flowSteps.push(`**[GET]** 연관 데이터 수동 갱신`);
          }
        }

        if (line.includes('} catch') || line.includes('} finally')) {
          if (currentMutationContext && flowSteps.length > 0) {
            let autoAdded = false;
            for (const tag of currentMutationContext.invalidatesTags) {
               if (autoAdded) break;
               const queries = tagToQueries.get(tag) || [];
               for (const q of queries) {
                 if (usedQueries.some(uq => uq.name === q.name)) {
                   flowSteps.push(`**[GET]** \`${q.url}\` 자동 갱신`);
                   autoAdded = true;
                   break;
                 }
               }
            }
            if (!autoAdded && currentMutationContext.invalidatesTags.length > 0) {
               const firstTag = currentMutationContext.invalidatesTags[0];
               const firstQuery = (tagToQueries.get(firstTag) || [])[0];
               if (firstQuery) {
                 flowSteps.push(`**[GET]** \`${firstQuery.url}\` 등 백그라운드 갱신`);
               }
            }

            if (flowSteps.length > 1) {
              flows.push({
                viewLabel,
                triggerApi: `\`[${currentMutationContext.method}] ${currentMutationContext.url}\``,
                flowSteps: [...flowSteps],
                purpose: generateDescription(currentMutationContext) + ' 시나리오'
              });
            }
          }
          currentMutationContext = null;
          flowSteps = [];
          inUnwrapBlock = false;
        }
      }
    }

    if (currentMutationContext && flowSteps.length > 0) {
      let autoAdded = false;
      for (const tag of currentMutationContext.invalidatesTags) {
         if (autoAdded) break;
         const queries = tagToQueries.get(tag) || [];
         for (const q of queries) {
           if (usedQueries.some(uq => uq.name === q.name)) {
             flowSteps.push(`**[GET]** \`${q.url}\` 자동 갱신`);
             autoAdded = true;
             break;
           }
         }
      }
      if (!autoAdded && currentMutationContext.invalidatesTags.length > 0) {
         const firstTag = currentMutationContext.invalidatesTags[0];
         const firstQuery = (tagToQueries.get(firstTag) || [])[0];
         if (firstQuery) {
           flowSteps.push(`**[GET]** \`${firstQuery.url}\` 등 백그라운드 갱신`);
         }
      }

      if (flowSteps.length > 1) {
        flows.push({
          viewLabel,
          triggerApi: `\`[${currentMutationContext.method}] ${currentMutationContext.url}\``,
          flowSteps: [...flowSteps],
          purpose: generateDescription(currentMutationContext) + ' 시나리오'
        });
      }
    }
  }

  if (flows.length === 0) {
    return '## 💡 시나리오 추천\n\n> 추출된 시나리오 흐름이 없습니다.\n';
  }

  const seen = new Set<string>();
  const uniqueFlows = flows.filter(f => {
    const key = `${f.viewLabel}|${f.triggerApi}|${f.flowSteps.join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let md = '## 💡 시나리오 흐름 (Sequence)\n\n';
  md += '| 시작 화면 | 트리거 API | 전체 시나리오 흐름 (Sequence) | 목적/설명 |\n';
  md += '|---|---|---|---|\n';

  const groupedFlows = groupBy(uniqueFlows, f => f.viewLabel);
  const sortedFlowKeys = Array.from(groupedFlows.keys()).sort();

  for (const viewLabel of sortedFlowKeys) {
    const items = groupedFlows.get(viewLabel)!;
    let isFirst = true;
    for (const flow of items) {
      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
      const flowSequenceStr = flow.flowSteps
        .map((step, idx) => `${emojis[Math.min(idx, emojis.length - 1)]} ${step}`)
        .join(' ⬇️ ');

      const displayLabel = isFirst ? `**\`${flow.viewLabel}\`**` : `〃`;
      md += `| ${displayLabel} | ${flow.triggerApi} | ${flowSequenceStr} | ${flow.purpose} |\n`;
      isFirst = false;
    }
  }

  return md;
}
