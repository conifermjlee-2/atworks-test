import simpleGit from 'simple-git';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { promptGemini } from './gemini';

/**
 * GitHub URL을 파싱하여 저장소 루트 URL과 하위 경로(모놀레포용)를 분리하는 함수입니다.
 * 초보자도 이해하기 쉽게 예외 처리를 꼼꼼히 해두었습니다.
 */
function parseGitHubUrl(inputUrl: string) {
    try {
        // 사용자가 'https://'를 빼먹고 입력했을 경우를 대비해 자동으로 붙여줍니다.
        const urlStr = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`;
        const url = new URL(urlStr);
        
        // URL의 경로(pathname)를 '/' 기준으로 쪼갭니다.
        // 예: ["skccmygit", "davis-frontend", "tree", "develop", "apps", "agent-bt"]
        const parts = url.pathname.split('/').filter(Boolean);
        
        // 최소한 저장소 소유자(owner)와 이름(repo)은 있어야 합니다.
        if (parts.length >= 2) {
            // 무조건 첫 두 개 세그먼트를 합쳐서 루트 저장소 URL을 만듭니다.
            const repoUrl = `${url.origin}/${parts[0]}/${parts[1]}`;
            
            // 만약 URL에 '/tree/'가 포함되어 있고 그 뒤에 경로가 더 있다면 모놀레포 서브 디렉터리입니다.
            if (parts[2] === 'tree' && parts.length > 3) {
                // 'tree' 글자를 건너뛰고 나머지 경로를 합칩니다. (예: "develop/apps/agent-bt")
                const remaining = parts.slice(3).join('/');
                return { repoUrl, remaining, isMonorepo: true };
            }
            
            // 일반적인 단일 저장소인 경우
            return { repoUrl, remaining: null, isMonorepo: false };
        }
    } catch (e) {
        // 혹시라도 이상한 URL이 들어와서 에러가 나면 그냥 원래 입력값을 반환합니다.
        console.error("URL 파싱 에러:", e);
    }
    return { repoUrl: inputUrl, remaining: null, isMonorepo: false };
}

export async function analyzeRepoWithAI(
    inputUrl: string, 
    mode: 'github' | 'local' = 'github',
    analysisType: 'view-api' | 'api-flow' | 'state-flow' = 'view-api'
): Promise<string> {
    let baseDir = '';
    let scanDirs: string[] = [];
    let isTempDir = false;

    try {
        if (mode === 'github') {
            // 1. 코드를 임시로 다운로드할 텅 빈 폴더를 만듭니다. (분석이 끝나면 싹 지워질 예정입니다)
            baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-front-code-ai-2-'));
            isTempDir = true;
            const git = simpleGit();

            // 우리가 만든 파싱 함수로 URL을 예쁘게 분리합니다.
            const { repoUrl, remaining, isMonorepo } = parseGitHubUrl(inputUrl);
            console.log(`Cloning repository: ${repoUrl}`);
            
            // 2. 가장 먼저 루트 저장소를 가볍게(depth=1) 다운로드합니다.
            await git.clone(repoUrl, baseDir, ['--depth', '1']);

            let subPath = ''; // 최종적으로 분석할 폴더 경로를 담을 변수

            // 3. 만약 모놀레포(서브 디렉터리) 경로라면, 브랜치와 실제 폴더를 매칭해야 합니다.
            if (isMonorepo && remaining) {
                console.log(`Resolving branch for monorepo path: ${remaining}`);
                
                // 깃허브 원격 서버에 있는 실제 브랜치 목록을 전부 가져옵니다.
                const branchSummary = await git.cwd(baseDir).branch(['-r']);
                const branches = branchSummary.all.map(b => b.replace('origin/', ''));
                
                let matchedBranch = '';
                
                // "develop/apps/agent-bt" 같은 경로에서 진짜 브랜치명("develop")을 찾아냅니다.
                for (const b of branches) {
                    // 브랜치 이름과 정확히 일치하거나, 그 브랜치 이름 뒤에 '/'가 붙어있는지 확인합니다.
                    if (remaining === b || remaining.startsWith(b + '/')) {
                        if (b.length > matchedBranch.length) {
                            matchedBranch = b; // 가장 길게 일치하는 것을 진짜 브랜치로 판단! (예: feature/login)
                        }
                    }
                }

                if (matchedBranch) {
                    console.log(`Matched branch: ${matchedBranch}`);
                    // 찾은 브랜치의 코드를 마저 다운받고, 그 브랜치로 쇽! 이동(checkout)합니다.
                    await git.cwd(baseDir).fetch('origin', matchedBranch, ['--depth', '1']);
                    await git.cwd(baseDir).checkout(matchedBranch);
                    
                    // 남은 경로에서 브랜치 이름을 빼면 순수한 폴더 경로만 남습니다. (예: "apps/agent-bt")
                    subPath = remaining.substring(matchedBranch.length).replace(/^\/+/, '');
                    console.log(`Target sub-directory: ${subPath}`);
                } else {
                    console.log(`No matching branch found for ${remaining}, using default branch.`);
                    // 만약 브랜치를 못 찾았다면, 어쩔 수 없이 첫 번째 단어를 브랜치라고 '찍고' 넘어갑니다.
                    const parts = remaining.split('/');
                    subPath = parts.slice(1).join('/'); 
                }
            }

            console.log(`Finding source files in GitHub repository...`);
            scanDirs = [baseDir]; // 기본적으로는 저장소 전체를 스캔 대상으로 삼습니다.
            
            // 4. 하지만 모놀레포라면 스캔할 폴더 범위를 확! 줄여줍니다.
            if (isMonorepo && subPath) {
                const mainAppDir = path.join(baseDir, subPath);
                if (fs.existsSync(mainAppDir)) {
                    scanDirs = [mainAppDir]; // 타겟 앱 폴더 하나만 딱 찝어서 분석!
                }
                
                // ★ 매우 중요: 모놀레포는 공통 코드(shared)를 쓸 확률이 매우 높습니다. 
                const sharedFolders = ['packages', 'libs', 'shared', 'common'];
                for (const folder of sharedFolders) {
                    const sharedPath = path.join(baseDir, folder);
                    if (fs.existsSync(sharedPath)) {
                        scanDirs.push(sharedPath); // 공통 폴더가 존재하면 바구니에 같이 담아줍니다.
                    }
                }
            }
        } else {
            // === 로컬 폴더 분석 모드 ===
            if (!fs.existsSync(inputUrl)) {
                throw new Error("입력하신 로컬 폴더 경로가 존재하지 않습니다.");
            }

            const normalizedInput = inputUrl.replace(/\\/g, '/');
            baseDir = normalizedInput;
            scanDirs = [normalizedInput];

            console.log(`Finding source files in Local directory: ${normalizedInput}...`);

            // [스마트 탐색] 로컬 경로 안에 '/apps/' 가 있다면 모놀레포로 간주하고 루트의 패키지 폴더들을 끌어옵니다.
            const appsIndex = normalizedInput.lastIndexOf('/apps/');
            if (appsIndex !== -1) {
                const rootDir = normalizedInput.substring(0, appsIndex);
                baseDir = rootDir; // 파일 상대경로 출력을 예쁘게 하기 위해 기준점을 모놀레포 루트로 올립니다.
                
                console.log(`Monorepo detected locally. Root dir: ${rootDir}`);
                // 공통 폴더(packages, libs 등) 스캔 로직 제거
                // (이유: 프롬프트가 너무 방대해져서 Gemini 무료 티어의 출력 토큰 한도가 극단적으로 줄어드는 현상 방지)
                /* 
                const sharedFolders = ['packages', 'libs', 'shared', 'common'];
                for (const folder of sharedFolders) {
                    const sharedPath = path.join(rootDir, folder);
                    if (fs.existsSync(sharedPath)) {
                        scanDirs.push(sharedPath);
                        console.log(`Added shared local folder: ${sharedPath}`);
                    }
                }
                */
            }
        }

        // 5. 스캔 바구니에 담긴 폴더들을 돌아다니며 실제 코드가 적힌 파일들만 싹 쓸어 모읍니다.
        let files: string[] = [];
        for (const dir of scanDirs) {
            const dirFiles = await glob('**/*.{js,jsx,ts,tsx}', {
                cwd: dir,
                ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/public/**']
            });
            // 파일 절대 경로를 보기 좋은 상대 경로(루트 기준)로 바꿔서 저장합니다.
            const relativeToBase = dirFiles.map(f => path.relative(baseDir, path.join(dir, f)).replace(/\\/g, '/'));
            files = files.concat(relativeToBase);
        }

        // 6. 아무 파일이나 막 주면 토큰(비용)이 낭비되니까, 프론트엔드 핵심 로직이 들어있을 만한 폴더만 다시 한번 거릅니다.
        const targetFiles = files.filter(f => {
            const normalized = f.replace(/\\/g, '/');
            return normalized.includes('pages/') || 
                   normalized.includes('app/') || 
                   normalized.includes('api/') || 
                   normalized.includes('services/') || 
                   normalized.includes('hooks/') ||
                   normalized.includes('components/') ||
                   normalized.includes('packages/') ||
                   normalized.includes('libs/') ||
                   normalized.includes('shared/');
        });

        let mergedCode = '';
        
        // 7. 찾아낸 핵심 파일들을 햄버거 패티처럼 차곡차곡 하나의 거대한 텍스트로 이어 붙입니다.
        for (const file of targetFiles) {
            const filePath = path.join(baseDir, file);
            const code = fs.readFileSync(filePath, 'utf-8');
            // 주석이나 빈 줄을 지워서 최대한 AI 토큰을 아껴줍니다.
            const minified = code.replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\s*$/gm, '').trim(); 
            if (minified.length > 0) {
                mergedCode += `\n\n--- FILE: ${file} ---\n${minified}`; // 파일명 꼬리표를 꼭 달아줍니다.
            }
        }

        // Gemini API 무료 티어(Free Tier)는 1분에 최대 25만 토큰(약 80만 글자)까지만 입력 가능합니다.
        // 무료 티어 한도 초과(429 에러)를 방지하기 위해 최대 30만 글자(약 7.5만 토큰)로 제한합니다.
        const MAX_CHARS = 300000; 
        if (mergedCode.length > MAX_CHARS) {
            mergedCode = mergedCode.substring(0, MAX_CHARS) + "\n... (무료 티어 토큰 제한으로 인해 코드가 잘렸습니다) ...";
        }

        // 만약 분석할 코드가 하나도 없다면 허무하게 종료!
        if (mergedCode.trim().length === 0) {
            return "분석할 수 있는 프론트엔드 코드(React/Next.js)를 찾지 못했습니다.";
        }

        let promptText = `
너는 뛰어난 시니어 프론트엔드 아키텍트야. 다음은 프론트엔드 프로젝트의 소스 코드 전체(주요 파일)야. 
이 코드를 꼼꼼히 분석하여 아래 요청된 분석 항목을 마크다운 표(Table) 형식으로 완벽하게 정리해줘.
한국어로 친절하고 명확하게 답변해줘.

[🔥매우 중요한 주의사항🔥]
1. 코드가 아무리 방대하더라도 발견된 화면(View)과 API 매핑은 끝까지 전부 작성해. 단, **공통 폴더(packages, libs 등)에 정의만 되어 있고 메인 화면 컴포넌트에서 실제로 사용/호출되지 않는 API는 철저하게 제외**해. (출력량 초과 방지)
2. 절대 코드에 없는 API나 경로를 지어내지 마(Hallucination 금지).
3. Redux, Zustand, React Query 등 상태 관리 라이브러리가 사용된 경우, dispatch 액션과 UI 이벤트(useEffect, 콜백)를 논리적으로 추론해줘.
4. 컴포넌트 이름이나 라우트 경로를 설명할 때 절대 HTML 태그 형태(\`<Component>\`)로 적지 말고, 반드시 백틱( \`Component\` )으로 감싸서 작성해! (프론트엔드 마크다운 렌더러가 태그를 삼켜버리는 치명적 오류 방지)

`;

        if (analysisType === 'view-api') {
            promptText += `
분석 항목: [화면별 API 묶음 (View-API Mapping)]
각 화면(실제 라우팅 경로 또는 모달/컴포넌트)에서 호출되는 모든 API를 마크다운 표(Table) 형식으로 깔끔하게 정리해.
형식:
| 화면 (경로 또는 UI) | HTTP 메서드 | API 주소 | 호출 훅(함수) | 목적/설명 |
|---|---|---|---|---|
| \`/agents/bt\` (Main) | GET | \`/tasks?agentId=bt\` | \`useGetTasksQuery\` | 태스크 목록 조회 |
`;
        } else if (analysisType === 'api-flow') {
            promptText += `
분석 항목: [API 연계 흐름 (Cross-Screen Flow)]
하나의 화면에서 API 호출이 성공한 뒤, 다른 화면으로 라우팅(이동)하거나 연속적으로 이어지는 중요한 API 흐름을 **모두** 찾아내어 표로 정리해.
(주의: 3~4개만 찾고 절대 중단하지 마! 존재하는 모든 흐름을 최소 수십 개라도 끝까지 빠짐없이 샅샅이 뒤져서 표를 완성해야 해.)
형식:
| 시작 화면 | 트리거 API | 성공 시 동작 (이동 라우트 또는 연계 API) |
|---|---|---|
| \`/create\` | POST \`/tasks\` | \`/agents/bt\` 로 페이지 이동 |
`;
        } else if (analysisType === 'state-flow') {
            promptText += `
분석 항목: [전역 상태 관리 흐름 (State Update Flow)]
화면 이동이 없더라도 Redux, RTK Query, Zustand 등을 통해 전역 상태나 캐시가 갱신되어 화면이 실시간으로 자동 업데이트되는 핵심 로직을 표로 정리해.
형식:
| 트리거 액션/API | 갱신되는 전역 상태/캐시 | 영향을 받는 화면/컴포넌트 |
|---|---|---|
| POST \`/batches\` | \`/tasks/{taskCode}\` 쿼리 무효화(Invalidate) | Task 상세 컴포넌트 실시간 리렌더링 |
`;
        }

        promptText += `
분석할 코드(전체 주요 파일 포함):
${mergedCode}
        `;

        console.log(`Sending to Gemini API (Prompt size: ${promptText.length} chars)...`);
        const result = await promptGemini(promptText);

        return result || "Gemini 분석 결과를 가져오지 못했습니다.";

    } catch (error: any) {
        console.error(error);
        throw new Error(error?.message || "저장소 분석 중 오류가 발생했습니다.");
    } finally {
        // GitHub 모드였다면 생성했던 임시 폴더를 깔끔하게 지워줍니다. 로컬 모드일 때는 삭제하지 않습니다.
        if (isTempDir && baseDir) {
            fs.rmSync(baseDir, { recursive: true, force: true });
        }
    }
}
