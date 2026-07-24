import { detectFramework } from '../adapters';
import { parseFile } from './parser/ast-parser';
import { findApiCalls, findScenarios, getLocalDependencies, findNavigationTargets } from './parser/ast-traverser';
import { MappingResult, HookResolver, ScenarioFlow, E2EScenario, E2EStep } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Resolver 임포트
import { RtkQueryResolver } from '../resolvers/rtk-query-resolver';
import { ReactQueryResolver } from '../resolvers/react-query-resolver';
import { SwrResolver } from '../resolvers/swr-resolver';
import { AxiosFetchResolver } from '../resolvers/axios-fetch-resolver';

/**
 * plan-v5.md 2장 아키텍처: 핵심 분석 파이프라인 오케스트레이터
 */
export class Analyzer {
  private resolvers: HookResolver[] = [];

  async run(targetDir: string): Promise<{ results: MappingResult[]; scenarios: ScenarioFlow[]; routeScenarios: any[] }> {
    // [1단계] 프레임워크 판별 및 Adapter 로드 (plan-v5.md 2장 1단계)
    const adapter = await detectFramework(targetDir);
    if (!adapter) {
      throw new Error(
        '지원하지 않는 프레임워크이거나 package.json이 없습니다.\n' +
        '현재 Phase 1에서는 React 및 Next.js 프로젝트만 분석 가능합니다.'
      );
    }

    // [2단계] package.json 의존성 분석 → 필요한 Resolver만 동적 로드 (최적화)
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    this.resolvers = [];

    // RTK Query: 사전 학습(init)이 필요하므로 최우선 등록 (plan-v5.md 4장)
    if (deps['@reduxjs/toolkit'] || deps['@rtk-query/core']) {
      console.log('[Analyzer] RTK Query Resolver 로드됨');
      this.resolvers.push(new RtkQueryResolver());
    }
    if (deps['@tanstack/react-query'] || deps['react-query']) {
      console.log('[Analyzer] React Query Resolver 로드됨');
      this.resolvers.push(new ReactQueryResolver());
    }
    if (deps['swr']) {
      console.log('[Analyzer] SWR Resolver 로드됨');
      this.resolvers.push(new SwrResolver());
    }
    // Axios/Fetch: 항상 기본 탑재 (가장 마지막 — 저수준 Fallback)
    this.resolvers.push(new AxiosFetchResolver());

    // [3단계] 플러그인 초기화 (RTK Query는 파일 사전 스캔으로 이름표 사전 구축)
    for (const resolver of this.resolvers) {
      if (resolver.init) {
        await resolver.init(targetDir);
      }
    }

    // [4단계] 파일 스캔 (Adapter가 프레임워크 규칙에 맞게 대상 파일 목록 반환)
    const files = await adapter.getFilesToAnalyze();
    if (files.length === 0) {
      return [];
    }

    const results: MappingResult[] = [];
    const scenarios: ScenarioFlow[] = [];
    const seen = new Set<string>();

    // [5단계] 파일별 AST 파싱 및 범용 심볼 역추적 (Symbol Tracing) 순회
    for (const filePath of files) {
      const ast = parseFile(filePath);
      if (!ast) continue;

      const callType = adapter.getCallType(filePath);
      // 범용 심볼 역추적(filePath, targetDir) 활성화
      const apiCalls = findApiCalls(ast, this.resolvers, filePath, targetDir);

      const relativePath = path.relative(targetDir, filePath);
      const viewName = path.basename(filePath, path.extname(filePath));

      for (const call of apiCalls) {
        const dedupeKey = `${relativePath}:${call.method}:${call.endpoint}:${call.calleeName ?? ''}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
          file: relativePath.replace(/\\/g, '/'),
          viewName,
          callType,
          api: call,
        });
      }

      // 시나리오 흐름 분석
      const fileScenarios = findScenarios(ast, this.resolvers, filePath, targetDir);
      scenarios.push(...fileScenarios);
    }
    // [6단계] Route(화면) 단위 시나리오 병합 (Roll-up)
    // 코어에는 프레임워크 종속 코드가 없습니다.
    // 어댑터가 getRouteEntryPoints를 구현한 경우에만 실행됩니다 (코어 로직 무해안성 보장).
    const routeScenarios: { route: string; entryFile: string; files: string[]; scenarios: ScenarioFlow[] }[] = [];

    if (adapter.getRouteEntryPoints) {
      const entryPoints = adapter.getRouteEntryPoints(files);
      const routeMap = new Map<string, { files: Set<string>; scenarios: Map<string, ScenarioFlow>; entryFiles: string[] }>();

      for (const entry of entryPoints) {
        // 해당 라우트 진입점에서 시작하여 AST import 구문을 재귀적으로 추적,
        // 화면에 실제로 렌더링되는 모든 컴포넌트의 집합을 수집합니다.
        const deps = new Set<string>();
        deps.add(entry.filePath);

        const collectDeps = (filePath: string) => {
          const localDeps = getLocalDependencies(filePath, targetDir);
          for (const dep of localDeps) {
            if (!deps.has(dep)) {
              deps.add(dep); // 소환했던 컴포넌트의 손자 컴포넌트들도 계속 추적
              collectDeps(dep);
            }
          }
        };
        collectDeps(entry.filePath);

        // 절대경로 목록을 프론트엔드에 전달하기 쉽게 상대경로로 변환
        const routeFiles = Array.from(deps).map(f => path.relative(targetDir, f).replace(/\\/g, '/'));

        // 5단계에서 추출한 전체 시나리오 중 이 라우트의 의존성 트리에 속하는 것들만 필터링
        const scenariosForRoute = scenarios.filter(sc => routeFiles.includes(sc.file));

        if (scenariosForRoute.length > 0) {
          if (!routeMap.has(entry.routePath)) {
            routeMap.set(entry.routePath, { files: new Set(), scenarios: new Map(), entryFiles: [] });
          }
          const group = routeMap.get(entry.routePath)!;
          
          group.entryFiles.push(path.relative(targetDir, entry.filePath).replace(/\\/g, '/'));
          routeFiles.forEach(f => group.files.add(f));
          
          // 시나리오 중복 방지 (같은 파일의 같은 라인 시나리오는 덮어쓰기)
          scenariosForRoute.forEach(sc => {
            const key = `${sc.file}:${sc.line}:${sc.triggerSource}`;
            group.scenarios.set(key, sc);
          });
        }
      }

      for (const [route, group] of routeMap.entries()) {
        routeScenarios.push({
          route,
          // 여러 진입점(layout.tsx, page.tsx)이 병합된 경우 콤마로 연결
          entryFile: group.entryFiles.join(', '),
          files: Array.from(group.files),
          scenarios: Array.from(group.scenarios.values()).sort((a, b) => {
            if (a.file === b.file) return (a.line || 0) - (b.line || 0);
            return a.file.localeCompare(b.file);
          })
        });
      }
    }

    // ── [7단계] E2E 시나리오 조립 (Post-Processing) ─────────────────
    // 기존 1번 탭(results), 2번 탭(scenarios), 3번 탭 단일 라우트(routeScenarios)에는
    // 아무런 영향 없이, 완성된 routeScenarios 데이터 위에 시나리오 맵을 덧씌웁니다.
    if (routeScenarios.length > 0) {
      // 7-1. 라우트별 네비게이션 대상 URL 수집 (AST에서 독립 추출)
      //      각 라우트에 속하는 파일들을 순회하며 findNavigationTargets() 호출
      const routeNavMap = new Map<string, Set<string>>(); // route -> Set<이동 URL>

      for (const rs of routeScenarios) {
        const navUrls = new Set<string>();
        for (const relFile of rs.files) {
          const absFile = path.join(targetDir, relFile);
          const navAst = parseFile(absFile);
          if (!navAst) continue;
          const targets = findNavigationTargets(navAst);
          targets.forEach(u => navUrls.add(u));
        }
        routeNavMap.set(rs.route, navUrls);
      }

      // 7-2. 범용 경로 매칭 함수: 동적 세그먼트([id], :id)를 무시하고 패턴 비교
      //      예: '/products/' 와 '/products/[id]' → 일치
      function routeMatchesUrl(routePath: string, navUrl: string): boolean {
        // 동적 세그먼트 토큰(예: [id], :id)을 '*'로 치환 후 비교
        const routePattern = routePath
          .replace(/\[([^\]]+)\]/g, '*')   // Next.js: [id] → *
          .replace(/:([^\/]+)/g, '*');       // React Router: :id → *

        const urlNormalized = navUrl.replace(/\/+$/, ''); // 끝 슬래시 제거
        const routeNormalized = routePattern.replace(/\/+$/, '');

        if (routeNormalized === urlNormalized) return true;

        // 동적 라우트인 경우 접두사 매칭 (예: '/products/' 는 '/products/[id]' 에 해당)
        if (routePattern.includes('*')) {
          const prefix = routePattern.split('*')[0].replace(/\/+$/, '');
          if (prefix && urlNormalized.startsWith(prefix)) return true;
        }

        return false;
      }

      // 7-3. 방향성 그래프(Edge) 구축: 출발 라우트 -> 도착 라우트
      const routeSet = new Set(routeScenarios.map(rs => rs.route));
      const edges = new Map<string, string[]>(); // from -> [to, ...]

      for (const rs of routeScenarios) {
        const navUrls = routeNavMap.get(rs.route) ?? new Set<string>();
        const destinations: string[] = [];

        for (const url of navUrls) {
          for (const targetRoute of routeSet) {
            if (targetRoute !== rs.route && routeMatchesUrl(targetRoute, url)) {
              destinations.push(targetRoute);
            }
          }
        }

        if (destinations.length > 0) {
          edges.set(rs.route, destinations);
        }
      }

      // 7-4. 시나리오(E2EScenario) 조립: 출발 라우트에서 DFS로 최대 3단계까지 탐색
      //      무한 루프 방지를 위해 방문한 라우트는 재방문하지 않음
      const routeScenariosMap = new Map(routeScenarios.map(rs => [rs.route, rs]));
      const MAX_DEPTH = 3;

      for (const rs of routeScenarios) {
        const destinations = edges.get(rs.route);
        if (!destinations || destinations.length === 0) continue;

        const e2eScenarios: E2EScenario[] = [];

        function buildE2EScenario(currentRoute: string, currentSteps: E2EStep[], visited: Set<string>) {
          const currentDests = edges.get(currentRoute);
          if (!currentDests || currentSteps.length >= MAX_DEPTH) return;

          for (const dest of currentDests) {
            if (visited.has(dest)) continue; // 순환 방지

            const destRouteScenario = routeScenariosMap.get(dest);
            if (!destRouteScenario) continue;

            const newStep: E2EStep = {
              route: dest,
              scenarios: destRouteScenario.scenarios,
            };

            const steps = [...currentSteps, newStep];
            const e2eScenarioId = steps.map(s => s.route).join(' ➞ ');

            e2eScenarios.push({ e2eScenarioId, steps });

            // 더 깊은 시나리오 재귀 탐색
            buildE2EScenario(dest, steps, new Set([...visited, dest]));
          }
        }

        const firstStep: E2EStep = { route: rs.route, scenarios: rs.scenarios };
        buildE2EScenario(rs.route, [firstStep], new Set([rs.route]));

        if (e2eScenarios.length > 0) {
          rs.e2eScenarios = e2eScenarios;
        }
      }
    }

    return { results, scenarios, routeScenarios };
  }
}
