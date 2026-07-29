import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — PrepPandit",
  description: "Terms of Service for preppandit.com — rules governing use of our UPSC optional exam preparation platform.",
  alternates: { canonical: "https://preppandit.com/terms" },
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <h1>Terms of Service</h1>
        <p className="legal-meta">Last updated: 29 July 2026 · Effective: 29 July 2026</p>

        <p>
          These Terms of Service govern your use of <strong>preppandit.com</strong> operated
          by the PrepPandit Team. By accessing or using the site you agree to be bound by
          these terms.
        </p>

        <h2>1. Services</h2>
        <p>
          PrepPandit provides UPSC optional exam preparation resources including
          structured notes, previous year questions (PYQs), AI-powered answer evaluation,
          topper answer copies, and a premium subscription plan across multiple optionals
          including Sociology, Anthropology, Political Science, Geography, and Public Administration.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old to use this service. By using the site you represent
          that you meet this requirement.
        </p>

        <h2>3. Account</h2>
        <ul>
          <li>You sign in using Google OAuth. You are responsible for keeping your account secure.</li>
          <li>You must not share your account credentials or allow others to access your subscription.</li>
          <li>We reserve the right to suspend accounts that violate these terms.</li>
        </ul>

        <h2>4. Subscription &amp; Payments</h2>
        <p>Premium subscription plans and their prices are:</p>
        <ul>
          <li>Daily — ₹49 per day</li>
          <li>6 Months — ₹3,999 per 6 months</li>
          <li>Yearly — ₹5,999 per year</li>
        </ul>
        <p>
          All payments are processed securely by Razorpay. Prices are in Indian Rupees (INR)
          and inclusive of applicable taxes. We reserve the right to change pricing with
          reasonable prior notice.
        </p>

        <h2>5. Refund Policy</h2>
        <p>
          All purchases are final. We do not offer refunds, exchanges, or credits for any
          subscription plan once payment has been processed. Please review the features
          available on the free plan before subscribing.
        </p>
        <p>
          In the event of a demonstrable technical failure on our part that prevents access
          to premium features for an extended period, we will evaluate refund or credit
          requests on a case-by-case basis. Contact us within 7 days of the issue.
        </p>

        <h2>6. Intellectual Property</h2>
        <p>
          All content on this site — including notes, question banks, AI-generated evaluations,
          and design — is owned by preppandit.com or its licensors. You may not copy,
          redistribute, or sell any content without written permission.
        </p>

        <h2>7. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Scrape, crawl, or systematically download site content</li>
          <li>Share premium content outside your personal use</li>
          <li>Use the platform for any unlawful purpose</li>
          <li>Attempt to reverse-engineer or interfere with the platform</li>
        </ul>

        <h2>8. AI Features</h2>
        <p>
          AI-powered answer evaluation and chat features are provided as study aids only.
          They do not constitute professional coaching advice. Accuracy of AI responses
          may vary; always cross-reference with official UPSC sources.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, preppandit.com shall not be liable for
          any indirect, incidental, or consequential damages arising from your use of the
          platform. Our total liability shall not exceed the amount you paid in the 30 days
          preceding the claim.
        </p>

        <h2>10. Governing Law</h2>
        <p>
          These terms are governed by the laws of India. Any disputes shall be subject to
          the exclusive jurisdiction of courts in India.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these terms? Contact us at:<br />
          <strong>PrepPandit Team</strong><br />
          Email: <a href="mailto:"></a>
        </p>
      </div>
    </main>
  );
}
