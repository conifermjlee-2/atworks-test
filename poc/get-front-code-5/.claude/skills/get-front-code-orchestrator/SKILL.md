---
name: get-front-code-orchestrator
description: "get-front-code-5 프론트엔드 자동 분석기 프로젝트를 구축한다. plan-2.md 기획서 기반의 Next.js + AST 파싱 엔진 구현 요청 시 반드시 이 스킬을 사용한다. 'get-front-code-5 구축', '분석기 만들어줘', '프로젝트 시작해', '작업 시작' 등의 요청에도 트리거된다."
---

# get-front-code-5 오케스트레이터

## 목표
`plan-2.md` 기획서를 기반으로 `C:\Users\lee\Desktop\atworks-test\poc\get-front-code-5` 에
프론트엔드 API 자동 분석기(v6)를 완전히 구현한다.

## 핵심 설계 원칙 (절대 불변)
1. **관심사 분리**: Adapter(프레임워크) / Resolver(라이브러리) 레이어 완전 분리
2. **백엔드**: 순수 JSON만 반환 (`src/app/api/analyze/route.ts`)
3. **프론트엔드**: 아코디언 UI + 배지 렌더링만 담당 (`src/app/page.tsx`)
4. **Route Handler 배제**: `**/api/**/route.*` 패턴을 스캔에서 원천 차단
5. **배타적 소유권**: 고수준 리졸버가 낚아채면 저수준 리졸버는 차단 (`path.skip()`)
6. **Max Depth 3**: Cross-file 추적 시 재귀 깊이 3단계 강제 제한
7. **TypeScript 5.9.3 고정**: Next.js 안정성 확보

## Phase 0: 컨텍스트 확인
기존 `src/` 하위에 코드 파일이 있는지 확인한다.
- 파일 존재 → 부분 재실행 모드
- 비어있음 → 초기 실행 모드

## Phase 1: Architect Agent 실행
**담당**: `architect` 에이전트
**산출물**: `_workspace/01_architect_done.md`

작업 목록:
1. `package.json` 생성 (get-front-code-4 기반, TS 5.9.3 고정)
2. `tsconfig.json` 생성
3. `src/types/index.ts` — 공통 타입 정의 (`MappingResult`, `ApiCall`, `HookResolver` 인터페이스)
4. `src/adapters/index.ts` — `detectFramework()` 함수
5. `src/adapters/next-adapter.ts` — Next.js App Router 어댑터 (분리 규칙 5.1절 구현)
6. `src/adapters/react-adapter.ts` — React 어댑터

## Phase 2: AST Engineer Agent 실행
**담당**: `ast-engineer` 에이전트
**선행 조건**: Phase 1 완료
**산출물**: `_workspace/02_ast_engineer_done.md`

작업 목록:
1. `src/core/parser/ast-parser.ts` — Babel 파서 (`errorRecovery: true`)
2. `src/core/parser/ast-traverser.ts` — AST 순회 + `path.skip()` 배타 규칙
3. `src/core/interfaces/resolver.ts` — HookResolver 인터페이스 (init 선택적)
4. `src/core/analyzer.ts` — 오케스트레이터 (5단계 파이프라인)

## Phase 3: Plugin Engineer Agent 실행
**담당**: `plugin-engineer` 에이전트
**선행 조건**: Phase 2 완료
**산출물**: `_workspace/03_plugin_engineer_done.md`

작업 목록:
1. `src/resolvers/axios-fetch-resolver.ts`
2. `src/resolvers/react-query-resolver.ts` (queryFn 우선, queryKey Fallback)
3. `src/resolvers/rtk-query-resolver.ts` (init() 사전 학습 포함)
4. `src/resolvers/swr-resolver.ts`

## Phase 4: UI/API Route 구현
**담당**: `architect` 에이전트 (재활용)
**선행 조건**: Phase 3 완료

작업 목록:
1. `src/app/api/analyze/route.ts` — POST 엔드포인트, 순수 JSON 반환
2. `src/app/page.tsx` — 아코디언 UI, 배지 시스템 (GET/POST/PUT/DELETE/PATCH 색상)
3. `src/app/globals.css` — 스타일

## Phase 5: QA 확인
**담당**: `qa-tester` 에이전트
`npm run dev` 실행 후 기본 동작 확인

## 에러 핸들링
- 에이전트 실패 시 1회 재시도
- 재실패 시 `_workspace/ERROR_LOG.md`에 기록 후 다음 Phase 진행

## 테스트 시나리오
**정상 흐름**: Architect → AST Engineer → Plugin Engineer → UI/API → QA
**부분 재실행**: 특정 Phase의 파일만 재생성 요청 시 해당 에이전트만 재호출
