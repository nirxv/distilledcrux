import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();
    if (!transcript?.trim())
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });

    // ── Pre-extract [Q]: markers written by the PDF-mode OCR ──────────────────
    // These are deterministic — no LLM needed for this step.
    // Format injected by ocr/route.ts (pdf mode): "[Q]: <question text>"
    const qMarkers: string[] = [];
    for (const line of transcript.split("\n")) {
      const m = line.match(/^\[Q\]:\s*(.+)/);
      if (m) qMarkers.push(m[1].trim());
    }

    const prompt = `You are analysing a UPSC History Optional handwritten answer sheet that has been OCR-transcribed into plain text.
Your task: segment this transcript into individual question-answer pairs.

TRANSCRIPT:
"""
${transcript}
"""

Rules:
- Look for question number markers like "Q1", "Q.1", "1.", "3(a)", "7b", "5(c)", "Answer 1", etc.
- Each marker signals the start of a new answer
- Lines starting with "[Q]: " contain the student-written question text — copy the text after "[Q]: " verbatim as questionText (do NOT include the "[Q]: " prefix itself)
- If no "[Q]: " line is present for a segment, check if the student wrote the question text above their answer — if so, extract it; otherwise use empty string
- Extract the complete answer body for each question (everything AFTER the question text/[Q]: line until the next question marker) — do NOT include [Q]: lines in the answerText
- For marks: look for patterns like "(10M)", "10 marks", "15M" near the question number — if absent, default to 15
- If you cannot find any question markers, treat the entire transcript as one answer with questionNumber "Q1"

Return ONLY a JSON array, no markdown, no preamble:
[
  {
    "questionNumber": "Q1",
    "marks": 15,
    "questionText": "question text from [Q]: line or student handwriting, else empty string",
    "answerText": "complete answer body without [Q]: lines"
  }
]`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          { role: "system", content: "You are a JSON-only response bot. Your entire response must be a valid JSON array starting with [ and ending with ]. No preamble, no markdown fences, no commentary." },
          { role: "user", content: prompt },
        ],
        temperature: 0.0,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: "Detection failed: " + err }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";

    // Aggressively clean: strip markdown fences, then slice from first [ to last ]
    const stripped = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    const clean = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;

    let segments: any[] = [];
    try {
      segments = JSON.parse(clean);
    } catch {
      // Fallback: treat the entire transcript as one segment
      segments = [{
        questionNumber: "Q1",
        marks: 15,
        questionText: qMarkers[0] ?? "",
        answerText: transcript.replace(/^\[Q\]:.*$/gm, "").trim(),
      }];
      return NextResponse.json({ segments });
    }

    // ── Post-process: overlay pre-extracted [Q]: markers onto segments ─────────
    // If the LLM failed to extract questionText but we found [Q]: markers,
    // fill them in by order (marker 0 → segment 0, marker 1 → segment 1, …).
    // This is the reliable fallback: deterministic regex beats LLM for this case.
    if (qMarkers.length > 0) {
      segments = segments.map((seg: any, i: number) => {
        if (seg.questionText && seg.questionText.trim()) return seg; // LLM got it
        if (qMarkers[i]) return { ...seg, questionText: qMarkers[i] };
        return seg;
      });
    }

    // Strip any accidental [Q]: lines from answerText
    segments = segments.map((seg: any) => ({
      ...seg,
      answerText: (seg.answerText || "").replace(/^\[Q\]:.*$/gm, "").trim(),
    }));

    return NextResponse.json({ segments });
  } catch (err) {
    console.error("detect-questions error:", err);
    return NextResponse.json({ error: "Detection failed" }, { status: 500 });
  }
}
