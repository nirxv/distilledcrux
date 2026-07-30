"use client";
import { useLang } from '@/lib/i18n/LangContext';
import { tr, t } from '@/lib/i18n/ui';
import { saveToHistory, loadHistory, AnswerEntry } from "@/hooks/useAnswerHistory";
import { supabase } from "@/lib/supabase";
import { auth } from '@/lib/firebase';
import { useState, useRef, useCallback, useEffect } from "react";
import { useSubscriptionGate } from "@/hooks/useSubscriptionGate";
import PDFTestEvaluator from '@/components/PDFTestEvaluator';
import MapEvaluator from '@/components/MapEvaluator';


interface Historian {
  name: string;
  work?: string;
  argument: string;
}

interface SectionMark {
  awarded: number;
  out_of: number;
  reasoning: string;
}

interface Evaluation {
  demand_of_question: string[];
  introduction: { what_was_written: string; strengths: string[]; analysis: string; suggestions: string[]; };
  body: { strengths: string[]; weaknesses: string[]; suggestions: string[]; };
  conclusion: { what_was_written: string; strengths: string[]; analysis: string; suggestions: string[]; };
  historians_to_cite: Historian[];
  model_answer: { introduction: string; body: string | string[]; conclusion: string; };
  overall_feedback: string;
  section_marks: {
    introduction: SectionMark;
    body: SectionMark;
    conclusion: SectionMark;
    presentation: SectionMark;
  };
  marks: number;
  marks_out_of: number;
  word_count: number;
  word_count_rating: "LOW" | "GOOD" | "HIGH";
}

function bodyParas(body: string | string[]): string[] {
  const stripMd = (t: string) => t
    .replace(/^#{1,4}\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-•*]\s+/, '')
    .trim();
  if (Array.isArray(body)) return body.map(stripMd).filter(Boolean);
  return body.split(/\n\n+/).map(stripMd).filter(Boolean);
}
// Safely convert any AI field that should be string[] but might come back as object/string
function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (val && typeof val === 'object') return Object.values(val as object).map(String).filter(Boolean);
  if (typeof val === 'string' && val.trim()) return [val];
  return [];
}

