import path from 'path';
import fs from 'fs/promises';

export async function assertReadableDirectory(input: unknown): Promise<string> {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('targetPath must be a non-empty string.');
  }

  const normalized = path.resolve(input.trim());
  const parsed = path.parse(normalized);

  if (normalized === parsed.root) {
    throw new Error('Root directories cannot be analyzed directly.');
  }

  if (input.includes('..')) {
    throw new Error('Parent directory traversal is not allowed.');
  }

  const stat = await fs.stat(normalized).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error('targetPath does not exist or is not a directory.');
  }

  return normalized;
}
