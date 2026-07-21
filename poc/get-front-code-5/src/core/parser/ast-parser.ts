import { parse } from '@babel/parser';
import { File } from '@babel/types';
import * as fs from 'fs';

/**
 * plan-v5.md 2장 & 7장: TypeScript/JSX 소스 코드를 Babel AST 객체로 파싱한다.
 * - errorRecovery: true — 파싱 에러 발생 시 크래시 없이 복구 (Fault Isolation)
 * - 파싱 실패 시 null 반환 (Fail-safe)
 */
export function parseFile(filePath: string): File | null {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    return parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
      ],
      errorRecovery: true,
    });
  } catch (error: any) {
    console.warn(`[Parser] 스킵 — 파싱 실패: ${filePath}\n사유: ${error.message}`);
    return null;
  }
}
