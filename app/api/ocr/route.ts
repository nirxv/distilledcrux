import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken";

export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(req: NextRequest) {
  // Auth check
  const token = req.headers.get("x-user-token") ?? "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await verifyFirebaseToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const rawFiles = formData.getAll("files") as File[];
    const files = [...rawFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    if (!files.length)
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    if (files.length > MAX_FILES)
      return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE)
        return NextResponse.json({ error: "File too large (max 20MB each)" }, { status: 400 });
      if (!ALLOWED_TYPES.includes(file.type))
        return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
    }

    // Convert files to base64 for Mistral
    const imageContents = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const b64 = buffer.toString("base64");
        const mimeType = file.type || "image/jpeg";
        return `data:${mimeType};base64,${b64}`;
      })
    );

    const ocrPrompt = `You are a precise handwriting transcription engine for UPSC Mains Optional answer sheets. Transcribe every word exactly as written.

RULES:
- Transcribe ALL words — do not skip, summarise, or compress anything
- Join hyphenated line-breaks into one word
- Do NOT preserve original line breaks — merge each paragraph into continuous flowing text
- Only use a newline when a new paragraph, heading, or section begins
- Never correct spelling silently — transcribe exactly what is written
- Thinker/scholar names are critical — transcribe letter for letter as written
- If uncertain (70-89% confident): add (?) after the word
- If unreadable (<70%): write [illegible]
- Preserve paragraph breaks as blank lines
- Skip the question text at the top — start from the first word of the answer body
- Output ONLY the transcribed handwritten text — nothing else
- NEVER output markdown headers (##), step descriptions, meta-commentary, reasoning, or explanations
- Do NOT narrate what you are doing — just output the transcription directly

Output the transcription now:`;

    // Build Mistral message content — one image_url block per page
    const contentBlocks: object[] = imageContents.map(dataUrl => ({
      type: "image_url",
      image_url: dataUrl,
    }));
    contentBlocks.push({ type: "text", text: ocrPrompt });

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [{ role: "user", content: contentBlocks }],
        temperature: 0.0,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Mistral OCR failed:", res.status, err);
      return NextResponse.json({ error: "OCR failed. Please try a clearer image.", detail: err }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("OCR route error:", err);
    return NextResponse.json({ error: "OCR failed." }, { status: 500 });
  }
}
