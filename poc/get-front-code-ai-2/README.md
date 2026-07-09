# (Gemini AI) 프론트엔드 코드 분석기 - 핵심 동작 원리

이 프로젝트는 기존 AST(정적 분석 트리) 기반 분석기의 한계를 극복하기 위해 **Google Gemini 2.5 Flash**의 100만 토큰(1M Token) 컨텍스트 윈도우를 활용하여 구축된 AI 프론트엔드 코드 분석기입니다. 

기존 프로그램들은 절대 흉내 낼 수 없는 **"버튼 클릭부터 API 통신 후 화면 이동까지의 흐름"**을 족집게처럼 정확하게 텍스트로 풀어내는 핵심 엔진의 작동 원리를 설명합니다.

---

## 핵심 엔진: `src/lib/analyzer.ts`

모든 동작의 비밀은 `src/lib/analyzer.ts` 파일에 구현되어 있습니다. 크게 3단계로 나뉘어 동작합니다.

### 1. 프로젝트 전체 코드 수집 (백엔드 로직)
깃허브에서 코드를 임시 폴더에 다운로드받은 뒤, `glob` 라이브러리로 모든 프론트엔드 파일을 찾아서 `mergedCode`라는 하나의 거대한 문자열 변수에 이어 붙입니다.

```typescript
// 1) 깃허브 저장소 다운로드
await git.clone(repoUrl, tempDir, ['--depth', '1']);

// 2) 프론트엔드 파일(js, ts, jsx, tsx)만 싹 다 찾기
const files = await glob('**/*.{js,jsx,ts,tsx}', {
    cwd: tempDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/public/**']
});

// 3) 찾은 파일들을 하나의 문자열(mergedCode)로 병합하기
let mergedCode = '';
for (const file of targetFiles) {
    const filePath = path.join(tempDir, file);
    const code = fs.readFileSync(filePath, 'utf-8');
    
    // 불필요한 주석을 제거하여 용량(토큰) 다이어트
    const minified = code.replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\s*$/gm, '').trim(); 
    if (minified.length > 0) {
        // "--- FILE: 파일명 ---" 구분자를 넣어서 파일들을 하나로 합침
        mergedCode += \`\n\n--- FILE: \${file} ---\n\${minified}\`;
    }
}
```

### 2. 고도화된 프롬프트 지시 (추론의 핵심)
Gemini에게 단순히 "분석해"라고 하지 않고, **"상태 관리자(Redux)와 UI 이벤트를 엮어서 라우팅을 추론해라"**라는 강력한 지시문(Prompt)을 작성합니다.

```typescript
const promptText = \`
너는 뛰어난 시니어 프론트엔드 아키텍트야. 다음은 프론트엔드 프로젝트의 소스 코드 전체(주요 파일)야. 
이 코드를 꼼꼼히 분석하여 아래 두 가지를 마크다운 형식으로 정리해줘.

[주의사항]
- 절대 코드에 없는 API나 경로를 지어내지 마(Hallucination 금지).
- Redux, Zustand, React Query 등 상태 관리 라이브러리가 사용된 경우, dispatch 액션과 UI 이벤트(useEffect, 콜백)를 논리적으로 추론하여 화면 이동 흐름까지 반드시 연결해줘.

1. 화면별 API 묶음 (View-API Mapping):
특정 화면에서 호출되는 API를 정리해. (출력 예시: [HTTP메서드] /api/주소)

2. API Flow (Cross-Screen Flow):
하나의 화면에서 API 호출이 성공한 뒤, 다른 화면으로 라우팅(이동)하며 이어지는 흐름이 있다면 인과관계를 추론해서 정리해.

코드 분석 대상:
\${mergedCode} // <-- 1번에서 만든 거대한 프로젝트 전체 코드 문자열 삽입
\`;
${mergedCode} // <-- 1번에서 만든 거대한 프로젝트 전체 코드 문자열 삽입
`;
```

### 3. AI의 논리적 추론 및 연결 (실행부)
이제 저 엄청난 길이의 텍스트(프롬프트 + 프로젝트 전체 소스코드)를 구글의 `Gemini 2.5 Flash` 모델에게 전송합니다. 여기서 AI가 100만 토큰의 뇌 용량을 풀가동해서 징검다리 로직을 이어 붙입니다.

```typescript
console.log(`Sending to Gemini API (Prompt size: ${promptText.length} chars)...`);

// 💡 여기서 Gemini가 모든 코드를 문맥적으로 엮어내어 마크다운 텍스트(result)로 뱉어냅니다!
const result = await promptGemini(promptText); 

return result;
```

---

## 4. Gemini API 키 연동 (`src/lib/gemini.ts`)
앞서 만든 프롬프트를 실제 구글의 AI 모델로 전송하기 위해 `@google/genai` 공식 SDK를 사용하여 연동합니다.

환경 변수(`.env.local`)에 `GEMINI_API_KEY`를 등록하면, `src/lib/gemini.ts` 파일에서 이 키를 가져와 인증을 수행하고 `gemini-2.5-flash` 모델을 호출합니다.

```typescript
import { GoogleGenAI } from '@google/genai';

// 1) .env.local 파일에서 발급받은 API 키 불러오기
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
}

// 2) GoogleGenAI 클라이언트 초기화
const ai = new GoogleGenAI({ apiKey });

export async function promptGemini(promptText: string) {
    // 3) gemini-2.5-flash 모델에 프롬프트 전송 (최대 100만 토큰 지원)
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
            temperature: 0.2, // 분석의 정확도를 높이기 위해 창의성(temperature)을 낮춤
            maxOutputTokens: 8192,
        }
    });

    return response.text;
}
```

---

## 결론
**"모든 파일을 하나로 합친다 ➡️ 100만 토큰을 버틸 수 있는 AI에게 완벽한 지시문과 함께 던진다"**
이 2가지 조합 덕분에 기존 파서로는 절대 불가능했던 족집게 같은 분석 결과를 뽑아낼 수 있습니다.
