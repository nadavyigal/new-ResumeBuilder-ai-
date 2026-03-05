# AI Resume Optimizer - Complete Supabase Backend Setup

## 🎯 Overview

This guide provides a complete Supabase backend setup for the AI Resume Optimizer application, including database schema, authentication, storage, and advanced functions for subscription management.

## 📋 Prerequisites

- [x] Supabase project created (URL: https://kjzecpnpkmcocykgsxvr.supabase.co)
- [x] Environment variables configured in `.env.local`
- [x] Supabase CLI installed (`npm install -g supabase`)
- [x] Next.js 15 project with TypeScript

## 🗄️ Database Schema

### Core Tables

1. **profiles** - User information and subscription status
   - Automatic profile creation on signup
   - Freemium model with optimization limits
   - Subscription tier tracking

2. **templates** - Resume templates (ATS and modern styles)
   - Free and premium template categories
   - Configurable layouts and styling

3. **resumes** - User-uploaded resume files
   - Original content storage
   - Parsed structured data (JSONB)
   - Vector embeddings for AI matching

4. **job_descriptions** - Target job postings
   - Manual input or URL scraping
   - Structured requirement extraction
   - Vector embeddings for similarity

5. **optimizations** - AI optimization results
   - Resume-job description pairings
   - Match scores and optimization data
   - Processing status tracking

6. **events** - Analytics and user activity tracking

### Security Features

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Service role has admin access for management
- Automatic audit trails with updated_at timestamps

## 🔐 Authentication Setup

### Automatic Profile Creation
- Trigger creates user profile on signup
- Default free tier with 1 optimization limit
- Profile linked to auth.users table

### Subscription Management
- `upgrade_to_premium()` - Upgrade user to unlimited
- `get_user_subscription_status()` - Check limits and usage
- `check_subscription_limit()` - Validate before operations

## 📁 Storage Configuration

### Buckets Created

1. **resume-uploads** - Original resume files
   - Private bucket with user-folder structure
   - PDF/DOCX support, 10MB limit
   - Secure file naming with timestamps

2. **resume-exports** - AI-optimized resume exports
   - Private bucket for generated files
   - PDF/DOCX output formats
   - Automatic cleanup capabilities

### Security Policies
- Users can only upload/access their own files
- File type restrictions (PDF, DOCX only)
- Size limits enforced (10MB maximum)
- Secure folder structure: `{user_id}/{type}_{filename}_{timestamp}.{ext}`

## ⚙️ Advanced Functions

### Optimization Workflow
```sql
-- Start optimization with limit checking
create_optimization(user_uuid, resume_uuid, jd_uuid, initial_match_score)

-- Complete successful optimization
complete_optimization(optimization_uuid, final_match_score, optimization_result)

-- Handle failed optimizations
fail_optimization(optimization_uuid, error_message)
```

### Analytics & Reporting
```sql
-- Get dashboard statistics
get_user_dashboard_stats(user_uuid)

-- System maintenance
cleanup_stale_optimizations()
```

### File Management
```sql
-- Generate secure file paths
generate_file_path(user_uuid, filename, file_type)
```

## 🚀 Deployment Steps

### 1. Run Migrations

```bash
# Navigate to project directory
cd resume-builder-ai

# Link to your Supabase project
supabase link --project-ref kjzecpnpkmcocykgsxvr

# Push migrations to remote database
supabase db push
```

### 2. Alternative: Manual Migration

If `supabase db push` fails, run each migration manually in the Supabase dashboard:

1. `supabase/migrations/20250915000000_complete_schema_setup.sql`
2. `supabase/migrations/20250915000001_setup_storage.sql`
3. `supabase/migrations/20250915000002_advanced_functions.sql`

### 3. Automated Setup

```bash
# Run the automated setup script
node scripts/setup-supabase.js
```

## 🧪 Testing & Validation

### 1. Authentication Test
```bash
# Start development server
npm run dev

# Test signup at http://localhost:3000/auth/signup
# Verify profile creation in Supabase dashboard
```

### 2. Storage Test
```bash
# Upload a PDF resume file
# Check resume-uploads bucket in Storage
# Verify file access controls
```

### 3. Database Verification
```bash
# Check tables exist
supabase db inspect

# Verify RLS policies
supabase db inspect --schema public
```

### 4. Function Testing
```sql
-- Test subscription status
SELECT public.get_user_subscription_status('user-uuid-here');

-- Test optimization limits
SELECT public.check_subscription_limit('user-uuid-here');

-- Test dashboard stats
SELECT public.get_user_dashboard_stats('user-uuid-here');
```

## 📚 Integration Guide

### Client-Side Usage

```typescript
import { authClient } from '@/lib/supabase/auth'

// Sign up new user
await authClient.signUp('email@example.com', 'password', 'Full Name')

// Check subscription status
const status = await authClient.getSubscriptionStatus()

// Get user profile
const profile = await authClient.getUserProfile()
```

### Server-Side Usage

```typescript
import { authServer, requireAuth } from '@/lib/supabase/auth'
import { createServerClient } from '@/lib/supabase/client'

// In API routes
export async function POST(request: Request) {
  const user = await requireAuth(request)
  const supabase = createServerClient()

  // Perform database operations with RLS automatically applied
  const { data } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
}
```

### File Upload Example

```typescript
import { createBrowserClient, supabaseConfig } from '@/lib/supabase/client'

const supabase = createBrowserClient()

// Upload resume file
const filePath = `${user.id}/upload_resume_${Date.now()}.pdf`
const { data, error } = await supabase.storage
  .from(supabaseConfig.buckets.resumeUploads)
  .upload(filePath, file)
```

## 🔧 Configuration Files Created

### Database Types (`src/lib/supabase/types.ts`)
- Complete TypeScript definitions
- Type-safe database operations
- Convenience types for common operations

### Client Configuration (`src/lib/supabase/client.ts`)
- Browser and server client factories
- Environment variable validation
- Storage configuration constants

### Authentication Utilities (`src/lib/supabase/auth.ts`)
- Client and server auth classes
- User management functions
- Session validation utilities

## 🛡️ Security Considerations

### Row Level Security
- All tables have RLS policies
- Users can only access their own data
- Service role has administrative access

### File Storage Security
- Private buckets with user-specific folders
- MIME type restrictions
- File size limits enforced
- Secure file naming convention

### API Security
- All functions use SECURITY DEFINER
- Input validation and error handling
- Subscription limit enforcement
- Event logging for audit trails

## 📊 Default Data

### Templates Included
1. **ATS-Safe Professional** (Free) - Clean, single-column layout
2. **Modern Creative** (Premium) - Two-column design with colors
3. **Executive Level** (Premium) - High-level executive template

### User Limits
- **Free Tier**: 1 optimization per user
- **Premium Tier**: Unlimited optimizations

## 🚨 Troubleshooting

### Common Issues

1. **Migration Errors**
   - Check Supabase CLI version
   - Verify project permissions
   - Run migrations manually if needed

2. **RLS Policy Issues**
   - Ensure auth.uid() returns valid user ID
   - Check table policies in Supabase dashboard
   - Verify user is authenticated

3. **Storage Access Denied**
   - Check bucket policies
   - Verify file path format
   - Ensure user owns the folder

4. **Function Errors**
   - Check function exists in Supabase dashboard
   - Verify parameter types match
   - Check error logs in Supabase

### Support Commands

```bash
# Check Supabase status
supabase status

# View logs
supabase logs

# Reset local database (development only)
supabase db reset

# Generate types
supabase gen types typescript --project-id kjzecpnpkmcocykgsxvr > src/lib/supabase/database.types.ts
```

## 🎉 Success Indicators

When setup is complete, you should have:

- [x] All 6 database tables created with proper relationships
- [x] Row Level Security enabled and tested
- [x] User signup creates profile automatically
- [x] Storage buckets accessible with proper permissions
- [x] All advanced functions working correctly
- [x] Type-safe client configuration
- [x] Authentication flows working end-to-end

## 📖 Next Steps

1. **Frontend Integration**
   - Implement upload components
   - Create dashboard with statistics
   - Build optimization workflow UI

2. **AI Integration**
   - Connect OpenAI API for resume optimization
   - Implement vector similarity search
   - Add job description scraping

3. **Payment Integration**
   - Connect Stripe for premium subscriptions
   - Implement subscription upgrade flow
   - Add billing management

4. **Production Deployment**
   - Configure production environment variables
   - Set up monitoring and alerts
   - Implement backup strategies

---

**Setup completed by Atlas, Backend Integration Expert**
*Secure, scalable, and production-ready Supabase backend*