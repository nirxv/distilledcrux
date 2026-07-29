import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Distilled Crux",
  description: "Privacy Policy for distilledcrux.com — how we collect, use, and protect your data.",
  alternates: { canonical: "https://distilledcrux.com/privacy" },
};

const S = {
  page: { minHeight: "100vh", padding: "4rem 1.5rem 6rem", background: "var(--bg)" } as React.CSSProperties,
  container: { maxWidth: 760, margin: "0 auto", color: "var(--text)" } as React.CSSProperties,
  h1: { fontFamily: "var(--font-body)", fontSize: "2.2rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem", lineHeight: 1.2 } as React.CSSProperties,
  meta: { fontSize: "0.82rem", color: "var(--text3)", marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid var(--border)", display: "block" } as React.CSSProperties,
  h2: { fontFamily: "var(--font-ui)", fontSize: "1.1rem", fontWeight: 600, color: "var(--gold)", margin: "2.5rem 0 0.75rem", paddingBottom: "0.3rem", borderBottom: "1px solid var(--border)" } as React.CSSProperties,
  h3: { fontFamily: "var(--font-ui)", fontSize: "0.95rem", fontWeight: 600, color: "var(--accent)", margin: "1.5rem 0 0.5rem" } as React.CSSProperties,
  p: { fontSize: "0.95rem", lineHeight: 1.75, color: "var(--text2)", marginBottom: "1rem" } as React.CSSProperties,
  ul: { margin: "0.5rem 0 1rem 1.2rem", padding: 0 } as React.CSSProperties,
  li: { fontSize: "0.95rem", lineHeight: 1.7, color: "var(--text2)", marginBottom: "0.4rem" } as React.CSSProperties,
  a: { color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3 } as React.CSSProperties,
  strong: { color: "var(--text)", fontWeight: 600 } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <main style={S.page}>
      <div style={S.container}>
        <h1 style={S.h1}>Privacy Policy</h1>
        <span style={S.meta}>Last updated: 29 July 2026 · Effective: 29 July 2026</span>

        <p style={S.p}>
          This Privacy Policy describes how Distilled Crux (<strong style={S.strong}>distilledcrux.com</strong>,
          &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and protects information when you use our website
          and services. By using the site you agree to this policy.
        </p>

        <h2 style={S.h2}>1. Information We Collect</h2>
        <h3 style={S.h3}>Information you provide</h3>
        <ul style={S.ul}>
          <li style={S.li}>Email address and name (when you sign in via Google OAuth)</li>
          <li style={S.li}>Answer scripts and evaluation content you upload</li>
          <li style={S.li}>Payment information — processed by Razorpay; we do not store card details</li>
        </ul>
        <h3 style={S.h3}>Information collected automatically</h3>
        <ul style={S.ul}>
          <li style={S.li}>Usage data: pages visited, features used, session duration</li>
          <li style={S.li}>Device and browser information</li>
        </ul>

        <h2 style={S.h2}>2. How We Use Your Information</h2>
        <ul style={S.ul}>
          <li style={S.li}>To provide and improve our UPSC optional exam preparation platform</li>
          <li style={S.li}>To process payments and manage your subscription</li>
          <li style={S.li}>To deliver AI-powered answer evaluation and chat features</li>
          <li style={S.li}>To send important service notifications (no marketing without consent)</li>
        </ul>

        <h2 style={S.h2}>3. Data Storage</h2>
        <p style={S.p}>
          Your data is stored securely. We retain your account data for as long as your account
          is active. You may request deletion at any time by contacting us at the address below.
        </p>

        <h2 style={S.h2}>4. Sharing of Information</h2>
        <p style={S.p}>We do not sell your personal data. We share data only with:</p>
        <ul style={S.ul}>
          <li style={S.li}><strong style={S.strong}>Razorpay</strong> — payment processing</li>
          <li style={S.li}><strong style={S.strong}>Google</strong> — OAuth sign-in</li>
          <li style={S.li}>Law enforcement, if required by applicable Indian law</li>
        </ul>

        <h2 style={S.h2}>5. Your Rights (India DPDP Act 2023)</h2>
        <p style={S.p}>Under the Digital Personal Data Protection Act 2023, you have the right to:</p>
        <ul style={S.ul}>
          <li style={S.li}>Access the personal data we hold about you</li>
          <li style={S.li}>Correct inaccurate personal data</li>
          <li style={S.li}>Request erasure of your personal data</li>
          <li style={S.li}>Withdraw consent at any time</li>
          <li style={S.li}>Nominate a person to exercise your rights in case of death or incapacity</li>
        </ul>
        <p style={S.p}>To exercise these rights, contact us at the address in Section 7.</p>

        <h2 style={S.h2}>6. Children&apos;s Privacy</h2>
        <p style={S.p}>
          Our services are intended for users aged 18 and above. We do not knowingly collect
          data from minors.
        </p>

        <h2 style={S.h2}>7. Contact</h2>
        <p style={S.p}>
          For privacy-related queries or to exercise your data rights, contact us at:<br />
          <strong style={S.strong}>Distilled Crux Team</strong><br />
          Email: <a href="mailto:" style={S.a}></a>
        </p>

        <h2 style={S.h2}>8. Changes to This Policy</h2>
        <p style={S.p}>
          We may update this policy from time to time. Continued use of the site after changes
          constitutes acceptance of the revised policy.
        </p>
      </div>
    </main>
  );
}
