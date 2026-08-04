import re

# ── Fix: pricing/page.tsx ─────────────────────────────────────────────────────
# Load Razorpay script eagerly via useEffect on mount instead of injecting
# dynamically on button click. This avoids the script being blocked by
# adblockers/Brave Shields mid-flow after the user has already clicked.

with open('app/pricing/page.tsx', 'r') as f:
    src = f.read()

# 1. Add useEffect to imports
src = src.replace(
    "import { useState } from 'react';",
    "import { useState, useEffect } from 'react';"
)

# 2. Inside the component, add a useEffect that preloads Razorpay on mount
old_state = "  const [loading, setLoading] = useState<string | null>(null);\n  const [error, setError] = useState<string | null>(null);"
new_state = """  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rzpReady, setRzpReady] = useState(false);

  // Preload Razorpay checkout script on mount so it's ready before user clicks
  useEffect(() => {
    if (window.Razorpay) { setRzpReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => setRzpReady(true);
    s.onerror = () => setError('Payment gateway failed to load. Try disabling your adblocker or use a different browser.');
    document.body.appendChild(s);
  }, []);"""
src = src.replace(old_state, new_state)

# 3. Remove the inline script injection block from handlePurchase
old_inject = """      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Razorpay failed to load'));
          document.body.appendChild(s);
        });
      }

      const rzp"""
new_inject = "      const rzp"
src = src.replace(old_inject, new_inject)

# 4. Disable the button if Razorpay hasn't loaded yet
src = src.replace(
    "disabled={!!loading}",
    "disabled={!!loading || !rzpReady}"
)

# 5. Update button label to show when gateway is loading
src = src.replace(
    "{isLoading ? 'Opening checkout\u2026' : 'Get started \u2192'}",
    "{isLoading ? 'Opening checkout\u2026' : !rzpReady ? 'Loading\u2026' : 'Get started \u2192'}"
)

with open('app/pricing/page.tsx', 'w') as f:
    f.write(src)

print("✓ pricing/page.tsx patched")
