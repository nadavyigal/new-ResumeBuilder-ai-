# How to Fix the 406 Error (Simple Steps)

## Step 1: Find Out What's Wrong

1. Open `check-schema.js`
2. Replace `YOUR_SUPABASE_URL_HERE` with your actual Supabase URL
3. Replace `YOUR_SUPABASE_ANON_KEY_HERE` with your actual anon key
   (Get both from your `.env.local` file or Supabase dashboard)
4. Run: `node check-schema.js`
5. **Share the output with me**

This will tell us EXACTLY what columns are missing.

## Step 2: I'll Give You the Exact Fix

Once I see the output, I'll give you ONE simple SQL command to run in Supabase dashboard that will fix it.

## Why This Approach?

- No more guessing
- No multiple failed fixes
- We see exactly what's in your database
- One targeted fix that actually works

## Need the Keys?

Your `.env.local` should have:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

If you don't have a `.env.local` file, check your Supabase dashboard:
- Project Settings → API → URL and anon/public key

