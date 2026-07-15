import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { BaseAdapter, CallType } from '../types';

/**
 * Next.js 프레임워크 전용 어댑터 (NextAdapter)
 * 
 * [Harness 엔지니어링 원칙: 어댑터 패턴 적용]
 * 코어 분석 엔진(Traverser)이 특정 프레임워크의 폴더 구조나 설정 방식에 종속되지 않도록,
 * Next.js 프로젝트만의 고유한 규칙(파일 탐색 패턴, 서버/클라이언트 컴포넌트 식별 등)을 
 * 캡슐화하여 처리하는 클래스입니다.
 */
export class NextAdapter implements BaseAdapter {
  name = 'Next.js Adapter';

  constructor(private rootDir: string) {}

  /**
   * 1. 프레임워크 식별 (isMatch)
   * 
   * 입력받은 프로젝트 경로(rootDir)가 Next.js 프로젝트인지 판별합니다.
   * `package.json` 파일을 열어 `dependencies` 또는 `devDependencies`에
   * 'next' 패키지가 명시되어 있는지 확인합니다.
   * 
   * @returns {Promise<boolean>} Next.js 프로젝트라면 true 반환
   */
  async isMatch(): Promise<boolean> {
    const pkgPath = path.join(this.rootDir, 'package.json');
    try {
      if (!fs.existsSync(pkgPath)) return false;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!deps['next'];
    } catch {
      return false;
    }
  }

  /**
   * 2. 분석 대상 파일 추출 (getFilesToAnalyze)
   * 
   * Next.js의 Pages Router 및 App Router 구조 내에 존재하는 
   * 모든 UI 컴포넌트 파일들의 절대 경로 목록을 추출합니다.
   * 
   * [노이즈 필터링 전략]
   * - node_modules, .next: 불필요한 라이브러리 및 빌드 결과물 제외
   * - *.test.*: 테스트 코드 제외
   * - api/.../route.* : 프론트 화면이 아닌 백엔드(API) 자체 로직은 분석 대상에서 제외
   * 
   * @returns {Promise<string[]>} 분석 가능한 타겟 파일들의 절대 경로 배열
   */
  async getFilesToAnalyze(): Promise<string[]> {
    const pattern = path.join(this.rootDir, '**', '*.{tsx,jsx,ts,js}').replace(/\\/g, '/');
    return fg(pattern, { 
      ignore: [
        '**/node_modules/**', 
        '**/.next/**', 
        '**/*.test.*', 
        '**/api/**/route.*' // 기획서 6장: API 자체 라우트는 분석 대상에서 제외
      ] 
    });
  }

  /**
   * 3. 호출 유형 식별 (getCallType)
   * 
   * Next.js 13+ (App Router) 환경에서 해당 파일이 클라이언트 영역인지,
   * 서버 영역인지 판별하여 반환합니다. 이 정보는 최종 마크다운 리포트에 활용됩니다.
   * 
   * @param filePath 분석 중인 파일의 절대 경로
   * @returns {CallType} 'Client' | 'ServerComponent' | 'ServerAction' | 'Unknown'
   */
  getCallType(filePath: string): CallType {
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      
      // [판별 로직 1] 파일 최상단 지시어(Directive) 검사
      // "use client"가 명시되어 있으면 무조건 클라이언트 컴포넌트 (CSR)
      if (code.includes('"use client"') || code.includes("'use client'")) {
        return 'Client';
      }
      
      // "use server"가 명시되어 있으면 서버 액션 (SSR/Action)
      if (code.includes('"use server"') || code.includes("'use server'")) {
        return 'ServerAction';
      }
      
      // [판별 로직 2] 경로 기반 추론
      // 지시어가 명시되어 있지 않은 상태에서, /app/ 디렉토리 하위에 위치한다면
      // Next.js App Router의 기본 동작 방식에 따라 서버 컴포넌트로 간주함
      if (filePath.replace(/\\/g, '/').includes('/app/')) {
         return 'ServerComponent';
      }
      
      // 그 외의 경우 (예: Pages Router의 기본 컴포넌트 등) Client로 Fallback
      return 'Client';
    } catch {
      return 'Unknown';
    }
  }
}
