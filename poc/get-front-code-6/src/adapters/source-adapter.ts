import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import type { CallType, SourceFile } from '@/types';

const SOURCE_GLOBS = [
  '**/*.{ts,tsx,js,jsx}',
  '!**/node_modules/**',
  '!**/.next/**',
  '!**/dist/**',
  '!**/build/**',
  '!**/coverage/**',
  '!**/*.d.ts',
  '!**/app/api/**/route.{ts,js}',
  '!**/pages/api/**',
];

export async function collectSourceFiles(rootDir: string): Promise<SourceFile[]> {
  const entries = await fg(SOURCE_GLOBS, { cwd: rootDir, absolute: true, onlyFiles: true });
  const files = await Promise.all(
    entries.map(async absolutePath => {
      const relativePath = slash(path.relative(rootDir, absolutePath));
      const source = await fs.readFile(absolutePath, 'utf8').catch(() => '');
      return {
        absolutePath,
        relativePath,
        viewName: inferViewName(relativePath),
        callType: inferCallType(source, relativePath),
      };
    }),
  );

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function inferViewName(relativePath: string): string {
  const normalized = slash(relativePath);
  const appMatch = normalized.match(/^src\/app\/(.+)\/page\.[tj]sx?$/) ?? normalized.match(/^app\/(.+)\/page\.[tj]sx?$/);
  if (appMatch) return appMatch[1] === 'page' ? '/' : `/${appMatch[1]}`;

  const rootPage = normalized.match(/^(src\/)?app\/page\.[tj]sx?$/);
  if (rootPage) return '/';

  const pagesMatch = normalized.match(/^(src\/)?pages\/(.+)\.[tj]sx?$/);
  if (pagesMatch) return pagesMatch[2].replace(/\/index$/, '').split('/').pop() ?? pagesMatch[2];

  return normalized.replace(/\.[tj]sx?$/, '');
}

function inferCallType(source: string, relativePath: string): CallType {
  const directive = source.match(/^\s*['"]use\s+(client|server)['"]/m)?.[1];
  if (directive === 'client') return 'Client';
  if (directive === 'server') return 'ServerAction';
  if (/\/app\/|^app\//.test(slash(relativePath)) && /\/page\.[tj]sx?$/.test(slash(relativePath))) {
    return 'ServerComponent';
  }
  if (/^(src\/)?pages\//.test(slash(relativePath))) return 'Client';
  return 'Unknown';
}

function slash(value: string): string {
  return value.replace(/\\/g, '/');
}
