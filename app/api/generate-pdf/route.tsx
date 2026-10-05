export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rateLimit";
import { renderToBuffer, Document, Page, Text, View, Image as PdfImage, StyleSheet, Font } from "@react-pdf/renderer";
import { OWL_PEEK, OWL_PEEK_RATIO, OWL_READING, OWL_READING_RATIO } from "@/lib/pdfMascot";
import path from "path";

/**
 * Save PDF under a chat answer: the question and the answer on A4, with the
 * site's name in the header and page numbers in the footer. The layout is
 * history-optional's, which has used it since its chat was redesigned.
 */

const fontDir = path.join(process.cwd(), "public");
Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

// The site's --accent. A PDF has no stylesheet, so the token cannot be used
// here: var(--accent) would reach react-pdf as an unknown colour and every
// rule and bar would print black.
const BLUE = "#4361ee";
const BLACK = "#1a1a1a";
const WHITE = "#ffffff";
const GRAY = "#888888";
const LIGHT_BLUE = "#eef1fd";
const RULE = "#bbbbbb";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSans", fontSize: 11, color: BLACK, paddingTop: 36, paddingBottom: 78, paddingLeft: 40, paddingRight: 40 },
  // header
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headerOwl: { width: 64, height: 64 * OWL_PEEK_RATIO, marginRight: 12 },
  headerMid: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: "bold", color: BLACK },
  headerSub: { fontSize: 8, color: GRAY, marginTop: 2 },
  headerDate: { fontSize: 8, color: GRAY, textAlign: "right", letterSpacing: 1 },
  headerDivider: { height: 3, backgroundColor: BLUE, marginBottom: 16 },
  // question
  qBlock: { flexDirection: "row", marginBottom: 16 },
  qAccent: { width: 6, backgroundColor: BLUE },
  qInner: { flex: 1, backgroundColor: LIGHT_BLUE, padding: 12 },
  qLabel: { fontSize: 7, fontWeight: "bold", color: BLUE, letterSpacing: 2, marginBottom: 6 },
  qText: { fontSize: 12, fontWeight: "bold", color: BLACK, lineHeight: 1.4 },
  // section
  sectionThin: { height: 0.5, backgroundColor: RULE, marginTop: 10, marginBottom: 4 },
  sectionRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 2 },
  sectionNum: { fontSize: 28, fontWeight: "bold", color: "#e8e8e8", width: 36 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: BLACK, letterSpacing: 2, flex: 1 },
  sectionBlue: { height: 2, backgroundColor: BLUE, marginBottom: 8 },
  // h2
  h2Row: { flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 3 },
  h2Accent: { width: 4, height: 14, backgroundColor: BLUE, marginRight: 6 },
  h2Text: { fontSize: 12, fontWeight: "bold", color: BLACK, flex: 1 },
  // h3
  h3Row: { flexDirection: "row", alignItems: "center", marginTop: 7, marginBottom: 3 },
  h3Accent: { width: 3, height: 10, backgroundColor: BLUE, marginRight: 6 },
  h3Text: { fontSize: 11, fontWeight: "bold", color: BLACK, flex: 1 },
  // bullet
  bulletRow: { flexDirection: "row", marginLeft: 8, marginBottom: 5 },
  bulletDot: { width: 14, fontSize: 16, color: BLUE, marginTop: -3 },
  bulletText: { fontSize: 11, color: BLACK, flex: 1, lineHeight: 1.65 },
  // para
  para: { fontSize: 11, color: BLACK, lineHeight: 1.7, marginBottom: 5 },
  // table
  tableRow: { flexDirection: "row" },
  tableCell: { flex: 1, fontSize: 10, padding: 4, borderWidth: 0.5, borderColor: "#cccccc" },
  // footer. paddingBottom on the page is the footer's height, about 52, plus
  // a 26pt gap to the text, so the footer clears the paper's edge, where many
  // printers cannot print.
  footer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  footerBar: { height: 3, backgroundColor: BLUE },
  footerRow: { flexDirection: "row", alignItems: "center", paddingLeft: 40, paddingRight: 40, paddingTop: 8, paddingBottom: 20 },
  footerOwl: { width: 24, height: 24 * OWL_READING_RATIO, marginRight: 8 },
  footerLeft: { flex: 1 },
  footerSiteLabel: { fontSize: 9, fontWeight: "bold", color: BLACK },
  footerRight: { alignItems: "flex-end" },
  footerPage: { fontSize: 11, fontWeight: "bold", color: BLACK },
  footerPageLabel: { fontSize: 6, color: GRAY, letterSpacing: 1, marginTop: 1 },
});

// ── Helpers ──
function parseInline(t: string): string {
  return t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}

function Header({ dateStr }: { dateStr: string }) {
  return (
    <>
      <View style={s.headerRow}>
        <PdfImage src={OWL_PEEK} style={s.headerOwl} />
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>DistilledCrux.com</Text>
          <Text style={s.headerSub}>UPSC Optional preparation, distilled</Text>
        </View>
        <Text style={s.headerDate}>{dateStr}</Text>
      </View>
      <View style={s.headerDivider} />
    </>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerBar} />
      <View style={s.footerRow}>
        <PdfImage src={OWL_READING} style={s.footerOwl} />
        <View style={s.footerLeft}>
          <Text style={s.footerSiteLabel}>DistilledCrux.com</Text>
        </View>
        <View style={s.footerRight}>
          <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          <Text style={s.footerPageLabel}>PAGE</Text>
        </View>
      </View>
    </View>
  );
}

