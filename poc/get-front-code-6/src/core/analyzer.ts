import fs from 'fs/promises';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { ApiCallInfo, FileError, MappingItem, MappingResult, SourceFile } from '@/types';
import { collectSourceFiles } from '@/adapters/source-adapter';
import { readProjectConfig } from './project-config';
import type { ProjectConfig } from './project-config';
import { parseSource } from './parser';
import { collectImports } from './imports';
import type { ImportMap } from './imports';
import { collectStringConstants } from './constants';
import { resolveDirectCall } from '@/resolvers/direct-resolver';
import { resolveReactQuery, resolveRtkUsage, resolveSWR } from '@/resolvers/hook-resolver';
import { collectRtkEndpoints } from '@/resolvers/rtk-indexer';
import { traceSymbolCall } from './symbol-tracer';

interface ParsedFile {
  file: SourceFile;
  ast: File;
  constants: Map<string, string>;
  imports: ImportMap;
}

export async function analyzeProject(targetPath: string): Promise<MappingResult> {
  const config = await readProjectConfig(targetPath);
  const sourceFiles = await collectSourceFiles(targetPath);
  const errors: FileError[] = [];
  const rtkEndpoints = new Map<string, ApiCallInfo>();
  const parsedFiles: ParsedFile[] = [];

  for (const file of sourceFiles) {
    try {
      const source = await fs.readFile(file.absolutePath, 'utf8');
      const ast = parseSource(source, file.absolutePath);
      const constants = collectStringConstants(ast);
      collectRtkEndpoints(ast, constants).forEach((api, name) => rtkEndpoints.set(name, api));
      parsedFiles.push({ file, ast, constants, imports: collectImports(ast, file.absolutePath, config) });
    } catch (error) {
      errors.push({ file: file.relativePath, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const mappings: MappingItem[] = [];

  for (const parsed of parsedFiles) {
    try {
      const fileMappings: MappingItem[] = [];
      traverse(parsed.ast, {
        CallExpression(callPath) {
          const highLevel =
            resolveReactQuery(callPath.node, parsed.constants) ??
            resolveSWR(callPath.node, parsed.constants) ??
            resolveRtkUsage(callPath.node, rtkEndpoints);

          if (highLevel) {
            fileMappings.push(toMapping(parsed.file, highLevel));
            callPath.skip();
            return;
          }

          const direct = resolveDirectCall(callPath.node, parsed.constants);
          if (direct) {
            fileMappings.push(toMapping(parsed.file, direct));
          }
        },
      });

      for (const item of fileMappings) {
        mappings.push(item);
      }

      const symbolCalls = await resolveImportedUtilityCalls(parsed);
      for (const api of symbolCalls) {
        mappings.push(toMapping(parsed.file, api));
      }
    } catch (error) {
      errors.push({ file: parsed.file.relativePath, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    targetPath,
    totalFiles: sourceFiles.length,
    totalViews: new Set(mappings.map(item => item.viewName)).size,
    totalApis: mappings.length,
    mappings: dedupeMappings(mappings),
    errors,
  };

  async function resolveImportedUtilityCalls(parsed: ParsedFile): Promise<ApiCallInfo[]> {
    const apis: ApiCallInfo[] = [];
    const pending: Array<Promise<ApiCallInfo | null>> = [];

    traverse(parsed.ast, {
      CallExpression(callPath) {
        if (!t.isIdentifier(callPath.node.callee)) return;
        const importedFile = parsed.imports.symbols.get(callPath.node.callee.name);
        if (!importedFile) return;
        pending.push(traceSymbolCall(callPath.node.callee.name, importedFile, config));
      },
    });

    for (const promise of pending) {
      const api = await promise;
      if (api) apis.push(api);
    }
    return apis;
  }
}

function toMapping(file: { relativePath: string; viewName: string; callType: MappingItem['callType'] }, api: ApiCallInfo): MappingItem {
  return {
    file: file.relativePath,
    viewName: file.viewName,
    callType: file.callType,
    api,
  };
}

function dedupeMappings(mappings: MappingItem[]): MappingItem[] {
  const seen = new Set<string>();
  const result: MappingItem[] = [];
  for (const item of mappings) {
    const key = [item.file, item.viewName, item.callType, item.api.method, item.api.endpoint, item.api.resolver].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare) return fileCompare;
    return a.api.endpoint.localeCompare(b.api.endpoint);
  });
}
