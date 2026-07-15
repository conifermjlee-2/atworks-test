import { parse } from '@babel/parser';
import { File } from '@babel/types';
import * as fs from 'fs';

/**
 * TypeScript/JSX 소스 코드를 읽어 Babel AST 객체로 반환합니다.
 * 파싱 실패 시 예외를 무시하고 null을 반환하여 시스템 다운을 방지합니다. (Fail-safe)
 */
export function parseFile(filePath: string): File | null {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    return parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript', 
        'jsx',
        'decorators-legacy' // 구형 Vue 코드 등에서 데코레이터 사용 대비
      ],
      // 에러가 나더라도 복구를 시도하여 최대한 AST를 생성
      errorRecovery: true,
    });
  } catch (error: any) {
    console.warn(`[Parser Error] 스킵됨 - 파일 파싱 실패: ${filePath}\n사유: ${error.message}`);
    return null;
  }
}
