with open('next.config.ts', 'r') as f:
    src = f.read()

# Add Razorpay to script-src
src = src.replace(
    "\"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com\",",
    "\"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com https://checkout.razorpay.com\","
)

# Add Razorpay to connect-src
src = src.replace(
    "\"connect-src 'self' https://api.anthropic.com https://*.supabase.co https://www.google-analytics.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://firebase.googleapis.com\",",
    "\"connect-src 'self' https://api.anthropic.com https://*.supabase.co https://www.google-analytics.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://firebase.googleapis.com https://checkout.razorpay.com https://lumberjack.razorpay.com\","
)

# Add Razorpay iframe to frame-src
src = src.replace(
    "\"frame-src 'self' https://*.firebaseapp.com https://accounts.google.com\",",
    "\"frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com\","
)

with open('next.config.ts', 'w') as f:
    f.write(src)

print("done")
