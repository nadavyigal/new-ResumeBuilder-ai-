# Data Model: AI Resume Optimizer

## Entity Relationships Overview

```
User (profiles)
├── has many → Resumes
├── has many → Job Descriptions  
├── has many → Optimizations
└── has one → Subscription Status

Resume
├── belongs to → User
├── has many → Optimizations
└── has one → Storage File

Job Description  
├── belongs to → User
└── has many → Optimizations

Optimization
├── belongs to → User
├── belongs to → Resume
├── belongs to → Job Description
├── uses → Template
└── generates → Export Files

Template
├── has many → Optimizations
└── defines → Styling Rules
```

## Core Entities

### User Profile (`profiles`)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'job_seeker',
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'premium'
  subscription_status TEXT DEFAULT 'active',
  optimizations_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Validation Rules**:
- `email` must be valid email format
- `subscription_tier` enum: 'free', 'premium'
- `subscription_status` enum: 'active', 'cancelled', 'expired'
- `optimizations_used` >= 0

**Business Rules**:
- Free tier: max 1 optimization
- Premium tier: unlimited optimizations
- Email must be unique and verified

### Resume (`resumes`)
```sql
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'docx'
  raw_text TEXT,
  parsed_data JSONB, -- Structured resume content
  embeddings VECTOR(1536), -- OpenAI ada-002 embeddings
  parsing_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  parsing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Parsed Data Structure** (JSONB):
```json
{
  "contact": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "website": "string"
  },
  "summary": "string",
  "experience": [
    {
      "company": "string",
      "position": "string",
      "startDate": "string",
      "endDate": "string",
      "description": "string",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "graduationYear": "string",
      "gpa": "string"
    }
  ],
  "skills": {
    "technical": ["string"],
    "soft": ["string"],
    "languages": ["string"],
    "certifications": ["string"]
  }
}
```

**Validation Rules**:
- `file_size` <= 10MB (10,485,760 bytes)
- `file_type` enum: 'pdf', 'docx'
- `storage_path` must exist in Supabase Storage
- `parsing_status` enum: 'pending', 'success', 'failed'

### Job Description (`job_descriptions`)
```sql
CREATE TABLE job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'text', 'url'
  source_url TEXT,
  company TEXT,
  title TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  cleaned_text TEXT NOT NULL,
  extracted_data JSONB, -- Structured JD content
  embeddings VECTOR(1536), -- OpenAI ada-002 embeddings
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Extracted Data Structure** (JSONB):
```json
{
  "company": "string",
  "title": "string",
  "location": "string",
  "employment_type": "string", // full-time, part-time, contract
  "experience_level": "string", // entry, mid, senior, executive
  "requirements": {
    "must_have": ["string"],
    "nice_to_have": ["string"],
    "experience_years": "number",
    "education": ["string"]
  },
  "responsibilities": ["string"],
  "benefits": ["string"],
  "keywords": ["string"]
}
```

**Validation Rules**:
- `source_type` enum: 'text', 'url'
- `title` and `raw_text` required
- `cleaned_text` length <= 50,000 characters
- If `source_type = 'url'`, `source_url` is required

