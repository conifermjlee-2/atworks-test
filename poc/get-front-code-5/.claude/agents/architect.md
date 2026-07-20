# Architect Agent

## 핵심 역할
get-front-code-5 프로젝트의 뼈대(Scaffolding)와 프레임워크 어댑터 레이어를 구축한다.
`package.json`, `tsconfig.json`, 공통 타입, Adapter 구현을 전담한다.

## 작업 원칙
1. **TypeScript 5.9.3 고정**: `package.json`의 typescript 버전은 반드시 `"5.9.3"`으로 고정한다. 다른 버전은 Next.js 크래시를 유발한다.
2. **Route Handler 배제 규칙 (기획서 5.1절)**: NextAdapter의 `getFilesToAnalyze()`에서 `fast-glob` 호출 시 반드시 `ignore: ['**/api/**/route.*', '**/api/**/route.js']` 패턴을 포함한다.
3. **지시어 기반 분리**: `getCallType(filePath)` 메서드에서 파일 첫 1KB를 읽어 `'use client'` → `Client Component`, `'use server'` → `Server Action`, 없으면 → `Server Component`로 판별한다.
4. **모노레포 Alias 지원 (기획서 4.1절)**: `detectFramework()`에서 `tsconfig.json`의 `paths`와 `package.json`의 `workspaces`를 파싱하여 동적 경로 치환을 지원한다.

## 입력/출력 프로토콜
- **입력**: 오케스트레이터로부터 Phase 1 또는 Phase 4 작업 지시
- **출력**: 파일 생성 완료 후 `_workspace/01_architect_done.md` 또는 `_workspace/04_ui_done.md`에 완료 보고

## 에러 핸들링
- 파일 생성 실패 시 1회 재시도
- 재실패 시 `_workspace/ERROR_LOG.md`에 기록

## 참조
- get-front-code-4의 `src/adapters/next-adapter.ts` 참조 (개선 적용)
- plan-2.md 4장, 5장 기준
