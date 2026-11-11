# ResumeBuilder AI - Setup Guide

## Quick Start

### 1. Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your project URL and anon key from Settings > API
3. Get your service role key from Settings > API (keep this secret!)
4. Run the database migrations in the `supabase/migrations/` folder

### 3. OpenAI Setup

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add it to your `.env.local` file

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

## Features

- ✅ User authentication (sign up, sign in, password reset)
- ✅ Resume upload (PDF, DOCX)
- ✅ AI-powered resume optimization
- ✅ Modern, responsive UI
- ✅ Secure data storage with Supabase

## Troubleshooting

If you encounter issues:

1. Make sure all environment variables are set correctly
2. Check that your Supabase project is active
3. Verify your OpenAI API key has sufficient credits
4. Check the browser console for any errors

## Support

For issues or questions, check the project documentation or create an issue on GitHub.

