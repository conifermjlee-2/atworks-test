import { getLlama, LlamaChatSession } from "node-llama-cpp";
import path from "path";
import fs from "fs";

let llamaCache: any = null;
let modelCache: any = null;

export async function getModel() {
    const modelPath = path.join(process.cwd(), "models", "qwen2.5-coder.gguf");
    
    if (!fs.existsSync(modelPath)) {
        throw new Error("Model file not found. Please run 'node scripts/download-model.mjs' first.");
    }

    if (!llamaCache) {
        // Initialize llama backend
        llamaCache = await getLlama();
    }
    
    if (!modelCache) {
        // Load the model into memory
        modelCache = await llamaCache.loadModel({ modelPath });
    }
    
    return { llama: llamaCache, model: modelCache };
}

export async function promptLlama(promptText: string) {
    const { model } = await getModel();
    
    // Create a new context for this prompt
    const context = await model.createContext({
        contextSize: Math.max(4096, 8192) // Allow enough context for code analysis
    });
    
    try {
        const session = new LlamaChatSession({
            contextSequence: context.getSequence()
        });
        
        console.log("Starting AI inference...");
        const response = await session.prompt(promptText);
        return response;
    } finally {
        // Always dispose context to free up memory
        await context.dispose();
    }
}
