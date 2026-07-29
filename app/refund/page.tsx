import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — Distilled Crux",
  description: "Refund Policy for distilledcrux.com premium subscriptions.",
  alternates: { canonical: "https://distilledcrux.com/refund" },
};

const S = {
  page: { minHeight: "100vh", padding: "4rem 1.5rem 6rem", background: "var(--bg)" } as React.CSSProperties,
  container: { maxWidth: 760, margin: "0 auto", color: "var(--text)" } as React.CSSProperties,
  h1: { fontFamily: "var(--font-body)", fontSize: "2.2rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem", lineHeight: 1.2 } as React.CSSProperties,
  meta: { fontSize: "0.82rem", color: "var(--text3)", marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid var(--border)", display: "block" } as React.CSSProperties,
  h2: { fontFamily: "var(--font-ui)", fontSize: "1.1rem", fontWeight: 600, color: "var(--gold)", margin: "2.5rem 0 0.75rem", paddingBottom: "0.3rem", borderBottom: "1px solid var(--border)" } as React.CSSProperties,
  p: { fontSize: "0.95rem", lineHeight: 1.75, color: "var(--text2)", marginBottom: "1rem" } as React.CSSProperties,
  ul: { margin: "0.5rem 0 1rem 1.2rem", padding: 0 } as React.CSSProperties,
  li: { fontSize: "0.95rem", lineHeight: 1.7, color: "var(--text2)", marginBottom: "0.4rem" } as React.CSSProperties,
  a: { color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3 } as React.CSSProperties,
  strong: { color: "var(--text)", fontWeight: 600 } as React.CSSProperties,
};

export default function RefundPage() {
  return (
    <main style={S.page}>
      <div style={S.container}>
        <h1 style={S.h1}>Refund Policy</h1>
        <span style={S.meta}>Last updated: 29 July 2026 · Effective: 29 July 2026</span>

        <p style={S.p}>
          This Refund Policy applies to all premium subscription purchases made on{" "}
          <strong style={S.strong}>distilledcrux.com</strong>.
        </p>

        <h2 style={S.h2}>1. No-Refund Policy</h2>
        <p style={S.p}>
          All subscription purchases are <strong style={S.strong}>final and non-refundable</strong>. Once a
          payment is processed via Razorpay, we do not offer refunds, partial refunds,
          or credits — regardless of usage.
        </p>
        <p style={S.p}>
          We strongly recommend using the <strong style={S.strong}>free plan</strong> to evaluate the platform
          before subscribing. The free plan includes 3 free AI chats and 1 free AI evaluation with no card required.
        </p>

        <h2 style={S.h2}>2. Subscription Plans</h2>
        <ul style={S.ul}>
          <li style={S.li}><strong style={S.strong}>Daily</strong> — ₹49/day</li>
          <li style={S.li}><strong style={S.strong}>6 Months</strong> — ₹3,999/6 months</li>
          <li style={S.li}><strong style={S.strong}>Yearly</strong> — ₹5,999/year</li>
        </ul>

        <h2 style={S.h2}>3. Exceptions</h2>
        <p style={S.p}>
          We will consider refund or credit requests only in the following circumstances:
        </p>
        <ul style={S.ul}>
          <li style={S.li}>
            <strong style={S.strong}>Duplicate payment</strong> — if you were charged more than once for the
            same plan due to a technical error
          </li>
          <li style={S.li}>
            <strong style={S.strong}>Extended service outage</strong> — if premium features were inaccessible
            for more than 5 consecutive days due to our platform failure
          </li>
        </ul>
        <p style={S.p}>
          Exception requests must be raised within <strong style={S.strong}>7 days</strong> of the payment date
          by contacting us at the address below. We will respond within 5 business days.
        </p>

        <h2 style={S.h2}>4. Payment Disputes</h2>
        <p style={S.p}>
          If you believe an unauthorised charge has been made, please contact us before
          raising a dispute with your bank or card issuer. We will resolve legitimate issues
          promptly.
        </p>

        <h2 style={S.h2}>5. Contact</h2>
        <p style={S.p}>
          For refund-related queries, reach us at:<br />
          <strong style={S.strong}>Distilled Crux Team</strong><br />
          Email: <a href="mailto:" style={S.a}></a><br />
          Response time: within 5 business days
        </p>
      </div>
    </main>
  );
}
