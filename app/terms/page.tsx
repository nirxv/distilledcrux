import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service Distilled Crux",
  description: "Terms of Service for distilledcrux.com rules governing use of our UPSC optional exam preparation platform.",
  alternates: { canonical: "https://distilledcrux.com/terms" },
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

export default function TermsPage() {
  return (
    <main style={S.page}>
      <div style={S.container}>
        <h1 style={S.h1}>Terms of Service</h1>
        <span style={S.meta}>Last updated: 29 July 2026 · Effective: 29 July 2026</span>

        <p style={S.p}>
          These Terms of Service govern your use of <strong style={S.strong}>distilledcrux.com</strong> operated
          by the Distilled Crux Team. By accessing or using the site you agree to be bound by these terms.
        </p>

        <h2 style={S.h2}>1. Services</h2>
        <p style={S.p}>
          Distilled Crux provides UPSC optional exam preparation resources including structured notes,
          previous year questions (PYQs), AI-powered answer evaluation, topper answer copies, and a
          premium subscription plan across multiple optionals including Sociology, Anthropology,
          PSIR, Geography, and Public Administration.
        </p>

        <h2 style={S.h2}>2. Eligibility</h2>
        <p style={S.p}>
          You must be at least 18 years old to use this service. By using the site you represent
          that you meet this requirement.
        </p>

        <h2 style={S.h2}>3. Account</h2>
        <ul style={S.ul}>
          <li style={S.li}>You sign in using Google OAuth. You are responsible for keeping your account secure.</li>
          <li style={S.li}>You must not share your account credentials or allow others to access your subscription.</li>
          <li style={S.li}>We reserve the right to suspend accounts that violate these terms.</li>
        </ul>

        <h2 style={S.h2}>4. Subscription &amp; Payments</h2>
        <p style={S.p}>Premium subscription plans and their prices are:</p>
        <ul style={S.ul}>
          <li style={S.li}>Daily ₹49 per day</li>
          <li style={S.li}>6 Months ₹3,999 per 6 months</li>
          <li style={S.li}>Yearly ₹5,999 per year</li>
        </ul>
        <p style={S.p}>
          All payments are processed securely by Razorpay. Prices are in Indian Rupees (INR)
          and inclusive of applicable taxes. We reserve the right to change pricing with
          reasonable prior notice.
        </p>

        <h2 style={S.h2}>5. Refund Policy</h2>
        <p style={S.p}>
          All purchases are final. We do not offer refunds, exchanges, or credits for any
          subscription plan once payment has been processed. Please review the features
          available on the free plan before subscribing.
        </p>
        <p style={S.p}>
          In the event of a demonstrable technical failure on our part that prevents access
          to premium features for an extended period, we will evaluate refund or credit
          requests on a case-by-case basis. Contact us within 7 days of the issue.
        </p>

        <h2 style={S.h2}>6. Intellectual Property</h2>
        <p style={S.p}>
          All content on this site including notes, question banks, AI-generated evaluations,
          and design is owned by distilledcrux.com or its licensors. You may not copy,
          redistribute, or sell any content without written permission.
        </p>

        <h2 style={S.h2}>7. Acceptable Use</h2>
        <p style={S.p}>You agree not to:</p>
        <ul style={S.ul}>
          <li style={S.li}>Scrape, crawl, or systematically download site content</li>
          <li style={S.li}>Share premium content outside your personal use</li>
          <li style={S.li}>Use the platform for any unlawful purpose</li>
          <li style={S.li}>Attempt to reverse-engineer or interfere with the platform</li>
        </ul>

        <h2 style={S.h2}>8. AI Features</h2>
        <p style={S.p}>
          AI-powered answer evaluation and chat features are provided as study aids only.
          They do not constitute professional coaching advice. Accuracy of AI responses
          may vary; always cross-reference with official UPSC sources.
        </p>

        <h2 style={S.h2}>9. Limitation of Liability</h2>
        <p style={S.p}>
          To the maximum extent permitted by law, distilledcrux.com shall not be liable for
          any indirect, incidental, or consequential damages arising from your use of the
          platform. Our total liability shall not exceed the amount you paid in the 30 days
          preceding the claim.
        </p>

        <h2 style={S.h2}>10. Governing Law</h2>
        <p style={S.p}>
          These terms are governed by the laws of India. Any disputes shall be subject to
          the exclusive jurisdiction of courts in India.
        </p>

        <h2 style={S.h2}>11. Contact</h2>
        <p style={S.p}>
          Questions about these terms? Contact us at:<br />
          <strong style={S.strong}>Distilled Crux Team</strong><br />
          Email: <a href="mailto:" style={S.a}></a>
        </p>
      </div>
    </main>
  );
}
