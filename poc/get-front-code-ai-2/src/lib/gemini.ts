import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
}

const ai = new GoogleGenAI({ apiKey });

export async function promptGemini(promptText: string) {
    try {
        console.log("Starting Gemini API inference...");
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: promptText,
            config: {
                temperature: 0.2, // Low temperature for more deterministic analysis
                maxOutputTokens: 8192,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ]
            }
        });

        const finishReason = response.candidates?.[0]?.finishReason;
        console.log("Gemini API Finished with reason:", finishReason);

        return response.text;
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        
        // 429 Rate Limit 에러 처리
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota exceeded')) {
            throw new Error("⚠️ 구글 Gemini API 무료 티어 한도를 초과했습니다 (1분에 15회 요청 제한). 서버 보호를 위해 딱 1분만 기다리셨다가 다시 버튼을 눌러주세요!");
        }
        
        throw new Error("Gemini API 호출 중 오류가 발생했습니다: " + (error?.message || '알 수 없는 오류'));
    }
}