type Block =
  | { type: "spacer" }
  | { type: "h1"; text: string; num: number }
  | { type: "h2" | "h3" | "bullet" | "para"; text: string }
  | { type: "table"; rows: string[][] };

function ChatPDF({ markdownText, questionText, dateStr }: { markdownText: string; questionText?: string; dateStr: string }) {
  const lines = markdownText.split("\n");
  const elements: Block[] = [];
  let sectionNum = 0;
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith("|") && t.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i].trim()); i++; }
      const rows = tableLines.filter(l => !/^\|[-| :]+\|$/.test(l))
        .map(r => r.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim()));
      if (rows.length) elements.push({ type: "table", rows });
      continue;
    }
    if (!t || /^---+$/.test(t)) elements.push({ type: "spacer" });
    else if (/^# /.test(t)) { sectionNum++; elements.push({ type: "h1", text: parseInline(t.replace(/^# /, "")), num: sectionNum }); }
    else if (/^## /.test(t)) elements.push({ type: "h2", text: parseInline(t.replace(/^## /, "")) });
    else if (/^#{3,6} /.test(t)) elements.push({ type: "h3", text: parseInline(t.replace(/^#{3,6} /, "")) });
    else if (/^[•\-\*] /.test(t)) elements.push({ type: "bullet", text: parseInline(t.replace(/^[•\-\*] /, "")) });
    else elements.push({ type: "para", text: parseInline(t) });
    i++;
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header dateStr={dateStr} />
        {questionText && (
          <View style={s.qBlock}>
            <View style={s.qAccent} />
            <View style={s.qInner}>
              <Text style={s.qLabel}>QUESTION</Text>
              <Text style={s.qText}>{questionText}</Text>
            </View>
          </View>
        )}
        {elements.map((el, idx) => {
          if (el.type === "spacer") return <View key={idx} style={{ height: 4 }} />;
          if (el.type === "h1") return (
            <View key={idx}>
              <View style={s.sectionThin} />
              <View style={s.sectionRow}>
                <Text style={s.sectionNum}>{String(el.num).padStart(2, "0")}</Text>
                <Text style={s.sectionTitle}>{el.text.toUpperCase()}</Text>
              </View>
              <View style={s.sectionBlue} />
            </View>
          );
          if (el.type === "h2") return <View key={idx} style={s.h2Row}><View style={s.h2Accent} /><Text style={s.h2Text}>{el.text}</Text></View>;
          if (el.type === "h3") return <View key={idx} style={s.h3Row}><View style={s.h3Accent} /><Text style={s.h3Text}>{el.text}</Text></View>;
          if (el.type === "bullet") return <View key={idx} style={s.bulletRow}><Text style={s.bulletDot}>•</Text><Text style={s.bulletText}>{el.text}</Text></View>;
          if (el.type === "table") return (
            <View key={idx} style={{ marginVertical: 8 }}>
              {el.rows.map((row, rIdx) => (
                <View key={rIdx} style={s.tableRow}>
                  {row.map((cell, cIdx) => (
                    <Text key={cIdx} style={[s.tableCell, {
                      backgroundColor: rIdx === 0 ? "#2a2a2a" : rIdx % 2 === 0 ? "#f5f7ff" : WHITE,
                      color: rIdx === 0 ? WHITE : BLACK,
                      fontWeight: rIdx === 0 ? "bold" : "normal",
                    }]}>{cell}</Text>
                  ))}
                </View>
              ))}
            </View>
          );
          return <Text key={idx} style={s.para}>{el.text}</Text>;
        })}
        <Footer />
      </Page>
    </Document>
  );
}

/**
 * Kept out of the handler's try block: a JSX element is only a description,
 * so building one inside the try catches nothing. The await on the render
 * is what can throw, and that stays inside it.
 */
function renderChat(markdownText: string, questionText: string | undefined, dateStr: string) {
  return renderToBuffer(<ChatPDF markdownText={markdownText} questionText={questionText} dateStr={dateStr} />);
}

// ── Route Handler ──
// renderToBuffer is CPU-bound and runs in-process, so a burst of requests
// saturates the function rather than queuing cheaply; hence the per-IP gate.
const MAX_TEXT_CHARS = 100_000;
const PDF_LIMIT = 20;

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`generate-pdf:${clientIp(req)}`, {
    limit: PDF_LIMIT,
    windowSeconds: 10 * 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: rateLimitHeaders(rl, PDF_LIMIT) });
  }

  try {
    const { markdownText, questionText } = await req.json();

    // Bounds the render: without them a single request can pin a lambda for
    // the full 30s budget on an arbitrarily long document.
    if (typeof markdownText !== "string" || !markdownText) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }
    if (markdownText.length > MAX_TEXT_CHARS || (typeof questionText === "string" && questionText.length > 2_000)) {
      return NextResponse.json({ error: "Content too long for PDF export" }, { status: 413 });
    }
    const question = typeof questionText === "string" ? questionText : undefined;

    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
    const buffer = await renderChat(markdownText, question, dateStr);
    const filename = (question ?? markdownText).slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_") + " (distilledcrux.com).pdf";

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
