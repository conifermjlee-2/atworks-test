import { NextResponse } from 'next/server';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Normalize path
  targetPath = path.resolve(targetPath);

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
  }

  try {
    // Find all package.json files (ignoring node_modules)
    const packageFiles = globSync('**/package.json', {
      cwd: targetPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    });

    const subProjects = packageFiles.map(file => {
      const dirPath = path.dirname(file); // e.g., ".", "apps/web"
      const fullDirPath = path.join(targetPath!, dirPath);
      
      let framework = 'unknown';
      let isAppRouter = false;
      let isPagesRouter = false;

      // Check for Next.js
      if (fs.existsSync(path.join(fullDirPath, 'next.config.js')) || fs.existsSync(path.join(fullDirPath, 'next.config.mjs'))) {
        framework = 'nextjs';
      } else {
        // Simple React check
        const pkgContent = fs.readFileSync(path.join(fullDirPath, 'package.json'), 'utf-8');
        if (pkgContent.includes('"react"')) {
          framework = 'react';
        }
      }

      // Check routers if nextjs
      if (fs.existsSync(path.join(fullDirPath, 'src', 'app')) || fs.existsSync(path.join(fullDirPath, 'app'))) {
        isAppRouter = true;
      }
      if (fs.existsSync(path.join(fullDirPath, 'src', 'pages')) || fs.existsSync(path.join(fullDirPath, 'pages'))) {
        isPagesRouter = true;
      }

      let description = framework === 'nextjs' 
        ? `Next.js (${isAppRouter ? 'app' : ''}${isAppRouter && isPagesRouter ? ' + ' : ''}${isPagesRouter ? 'pages' : ''})`
        : framework === 'react' ? 'React' : 'Other';

      return {
        id: dirPath === '.' ? 'root' : dirPath,
        path: dirPath,
        fullPath: fullDirPath,
        framework,
        description
      };
    });

    return NextResponse.json({
      rootPath: targetPath,
      subProjects
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
