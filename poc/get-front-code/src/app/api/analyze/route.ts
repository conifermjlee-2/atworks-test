import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepoStatically } from '@/lib/staticAnalyzer';
import simpleGit from 'simple-git';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { url, mode = 'github', analysisType = 'view-api' } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL 또는 로컬 경로를 입력해 주세요.' }, { status: 400 });
    }

    let markdownResult: string;

    if (mode === 'local') {
      // 로컬 폴더 → 정적 분석기
      markdownResult = await analyzeRepoStatically(url, mode, analysisType);
    } else {
      // GitHub URL 파싱 (특정 폴더/브랜치 지정 처리)
      let repoUrl = url;
      let branch = '';
      let subDir = '';

      // 예: https://github.com/skccmygit/davis-frontend/tree/develop/apps/agent-bt
      const treeMatch = url.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)$/);
      if (treeMatch) {
        const [, user, repo, b, p] = treeMatch;
        repoUrl = `https://github.com/${user}/${repo}.git`;
        branch = b;
        subDir = p;
      }

      // GitHub URL → 임시 폴더에 클론 후 정적 분석기 실행
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-front-code-'));
      const git = simpleGit();
      
      try {
        if (branch) {
          await git.clone(repoUrl, tempDir, ['-b', branch, '--single-branch', '--depth', '1']);
        } else {
          await git.clone(repoUrl, tempDir, ['--depth', '1']);
        }
        
        // 클론된 폴더 내의 특정 하위 경로(subDir)를 타겟으로 지정
        const targetDir = subDir ? path.join(tempDir, subDir) : tempDir;
        markdownResult = await analyzeRepoStatically(targetDir, 'local', analysisType);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

    return NextResponse.json({ result: markdownResult });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
