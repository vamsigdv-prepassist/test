import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Native UPSC Identity Vectorization: Converting chunks into high-dimension semantic tensors.
 * We prioritize the stable text-embedding-004 engine for UPSC retrieval precision.
 */
export async function generateUPSCIdentity(text: string): Promise<number[]> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    if (!apiKey) {
      throw new Error("Missing Native Google API Credentials.");
    }

    // Adding instruction helps the model focus on academic/educational retrieval
    const taskText = `Represent this UPSC academic sentence for retrieval: ${text}`;

    // We use direct REST fetch for maximum reliability across SDK versions
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: taskText }] }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Direct Embedding API Error:", errorBody);
      throw new Error(`Native Embedding Fetch Failed: ${errorBody.substring(0, 100)}`);
    }

    const data = await response.json();
    const embeddingValues = data.embedding?.values;

    if (!embeddingValues) {
      throw new Error("No vector sequences extracted natively from direct REST fetch.");
    }

    // Returns the 768-float array ready for Supabase pgvector insertion
    return embeddingValues;
  } catch (error: any) {
    console.error("Vectorization Semantic Error:", error);
    throw new Error("Failed to generate vector semantic signature.");
  }
}
