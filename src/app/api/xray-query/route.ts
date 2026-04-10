import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Native Fallback Engine Initialization
const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

async function executeWithResilience<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
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

export async function POST(req: Request) {
  try {
    const { sentence } = await req.json();

    if (!sentence) {
      return NextResponse.json({ error: 'Sentence is vital for extraction.' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'Native Google API Credentials missing for fallback generator.' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const extractionPrompt = `
      You are a strict UPSC Professor. I have a sentence extracted from a document. 
      Analyze this sentence strictly from the UPSC Civil Services perspective: "${sentence}"
      
      Extract and generate exactly the following JSON keys:
      {
        "subject": "GS Paper 1/2/3/4 + Specific Subject",
        "deep_dive": "Historical context, core definitions, and conceptual deep dive (200 words)",
        "current_affairs": "Recent relevant current affairs/news related to this topic (100 words)",
        "prelims_practice": "1 MCQ strictly for UPSC Prelims style with 4 options and correct answer",
        "history": "Historical importance or legacy of this topic",
        "references": "Laxmikanth / Spectrum / NCERT Book references"
      }
      
      Output ONLY raw parseable JSON without any markdown formatting or codeblocks.
    `;

    const result = await executeWithResilience(() => model.generateContent(extractionPrompt), "Query Synthesis");
    const responseText = result.response.text().trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');
    
    let generatedPackage;
    try {
      generatedPackage = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON Mapping Error in Fallback:', responseText);
       // Simple regex extraction if JSON fails
       const extractKey = (key: string) => {
         const match = responseText.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'));
         return match ? match[1] : "Natively synthesized data unavailable.";
       };
       generatedPackage = {
         subject: extractKey("subject"),
         deep_dive: extractKey("deep_dive"),
         current_affairs: extractKey("current_affairs"),
         prelims_practice: extractKey("prelims_practice"),
         history: extractKey("history"),
         references: extractKey("references")
       };
    }

    return NextResponse.json({
      match: false,
      similarity: 0,
      ...generatedPackage
    });

  } catch (error: any) {
    console.error('Final Generation Node Failure:', error);
    return NextResponse.json({ error: 'Deep Synthesis Engine reached fatal execution state.' }, { status: 500 });
  }
}