### Optimization (`optimizations`)
```sql
CREATE TABLE optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL REFERENCES templates(key),
  
  -- Optimization Results
  match_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
  optimization_data JSONB NOT NULL, -- Optimized resume content
  analysis_data JSONB, -- Match analysis and gaps
  
  -- Export Files
  pdf_storage_path TEXT,
  docx_storage_path TEXT,
  
  -- Processing
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Optimization Data Structure** (JSONB):
```json
{
  "contact": { /* same as resume parsed_data */ },
  "summary": "string", // AI-optimized summary
  "experience": [
    {
      "company": "string",
      "position": "string", 
      "startDate": "string",
      "endDate": "string",
      "description": "string", // AI-optimized
      "bullets": ["string"], // AI-optimized bullets
      "keywords_added": ["string"],
      "improvements": ["string"]
    }
  ],
  "skills": {
    "highlighted": ["string"], // Skills emphasized for this JD
    "technical": ["string"],
    "soft": ["string"]
  }
}
```

**Analysis Data Structure** (JSONB):
```json
{
  "keyword_match": {
    "total_keywords": "number",
    "matched_keywords": "number",
    "missing_keywords": ["string"],
    "score": "number"
  },
  "skill_gap": {
    "required_skills": ["string"],
    "matching_skills": ["string"],  
    "missing_skills": ["string"],
    "score": "number"
  },
  "experience_match": {
    "years_required": "number",
    "years_candidate": "number",
    "level_match": "boolean",
    "score": "number"
  },
  "overall_recommendations": ["string"]
}
```

**Validation Rules**:
- `match_score` between 0.00 and 100.00
- `status` enum: 'pending', 'processing', 'completed', 'failed'
- Processing time limit: 20 seconds (timeout)
- One optimization per (user, resume, job_description, template) combo

### Template (`templates`)
```sql
CREATE TABLE templates (
  key TEXT PRIMARY KEY, -- 'ats-safe', 'modern', 'executive'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  family TEXT NOT NULL, -- 'ats', 'modern', 'creative'
  is_premium BOOLEAN DEFAULT FALSE,
  config JSONB NOT NULL, -- Styling and layout configuration
  preview_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Template Config Structure** (JSONB):
```json
{
  "layout": {
    "columns": "number", // 1 or 2
    "margins": {"top": 20, "bottom": 20, "left": 20, "right": 20},
    "spacing": {"section": 12, "item": 6}
  },
  "typography": {
    "name": {"font": "Arial", "size": 18, "weight": "bold"},
    "section_header": {"font": "Arial", "size": 14, "weight": "bold"},
    "content": {"font": "Arial", "size": 11, "weight": "normal"}
  },
  "colors": {
    "primary": "#000000",
    "secondary": "#666666", 
    "accent": "#0066cc"
  },
  "sections": {
    "order": ["contact", "summary", "experience", "education", "skills"],
    "contact": {"format": "header", "include_photo": false},
    "experience": {"bullet_style": "dash", "date_format": "MM/YYYY"}
  }
}
```

**Validation Rules**:
- `key` must be unique and URL-safe
- `family` enum: 'ats', 'modern', 'creative'
- ATS templates must have `family = 'ats'` and `is_premium = false`

## State Transitions

### Resume Processing
```
uploaded → parsing → (success|failed)
```

### Job Description Processing  
```
created → processing → (success|failed)
```

### Optimization Workflow
```
pending → processing → (completed|failed)
```

**Business Rules**:
- Processing timeout: 20 seconds
- Failed optimizations don't count against user quota
- Completed optimizations increment `user.optimizations_used`

## Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_job_descriptions_user_id ON job_descriptions(user_id);
CREATE INDEX idx_optimizations_user_id ON optimizations(user_id);
CREATE INDEX idx_optimizations_status ON optimizations(status);
CREATE INDEX idx_optimizations_created_at ON optimizations(created_at DESC);

-- Vector similarity search
CREATE INDEX idx_resumes_embeddings ON resumes USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX idx_job_descriptions_embeddings ON job_descriptions USING ivfflat (embeddings vector_cosine_ops);

-- Unique constraints
ALTER TABLE optimizations ADD CONSTRAINT unique_optimization 
  UNIQUE (user_id, resume_id, job_description_id, template_key);
```

## Row Level Security (RLS)

All tables enforce user isolation:

```sql
-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Resumes  
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own resumes" ON resumes FOR ALL USING (user_id = auth.uid());

-- Job Descriptions
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;  
CREATE POLICY "Users can CRUD own job descriptions" ON job_descriptions FOR ALL USING (user_id = auth.uid());

-- Optimizations
ALTER TABLE optimizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own optimizations" ON optimizations FOR ALL USING (user_id = auth.uid());

-- Templates (public read)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view templates" ON templates FOR SELECT TO authenticated USING (true);
```

