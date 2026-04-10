import { NextResponse } from 'next/server';
import { generateUPSCIdentity } from '@/lib/ai/google-embeddings';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { deductCredit } from '@/lib/credits';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subject = formData.get("subject") as string;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
        return NextResponse.json({ error: "Fatal Security Alert: Absolute Identity Missing." }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
        return NextResponse.json({ error: "Identity Verification Failure." }, { status: 401 });
    }

    const userId = user.id;

    if (!file || !subject) {
      return NextResponse.json({ error: "Missing Target Image Context or Subject." }, { status: 400 });
    }

    // Attempt Deduction Natively First
    try {
       await deductCredit(userId, 5, `X-Ray AI Generation (${subject})`);
    } catch (err: any) {
       if (err.message === "INSUFFICIENT_CREDITS") {
          return NextResponse.json({ error: "Insufficient AI Credits. Please top up your ledger." }, { status: 402 });
       }
       return NextResponse.json({ error: "Credit Ledger Sync Failed." }, { status: 500 });
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Native Google API Credentials missing for Agent Synthesis." }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // PHASE 1: Parse the file natively
    let extractedText = "";
    
    // Convert Blob to Buffer safely
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isPdf = file.type === "application/pdf" || (file.name && file.name.endsWith(".pdf"));
    const isImage = file.type.startsWith("image/");

    if (isPdf || isImage) {
      try {
         const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
         const prompt = "Extract literally all textual data, words, numbers, and references exactly as written from this document or image. Provide only the raw transcription.";
         
         const mimeType = isPdf ? "application/pdf" : file.type;

         const config = {
            inlineData: {
               data: buffer.toString("base64"),
               mimeType: mimeType
            }
         };
         
         // Fix: Ensure Part array exact mappings
         const result = await model.generateContent([{ text: prompt }, config]);
         extractedText = result.response.text();
      } catch (e: any) {
         console.error("Multimodal Extraction Error:", e);
         extractedText = "Fallback: Document Extraction Native Engine Failed.";
      }
    } else {
      extractedText = "Unsupported MimeType fallback.";
    }

    // PHASE 2: SENTENCE CHUNKING & RAG VECTOR DEPLOYMENT
    let ragContext = "";
    if (extractedText && extractedText.length > 20) {
       // Chunking array (max 15 sentences)
       const sentences = extractedText.replace(/\n/g, ' ').split(/(?<=[.!?])\s+/);
       const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 10).slice(0, 15);
       
       console.log(`Triggering Native Vector Engine for ${cleanSentences.length} Chunks explicitly for Subject: ${subject}...`);
       
       for (let i = 0; i < cleanSentences.length; i++) {
          try {
             const chunk = cleanSentences[i];
             const queryVector = await generateUPSCIdentity(chunk);
             
             // RPC query with p_subject
             const { data, error } = await supabase.rpc('match_xray_subject_references', {
               query_embedding: queryVector,
               match_threshold: 0.80,
               match_count: 1,
               p_subject: subject
             });

             if (!error && data && data.length > 0) {
               const match = data[0];
               ragContext += `- Found Match for '${chunk.substring(0, 30)}...':\n`;
               ragContext += `   Deep Dive: ${match.deep_dive}\n`;
               ragContext += `   Current Affairs: ${match.current_affairs}\n\n`;
             }
          } catch(e) {
             console.log("Vector DB Miss/Error on chunk iteration.", e);
          }
       }
    }

    // PHASE 3: AGENT SYNTHESIS & TARGET EXPORT
    const ragInjection = ragContext ? `\n\n[SYSTEM VECTOR DB MATCHES FOR '${subject}']:\n${ragContext}\nYou MUST heavily prioritize these exact Deep Dives and Current Affairs arrays above your own synthesis!` : '';

    const agentPrompt = `
      I have just submitted a parsed document to you relating to ${subject}.
      Extracted Document Text:
      "${extractedText.substring(0, 3000)}" ${ragInjection}
      
      Using the "UPSC Master Mentor" methodology:
      Analyze this text strictly from a UPSC Civil Services perspective.
      1. Formulate your response using standard 'Intro-Body-Conclusion' flow.
      2. Synthesize Vector DB Matches if any exist into the Deep Dive and current affairs nodes.
      
      You MUST output EXACTLY raw parseable JSON strictly using this format, and absolutely nothing else.
      IMPORTANT: DO NOT USE NESTED JSON OBJECTS. Write highly readable, plain-text paragraphs or markdown bullet points natively inside these 5 exact string fields:
      {
        "deep_dive": "Write detailed, fully readable paragraphs here...",
        "current_affairs": "Write your readable notes here...",
        "prelims_practice": "...",
        "history": "...",
        "references": "..."
      }
    `;

    const model = genAI.getGenerativeModel({ 
       model: "gemini-1.5-flash",
       systemInstruction: `You are the absolute UPSC Master Mentor for ${subject}. 
       Your goal is to assist aspirants with conceptual clarity and current affairs integration natively.
       Core Persona Rules:
       - Incorporate retrieved RAG contexts naturally into the response if provided.
       - Map perfectly to GS Papers.
       - Provide analytical & objective viewpoints.
       - NEVER use conversational filler. OUTPUT ONLY flat JSON strings for the 5 requested keys. Do not nest objects.`
    });

    const result = await model.generateContent(agentPrompt);
    const responseText = result.response.text().trim();
    
    // Hardened JSON Extractor Regex to catch Gemini conversational wrappers
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)```/) || responseText.match(/```\n?([\s\S]*?)```/);
    const cleanJsonString = jsonMatch ? jsonMatch[1].trim() : responseText.trim().replace(/^\{/g, '{').replace(/\}$/g, '}');

    let crewPayload;
    try {
       crewPayload = JSON.parse(cleanJsonString);
    } catch(e) {
       console.error("Agent JSON Parse Error. Raw Text:", responseText);
       throw new Error("Generative Engine failed to strictly structure JSON matrices securely.");
    }
    
    const enforceString = (val: any): string => {
       if (typeof val === 'string') {
          try {
             // If model double-stringified JSON natively, unpack it
             const parsed = JSON.parse(val);
             if (typeof parsed === 'object' && parsed !== null) {
                return enforceString(parsed);
             }
          } catch(e) {}
          return val.replace(/```json/gi, '').replace(/```/g, '').trim();
       }
       if (Array.isArray(val)) {
          return val.map(v => enforceString(v)).join('\n\n');
       }
       if (typeof val === 'object' && val !== null) {
          // Flatten nested keys into readable uppercase headers dynamically
          return Object.entries(val)
             .map(([k, v]) => `**${k.toUpperCase().replace(/_/g, ' ')}**\n${enforceString(v)}`)
             .join('\n\n');
       }
       return String(val || "Processing Synthesis Missing");
    };
    
    const enforcedPayload = {
       deep_dive: enforceString(crewPayload.deep_dive),
       current_affairs: enforceString(crewPayload.current_affairs),
       prelims_practice: enforceString(crewPayload.prelims_practice),
       history: enforceString(crewPayload.history),
       references: enforceString(crewPayload.references)
    };

    // Firebase Historical Insertion Sequence
    try {
        await addDoc(collection(db, "users", userId, "xray_history"), {
           subject: subject,
           sentenceExtracted: extractedText.substring(0, 150) + "...",
           matchFound: ragContext !== "",
           payload: enforcedPayload,
           createdAt: serverTimestamp()
        });
    } catch(err) {
        console.error("Firebase History Push Error:", err);
    }

    return NextResponse.json({
       match: ragContext !== "", 
       similarity: 0,
       ...enforcedPayload
    });

  } catch (error: any) {
    console.error('Native Agent Construction Error:', error);
    return NextResponse.json({ error: error.message || 'Internal NextJS Architecture Error: Fatal Construction.' }, { status: 500 });
  }
}
