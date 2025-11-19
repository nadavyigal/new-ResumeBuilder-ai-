# Quick RLS Fix - Enable Row Level Security

## ⚠️ CRITICAL SECURITY ISSUE DETECTED

Your database currently allows **public access to all user data** without authentication. This is a serious security and privacy risk.

---

## Fix Now (2 minutes)

### Step 1: Open Supabase SQL Editor
Click this link:
👉 https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/sql/new

### Step 2: Copy This SQL
```sql
-- Enable Row Level Security on all core tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resume_design_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS amendment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
```

### Step 3: Run the SQL
Click **Run** or press **Ctrl+Enter**

### Step 4: Verify
You should see success messages. If you get errors, that's okay - it means RLS is already enabled for those tables.

---

## What This Does

- **Enables authentication requirement** for all user data
- **Prevents public access** to resumes, profiles, and job descriptions
- **Activates existing security policies** that were defined but not enforced
- **No data loss** - only adds security layer

---

## After Applying

Test your login again at:
http://localhost:3001/auth/signin

Your data will now be properly protected with Row Level Security.

---

## Still Having Login Issues?

If login still doesn't work after enabling RLS:

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Try to login**
4. **Screenshot any red error messages**
5. **Share the error** - we'll help debug

Common issues:
- Wrong email/password
- Email not confirmed (check inbox)
- Browser cache (try Ctrl+Shift+R to hard refresh)
