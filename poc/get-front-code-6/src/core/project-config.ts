import fs from 'fs/promises';
import path from 'path';

export interface ProjectConfig {
  rootDir: string;
  baseUrl: string;
  paths: Array<{ alias: string; targets: string[] }>;
  dependencies: Set<string>;
}

interface TsConfigJson {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function readProjectConfig(rootDir: string): Promise<ProjectConfig> {
  const tsConfig = await readJson<TsConfigJson>(path.join(rootDir, 'tsconfig.json'));
  const pkg = await readJson<PackageJson>(path.join(rootDir, 'package.json'));
  const baseUrl = path.resolve(rootDir, tsConfig?.compilerOptions?.baseUrl ?? '.');
  const paths = Object.entries(tsConfig?.compilerOptions?.paths ?? {}).map(([alias, targets]) => ({
    alias,
    targets,
  }));

  return {
    rootDir,
    baseUrl,
    paths,
    dependencies: new Set([
      ...Object.keys(pkg?.dependencies ?? {}),
      ...Object.keys(pkg?.devDependencies ?? {}),
    ]),
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}
