# OpenAI API Setup Guide

## Getting Your OpenAI API Key

If you're seeing the error **"Invalid OpenAI API key"**, follow these steps to get a valid key:

### 1. Create an OpenAI Account

1. Go to [https://platform.openai.com/signup](https://platform.openai.com/signup)
2. Sign up for a new account or log in if you already have one

### 2. Get Your API Key

1. Navigate to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"+ Create new secret key"**
3. Give your key a name (e.g., "Resume Builder AI")
4. Click **"Create secret key"**
5. **IMPORTANT:** Copy the key immediately - you won't be able to see it again!
   - It will look like: `sk-proj-...` (starts with `sk-proj-` or `sk-`)

### 3. Add the Key to Your Project

1. Open the file: `resume-builder-ai/.env.local`
2. Find the line that says: `OPENAI_API_KEY=...`
3. Replace the existing value with your new key:
   ```
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
   ```
4. Save the file

### 4. Restart Your Development Server

```bash
cd resume-builder-ai
npm run dev
```

The server needs to restart to pick up the new environment variable.

### 5. Verify the Setup

Visit: [http://localhost:3000/api/health](http://localhost:3000/api/health)

You should see:
```json
{
  "server": "ok",
  "openai_key_configured": true,
  "openai_accessible": true,
  "timestamp": "..."
}
```

## Billing and Usage

⚠️ **Important Notes:**

- **Free Trial**: New OpenAI accounts get $5 in free credits for 3 months
- **Billing Required**: After the trial, you'll need to add a payment method
- **Cost**: GPT-3.5-turbo costs ~$0.0015 per 1K tokens (very affordable)
- **Monitoring**: Check your usage at [https://platform.openai.com/usage](https://platform.openai.com/usage)

## Troubleshooting

### Error: "Invalid OpenAI API key"

**Causes:**
- Key is expired or revoked
- Key not set in `.env.local`
- Development server not restarted after adding key
- Typo in the key

**Solutions:**
1. Verify the key is correct in `.env.local` (no extra spaces, quotes, or line breaks)
2. Generate a new key from OpenAI dashboard
3. Restart the development server
4. Check the health endpoint: `http://localhost:3000/api/health`

### Error: "OpenAI API quota exceeded"

**Cause:** You've used up your free credits or reached your billing limit

**Solution:** Add a payment method at [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)

### Error: "OpenAI API rate limit exceeded"

**Cause:** Too many requests in a short time period

**Solution:** Wait a few seconds and try again. The free tier has lower rate limits.

## Security Best Practices

⚠️ **NEVER commit your API key to Git!**

- The `.env.local` file is already in `.gitignore`
- Never share your key publicly
- Rotate keys regularly
- Use separate keys for development and production

## Need Help?

- OpenAI Documentation: [https://platform.openai.com/docs](https://platform.openai.com/docs)
- OpenAI Community Forum: [https://community.openai.com](https://community.openai.com)
- Check server logs for detailed error messages

---

**Last Updated:** 2025-10-13
