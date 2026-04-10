import { NextResponse } from 'next/server';
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: 'Topic explicitly required for Mindmap array generation.' }, { status: 400 });
    }

    // Global Caching Check
    const normalizedTopic = topic.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const cacheRef = doc(db, 'global_cache_mindmaps', normalizedTopic);
    const cacheSnap = await getDoc(cacheRef);
    if (cacheSnap.exists()) {
        console.log(`Global Mindmap Cache HIT natively for topic: ${topic}`);
        return NextResponse.json({ mapData: cacheSnap.data().mapData });
    }

    const prompt = `Create a massive, highly detailed, deeply nested Mindmap structure for the UPSC Mains examination topic: "${topic}". 
    The architecture must strictly outline: Historical Context, Causes/Factors, Impacts (Social/Economic/Political), Government Initiatives, Challenges, and a Way Forward/Conclusion.
    
    The output MUST STRICTLY be a pristine JSON object matching this recursive interface exactly:
    {
      "title": "${topic}",
      "children": [
         {
           "title": "Causes",
           "children": [
              { "title": "Economic Factors", "children": [{"title": "Poverty"}, {"title": "Unemployment"}] }
           ]
         }
      ]
    }
    
    Return ONLY valid JSON without ANY markdown formatting wrappers (no \`\`\`json).`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "PrepAssist V2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
       console.error("OpenRouter Response Error:", await response.text());
       throw new Error("OpenRouter Synthesis Failed");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    // Strict Cleanup
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const mapData = JSON.parse(jsonStr);

    try {
        await setDoc(cacheRef, { mapData, originalTopic: topic });
        console.log(`Saved exact Mindmap to Global Cache natively: ${topic}`);
    } catch(e) { 
        console.error("Global Cache write drop", e); 
    }

    return NextResponse.json({ mapData });
  } catch (error: any) {
    console.error('[Mindmap] Generation Mapping Error:', error);
    return NextResponse.json({ error: 'Structural Synthesis Failed natively.' }, { status: 500 });
  }
}
