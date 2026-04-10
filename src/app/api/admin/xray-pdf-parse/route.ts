import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Native aggressive timeout extension for heavy PDF document arrays.
export const maxDuration = 60; 

/**
 * Native Resilience Helper: Implementing multi-attempt exponential backoff for 2026 free tiers.
 */
async function executeWithResilience<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
   let lastError: any;
   for (let i = 0; i < retries; i++) {
      try {
         return await fn();
      } catch (error: any) {
         lastError = error;
         const isRateLimit = error?.message?.includes("429") || error?.status === 429;
         const isPotentialTransient = error?.status >= 500 || error?.message?.includes("fetch");
         
         if ((isRateLimit || isPotentialTransient) && i < retries - 1) {
            const waitTime = (i + 1) * 4000; // 4s, 8s, 12s backoff
            console.warn(`[${label}] Resilience Triggered (Attempt ${i+1}/${retries}). Error: ${error.message}. Waiting ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
         }
         throw error;
      }
   }
   throw lastError;
}

function bufferToGenerativePart(buffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        
        if (!token) return NextResponse.json({ error: "Missing Security Token" }, { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return NextResponse.json({ error: "Unauthenticated Node." }, { status: 401 });

        const userDoc = await getDoc(doc(db, "users", user.id));
        if (!userDoc.exists() || userDoc.data().role !== "admin") {
            return NextResponse.json({ error: "Insufficient Matrix Clearance." }, { status: 403 });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
        if (!apiKey) return NextResponse.json({ error: "Fatal Error: Missing Native API Credentials." }, { status: 500 });
        
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        
        if (!file) {
            return NextResponse.json({ error: "Missing Target PDF Documentation Matrix." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfPart = bufferToGenerativePart(buffer, "application/pdf");

        const genAI = new GoogleGenerativeAI(apiKey);
        const prompt = "Extract absolutely all text mechanically from this academic PDF document exactly matching its linear layout natively. Do not summarize, skip, or format using markdown. Process and extract raw content seamlessly across every page.";
        let responseText = "";

        try {
           const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
           const result = await executeWithResilience(() => model.generateContent([prompt, pdfPart]), "Tier 1: 2.5 Flash");
           responseText = result.response.text();
        } catch (e: any) {
           console.warn("Tier 1 Failed, trying Tier 2 (1.5 Flash):", e.message);
           try {
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
              const result = await executeWithResilience(() => model.generateContent([prompt, pdfPart]), "Tier 2: 1.5 Flash");
              responseText = result.response.text();
           } catch (e2: any) {
              console.warn("Tier 2 Failed, trying Tier 3 (1.5 Pro):", e2.message);
              try {
                 const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                 const result = await executeWithResilience(() => model.generateContent([prompt, pdfPart]), "Tier 3: 1.5 Pro");
                 responseText = result.response.text();
              } catch (ultimateError: any) {
                 console.error("CRITICAL: All Admin Extraction Tiers Exhausted.", ultimateError);
                 throw new Error(`Fatal Extraction Failure: ${ultimateError.message}`);
              }
           }
        }

        return NextResponse.json({ success: true, text: responseText });
    } catch (e: any) {
        console.error("PDF Flash Extractor Node Panic:", e);
        return NextResponse.json({ error: e.message || "Hardware or Network execution layer dropped." }, { status: 500 });
    }
}
