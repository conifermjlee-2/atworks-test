import { parse } from '@babel/parser';
import type { File } from '@babel/types';

export function parseSource(source: string, filename: string): File {
  return parse(source, {
    sourceType: 'module',
    sourceFilename: filename,
    errorRecovery: true,
    plugins: [
      'typescript',
      'jsx',
      'decorators-legacy',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport',
    ],
  });
}
