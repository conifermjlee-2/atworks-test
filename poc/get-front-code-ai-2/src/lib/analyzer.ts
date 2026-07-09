import simpleGit from 'simple-git';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { promptGemini } from './gemini';

export async function analyzeRepoWithAI(repoUrl: string): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-front-code-ai-2-'));
    const git = simpleGit();

    try {
        console.log(`Cloning repository: ${repoUrl}`);
        await git.clone(repoUrl, tempDir, ['--depth', '1']);

        console.log(`Finding source files...`);
        // Target typical frontend files
        const files = await glob('**/*.{js,jsx,ts,tsx}', {
            cwd: tempDir,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/public/**']
        });

        // To fit into context window, let's filter for likely view/api components
        const targetFiles = files.filter(f => {
            const normalized = f.replace(/\\/g, '/');
            return normalized.includes('pages/') || 
                   normalized.includes('app/') || 
                   normalized.includes('api/') || 
                   normalized.includes('services/') || 
                   normalized.includes('hooks/') ||
                   normalized.includes('components/');
        });

        let mergedCode = '';
        
        // Merge code into a single string
        for (const file of targetFiles) {
            const filePath = path.join(tempDir, file);
            const code = fs.readFileSync(filePath, 'utf-8');
            // Basic minification to save tokens
            const minified = code.replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\s*$/gm, '').trim(); 
            if (minified.length > 0) {
                mergedCode += `\n\n--- FILE: ${file} ---\n${minified}`;
            }
        }

        // Gemini 2.5 Flash has a 1M token context, so we don't need a harsh 30k char limit anymore.
        // But let's cap at around 1,000,000 chars to prevent memory issues during string processing.
        const MAX_CHARS = 1000000; 
        if (mergedCode.length > MAX_CHARS) {
            mergedCode = mergedCode.substring(0, MAX_CHARS) + "\n... (TRUNCATED DUE TO LENGTH) ...";
        }

        if (mergedCode.trim().length === 0) {
            return "분석할 수 있는 프론트엔드 코드(React/Next.js)를 찾지 못했습니다.";
        }

        const promptText = `
너는 뛰어난 시니어 프론트엔드 아키텍트야. 다음은 프론트엔드 프로젝트의 소스 코드 전체(주요 파일)야. 
이 코드를 꼼꼼히 분석하여 아래 두 가지를 마크다운 형식으로 정리해줘.
한국어로 친절하고 명확하게 답변해줘.

[주의사항]
- 절대 코드에 없는 API나 경로를 지어내지 마(Hallucination 금지).
- Redux, Zustand, React Query 등 상태 관리 라이브러리가 사용된 경우, dispatch 액션과 UI 이벤트(useEffect, 콜백)를 논리적으로 추론하여 화면 이동 흐름까지 반드시 연결해줘.

1. 화면별 API 묶음 (View-API Mapping):
특정 화면(실제 라우팅 경로, 예: src/app/page.tsx는 '/', src/app/create/page.tsx는 '/create')에서 호출되는 API를 정리해.
출력 형식 예시:
### 🖥️ 화면: /라우팅경로
- [HTTP메서드] /실제/api/주소/{동적변수명}

2. API Flow (Cross-Screen Flow):
하나의 화면에서 API 호출이 성공한 뒤, 다른 화면으로 라우팅(이동)하며 이어지는 흐름이 있다면 인과관계를 추론해서 정리해.
출력 형식 예시:
### 🔄 Flow 1
1. **\`/시작화면\`**
   - \`[HTTP메서드] /실제/api/주소\` 호출 성공 시 ➡️ **\`/다음화면\` 으로 이동**

코드 분석 대상:
${mergedCode}
        `;

        console.log(`Sending to Gemini API (Prompt size: ${promptText.length} chars)...`);
        const result = await promptGemini(promptText);

        return result || "Gemini 분석 결과를 가져오지 못했습니다.";

    } catch (error) {
        console.error(error);
        throw new Error("저장소 분석 중 오류가 발생했습니다.");
    } finally {
        // Cleanup temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
