import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Validating Native Google Engine Connectivity dynamically to bypass ES6 hoisting limits.
 */

/**
 * Generates a 768-dimension vector using text-embedding-004.
 * Prepend a task-specific instruction to optimize for UPSC academic context.
 */
async function executeWithResilience<T>(fn: () => Promise<T>, label: string): Promise<T> {
   try {
      return await fn();
   } catch (error: any) {
      if (error?.message?.includes("429") || error?.status === 429) {
         console.warn(`[${label}] Rate Limited. Initializing 4s passive cool-down...`);
         await new Promise(r => setTimeout(r, 4000));
         return await fn();
      }
      throw error;
   }
}

export async function generateUPSCIdentity(text: string): Promise<number[]> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    if (!apiKey) {
      throw new Error("Missing Native Google API Credentials.");
    }
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' });
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });
    
    // Adding instruction helps the model focus on academic/educational retrieval
    const taskText = `Represent this UPSC academic sentence for retrieval: ${text}`;

    const result = await executeWithResilience(() => model.embedContent(taskText), "Embedding Generation");
    const embedding = result.embedding;
    
    if (!embedding.values) {
       throw new Error("No vector sequences extracted natively.");
    }

    // Returns the 768-float array ready for Supabase pgvector insertion
    return embedding.values; 
  } catch (error) {
    console.error("Vectorization Semantic Error:", error);
    throw new Error("Failed to generate vector semantic signature.");
  }
}
