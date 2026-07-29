import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PrepPandit",
  description: "Privacy Policy for preppandit.com — how we collect, use, and protect your data.",
  alternates: { canonical: "https://preppandit.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated: 29 July 2026 · Effective: 29 July 2026</p>

        <p>
          This Privacy Policy describes how PrepPandit (<strong>preppandit.com</strong>,
          &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and protects information when you use our website
          and services. By using the site you agree to this policy.
        </p>

        <h2>1. Information We Collect</h2>
        <h3>Information you provide</h3>
        <ul>
          <li>Email address and name (when you sign in via Google OAuth)</li>
          <li>Answer scripts and evaluation content you upload</li>
          <li>Payment information — processed by Razorpay; we do not store card details</li>
        </ul>
        <h3>Information collected automatically</h3>
        <ul>
          <li>Usage data: pages visited, features used, session duration</li>
          <li>Device and browser information</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide and improve our UPSC optional exam preparation platform</li>
          <li>To process payments and manage your subscription</li>
          <li>To deliver AI-powered answer evaluation and chat features</li>
          <li>To send important service notifications (no marketing without consent)</li>
        </ul>

        <h2>3. Data Storage</h2>
        <p>
          Your data is stored securely. We retain your account data
          for as long as your account is active. You may request deletion at any time by contacting
          us at the address below.
        </p>

        <h2>4. Sharing of Information</h2>
        <p>We do not sell your personal data. We share data only with:</p>
        <ul>
          <li><strong>Razorpay</strong> — payment processing</li>
          <li><strong>Google</strong> — OAuth sign-in</li>
          <li>Law enforcement, if required by applicable Indian law</li>
        </ul>

        <h2>5. Your Rights (India DPDP Act 2023)</h2>
        <p>Under the Digital Personal Data Protection Act 2023, you have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate personal data</li>
          <li>Request erasure of your personal data</li>
          <li>Withdraw consent at any time</li>
          <li>Nominate a person to exercise your rights in case of death or incapacity</li>
        </ul>
        <p>To exercise these rights, contact us at the address in Section 8.</p>

        <h2>6. Children&apos;s Privacy</h2>
        <p>
          Our services are intended for users aged 18 and above. We do not knowingly collect
          data from minors.
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy-related queries or to exercise your data rights, contact us at:<br />
          <strong>PrepPandit Team</strong><br />
          Email: <a href="mailto:"></a>
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Continued use of the site after changes
          constitutes acceptance of the revised policy.
        </p>
      </div>
    </main>
  );
}
