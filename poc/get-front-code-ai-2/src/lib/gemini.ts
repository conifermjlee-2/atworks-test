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
            model: 'gemini-2.5-flash',
            contents: promptText,
            config: {
                temperature: 0.2, // Low temperature for more deterministic analysis
                maxOutputTokens: 8192,
            }
        });

        return response.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Gemini API 호출 중 오류가 발생했습니다.");
    }
}
