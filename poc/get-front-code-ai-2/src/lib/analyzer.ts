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
너는 깐깐한 시니어 프론트엔드 아키텍트야. 다음은 프론트엔드 프로젝트의 소스 코드 전체(주요 파일)야. 
이 코드를 분석하여 아래 요청된 분석 항목을 마크다운 표(Table) 형식으로만 출력해.
절대로 "제가 분석해보겠습니다", "여기 표가 있습니다" 같은 인사말이나 서론, 결론 등의 수다를 떨지 마. 오직 마크다운 표만 깔끔하게 반환해야 해.

[🔥매우 중요한 UI 렌더링 주의사항🔥]
1. HTTP 메서드를 출력할 때는 반드시 대괄호를 씌워서 \`[GET]\`, \`[POST]\`, \`[DELETE]\`, \`[PUT]\` 와 같이 작성해. (커스텀 UI 뱃지가 렌더링 되기 위해 필수적인 조건이야. 대괄호를 안 쓰면 UI가 다 깨져버려!)
2. 화면(경로 또는 UI)을 출력할 때는 뭉뚱그려서 "MainPage" 라고 쓰지 말고, 해당 화면을 구성하는 정확한 파일 경로(예: \`src/features/main/page.tsx\`)를 백틱(\` \`)으로 감싸서 작성해.
3. 코드가 아무리 방대하더라도 메인 화면 컴포넌트에서 실제로 사용/호출되지 않는 공통 API는 제외해.
4. 컴포넌트 이름을 절대 HTML 태그 형태(\`<Component>\`)로 적지 마.
5. API 주소가 동적으로 생성되는 경우, 코드 원본 형태(예: \`/tasks/\${taskId}\` 또는 변수명) 그대로 작성해. 단, 코드만으로 도저히 파악이 안 될 경우에는 이상한 문자를 지어내지 말고 깔끔하게 \`(동적 URL)\`이라고만 명시해.
6. [🔥출력 중단 금지🔥] 발견된 API 개수가 아무리 많더라도, 절대로 중간에 생략(예: "등등", "이하 생략")하거나 출력을 멈추지 마. 모든 파일의 API 매핑이 끝날 때까지 완벽하게 전체 표를 완성해.

`;

        if (analysisType === 'view-api') {
            promptText += `
분석 항목: [화면별 API 묶음 (View-API Mapping)]
각 파일에서 호출되는 모든 API를 마크다운 표(Table) 형식으로만 깔끔하게 출력해.
형식:
| 화면 (파일 경로) | HTTP 메서드 | API 주소 | 호출 훅(함수) | 목적/설명 |
|---|---|---|---|---|
| \`src/app/agents/bt/page.tsx\` | \`[GET]\` | \`/tasks?agentId=bt\` | \`useGetTasksQuery\` | 태스크 목록 조회 |
`;
        } else if (analysisType === 'api-flow') {
            promptText += `
분석 항목: [API 연계 흐름 (Cross-Screen Flow)]
하나의 컴포넌트(화면)에서 데이터를 변경하는 API(주로 POST, PUT, DELETE, PATCH)가 호출된 후,
그 결과로 인해 연달아 호출되는(조회/갱신되는) GET API를 찾아내어 **1:1 매핑** 형태로 표로 정리해.
(주의: 모달 닫기, 알림 표시 같은 UI 상태 변화는 철저히 배제하고 오직 "API 호출 ➡️ 연계 API 조회" 흐름만 직관적으로 작성해.)
(주의: 연달아 갱신되는 GET API가 여러 개라도 가장 핵심적인 1개만 대표로 골라서 적어줘. 전체 흐름이 매우 심플하게 한눈에 들어와야 해.)

형식:
| 시작 화면 | API | 연계 흐름 (Flow) |
|---|---|---|
| \`src/components/add-modal.tsx\` | \`[POST] /tasks/{taskCode}/scenarios\` | **[POST] /tasks/{taskCode}/scenarios 호출** ➡️ **[GET] /tasks/{taskCode}/scenarios/{scenarioId} 조회(갱신)** |
| \`src/components/delete-modal.tsx\` | \`[DELETE] /users/{id}\` | **[DELETE] /users/{id} 호출** ➡️ **[GET] /users 조회(갱신)** |
`;
        } else if (analysisType === 'state-flow') {
            promptText += `
분석 항목: [전역 상태 관리 흐름 (State Update Flow)]
화면 이동이 없더라도 Redux, RTK Query, Zustand 등을 통해 전역 상태나 캐시가 갱신되어 화면이 실시간으로 자동 업데이트되는 핵심 로직을 표로 정리해.
형식:
| 트리거 액션/API | 갱신되는 전역 상태/캐시 | 영향을 받는 화면/컴포넌트 |
|---|---|---|
| \`[POST]\` \`/batches\` | \`/tasks/{taskCode}\` 쿼리 무효화(Invalidate) | Task 상세 컴포넌트 실시간 리렌더링 |
`;
        } else if (analysisType === 'scenario') {
            promptText += `
분석 항목: [💡 AI 테스트 시나리오 추천]
코드 전반의 컴포넌트 구성과 API 호출(트리거 및 결과)을 기반으로, QA 엔지니어가 검증해야 할 가장 중요한 테스트 시나리오들을 표로 추천해 줘. 정상 케이스(Happy Path) 외에 예외(Edge) 케이스도 포함해.
형식:
| 테스트 구분 | 시나리오 설명 | 사전 조건 | 예상 결과 |
|---|---|---|---|
| 🟢 정상 | 유저가 태스크를 등록하면 목록이 즉시 갱신된다 | 로그인 됨 | 목록 맨 위에 신규 태스크가 노출된다 |
| 🔴 예외 | 태스크 등록 실패 시 에러 모달이 표시된다 | 네트워크 오류 발생 | '서버 에러' 알림 노출 후 기존 데이터 유지 |
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