// Bold known historian names inside feedback strings (suggestions, weaknesses, etc.)
const HISTORIAN_NAMES = [
  "Vincent Smith","D.D. Kosambi","Kosambi","Romila Thapar","R.S. Sharma","R.C. Majumdar",
  "Upinder Singh","Irfan Habib","Satish Chandra","B.D. Chattopadhyaya","Hermann Kulke",
  "Burton Stein","Nicholas Dirks","Sumit Sarkar","Bipan Chandra","K.A. Nilakanta Sastri",
  "A.L. Basham","John Marshall","Niharranjan Ray","Eric Hobsbawm","Ranajit Guha",
  "Sheldon Pollock","Richard Eaton","David Ludden","Susan Bayly","Christopher Bayly",
  "Jadunath Sarkar","Tapan Raychaudhuri","Dietmar Rothermund","Percival Spear",
  "Stanley Wolpert","Sudipta Kaviraj","Partha Chatterjee","Gyan Prakash","Dipesh Chakrabarty",
  "Tanika Sarkar","Sumit Guha","Muzaffar Alam","Sanjay Subrahmanyam","Velcheru Narayana Rao",
  "Daud Ali","Cynthia Talbot","Phillip Wagoner","George Michell","Vasundhara Filliozat",
];
function boldHistorians(text: string): React.ReactNode[] {
  if (!text) return [text];
  const pattern = new RegExp(`(${HISTORIAN_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    HISTORIAN_NAMES.includes(part) ? <strong key={i} style={{ color: "var(--text)" }}>{part}</strong> : part
  );
}

// Mood emoji + color for a marks gauge, based on % scored
function gaugeMood(pct: number): { emoji: string; color: string; label: string } {
  if (pct >= 75) return { emoji: "😄", color: "var(--green)", label: "Strong answer — keep this up!" };
  if (pct >= 50) return { emoji: "🙂", color: "#3b82f6", label: "Decent attempt — a few gaps to close." };
  if (pct >= 30) return { emoji: "😕", color: "#f59e0b", label: "Learn from your mistakes — keep going!" };
  return { emoji: "😟", color: "var(--red)", label: "Needs significant work — review the feedback below." };
}



async function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  if (file.type === 'application/pdf') return file; // skip PDFs — should not reach here
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function downloadModelAnswerPDF(question: string, marks: number, evaluation: Evaluation) {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
  pdfMake.vfs = pdfFonts.vfs;
  if (!pdfMake.vfs) pdfMake.vfs = {};

  const BLUE  = '#1a4fa0';
  const BLACK = 'var(--bg)';
  const WHITE = '#ffffff';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

  const parseInline = (t: string): any[] => {
    const parts: any[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0, m;
    while ((m = regex.exec(t)) !== null) {
      if (m.index > last) parts.push({ text: t.slice(last, m.index) });
      parts.push({ text: m[1], bold: true, color: BLACK });
      last = m.index + m[0].length;
    }
    if (last < t.length) parts.push({ text: t.slice(last) });
    return parts.length ? parts : [{ text: t }];
  };

  const sectionHeader = (title: string) => ([
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#bbbbbb' }], margin: [0, 10, 0, 4] },
    {
      columns: [
        { canvas: [{ type: 'rect', x: 0, y: 2, w: 4, h: 14, color: BLUE }], width: 10 },
        { text: title.toUpperCase(), fontSize: 11, bold: true, color: BLACK, characterSpacing: 2, width: '*', margin: [4, 2, 0, 0] },
      ],
      margin: [0, 0, 0, 2],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BLUE }], margin: [0, 2, 0, 8] },
  ]);

  const bodyParas = (body: string | string[]): string[] => {
    if (Array.isArray(body)) return body;
    return body.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
  };

  const content: any[] = [];

  // ── HEADER ──
  content.push({
    columns: [
      {
        table: {
          widths: [54], heights: [54],
          body: [[{
            text: 'H.', fontSize: 30, bold: true, font: 'Roboto',
            color: WHITE, fillColor: BLACK, alignment: 'center',
            margin: [0, 8, 0, 0], border: [false, false, false, false],
          }]],
        },
        layout: 'noBorders', width: 66, margin: [0, 0, 0, 0],
      },
      {
        stack: [
          { text: 'historyoptional.xyz', fontSize: 36, bold: true, font: 'Roboto', color: BLACK, margin: [12, 4, 0, 2] },
          { text: 'one-stop solution for everything history optional', fontSize: 7.5, color: 'var(--text3)', italics: true, margin: [14, 0, 0, 0] },
        ],
        width: '*',
      },
      {
        text: dateStr,
        fontSize: 8,
        color: 'var(--text3)',
        alignment: 'right',
        characterSpacing: 1,
        margin: [0, 10, 0, 0],
        width: 'auto',
      },
    ],
    margin: [0, 0, 0, 10],
  });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 3, lineColor: BLUE }], margin: [0, 0, 0, 16] });

  // ── SCORE BADGE ──
  const scoreStr = evaluation.marks + ' / ' + evaluation.marks_out_of;
  const idealWC = marks === 10 ? '150 words' : marks === 15 ? '200 words' : '250 words';
  content.push({
    columns: [
      {
        table: {
          widths: [100],
          body: [[{
            stack: [
              { text: scoreStr, fontSize: 22, bold: true, color: BLACK, alignment: 'center', margin: [0, 8, 0, 2] },
              { text: 'MARKS SCORED', fontSize: 7, color: 'var(--text3)', alignment: 'center', characterSpacing: 1, margin: [0, 0, 0, 6] },
            ],
            fillColor: '#eef3fc', border: [false, false, false, false],
          }]],
        },
        layout: 'noBorders', width: 110,
      },
      {
        stack: [
          { text: 'MODEL ANSWER', fontSize: 14, bold: true, color: BLACK, margin: [12, 8, 0, 4] },
          { text: idealWC + '  ·  ' + marks + ' Marks  ·  UPSC CSM', fontSize: 8, color: 'var(--text3)', margin: [12, 0, 0, 0] },
        ],
        width: '*',
      },
    ],
    margin: [0, 0, 0, 14],
  });

  // ── QUESTION BOX ──
  content.push({
    table: {
      widths: [6, '*'],
      body: [[
        { text: '', fillColor: BLUE, border: [false, false, false, false] },
        {
          stack: [
            {
              columns: [
                { text: 'QUESTION', fontSize: 7, bold: true, color: BLUE, characterSpacing: 2, width: 'auto' },
                { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 400, y2: 4, lineWidth: 0.5, lineColor: '#aaaaaa' }], width: '*', margin: [8, 0, 0, 0] },
              ],
              margin: [0, 0, 0, 6],
            },
            { text: question, fontSize: 12, bold: true, color: BLACK, lineHeight: 1.4 },
          ],
          fillColor: '#eef3fc', border: [false, false, false, false], margin: [12, 10, 12, 12],
        },
      ]],
    },
    layout: 'noBorders', margin: [0, 0, 0, 16],
  });

  // ── INTRODUCTION ──
  sectionHeader('Introduction').forEach((b: any) => content.push(b));
  content.push({ text: parseInline(evaluation.model_answer.introduction), fontSize: 11, color: BLACK, lineHeight: 1.7, marginBottom: 5 });

  // ── BODY ──
  sectionHeader('Body').forEach((b: any) => content.push(b));
  const paras = bodyParas(evaluation.model_answer.body);
  paras.forEach((p: string, idx: number) => {
    content.push({
      columns: [
        { canvas: [{ type: 'ellipse', x: 3, y: 6, r1: 2.5, r2: 2.5, color: BLUE }], width: 14 },
        { text: parseInline(p), fontSize: 11, color: BLACK, lineHeight: 1.65, width: '*' },
      ],
      margin: [8, 0, 0, idx < paras.length - 1 ? 8 : 0],
    });
    if (idx < paras.length - 1) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#dddddd' }], margin: [0, 2, 0, 6] });
    }
  });

  // ── CONCLUSION ──
  sectionHeader('Conclusion').forEach((b: any) => content.push(b));
  content.push({ text: parseInline(evaluation.model_answer.conclusion), fontSize: 11, color: BLACK, lineHeight: 1.7, marginBottom: 5 });

  // ── HISTORIANS ──
  sectionHeader('Historians to Cite').forEach((b: any) => content.push(b));
  evaluation.historians_to_cite.forEach((h: any) => {
    content.push({
      table: {
        widths: [6, '*'],
        body: [[
          { text: '', fillColor: BLUE, border: [false, false, false, false] },
          {
            stack: [
              { text: h.name, fontSize: 12, bold: true, color: BLACK, margin: [0, 0, 0, 2] },
              ...(h.work ? [{ text: h.work, fontSize: 9, color: 'var(--text3)', italics: true, margin: [0, 0, 0, 4] }] : []),
              { text: parseInline(h.argument), fontSize: 10.5, color: BLACK, lineHeight: 1.6 },
            ],
            fillColor: '#eef3fc', border: [false, false, false, false], margin: [10, 8, 10, 10],
          },
        ]],
      },
      layout: 'noBorders', margin: [0, 0, 0, 8],
    });
  });

  const docDef: any = {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 11, color: BLACK },
    pageMargins: [40, 40, 40, 58],
    footer: (currentPage: number, pageCount: number) => ({
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 595, h: 3, color: BLUE }] },
        {
          columns: [
            {
              stack: [
                { text: 'H.  HISTORY OPTIONAL', fontSize: 8, bold: true, color: BLACK },
                { text: 'historyoptional.xyz', fontSize: 7, color: 'var(--text3)', margin: [0, 1, 0, 0] },
              ],
              margin: [40, 10, 0, 0], width: '*',
            },
            {
              stack: [
                { text: currentPage + ' / ' + pageCount, fontSize: 11, bold: true, color: BLACK, alignment: 'right' },
                { text: 'PAGE', fontSize: 6, color: 'var(--text3)', alignment: 'right', characterSpacing: 1, margin: [0, 1, 0, 0] },
              ],
              margin: [0, 9, 40, 0], width: 'auto',
            },
          ],
        },
      ],
    }),
  };

  const slug = question.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'model-answer';
  pdfMake.createPdf(docDef).download(slug + '-model_answer (historyoptional.xyz).pdf');
}


// Convert PDF pages to image Files using pdfjs-dist (bundled)
async function pdfToImages(file: File): Promise<File[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const images: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, canvas, viewport } as any).promise;
    const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.9));
    images.push(new File([blob], `page-${i}.jpg`, { type: 'image/jpeg' }));
  }
  return images;
}

export default function EvaluatePage() {
  const [files, setFiles]           = useState<File[]>();
  const [question, setQuestion]     = useState("");
  const [marks, setMarks]           = useState<10 | 15 | 20>(15);
  const [loading, setLoading]       = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [submittedQ, setSubmittedQ] = useState("");
  const [submittedM, setSubmittedM] = useState<10|15|20>(15);
  const [error, setError]           = useState("");
  const [tab, setTab]               = useState<"eval"|"model"|"hist">("eval");
  const [stage, setStage]           = useState<"form"|"ocr"|"result">("form");
  const [history, setHistory]        = useState<AnswerEntry[]>([]);
  const [openEntry, setOpenEntry]    = useState<AnswerEntry | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [evalMode, setEvalMode] = useState<"single"|"batch"|"map">("single");

  useEffect(() => {
    setSidebarOpen(window.innerWidth > 768);
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
  }, [stage]); // reload whenever stage changes (new eval saved)
  const [extractedText, setExtractedText] = useState("");
  const [processedImageFiles, setProcessedImageFiles] = useState<File[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress]   = useState(0);
  const [evalProgress, setEvalProgress] = useState(0);
  const [evalPhase, setEvalPhase]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [swapIdx, setDragIdx] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

const handleOcr = useCallback(async () => {
    if (!files || files.length === 0) { setError("Please upload at least one file."); return; }
    setError(""); setOcrLoading(true); setOcrProgress(0);
    // Check if any file is a PDF — convert to images first
    let processedFiles = [...files];
    const hasPdf = files.some(f => f.type === 'application/pdf');
    if (hasPdf) {
      try {
        setOcrProgress(8);
        const expanded: File[] = [];
        for (const f of files) {
          if (f.type === 'application/pdf') {
            const pages = await pdfToImages(f);
            expanded.push(...pages);
          } else {
            expanded.push(f);
          }
        }
        processedFiles = expanded;
        setProcessedImageFiles(expanded);
        setOcrProgress(20);
      } catch (e: unknown) {
        setError('PDF conversion failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
        setOcrLoading(false);
        return;
      }
    }
    // Animate OCR progress
    let ocrTimer: ReturnType<typeof setTimeout> | undefined;
    const ocrSteps = [
      { pct: 12, label: "Compressing images…" },
      { pct: 30, label: "Sending to vision model…" },
      { pct: 55, label: "Reading handwriting…" },
      { pct: 78, label: "Parsing text…" },
      { pct: 92, label: "Almost there…" },
    ];
    const runOcrStep = (idx: number) => {
      if (idx >= ocrSteps.length) return;
      setOcrProgress(ocrSteps[idx].pct);
      ocrTimer = setTimeout(() => runOcrStep(idx + 1), 900 + Math.random() * 600);
    };
    setProcessedImageFiles(processedFiles);
    runOcrStep(0);
    const compressed = await Promise.all(processedFiles.map(f => compressImage(f)));
    const fd = new FormData();
    fd.append("question", question);
    compressed.forEach(f => fd.append("files", f));
    try {
      const res = await fetch("/api/ocr", { method: "POST", headers: { "x-user-token": tokenRef.current ?? "" }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");
      setOcrProgress(100);
      clearTimeout(ocrTimer);
      setTimeout(() => {
        setExtractedText(data.text);
        if (data.detectedQuestion && !question.trim()) {
          setQuestion(data.detectedQuestion);
        }
        setStage("ocr");
      }, 400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "OCR failed. Please try again.");
    } finally { setOcrLoading(false); }
  }, [files, question]);

  // ── Subscription gate — must come after handleOcr is defined ──────────────
  const { UsagePill, GateModals, handleEvaluate, usage, increment, slots, showChatLimitModal: showEvalLimitModal, showLoginModal } = useSubscriptionGate(handleOcr);
  // showEvalLimitModal re-used here as the paywall trigger for PDF evaluator
  const tokenRef = useRef<string | null>(null);
  const { langHi } = useLang();
  useEffect(() => {
    // Get Firebase token for owner bypass
    const currentUser = auth.currentUser;
    if (currentUser) {
      currentUser.getIdToken().then(token => {
        tokenRef.current = token ?? usage.token ?? null;
      });
    } else {
      tokenRef.current = usage.token ?? null;
    }
  }, [usage.token]);

  const submit = async () => {
    setError(""); setLoading(true); setEvaluation(null); setEvalProgress(0); setEvalPhase("");
    let evalTimer: ReturnType<typeof setTimeout> | undefined;
    const evalSteps = [
      { pct: 8,  label: "Loading answer into context…" },
      { pct: 18, label: "Checking demand of question…" },
      { pct: 32, label: "Evaluating introduction…" },
      { pct: 48, label: "Analysing body paragraphs…" },
      { pct: 62, label: "Checking historiography…" },
      { pct: 74, label: "Evaluating conclusion…" },
      { pct: 84, label: "Scoring against UPSC rubric…" },
      { pct: 93, label: "Compiling feedback…" },
    ];
    const runEvalStep = (idx: number) => {
      if (idx >= evalSteps.length) return;
      setEvalProgress(evalSteps[idx].pct);
      setEvalPhase(evalSteps[idx].label);
      evalTimer = setTimeout(() => runEvalStep(idx + 1), 1800 + Math.random() * 1200);
    };
    runEvalStep(0);
    const fd = new FormData();
    fd.append("question", question); fd.append("marks", marks.toString());
    fd.append("extractedText", extractedText);
    const evalFiles = processedImageFiles.length > 0 ? processedImageFiles : (files ? [...files] : []);
    if (evalFiles.length > 0) { const compEval = await Promise.all(evalFiles.map(f => compressImage(f))); compEval.forEach(f => fd.append("files", f)); }
    fd.append("lang", langHi ? "hi" : "en");
    try {
      const res  = await fetch("/api/evaluate", { method: "POST", headers: { "x-user-token": tokenRef.current ?? "" }, body: fd });
      const rawText = await res.text();
      console.log("Evaluate raw response:", rawText.slice(0, 500));
      if (!rawText) throw new Error("Empty response from server");
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(res.ok ? "Unexpected response from server. Please try again." : `Server error (${res.status}). Please try again.`);
      }
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      setEvalProgress(100);
      setEvalPhase("Complete.");
      clearTimeout(evalTimer);
      setSubmittedQ(question);
      // Save full evaluation to history
      if (data) {
        saveToHistory({
          question,
          marks: data.marks,
          marksOutOf: data.marks_out_of,
          wordCount: data.word_count,
          wordCountRating: data.word_count_rating,
          overallFeedback: data.overall_feedback,
          sectionMarks: {
            introduction: data.section_marks.introduction,
            body: data.section_marks.body,
            conclusion: data.section_marks.conclusion,
            presentation: data.section_marks.presentation,
          },
          demandOfQuestion: data.demand_of_question,
          introduction: data.introduction,
          body: data.body,
          conclusion: data.conclusion,
          historiansToCite: data.historians_to_cite,
          modelAnswer: data.model_answer,
        });
      }
      setSubmittedM(marks);
      setTimeout(() => setEvaluation(data), 500);
      setStage("result");
      setTab("eval");
      // eval_count tracked server-side in /api/evaluate
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
  };

  const pct      = evaluation ? (evaluation.marks / evaluation.marks_out_of) * 100 : 0;
  const scoreCol = pct >= 70 ? "var(--green)" : pct >= 50 ? "#3b82f6" : "var(--red)";

  return (
    <>
      <style>{`
        .ev-wrap * { box-sizing: border-box; }
        .ev-upload { border: 1.5px dashed #333; border-radius:6px; padding:44px 24px;
          text-align:center; cursor:pointer; background:var(--bg4); transition:all 0.2s; }
        .ev-upload:hover, .ev-upload.has { border-color:var(--accent); background:var(--accent-dim); }
        .ev-ta { width:100%; box-sizing:border-box; background:var(--bg4); border:1.5px solid var(--border2); border-radius:6px;
          color:var(--text); padding:14px 16px; font-family:var(--font-body); font-size:0.95rem;
          resize:vertical; line-height:1.75; transition:border-color 0.2s; outline:none; text-align:left; white-space:pre-wrap; }
        .ev-ta:focus { border-color:var(--accent); }
        .ev-ta::placeholder { color:var(--text3); }
        .ev-mchip { padding:9px 26px; border-radius:4px; cursor:pointer;
          border:1.5px solid var(--border2); background:var(--bg4); color:var(--text2);
          font-family:var(--font-mono); font-size:0.82rem; letter-spacing:0.06em; transition:all 0.15s; }
        .ev-mchip.active { background:var(--accent-dim); border-color:var(--accent); color:var(--accent); }
        .ev-mchip:hover:not(.active) { border-color:var(--text3); color:var(--text2); }
        .ev-btn { width:100%; padding:16px; border:1.5px solid rgba(59,130,246,0.5); overflow:hidden; position:relative;
          background:rgba(59,130,246,0.1); color:var(--accent); font-size:0.78rem;
          font-family:var(--font-mono); cursor:pointer; transition:all 0.2s;
          letter-spacing:0.2em; text-transform:uppercase; border-radius:4px; }
        .ev-btn:hover:not(:disabled) { background:rgba(59,130,246,0.18); border-color:var(--accent); }
        .ev-btn::before { content:''; position:absolute; top:0; left:-75%; width:50%; height:100%; background:linear-gradient(120deg,transparent 0%,rgba(0,0,0,0.09) 50%,transparent 100%); transform:skewX(-20deg); opacity:0; pointer-events:none; z-index:1; }
        .ev-btn:hover:not(:disabled)::before { opacity:1; animation:glass-shine 0.55s ease forwards; }
        .ev-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .ev-btn-sm { padding:10px 20px; width:auto; font-size:0.7rem; }
        .ev-err { background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.3);
          border-radius:4px; padding:12px 16px; color:#f87171;
          font-size:0.85rem; margin-bottom:20px; font-family:var(--font-ui); }
        .ev-score-row { display:flex; justify-content:space-between;
          align-items:flex-end; padding-bottom:36px;
          border-bottom:1px solid #2e2e2e; margin-bottom:32px; }
        .ev-score-num { font-family:var(--font-mono); font-size:5.5rem; font-weight:700; line-height:1; }
        .ev-score-denom { font-family:var(--font-mono); font-size:1.8rem; color:#444; }
        .ev-bar-bg { background:var(--bg4); border-radius:2px; height:4px; overflow:hidden; margin-top:14px; width:260px; }
        .ev-bar-fill { height:100%; border-radius:2px; transition:width 1.2s cubic-bezier(.16,1,.3,1); }
        /* ── MARKS GAUGE ── */
        .ev-gauge { display:flex; align-items:center; gap:18px; background:linear-gradient(135deg,#161616,#111);
          border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:18px 22px; margin-bottom:16px; }
        .ev-gauge-emoji { font-size:2.4rem; line-height:1; flex-shrink:0; }
        .ev-gauge-body { flex:1; min-width:0; }
        .ev-gauge-top { display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
        .ev-gauge-score { font-family:var(--font-mono); font-size:1.3rem; font-weight:700; }
        .ev-gauge-outof { font-family:var(--font-mono); font-size:0.85rem; color:var(--text3); }
        .ev-gauge-label { font-family:var(--font-ui); font-size:0.8rem; color:var(--text2); margin-left:4px; }
        .ev-gauge-track { position:relative; height:8px; border-radius:4px;
          background:linear-gradient(90deg,var(--red),#f59e0b,var(--green)); margin-top:4px; }
        .ev-gauge-arrow { position:absolute; top:-9px; width:0; height:0;
          border-left:6px solid transparent; border-right:6px solid transparent;
          border-top:7px solid #f0f0f0; transform:translateX(-50%); transition:left 1.2s cubic-bezier(.16,1,.3,1); }
        .ev-gauge-scale { display:flex; justify-content:space-between; margin-top:4px;
          font-family:var(--font-mono); font-size:0.62rem; color:var(--text3); }
        .ev-wc { font-family:var(--font-mono); font-size:2.8rem; font-weight:700; color:var(--text); line-height:1; }
        .ev-pill { display:inline-block; padding:3px 12px; border-radius:3px;
          font-family:var(--font-mono); font-size:0.64rem; letter-spacing:0.12em;
          text-transform:uppercase; margin-top:10px; font-weight:600; }
        .pill-g { background:rgba(74,222,128,0.1); color:#4ade80; border:1px solid rgba(74,222,128,0.3); }
        .pill-r { background:rgba(248,113,113,0.1); color:#f87171; border:1px solid rgba(248,113,113,0.3); }
        .pill-y { background:rgba(59,130,246,0.1); color:var(--accent); border:1px solid rgba(59,130,246,0.3); }
        /* ── TABS ── */
        .ev-tabs { display:flex; gap:0; margin-bottom:32px; border-bottom:1px solid rgba(0,0,0,0.07); }
        .ev-tab { padding:13px 28px; cursor:pointer; font-size:0.65rem; letter-spacing:0.2em; text-transform:uppercase; font-family:var(--font-mono); background:none; border:none; color:#444; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.2s; }
        .ev-tab.active { color:#e2e8f0; border-bottom-color:var(--accent); }
        .ev-tab:hover:not(.active) { color:var(--text2); }

        /* ── BASE CARD ── */
        .ev-card { background:linear-gradient(135deg,#161616,#111); border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:28px 30px; margin-bottom:16px; position:relative; overflow:hidden; }
        .ev-card::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(0,0,0,0.02),transparent 60%); pointer-events:none; }
        .ev-card-gold { border-color:rgba(234,179,8,0.18); background:linear-gradient(135deg,#161410,#111); }
        .ev-card-gold::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,rgba(234,179,8,0.4),transparent); }
        .ev-card-green { border-color:rgba(74,222,128,0.12); background:linear-gradient(135deg,#101610,#111); }
        .ev-card-green::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,rgba(74,222,128,0.35),transparent); }
        /* ── STRENGTHS / WEAKNESSES 2-COL ── */
        .ev-sw-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:14px 0; }
        @media (max-width:640px) { .ev-sw-grid { grid-template-columns:1fr; } }
        .ev-sw-col { border-radius:8px; padding:14px 16px; }
        .ev-sw-col-s { background:rgba(74,222,128,0.04); border:1px solid rgba(74,222,128,0.14); }
        .ev-sw-col-w { background:rgba(248,113,113,0.04); border:1px solid rgba(248,113,113,0.14); }
        .ev-sw-head { display:flex; align-items:center; gap:7px; font-family:var(--font-mono); font-size:0.62rem;
          letter-spacing:0.18em; text-transform:uppercase; margin-bottom:10px; }
        .ev-sw-head-s { color:var(--green); }
        .ev-sw-head-w { color:var(--red); }
        .ev-sw-item { display:flex; gap:9px; align-items:flex-start; margin-bottom:9px; font-size:0.86rem;
          line-height:1.65; color:#c0c0c0; font-family:var(--font-body); }
        .ev-sw-item:last-child { margin-bottom:0; }
        .ev-sw-empty { font-size:0.82rem; color:var(--text3); font-style:italic; }

        /* ── SECTION TITLE ── */
        .ev-ct { font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.32em; text-transform:uppercase; color:var(--accent); margin-bottom:18px; display:flex; align-items:center; gap:10px; }
        .ev-ct::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(59,130,246,0.25),transparent); }

        /* ── DEMAND LIST ── */
        .ev-demand-item { display:flex; gap:14px; padding:13px 0; border-bottom:1px solid rgba(0,0,0,0.04); align-items:flex-start; }
        .ev-demand-item:last-child { border-bottom:none; padding-bottom:0; }
        .ev-demand-bullet { width:6px; height:6px; border-radius:50%; background:var(--accent); margin-top:7px; flex-shrink:0; box-shadow:0 0 8px rgba(59,130,246,0.5); }
        .ev-demand-txt { font-size:0.9rem; color:#c4c4c4; line-height:1.75; font-family:var(--font-body); }

        /* ── WHAT YOU WROTE ── */
        .ev-wrote { background:rgba(0,0,0,0.025); border:1px solid rgba(0,0,0,0.07); border-radius:8px; padding:16px 18px; margin-bottom:18px; position:relative; }
        .ev-wrote::before { content:''; position:absolute; left:0; top:12px; bottom:12px; width:3px; background:linear-gradient(180deg,#3b82f6,rgba(59,130,246,0.2)); border-radius:0 2px 2px 0; }
        .ev-wrote-lbl { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.25em; text-transform:uppercase; color:var(--accent); margin-bottom:8px; padding-left:14px; }
        .ev-wrote-txt { font-size:0.88rem; color:var(--text2); line-height:1.75; font-style:normal; padding-left:14px; text-align:justify; }

        /* ── ANALYSIS TEXT ── */
        .ev-analysis { font-size:0.92rem; color:#c8c8c8; line-height:1.85; margin-bottom:18px; font-family:var(--font-body); }

        /* ── SUBLABELS (Strengths / Weaknesses / Suggestions) ── */
        .ev-sl { font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--text3); margin:18px 0 10px; display:flex; align-items:center; gap:8px; }
        .ev-sl::after { content:''; flex:1; height:1px; background:rgba(0,0,0,0.05); }
        .ev-sl.g { color:rgba(74,222,128,0.6); }
        .ev-sl.r { color:rgba(248,113,113,0.5); }

        /* ── LISTS ── */
        ul.ev-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px; }
        ul.ev-list li { padding:10px 14px 10px 16px; background:rgba(0,0,0,0.02); border-radius:6px; border-left:2px solid rgba(0,0,0,0.08); font-size:0.88rem; color:#b0b0b0; line-height:1.7; font-family:var(--font-body); }
        ul.ev-list li.g { border-left-color:rgba(74,222,128,0.45); color:#a7f3c0; background:rgba(74,222,128,0.04); }
        ul.ev-list li.r { border-left-color:rgba(248,113,113,0.4); color:#fecaca; background:rgba(248,113,113,0.04); }

        /* ── QUESTION BOX ── */
        .ev-qbox { background:linear-gradient(135deg,#0d1b3e,#091530); border:1px solid rgba(59,130,246,0.2); border-radius:10px; padding:20px 24px; margin-bottom:20px; }
        .ev-qlabel { font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.25em; text-transform:uppercase; color:var(--accent); margin-bottom:10px; }
        .ev-qtext { font-size:1.05rem; color:#e2e8f0; line-height:1.65; font-family:var(--font-body); }

        /* ── MODEL ANSWER ── */
        .ev-ml { font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.25em; text-transform:uppercase; color:rgba(74,222,128,0.55); margin:22px 0 12px; display:flex; align-items:center; gap:8px; }
        .ev-ml::after { content:''; flex:1; height:1px; background:rgba(74,222,128,0.08); }
        .ev-ml:first-of-type { margin-top:0; }
        .ev-mp { font-size:0.93rem; line-height:1.9; color:#d4d4d4; margin-bottom:0; font-family:var(--font-body); }

        /* ── HISTORIANS ── */
        .ev-hist { padding:22px 0; border-bottom:1px solid rgba(0,0,0,0.05); display:grid; gap:6px; }
        .ev-hist:first-child { padding-top:0; }
        .ev-hist:last-child { border-bottom:none; padding-bottom:0; }
        .ev-hist-name { font-family:var(--font-display); font-size:1.0rem; font-weight:700; color:#60a5fa; letter-spacing:0.01em; }
        .ev-hist-work { font-family:var(--font-mono); font-size:0.68rem; color:var(--text3); letter-spacing:0.05em; }
        .ev-hist-arg { font-size:0.88rem; color:#aaa; line-height:1.75; font-family:var(--font-body); }

        /* ── OVERALL FEEDBACK ── */
        .ev-overall-txt { font-size:0.93rem; line-height:1.9; color:#d4d4d4; font-family:var(--font-body); }

        .ev-fade { animation:ev-fi 0.4s ease; }
        @keyframes ev-fi { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .ev-dl-btn { display:flex; align-items:center; gap:8px; padding:10px 20px;
          border:1.5px solid rgba(74,222,128,0.3); background:rgba(74,222,128,0.06);
          color:#4ade80; font-family:var(--font-mono); font-size:0.68rem;
          letter-spacing:0.15em; text-transform:uppercase; border-radius:4px;
          cursor:pointer; transition:all 0.2s; }
        .ev-dl-btn:hover { background:rgba(74,222,128,0.12); border-color:rgba(74,222,128,0.5); }
        .ev-sec-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:32px; }
        @media(max-width:620px){ .ev-sec-grid { grid-template-columns:repeat(2,1fr); } }
        .ev-sec-card { background:var(--bg4); border:1px solid #2a2a2a; border-radius:6px; padding:16px 14px; }
        .ev-sec-lbl { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.22em;
          text-transform:uppercase; color:var(--text3); margin-bottom:10px; }
        .ev-sec-num { font-family:var(--font-mono); font-size:1.85rem; font-weight:700; line-height:1; }
        .ev-sec-den { font-size:0.9rem; color:#444; }
        .ev-sec-bar-bg { background:var(--bg4); border-radius:2px; height:3px; overflow:hidden; margin:10px 0 8px; }
        .ev-sec-bar-fill { height:100%; border-radius:2px; transition:width 1.2s cubic-bezier(.16,1,.3,1); }
        .ev-sec-rsn { font-size:0.76rem; color:#666; line-height:1.5; font-family:var(--font-ui); }
        .ev-pages { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
        .ev-page-item { position:relative; width:80px; user-select:none; -webkit-user-select:none; }
        .ev-page-arrows { display:flex; justify-content:center; gap:4px; margin-top:5px; }
        .ev-page-item img { width:80px; height:100px; object-fit:cover; border-radius:4px; border:2px solid #333; display:block; transition:border-color 0.15s; }
        .ev-page-arrow { background:var(--bg4); border:1px solid #333; color:#aaa; border-radius:3px; width:34px; height:22px; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
        .ev-page-arrow:hover { background:#333; color:#fff; border-color:var(--text3); } .ev-page-arrow:disabled { opacity:0.2; cursor:default; }
        .ev-page-num { position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.75); color:#fff; font-family:var(--font-mono); font-size:0.6rem; padding:2px 6px; border-radius:3px; }
        .ev-page-del { position:absolute; top:4px; right:4px; background:rgba(248,113,113,0.85); color:#fff; font-size:0.65rem; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; line-height:1; }
        .ev-page-add { width:80px; height:100px; border:1.5px dashed var(--border2); border-radius:4px; background:var(--bg4); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; color:var(--text3); font-size:1.4rem; transition:all 0.15s; }
        .ev-page-add:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-dim); }

      `}</style>

      <div className="ev-layout" style={{ display:"flex", minHeight:"calc(100vh - 60px)", background:"var(--bg3)" }}>

        {/* Mobile-only floating trigger to reopen history drawer */}
        {!sidebarOpen && (
          <button
            className="ev-sidebar-trigger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open past evaluations"
          >
            <span style={{ fontSize:"0.95rem" }}>▸</span>
          </button>
        )}

        {/* Mobile backdrop — only visible+clickable when sidebar open on mobile */}
        {sidebarOpen && (
          <div className="ev-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── History Sidebar ── */}
        <div className="ev-sidebar" data-open={sidebarOpen ? 'true' : 'false'} style={{
          width: sidebarOpen ? 280 : 40, minWidth: sidebarOpen ? 280 : 40,
          borderRight:"1px solid #1e1e1e", background:"var(--bg2)",
          transition:"all 0.25s ease", overflow:"hidden", flexShrink:0,
          display:"flex", flexDirection:"column",
        }}>
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ padding:"14px", background:"transparent", border:"none", borderBottom:"1px solid #1e1e1e", color:"var(--text3)", cursor:"pointer", fontSize:"0.75rem", textAlign:"left", display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}
          >
            <span style={{ fontSize:"1rem" }}>{sidebarOpen ? "◂" : "▸"}</span>
            {sidebarOpen && <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"var(--text3)", whiteSpace:"nowrap" }}>Past Evaluations</span>}
          </button>

          {sidebarOpen && (
            <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
              {history.filter(e => evalMode === "batch" ? e.type === "batch" : evalMode === "map" ? e.type === "map" : !e.type || e.type === "single").length === 0 ? (
                <div style={{ padding:"24px 16px", color:"#444", fontSize:"0.78rem", fontFamily:"var(--font-ui)", lineHeight:1.6 }}>
                  {evalMode === "map" ? "No map evaluations yet. Evaluate Q1 Map first." : evalMode === "batch" ? "No batch evaluations yet. Evaluate a Full Paper / FLT first." : "No evaluations yet. Submit your first answer above."}
                </div>
              ) : history.filter(e => evalMode === "batch" ? e.type === "batch" : evalMode === "map" ? e.type === "map" : !e.type || e.type === "single").map(entry => {
                const pct = Math.round((entry.marks / entry.marksOutOf) * 100);
                const color = pct >= 70 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";
                const isOpen = openEntry?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setOpenEntry(isOpen ? null : entry)}
                    style={{
                      width:"100%", padding:"12px 16px", background: isOpen ? "var(--bg3)" : "transparent",
                      border:"none", borderBottom:"1px solid #1a1a1a",
                      cursor:"pointer", textAlign:"left", transition:"background 0.15s",
                    }}
                    onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "var(--bg3)"; }}
                    onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
                      <span style={{ fontSize:"0.65rem", fontFamily:"var(--font-mono)", color, fontWeight:700 }}>{pct}%</span>
                      <span style={{ fontSize:"0.6rem", color:"#444", fontFamily:"var(--font-mono)" }}>
                        {new Date(entry.date).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
                      </span>
                    </div>
                    <div style={{ fontSize:"0.75rem", color: isOpen ? "#e2e8f0" : "#888", lineHeight:1.4, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                      {entry.question}
                    </div>
                    <div style={{ marginTop:6, height:2, background:"var(--bg4)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:2 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        {openEntry ? (
          /* Past evaluation viewer — full result */
          <div className="ev-wrap" style={{ flex:1, padding:"48px 40px 96px", overflowY:"auto", maxWidth:820 }}>
            <button onClick={() => setOpenEntry(null)} style={{ background:"transparent", border:"1px solid var(--border)", color:"var(--text2)", cursor:"pointer", padding:"6px 14px", borderRadius:4, fontSize:"0.72rem", fontFamily:"var(--font-mono)", marginBottom:32, letterSpacing:"0.1em" }}>
              ← Back to Evaluate
            </button>

            {/* Date + question */}
            <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text3)", marginBottom:10 }}>
              {new Date(openEntry.date).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}
            </div>
            <div className="ev-qtext" style={{ marginBottom:32, paddingBottom:24, borderBottom:"1px solid var(--border)" }}>
              {openEntry.question}
            </div>

            {/* Score row */}
            <div className="ev-score-row">
              <div>
                {(() => { const col = (openEntry.marks/openEntry.marksOutOf) >= 0.7 ? "var(--green)" : (openEntry.marks/openEntry.marksOutOf) >= 0.5 ? "var(--yellow)" : "var(--red)"; return (
                  <><span className="ev-score-num" style={{ color:col }}>{openEntry.marks}</span><span className="ev-score-denom"> /{openEntry.marksOutOf}</span></>
                ); })()}
                {openEntry.wordCount && (
                  <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:"0.65rem", color:"var(--text2)" }}>
                    {openEntry.wordCount} words · <span style={{ color: openEntry.wordCountRating === "GOOD" ? "var(--green)" : "var(--yellow)" }}>{openEntry.wordCountRating}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Marks gauge */}
            {(() => {
              const ePct = (openEntry.marks / openEntry.marksOutOf) * 100;
              const g = gaugeMood(ePct);
              return (
                <div className="ev-gauge">
                  <div className="ev-gauge-emoji">{g.emoji}</div>
                  <div className="ev-gauge-body">
                    <div className="ev-gauge-top">
                      <span className="ev-gauge-score" style={{ color:g.color }}>Marks scored: {openEntry.marks}</span>
                      <span className="ev-gauge-outof">/{openEntry.marksOutOf}</span>
                      <span className="ev-gauge-label">{g.label}</span>
                    </div>
                    <div className="ev-gauge-track">
                      <div className="ev-gauge-arrow" style={{ left:`${ePct}%` }} />
                    </div>
                    <div className="ev-gauge-scale">
                      <span>0</span><span>{Math.round(openEntry.marksOutOf/2)}</span><span>{openEntry.marksOutOf}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Section marks grid */}
            <div className="ev-sec-grid">
              {(["introduction","body","conclusion","presentation"] as const).map(sec => {
                const sm = openEntry.sectionMarks?.[sec];
                if (!sm) return null;
                const pct = (sm.awarded / sm.out_of) * 100;
                const col = pct >= 70 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";
                return (
                  <div key={sec} className="ev-sec-card">
                    <div className="ev-sec-lbl">{sec}</div>
                    <div className="ev-sec-num" style={{ color:col }}>{sm.awarded}<span className="ev-sec-den">/{sm.out_of}</span></div>
                    <div className="ev-sec-bar-bg"><div className="ev-sec-bar-fill" style={{ width:`${pct}%`, background:col }} /></div>
                    {sm.reasoning && <div className="ev-sec-rsn">{sm.reasoning}</div>}
                  </div>
                );
              })}
            </div>

            {/* Tabs — Eval / Model Answer */}
            <div className="ev-tabs">
              {["eval","model"].map(t => (
                <button key={t} className={`ev-tab${tab===t?" ev-tab-active":""}`} onClick={() => setTab(t as "eval"|"model")}>
                  {t === "eval" ? "Evaluation" : "Model Answer"}
                </button>
              ))}
            </div>

            {tab === "eval" && (
              <div className="ev-fade">
                {/* Demand */}
                {openEntry.demandOfQuestion && openEntry.demandOfQuestion.length > 0 && (
                  <div style={{ marginBottom:32 }}>
                    <div className="ev-ct">{tr(t.demandOfQuestion, langHi)}</div>
                    {openEntry.demandOfQuestion.map((d,i) => (
                      <div key={i} className="ev-demand-item"><div className="ev-demand-bullet"/><div style={{ fontSize:"0.87rem", color:"#ccc", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{d}</div></div>
                    ))}
                  </div>
                )}

                {/* Introduction */}
                {openEntry.introduction && (
                  <div style={{ marginBottom:32 }}>
                    <div className="ev-ct">Introduction</div>
                    {openEntry.introduction?.what_was_written && <div style={{ fontSize:"0.87rem", color:"#999", lineHeight:1.7, fontFamily:"var(--font-body)", marginBottom:12 }}>{openEntry.introduction?.what_was_written}</div>}
                    <div className="ev-sw-grid">
                      <div className="ev-sw-col ev-sw-col-s">
                        <div className="ev-sw-head ev-sw-head-s">✓ Strengths</div>
                        {(openEntry.introduction.strengths?.filter(s => s).length ?? 0) > 0
                          ? openEntry.introduction.strengths!.filter(s => s).map((s,i) => <div key={i} className="ev-sw-item">{s}</div>)
                          : <div className="ev-sw-empty">Nothing stood out here.</div>}
                      </div>
                      <div className="ev-sw-col ev-sw-col-w">
                        <div className="ev-sw-head ev-sw-head-w">✗ Weaknesses</div>
                        {(openEntry.introduction.weaknesses?.filter(w => w).length ?? 0) > 0
                          ? openEntry.introduction.weaknesses!.filter(w => w).map((w,i) => <div key={i} className="ev-sw-item">{w}</div>)
                          : <div className="ev-sw-empty">No major issues found.</div>}
                      </div>
                    </div>
                    {openEntry.introduction.suggestions?.map((s,i) => <div key={i} className="ev-sl" style={{ color:"var(--yellow)" }}>→ {boldHistorians(s)}</div>)}
                    {openEntry.modelAnswer?.introduction && (
                      <><div className="ev-ml">Model Introduction</div><p className="ev-mp">{openEntry.modelAnswer.introduction}</p></>
                    )}
                  </div>
                )}

                {/* Body */}
                {openEntry.body && (
                  <div className="ev-card" style={{ padding:0, overflow:"hidden" }}>
                    <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#888" }}>Body</span>
                      {openEntry.sectionMarks?.body && (
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.72rem", color:"#e0e0e0" }}>
                          {openEntry.sectionMarks.body.awarded}<span style={{ color:"var(--text3)" }}>/{openEntry.sectionMarks.body.out_of}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                      <div className="ev-sw-grid">
                        <div className="ev-sw-col ev-sw-col-s">
                          <div className="ev-sw-head ev-sw-head-s">✓ Strengths</div>
                          {(openEntry.body.strengths || []).filter(s => s).length > 0
                            ? (openEntry.body.strengths || []).filter(s => s).map((s,i) => <div key={i} className="ev-sw-item">{s}</div>)
                            : <div className="ev-sw-empty">Nothing stood out here.</div>}
                        </div>
                        <div className="ev-sw-col ev-sw-col-w">
                          <div className="ev-sw-head ev-sw-head-w">✗ Weaknesses</div>
                          {(openEntry.body.weaknesses || []).filter(w => w).length > 0
                            ? (openEntry.body.weaknesses || []).filter(w => w).map((w,i) => <div key={i} className="ev-sw-item">{w}</div>)
                            : <div className="ev-sw-empty">No major issues found.</div>}
                        </div>
                      </div>
                    </div>
                    {(openEntry.body.suggestions || []).filter(s => s).length > 0 && (
                      <div style={{ padding:"12px 20px" }}>
                        <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>How to improve</div>
                        {(openEntry.body.suggestions || []).map((s,i) => (
                          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                            <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--accent)", marginTop:8, flexShrink:0 }} />
                            <div style={{ fontSize:"0.87rem", color:"#b0b0b0", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{boldHistorians(s)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Conclusion */}
                {openEntry.conclusion && (
                  <div className="ev-card" style={{ padding:0, overflow:"hidden" }}>
                    <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#888" }}>Conclusion</span>
                      {openEntry.sectionMarks?.conclusion && (
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.72rem", color:"#e0e0e0" }}>
                          {openEntry.sectionMarks.conclusion.awarded}<span style={{ color:"var(--text3)" }}>/{openEntry.sectionMarks.conclusion.out_of}</span>
                        </span>
                      )}
                    </div>
                    {openEntry.conclusion?.what_was_written && (
                      <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)", background:"rgba(255,255,255,0.015)" }}>
                        <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>What you wrote</div>
                        <div style={{ fontSize:"0.87rem", color:"#999", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{openEntry.conclusion?.what_was_written}</div>
                      </div>
                    )}
                    <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                      <div className="ev-sw-grid">
                        <div className="ev-sw-col ev-sw-col-s">
                          <div className="ev-sw-head ev-sw-head-s">✓ Strengths</div>
                          {(openEntry.conclusion.strengths || []).filter(s => s).length > 0
                            ? (openEntry.conclusion.strengths || []).filter(s => s).map((s,i) => <div key={i} className="ev-sw-item">{s}</div>)
                            : <div className="ev-sw-empty">Nothing stood out here.</div>}
                        </div>
                        <div className="ev-sw-col ev-sw-col-w">
                          <div className="ev-sw-head ev-sw-head-w">✗ Weaknesses</div>
                          {(openEntry.conclusion.weaknesses || []).filter(w => w).length > 0
                            ? (openEntry.conclusion.weaknesses || []).filter(w => w).map((w,i) => <div key={i} className="ev-sw-item">{w}</div>)
                            : <div className="ev-sw-empty">No major issues found.</div>}
                        </div>
                      </div>
                    </div>
                    {(openEntry.conclusion.suggestions || []).filter(s => s).length > 0 && (
                      <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>How to improve</div>
                        {(openEntry.conclusion.suggestions || []).map((s,i) => (
                          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                            <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--accent)", marginTop:8, flexShrink:0 }} />
                            <div style={{ fontSize:"0.87rem", color:"#b0b0b0", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{boldHistorians(s)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {openEntry.modelAnswer?.conclusion && (
                      <div style={{ padding:"12px 20px", background:"rgba(74,222,128,0.02)" }}>
                        <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"rgba(74,222,128,0.5)", textTransform:"uppercase", marginBottom:8 }}>Model conclusion</div>
                        <div style={{ fontSize:"0.87rem", color:"#c0c0c0", lineHeight:1.8, fontFamily:"var(--font-body)" }}>{openEntry.modelAnswer.conclusion}</div>
                      </div>
                    )}
                  </div>
                )}
                {/* Historians */}
                {openEntry.historiansToCite && openEntry.historiansToCite.length > 0 && (
                  <div style={{ marginBottom:32 }}>
                    <div className="ev-ct">Historians to Cite</div>
                    {openEntry.historiansToCite.map((h,i) => (
                      <div key={i} className="ev-hist">
                        <div className="ev-hist-name">{h.name}</div>
                        {h.work && <div className="ev-hist-work">{h.work}</div>}
                        <div className="ev-hist-arg">{h.argument}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="ev-card ev-card-gold" style={{ padding:"16px 20px" }}>
                  <div className="ev-ct" style={{ marginBottom:10 }}>Overall Feedback</div>
                  <p className="ev-overall-txt" style={{ margin:0, lineHeight:1.8 }}>{openEntry.overallFeedback}</p>
                </div>
              </div>
            )}
            {tab === "model" && openEntry.modelAnswer && (
              <div className="ev-fade">
                <div className="ev-card ev-card-green">
                  <div className="ev-ml">Introduction</div>
                  <p className="ev-mp">{openEntry.modelAnswer.introduction}</p>
                  <div className="ev-ml">Body</div>
                  <ul className="ev-list" style={{ marginBottom:16 }}>
                    {bodyParas(openEntry.modelAnswer.body).map((p,i) => (
                      <li key={i} style={{ color:"#ccc", fontSize:"0.93rem", lineHeight:1.75, marginBottom:8 }}>{p}</li>
                    ))}
                  </ul>
                  <div className="ev-ml">Conclusion</div>
                  <p className="ev-mp" style={{ marginBottom:0 }}>{openEntry.modelAnswer.conclusion}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="ev-wrap" style={{ flex:1, padding:"48px 40px 96px", overflowY:"auto", maxWidth:820 }}>

        {/* Hero */}
        <div style={{ paddingBottom:40, borderBottom:"1px solid var(--border)", marginBottom:44 }} className="ev-fade">
          <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.65rem", letterSpacing:"0.28em", textTransform:"uppercase", color:"var(--text2)", marginBottom:14 }}>History Optional · UPSC Civil Services Mains</div>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:"2.6rem", fontWeight:700, color:"var(--text)", lineHeight:1.12, letterSpacing:"-0.02em" }}>
            Evaluate Your <span style={{ color:"#3b82f6" }}>Answer</span>
          </h1>
          <p style={{ marginTop:14, color:"var(--text3)", fontSize:"0.88rem", fontFamily:"var(--font-ui)", lineHeight:1.6 }}>
            {tr(t.evalHeading, langHi)}
          </p>
        </div>

        {/* ── OCR CONFIRMATION ── */}
        {stage === "ocr" && !evaluation && (
          <div className="ev-fade">
            <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:12 }}>{tr(t.evalStep2, langHi)}</div>
            <p style={{ color:"#888", fontSize:"0.88rem", fontFamily:"var(--font-ui)", lineHeight:1.6, marginBottom:20 }}>
              {tr(t.evalOcrHint, langHi)}
            </p>
            {error && <div className="ev-err">{error}</div>}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:8 }}>
                {tr(t.evalQuestionLabel, langHi)} {!question && <span style={{ color:"#e53e3e" }}>{tr(t.evalQuestionMissing, langHi)}</span>}
              </label>
              <textarea className="ev-ta" rows={2}
                placeholder={tr(t.evalQuestionPlaceholder, langHi)}
                value={question} onChange={e => setQuestion(e.target.value)}
                style={{ marginBottom:0, borderColor: question ? "var(--border)" : "#7f1d1d" }} />
            </div>
            <label style={{ display:"block", fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:8 }}>{tr(t.evalTranscription, langHi)}</label>
            <textarea
              className="ev-ta"
              style={{ minHeight:320, marginBottom:20, textAlign:"justify" }}
              value={extractedText.replace(/--- PAGE BREAK ---/g, " ")}
              onChange={e => setExtractedText(e.target.value)}
            />
            <div style={{ display:"flex", gap:12 }}>
              <button className="ev-btn ev-btn-sm" onClick={() => setStage("form")} style={{ background:"transparent", color:"var(--text2)", borderColor:"var(--border2)" }}>
                {tr(t.evalReupload, langHi)}
              </button>
              <button className="ev-btn" onClick={submit} disabled={loading}>
                {loading ? tr(t.evalEvaluating, langHi) : tr(t.evalLooksGood, langHi)}
              </button>
            </div>
          </div>
        )}

        {/* ── FORM ── */}
        {stage === "form" && !evaluation && !loading && (
          <div className="ev-fade">
            {/* ── Mode Toggle ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:32 }}>
              <button onClick={() => { setEvalMode("single"); setOpenEntry(null); }} style={{
                padding:"18px 20px", borderRadius:8, cursor:"pointer", textAlign:"left",
                background: evalMode==="single" ? "rgba(59,130,246,0.07)" : "var(--bg2)",
                border: evalMode==="single" ? "1.5px solid rgba(59,130,246,0.5)" : "1.5px solid var(--border)",
                boxShadow: evalMode==="single" ? "0 0 0 3px rgba(59,130,246,0.08), inset 0 1px 0 rgba(0,0,0,0.04)" : "none",
                transition:"all 0.18s ease", position:"relative", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                  <div style={{ width:28, height:28, borderRadius:6,
                    background: evalMode==="single" ? "rgba(59,130,246,0.15)" : "var(--bg3)",
                    border: evalMode==="single" ? "1px solid rgba(59,130,246,0.3)" : "1px solid var(--border)",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={evalMode==="single"?"#3b82f6":"#555"} strokeWidth="1.8" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.65rem", letterSpacing:"0.16em",
                    textTransform:"uppercase", color: evalMode==="single" ? "var(--text)" : "var(--text3)",
                    transition:"color 0.18s", fontWeight: evalMode==="single" ? 600 : 400 }}>{tr(t.evalSingleTitle, langHi)}</span>
                  {evalMode==="single" && <div style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"var(--accent)", boxShadow:"0 0 8px #3b82f6" }} />}
                </div>
                <div style={{ fontFamily:"var(--font-ui)", fontSize:"0.72rem", color: evalMode==="single" ? "#6b8db5" : "var(--text3)",
                  lineHeight:1.5, transition:"color 0.18s" }}>{tr(t.evalSingleDesc, langHi)}</div>
              </button>
              <button onClick={() => { setEvalMode("batch"); setOpenEntry(null); }} style={{
                padding:"18px 20px", borderRadius:8, cursor:"pointer", textAlign:"left",
                background: evalMode==="batch" ? "rgba(59,130,246,0.07)" : "var(--bg2)",
                border: evalMode==="batch" ? "1.5px solid rgba(59,130,246,0.5)" : "1.5px solid var(--border)",
                boxShadow: evalMode==="batch" ? "0 0 0 3px rgba(59,130,246,0.08), inset 0 1px 0 rgba(0,0,0,0.04)" : "none",
                transition:"all 0.18s ease", position:"relative", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                  <div style={{ width:28, height:28, borderRadius:6,
                    background: evalMode==="batch" ? "rgba(59,130,246,0.15)" : "var(--bg3)",
                    border: evalMode==="batch" ? "1px solid rgba(59,130,246,0.3)" : "1px solid var(--border)",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={evalMode==="batch"?"#3b82f6":"#555"} strokeWidth="1.8" strokeLinecap="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <path d="M8 21h8M12 17v4"/>
                    </svg>
                  </div>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.65rem", letterSpacing:"0.16em",
                    textTransform:"uppercase", color: evalMode==="batch" ? "var(--text)" : "var(--text3)",
                    transition:"color 0.18s", fontWeight: evalMode==="batch" ? 600 : 400 }}>{tr(t.evalBatchTitle, langHi)}</span>
                  {evalMode==="batch" && <div style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"var(--accent)", boxShadow:"0 0 8px #3b82f6" }} />}
                </div>
                <div style={{ fontFamily:"var(--font-ui)", fontSize:"0.72rem", color: evalMode==="batch" ? "#6b8db5" : "var(--text3)",
                  lineHeight:1.5, transition:"color 0.18s" }}>{tr(t.evalBatchDesc, langHi)}</div>
              </button>
              <button onClick={() => { setEvalMode("map"); setOpenEntry(null); }} style={{
                padding:"18px 20px", borderRadius:8, cursor:"pointer", textAlign:"left",
                gridColumn:"1 / -1",
                background: evalMode==="map" ? "rgba(16,185,129,0.07)" : "var(--bg2)",
                border: evalMode==="map" ? "1.5px solid rgba(16,185,129,0.45)" : "1.5px solid #222",
                boxShadow: evalMode==="map" ? "0 0 0 3px rgba(16,185,129,0.08), inset 0 1px 0 rgba(0,0,0,0.04)" : "none",
                transition:"all 0.18s ease", position:"relative", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                  <div style={{ width:28, height:28, borderRadius:6,
                    background: evalMode==="map" ? "rgba(16,185,129,0.15)" : "var(--bg3)",
                    border: evalMode==="map" ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border)",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={evalMode==="map"?"#10b981":"#555"} strokeWidth="1.8" strokeLinecap="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                      <line x1="9" y1="3" x2="9" y2="18"/>
                      <line x1="15" y1="6" x2="15" y2="21"/>
                    </svg>
                  </div>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.65rem", letterSpacing:"0.16em",
                    textTransform:"uppercase", color: evalMode==="map" ? "var(--text)" : "var(--text3)",
                    transition:"color 0.18s", fontWeight: evalMode==="map" ? 600 : 400 }}>{tr(t.evalMapTitle, langHi)}</span>
                  {evalMode==="map" && <div style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"#10b981", boxShadow:"0 0 8px #10b981" }} />}
                </div>
                <div style={{ fontFamily:"var(--font-ui)", fontSize:"0.72rem", color: evalMode==="map" ? "#4d9e84" : "var(--border2)",
                  lineHeight:1.5, transition:"color 0.18s" }}>{tr(t.evalMapDesc, langHi)}</div>
              </button>
            </div>
            {evalMode === "map" ? (
              <MapEvaluator
                token={tokenRef.current}
                onLoginRequired={showLoginModal}
              />
            ) : evalMode === "batch" ? (
              <PDFTestEvaluator
                isPremium={!!usage.subscribed}
                onPaywall={showEvalLimitModal}
                token={tokenRef.current}
                variant="evaluate"
              />
            ) : (<>
            <div style={{ marginBottom:28 }}>
              <label style={{ display:"block", fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:10 }}>Answer Images / PDF</label>
              <div className={`ev-upload ${files && files.length > 0 ? "has" : ""}`} onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display:"none" }}
                  onChange={e => {
                    const newFiles = Array.from(e.target.files || []);
                    setFiles(newFiles);
                    setPreviews(newFiles.map(f => f.type === "application/pdf" ? "__pdf__" : URL.createObjectURL(f)));
                  }} />
                {files && files.length > 0 ? (
                  <div onClick={e => e.stopPropagation()} style={{ textAlign:"left" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.2em", textTransform:"uppercase", color:"#3b82f6", marginBottom:8 }}>
                      `${files.length} page${files.length > 1 ? "s" : ""} — use arrows to reorder`
                    </div>
                    <div className="ev-pages">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className={`ev-page-item${swapIdx === i ? " dragging" : ""}`}
                          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragIdx(i); }}
                          onPointerEnter={() => {
                            if (swapIdx === null || swapIdx === i) return;
                            const newFiles = [...files];
                            const newPrev = [...previews];
                            newFiles.splice(i, 0, newFiles.splice(swapIdx, 1)[0]);
                            newPrev.splice(i, 0, newPrev.splice(swapIdx, 1)[0]);
                            setFiles(newFiles);
                            setPreviews(newPrev);
                            setDragIdx(i < swapIdx ? i : i);
                          }}
                          onPointerUp={() => setDragIdx(null)}
                          onPointerCancel={() => setDragIdx(null)}
                        >
                          {previews[i] === "__pdf__"
                            ? <div style={{width:80,height:100,borderRadius:4,border:"2px solid #333",background:"var(--bg2)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6" y="19" fontSize="5" fill="#22c55e" stroke="none" fontWeight="bold">PDF</text></svg>
                                <span style={{color:"#22c55e",fontSize:"0.6rem",fontFamily:"var(--font-mono)"}}>PDF</span>
                              </div>
                            : <img src={previews[i] || ""} alt={`page ${i+1}`} />}
                          <div className="ev-page-num">pg {i+1}</div>
                          <button className="ev-page-del" onPointerDown={e => e.stopPropagation()} onClick={() => {
                            const nf = files.filter((_,j) => j !== i);
                            const np = previews.filter((_,j) => j !== i);
                            setFiles(nf.length ? nf : undefined as any);
                            setPreviews(np);
                          }}>×</button>
                          <div className="ev-page-arrows">
                            <button className="ev-page-arrow" disabled={i === 0} onPointerDown={e => e.stopPropagation()} onClick={() => {
                              const nf = [...files]; const np = [...previews];
                              [nf[i-1], nf[i]] = [nf[i], nf[i-1]];
                              [np[i-1], np[i]] = [np[i], np[i-1]];
                              setFiles(nf); setPreviews(np);
                            }}>←</button>
                            <button className="ev-page-arrow" disabled={i === files.length - 1} onPointerDown={e => e.stopPropagation()} onClick={() => {
                              const nf = [...files]; const np = [...previews];
                              [nf[i+1], nf[i]] = [nf[i], nf[i+1]];
                              [np[i+1], np[i]] = [np[i], np[i+1]];
                              setFiles(nf); setPreviews(np);
                            }}>→</button>
                          </div>
                        </div>
                      ))}
                      <div className="ev-page-add" onClick={() => addFileRef.current?.click()}>
                        <input ref={addFileRef} type="file" accept="image/*,application/pdf" multiple style={{ display:"none" }}
                          onChange={e => {
                            const added = Array.from(e.target.files || []);
                            const nf = [...(files||[]), ...added];
                            const np = [...previews, ...added.map(f => f.type === "application/pdf" ? "__pdf__" : URL.createObjectURL(f))];
                            setFiles(nf);
                            setPreviews(np);
                          }} />
                        <span>+</span>
                        <span style={{ fontSize:"0.55rem", fontFamily:"var(--font-mono)", marginTop:4 }}>add</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:"2rem", marginBottom:12, opacity:0.35 }}>⬆</div>
                    <div style={{ color:"#888", fontSize:"0.95rem" }}>Upload photos or PDF of your answer sheet</div>
                    <div style={{ color:"var(--text3)", fontSize:"0.78rem", marginTop:6, fontFamily:"var(--font-mono)" }}>JPG · PNG · PDF · Multiple pages supported</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom:28 }}>
              <label style={{ display:"block", fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:10 }}>Question</label>
              {question ? (
                <textarea className="ev-ta" rows={3} placeholder="Write the exact question here..."
                  value={question} onChange={e => setQuestion(e.target.value)} />
              ) : (
                <div style={{ padding:"16px 18px", border:"1px solid #1e3a5f", borderRadius:8, background:"linear-gradient(135deg,#0a1628,#0d1f3c)", display:"flex", alignItems:"flex-start", gap:12 }}>
                  <span style={{ fontSize:"1.1rem", marginTop:1 }}>🔍</span>
                  <div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.75rem", color:"#60a5fa", marginBottom:5, fontWeight:600 }}>
                      Question will be auto-extracted from your answer script
                    </div>
                    <div style={{ fontFamily:"var(--font-ui)", fontSize:"0.78rem", color:"#94a3b8", lineHeight:1.5 }}>
                      Upload your sheet above — the system will detect and fill the question automatically. You can edit it afterwards.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom:32 }}>
              <label style={{ display:"block", fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:10 }}>Marks Allotted</label>
              <div style={{ display:"flex", gap:10 }}>
                {([10,15,20] as const).map(m => (
                  <button key={m} className={`ev-mchip ${marks===m?"active":""}`} onClick={() => setMarks(m)}>{m}M</button>
                ))}
              </div>
            </div>

            {error && <div className="ev-err">{error}</div>}
            <UsagePill />
            <button className="ev-btn" onClick={handleEvaluate} disabled={ocrLoading}>{ocrLoading ? "Reading handwriting…" : "Evaluate Answer →"}</button>
            </>)}
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div style={{ padding:"80px 0 60px", maxWidth:520, margin:"0 auto" }}>
            {/* Title */}
            <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.58rem", letterSpacing:"0.3em", textTransform:"uppercase", color:"#444", marginBottom:32, textAlign:"center" }}>
              Evaluating Answer
            </div>
            {/* Big progress number */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, marginBottom:18 }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:"4.5rem", fontWeight:700, lineHeight:1, color:"#f0f0f0", letterSpacing:"-0.04em" }}>{String(evalProgress).padStart(2,"0")}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:"1.2rem", color:"var(--border2)", marginBottom:10 }}>%</span>
            </div>
            {/* Main bar */}
            <div style={{ height:4, background:"var(--bg4)", borderRadius:2, overflow:"hidden", marginBottom:12 }}>
              <div style={{
                height:"100%",
                width:`${evalProgress}%`,
                background:"linear-gradient(90deg,#1e3a8a 0%,#2563eb 50%,#3b82f6 80%,#93c5fd 100%)",
                borderRadius:2,
                transition:"width 1.2s cubic-bezier(.16,1,.3,1)",
                boxShadow:"0 0 18px rgba(59,130,246,0.4)"
              }} />
            </div>
            {/* Checkpoint dots */}
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:28 }}>
              {[8,18,32,48,62,74,84,93,100].map((p,i) => (
                <div key={p} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <div style={{
                    width: evalProgress >= p ? 8 : 5,
                    height: evalProgress >= p ? 8 : 5,
                    borderRadius:"50%",
                    background: evalProgress >= p ? "#3b82f6" : "var(--bg4)",
                    border: evalProgress >= p ? "none" : "1px solid #333",
                    boxShadow: evalProgress >= p ? "0 0 8px #3b82f6" : "none",
                    transition:"all 0.5s"
                  }} />
                </div>
              ))}
            </div>
            {/* Phase label */}
            <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.65rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#3b82f6", minHeight:20, transition:"opacity 0.4s" }}>
              {evalPhase}
            </div>
            {/* Thin sub-bar (flicker effect) */}
            <div style={{ height:1, background:"var(--bg4)", borderRadius:1, overflow:"hidden", marginTop:20 }}>
              <div style={{ height:"100%", width:`${evalProgress}%`, background:"rgba(147,197,253,0.15)", transition:"width 1.2s cubic-bezier(.16,1,.3,1)" }} />
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {evaluation && (
          <div className="ev-fade">

            {/* Question box */}
            <div className="ev-qbox">
              <div className="ev-qlabel">Question · {submittedM}M</div>
              <div className="ev-qtext">{submittedQ}</div>
            </div>

            {/* Score row */}
            <div className="ev-score-row">
              <div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:10 }}>Marks Scored</div>
                <div>
                  <span className="ev-score-num" style={{ color:scoreCol }}>{evaluation.marks}</span>
                  <span className="ev-score-denom"> /{evaluation.marks_out_of}</span>
                </div>
                <div className="ev-bar-bg">
                  <div className="ev-bar-fill" style={{ width:`${pct}%`, background:scoreCol }} />
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.25em", textTransform:"uppercase", color:"var(--text2)", marginBottom:10 }}>Ideal Word Count</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:"2.2rem", fontWeight:700, color:"#f0f0f0", lineHeight:1 }}>
                  {submittedM === 10 ? "150" : submittedM === 15 ? "200" : "250"}
                </div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.7rem", color:"var(--text3)", marginTop:4 }}>words</div>
              </div>
            </div>

            {/* Marks gauge */}
            {(() => {
              const g = gaugeMood(pct);
              return (
                <div className="ev-gauge">
                  <div className="ev-gauge-emoji">{g.emoji}</div>
                  <div className="ev-gauge-body">
                    <div className="ev-gauge-top">
                      <span className="ev-gauge-score" style={{ color:g.color }}>Marks scored: {evaluation.marks}</span>
                      <span className="ev-gauge-outof">/{evaluation.marks_out_of}</span>
                      <span className="ev-gauge-label">{g.label}</span>
                    </div>
                    <div className="ev-gauge-track">
                      <div className="ev-gauge-arrow" style={{ left:`${pct}%` }} />
                    </div>
                    <div className="ev-gauge-scale">
                      <span>0</span><span>{Math.round(evaluation.marks_out_of/2)}</span><span>{evaluation.marks_out_of}</span>
                    </div>
                  </div>
                </div>
              );
            })()}


            <div style={{
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "6px",
              padding: "12px 16px",
              marginBottom: "28px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}>
              <span style={{ color: "#3b82f6", fontSize: "0.85rem", marginTop: "1px", flexShrink: 0 }}>ℹ</span>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.78rem", color: "var(--text3)", lineHeight: 1.65, margin: 0 }}>
                These marks are <span style={{ color: "#aaa" }}>indicative, not exact</span> — expect a 1–2 mark variance from what an actual UPSC examiner may award (usually on the lower side). Focus on the <span style={{ color: "#aaa" }}>qualitative feedback</span>: weak areas, missing historians, and the analytical depth of your answer. That is what moves the needle.
              </p>
            </div>

            {/* Section marks grid */}
            {evaluation.section_marks && (
              <div className="ev-sec-grid">
                {(["introduction","body","conclusion","presentation"] as const).map(sec => {
                  const s = evaluation.section_marks![sec];
                  const sp = s ? Math.round((s.awarded / s.out_of) * 100) : 0;
                  const sc = sp >= 75 ? "var(--green)" : sp >= 50 ? "#3b82f6" : "var(--red)";
                  return (
                    <div key={sec} className="ev-sec-card">
                      <div className="ev-sec-lbl">{sec}</div>
                      <div className="ev-sec-num" style={{ color: sc }}>
                        {s.awarded}<span className="ev-sec-den">/{s.out_of}</span>
                      </div>
                      <div className="ev-sec-bar-bg">
                        <div className="ev-sec-bar-fill" style={{ width:`${sp}%`, background: sc }} />
                      </div>
                      <div className="ev-sec-rsn">{s.reasoning}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabs */}
            <div className="ev-tabs" ref={tabsRef}>
              {(["eval","model","hist"] as const).map(t => (
                <button key={t} className={`ev-tab ${tab===t?"active":""}`} onClick={() => setTab(t)}>
                  {t==="eval"?"Evaluation":t==="model"?"Model Answer":"Historians"}
                </button>
              ))}
            </div>

            {/* EVALUATION TAB */}
            {tab==="eval" && (
              <div className="ev-fade">
                {/* Demand of Question — minimal pill row */}
                <div className="ev-card" style={{ padding:"16px 20px" }}>
                  <div className="ev-ct" style={{ marginBottom:12 }}>Demand of the Question</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {toArray(evaluation.demand_of_question).map((d,i) => (
                      <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                        <div style={{ width:4, height:4, borderRadius:"50%", background:"#555", marginTop:8, flexShrink:0 }} />
                        <div style={{ fontSize:"0.87rem", color:"#b0b0b0", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section evaluator — Introduction */}
                <div className="ev-card" style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#888" }}>Introduction</span>
                    {evaluation.section_marks?.introduction && (
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.72rem", color:"#e0e0e0" }}>
                        {evaluation.section_marks.introduction.awarded}<span style={{ color:"var(--text3)" }}>/{evaluation.section_marks.introduction.out_of}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)", background:"rgba(255,255,255,0.015)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>What you wrote</div>
                    <div style={{ fontSize:"0.87rem", color:"#999", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{evaluation.introduction?.what_was_written}</div>
                  </div>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                    {(() => {
                      const strengths = toArray(evaluation.introduction.strengths).filter(s => s && !s.startsWith("One sentence") && !s.startsWith("IMPORTANT"));
                      const weaknesses = toArray((evaluation.introduction as any).weaknesses).filter(w => w && !w.startsWith("One sentence") && !w.startsWith("IMPORTANT"));
                      return (
                        <div className="ev-sw-grid">
                          <div className="ev-sw-col ev-sw-col-s">
                            <div className="ev-sw-head ev-sw-head-s">✓ Strengths</div>
                            {strengths.length > 0 ? strengths.map((s,i) => (
                              <div key={i} className="ev-sw-item">{s}</div>
                            )) : <div className="ev-sw-empty">Nothing stood out here.</div>}
                          </div>
                          <div className="ev-sw-col ev-sw-col-w">
                            <div className="ev-sw-head ev-sw-head-w">✗ Weaknesses</div>
                            {weaknesses.length > 0 ? weaknesses.map((w,i) => (
                              <div key={i} className="ev-sw-item">{w}</div>
                            )) : <div className="ev-sw-empty">No major issues found.</div>}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ fontSize:"0.87rem", color:"#999", lineHeight:1.7, fontFamily:"var(--font-body)", marginTop:12 }}>{evaluation.introduction.analysis}</div>
                  </div>
                  {toArray(evaluation.introduction.suggestions).filter(s => s).length > 0 && (
                    <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>How to improve</div>
                      {toArray(evaluation.introduction.suggestions).map((s,i) => (
                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom: i < toArray(evaluation.introduction.suggestions).length - 1 ? 8 : 0 }}>
                          <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--accent)", marginTop:8, flexShrink:0 }} />
                          <div style={{ fontSize:"0.87rem", color:"#b0b0b0", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{boldHistorians(s)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding:"12px 20px", background:"rgba(59,130,246,0.03)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"#3b82f6", textTransform:"uppercase", marginBottom:8 }}>Model introduction</div>
                    <div style={{ fontSize:"0.87rem", color:"#c0c0c0", lineHeight:1.8, fontFamily:"var(--font-body)" }}>{evaluation.model_answer.introduction}</div>
                  </div>
                </div>

                {/* Section evaluator — Body */}
                <div className="ev-card" style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#888" }}>Body</span>
                    {evaluation.section_marks?.body && (
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.72rem", color:"#e0e0e0" }}>
                        {evaluation.section_marks.body.awarded}<span style={{ color:"var(--text3)" }}>/{evaluation.section_marks.body.out_of}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                    <div className="ev-sw-grid">
                      <div className="ev-sw-col ev-sw-col-s">
                        <div className="ev-sw-head ev-sw-head-s">✓ Strengths</div>
                        {(() => {
                          const strengths = toArray(evaluation.body.strengths).filter(s => s && !s.startsWith("One sentence") && !s.startsWith("IMPORTANT") && !s.startsWith("Use ["));
                          if (strengths.length === 0) return <div className="ev-sw-empty">Nothing stood out here.</div>;
                          return strengths.map((s,i) => {
                            const tagMatch = s.match(/^\[([^\]]+)\]:\s*/);
                            const tag = tagMatch ? tagMatch[1] : null;
                            const text = tagMatch ? s.slice(tagMatch[0].length) : s;
                            return (
                              <div key={i} className="ev-sw-item">
                                {tag && <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.48rem", letterSpacing:"0.12em", color:"var(--green)", textTransform:"uppercase", background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:4, padding:"2px 6px", marginRight:6, display:"inline-block", verticalAlign:"middle" }}>{tag}</span>}
                                {text}
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="ev-sw-col ev-sw-col-w">
                        <div className="ev-sw-head ev-sw-head-w">✗ Weaknesses</div>
                        {(() => {
                          const weaknesses = toArray(evaluation.body.weaknesses).filter(w => w && !w.startsWith("IMPORTANT") && !w.startsWith("Use ["));
                          if (weaknesses.length === 0) return <div className="ev-sw-empty">No major issues found.</div>;
                          const tagColors: Record<string,string> = {
                            "missed demand": "#fbbf24",
                            "needs historian": "var(--red)",
                            "too descriptive": "#a78bfa",
                            "check this": "var(--red)",
                            "structure": "#818cf8",
                          };
                          return weaknesses.map((w,i) => {
                            const tagMatch = w.match(/^\[([^\]]+)\]:\s*/);
                            const tag = tagMatch ? tagMatch[1] : null;
                            const text = tagMatch ? w.slice(tagMatch[0].length) : w;
                            const dotColor = tag && tagColors[tag] ? tagColors[tag] : "var(--red)";
                            return (
                              <div key={i} className="ev-sw-item">
                                {tag && <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.48rem", letterSpacing:"0.12em", color:dotColor, textTransform:"uppercase", background:`rgba(${dotColor === "#fbbf24" ? "251,191,36" : dotColor === "#a78bfa" ? "167,139,250" : dotColor === "#818cf8" ? "99,102,241" : "248,113,113"},0.08)`, border:`1px solid ${dotColor}33`, borderRadius:4, padding:"2px 6px", marginRight:6, display:"inline-block", verticalAlign:"middle" }}>{tag}</span>}
                                {text}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                  {toArray(evaluation.body.suggestions).filter(s => s).length > 0 && (
                    <div style={{ padding:"12px 20px" }}>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>How to improve</div>
                      {toArray(evaluation.body.suggestions).map((s,i) => (
                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom: i < toArray(evaluation.body.suggestions).length - 1 ? 10 : 0 }}>
                          <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--accent)", marginTop:8, flexShrink:0 }} />
                          <div style={{ fontSize:"0.87rem", color:"#b0b0b0", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{boldHistorians(s)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section evaluator — Conclusion */}
                <div className="ev-card" style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#888" }}>Conclusion</span>
                    {evaluation.section_marks?.conclusion && (
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.72rem", color:"#e0e0e0" }}>
                        {evaluation.section_marks.conclusion.awarded}<span style={{ color:"var(--text3)" }}>/{evaluation.section_marks.conclusion.out_of}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)", background:"rgba(255,255,255,0.015)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>What you wrote</div>
                    <div style={{ fontSize:"0.87rem", color:"#999", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{evaluation.conclusion?.what_was_written}</div>
                  </div>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                    {(() => {
                      const strengths = toArray(evaluation.conclusion.strengths).filter(s => s && !s.startsWith("One sentence") && !s.startsWith("IMPORTANT"));
                      const weaknesses = toArray((evaluation.conclusion as any).weaknesses).filter(w => w && !w.startsWith("One sentence") && !w.startsWith("IMPORTANT"));
                      return (
                        <div className="ev-sw-grid">
                          <div className="ev-sw-col ev-sw-col-s">
                            <div className="ev-sw-head ev-sw-head-s">✓ Strengths</div>
                            {strengths.length > 0 ? strengths.map((s,i) => (
                              <div key={i} className="ev-sw-item">{s}</div>
                            )) : <div className="ev-sw-empty">Nothing stood out here.</div>}
                          </div>
                          <div className="ev-sw-col ev-sw-col-w">
                            <div className="ev-sw-head ev-sw-head-w">✗ Weaknesses</div>
                            {weaknesses.length > 0 ? weaknesses.map((w,i) => (
                              <div key={i} className="ev-sw-item">{w}</div>
                            )) : <div className="ev-sw-empty">No major issues found.</div>}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ fontSize:"0.87rem", color:"#999", lineHeight:1.7, fontFamily:"var(--font-body)", marginTop:12 }}>{evaluation.conclusion.analysis}</div>
                  </div>
                  {toArray(evaluation.conclusion.suggestions).filter(s => s).length > 0 && (
                    <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>How to improve</div>
                      {toArray(evaluation.conclusion.suggestions).map((s,i) => (
                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom: i < toArray(evaluation.conclusion.suggestions).length - 1 ? 8 : 0 }}>
                          <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--accent)", marginTop:8, flexShrink:0 }} />
                          <div style={{ fontSize:"0.87rem", color:"#b0b0b0", lineHeight:1.7, fontFamily:"var(--font-body)" }}>{boldHistorians(s)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding:"12px 20px", background:"rgba(74,222,128,0.02)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", letterSpacing:"0.15em", color:"rgba(74,222,128,0.5)", textTransform:"uppercase", marginBottom:8 }}>Model conclusion</div>
                    <div style={{ fontSize:"0.87rem", color:"#c0c0c0", lineHeight:1.8, fontFamily:"var(--font-body)" }}>{evaluation.model_answer.conclusion}</div>
                  </div>
                </div>

                {/* Overall feedback */}
                <div className="ev-card ev-card-gold" style={{ padding:"16px 20px" }}>
                  <div className="ev-ct" style={{ marginBottom:10 }}>Overall Feedback</div>
                  <p className="ev-overall-txt" style={{ margin:0, lineHeight:1.8 }}>{evaluation.overall_feedback}</p>
                </div>
              </div>
            )}

            {/* MODEL ANSWER TAB */}
            {tab==="model" && (
              <div className="ev-fade">
                {/* Question reminder */}
                <div className="ev-qbox" style={{ marginBottom:20 }}>
                  <div className="ev-qlabel">Question · {submittedM}M</div>
                  <div className="ev-qtext">{submittedQ}</div>
                </div>

                <div className="ev-card ev-card-green">
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                    <div className="ev-ct" style={{ marginBottom:0 }}>Model Answer · {evaluation.marks_out_of}M</div>
                    <button className="ev-dl-btn" onClick={() => downloadModelAnswerPDF(submittedQ, submittedM, evaluation)}>
                      ↓ Download PDF
                    </button>
                  </div>
                  <div className="ev-ml">Introduction</div>
                  <p className="ev-mp">{evaluation.model_answer.introduction}</p>
                  <div className="ev-ml">Body</div>
                  <ul className="ev-list" style={{ marginBottom:16 }}>
                    {bodyParas(evaluation.model_answer.body).map((p,i) => (
                      <li key={i} style={{ color:'#ccc', fontSize:'0.93rem', lineHeight:1.75, marginBottom:8 }}>{p}</li>
                    ))}
                  </ul>
                  <div className="ev-ml">Conclusion</div>
                  <p className="ev-mp" style={{ marginBottom:0 }}>{evaluation.model_answer.conclusion}</p>
                </div>
              </div>
            )}

            {/* HISTORIANS TAB */}
            {tab==="hist" && (
              <div className="ev-fade">
                <div className="ev-card">
                  <div className="ev-ct">Historians to Cite for This Topic</div>
                  {(Array.isArray(evaluation.historians_to_cite) ? evaluation.historians_to_cite : []).map((h,i) => (
                    <div key={i} className="ev-hist">
                      <div className="ev-hist-name">{typeof h === 'object' && h !== null ? (h as any).name : String(h)}</div>
                      {typeof h === 'object' && h !== null && (h as any).work && <div className="ev-hist-work">{(h as any).work}</div>}
                      <div className="ev-hist-arg">{typeof h === 'object' && h !== null ? (h as any).argument : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="ev-btn" style={{ marginTop:28 }}
              onClick={() => {
                const next = tab === "eval" ? "model" : "eval";
                setTab(next);
                setTimeout(() => tabsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
              }}>
              {tab === "eval" ? "View Model Answer →" : "← View Answer Evaluation"}
            </button>
            <button className="ev-btn" style={{ marginTop:12, background:"transparent", color:"var(--text3)", borderColor:"var(--border)" }}
              onClick={() => { setEvaluation(null); setFiles(undefined as any); setPreviews([]); setQuestion(""); setSubmittedQ(""); setExtractedText(""); setError(""); setStage("form"); }}>
              ← Evaluate Another Answer
            </button>
          </div>
        )}
        </div>
        )}
      </div>
    <GateModals slots={slots} />
    </>
  );
}
