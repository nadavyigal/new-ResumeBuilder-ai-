# Quickstart Guide: AI Resume Optimizer

## Overview
This quickstart guide provides step-by-step scenarios to validate the AI Resume Optimizer functionality. Each scenario corresponds to a user story from the feature specification and includes both manual testing steps and automated test validation.

## Prerequisites
- ✅ User account created and authenticated
- ✅ Test resume files available (PDF and DOCX formats)
- ✅ Sample job descriptions prepared
- ✅ API endpoints deployed and accessible
- ✅ Database schema applied
- ✅ OpenAI API key configured

## Test Data Setup

### Sample Resume File
```
resume-sample.pdf (Located in: tests/fixtures/)
- Contains: John Doe, Software Developer
- Experience: 3 years React/Node.js
- Education: BS Computer Science
- Skills: JavaScript, React, Node.js, PostgreSQL
- File size: ~500KB
```

### Sample Job Description
```
Job Title: Senior Frontend Developer
Company: Tech Corp
Requirements:
- 5+ years experience with React
- TypeScript expertise
- Experience with Next.js
- Bachelor's degree in CS or related field
- Strong problem-solving skills
```

## Validation Scenarios

### Scenario 1: Resume Upload and Parsing
**User Story**: As a user, I want to upload my resume and see parsed content

**Steps**:
1. **Upload Resume**
   ```bash
   curl -X POST /api/upload-resume \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -F "file=@tests/fixtures/resume-sample.pdf"
   ```

2. **Expected Response**:
   ```json
   {
     "resume_id": "uuid-here",
     "filename": "resume-sample.pdf",
     "parsing_status": "success",
     "parsed_data": {
       "contact": {
         "name": "John Doe",
         "email": "john.doe@email.com"
       },
       "experience": [...],
       "skills": {...}
     },
     "message": "Resume uploaded and parsed successfully"
   }
   ```

3. **Validation Checklist**:
   - [ ] File upload accepts PDF/DOCX under 10MB
   - [ ] Parsing extracts contact information correctly
   - [ ] Experience section parsed with dates and descriptions
   - [ ] Skills section categorized appropriately
   - [ ] Error handling for unsupported file types
   - [ ] Database record created with correct user association

**Integration Test**:
```javascript
describe('/api/upload-resume', () => {
  it('should parse PDF resume successfully', async () => {
    const response = await uploadResume('resume-sample.pdf');
    expect(response.status).toBe(200);
    expect(response.body.parsing_status).toBe('success');
    expect(response.body.parsed_data.contact.name).toBe('John Doe');
  });
});
```

### Scenario 2: Job Description Processing
**User Story**: As a user, I want to input a job description and see extracted requirements

**Steps**:
1. **Submit Job Description**
   ```bash
   curl -X POST /api/ingest-jd \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "source_type": "text",
       "text": "Senior Frontend Developer at Tech Corp..."
     }'
   ```

2. **Expected Response**:
   ```json
   {
     "jd_id": "uuid-here",
     "extracted_data": {
       "company": "Tech Corp",
       "title": "Senior Frontend Developer",
       "requirements": {
         "must_have": ["React", "TypeScript", "5+ years experience"],
         "experience_years": 5
       },
       "keywords": ["React", "TypeScript", "Frontend", "JavaScript"]
     },
     "cleaned_text": "Clean normalized text...",
     "message": "Job description processed successfully"
   }
   ```

3. **Validation Checklist**:
   - [ ] Text input processed correctly
   - [ ] Key requirements extracted accurately
   - [ ] Company and title identified
   - [ ] Keywords detected and categorized
   - [ ] URL scraping works for job posting links
   - [ ] Database record created with embeddings

**Integration Test**:
```javascript
describe('/api/ingest-jd', () => {
  it('should extract job requirements correctly', async () => {
    const response = await ingestJobDescription(sampleJD);
    expect(response.status).toBe(200);
    expect(response.body.extracted_data.title).toContain('Frontend Developer');
    expect(response.body.extracted_data.keywords).toContain('React');
  });
});
```

### Scenario 3: AI Resume Optimization
**User Story**: As a user, I want to generate an optimized resume tailored to a job description

**Steps**:
1. **Request Optimization**
   ```bash
   curl -X POST /api/optimize \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "resume_id": "resume-uuid",
       "job_description_id": "jd-uuid",
       "template_key": "ats-safe"
     }'
   ```

2. **Expected Response** (within 20 seconds):
   ```json
   {
     "optimization_id": "optimization-uuid",
     "match_score": 75.5,
     "optimized_data": {
       "summary": "Experienced Frontend Developer with 3+ years...",
       "experience": [
         {
           "description": "Led React development...",
           "bullets": ["Developed React components using TypeScript"],
           "keywords_added": ["TypeScript", "React hooks"]
         }
       ]
     },
     "processing_time": 12.3,
     "message": "Resume optimized successfully"
   }
   ```

3. **Validation Checklist**:
   - [ ] Processing completes within 20 second timeout
   - [ ] Match score calculated between 0-100
   - [ ] Optimized content enhances keyword alignment
   - [ ] No fabricated skills or experience added
   - [ ] Truthful optimization maintains accuracy
   - [ ] Free user quota enforced (1 optimization max)
   - [ ] Premium users have unlimited access

**Integration Test**:
```javascript
describe('/api/optimize', () => {
  it('should optimize resume within time limit', async () => {
    const startTime = Date.now();
    const response = await optimizeResume(resumeId, jdId, 'ats-safe');
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(20000); // 20 seconds
    expect(response.body.match_score).toBeGreaterThan(0);
    expect(response.body.optimized_data).toBeDefined();
  });
});
```

### Scenario 4: Template Selection and Export
**User Story**: As a user, I want to select a template and download my optimized resume

**Steps**:
1. **Get Available Templates**
   ```bash
   curl -X GET /api/templates \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```

2. **Expected Templates Response**:
   ```json
   {
     "templates": [
       {
         "key": "ats-safe",
         "name": "ATS-Safe",
         "family": "ats",
         "is_premium": false,
         "description": "Simple, ATS-friendly format"
       },
       {
         "key": "modern",
         "name": "Modern Professional",
         "family": "modern", 
         "is_premium": true,
         "description": "Clean, modern design with color accents"
       }
     ]
   }
   ```

3. **Download Resume**
   ```bash
   curl -X GET "/api/download/{optimization_id}?format=pdf" \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -o "optimized-resume.pdf"
   ```

4. **Validation Checklist**:
   - [ ] Template list includes free and premium options
   - [ ] PDF download generates correctly formatted file
   - [ ] DOCX download preserves styling and layout
   - [ ] Free users can access ATS-safe template
   - [ ] Premium templates require subscription
   - [ ] Download links are secure and time-limited

**Integration Test**:
```javascript
describe('/api/download', () => {
  it('should generate PDF with correct formatting', async () => {
    const response = await downloadResume(optimizationId, 'pdf');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.body.length).toBeGreaterThan(1000); // Non-empty PDF
  });
});
```

### Scenario 5: Match Score Analysis
**User Story**: As a user, I want to see detailed match analysis and improvement suggestions

**Steps**:
1. **Get Score Analysis**
   ```bash
   curl -X GET /api/score/{optimization_id} \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```

2. **Expected Analysis Response**:
   ```json
   {
     "optimization_id": "uuid",
     "match_score": 75.5,
     "analysis": {
       "keyword_match": {
         "total_keywords": 20,
         "matched_keywords": 15,
         "missing_keywords": ["TypeScript", "Next.js"],
         "score": 75
       },
       "skill_gap": {
         "required_skills": ["React", "TypeScript", "Node.js"],
         "matching_skills": ["React", "Node.js"],
         "missing_skills": ["TypeScript"],
         "score": 67
       },
       "recommendations": [
         "Consider highlighting TypeScript experience",
         "Add Next.js projects to experience section"
       ]
     }
   }
   ```

3. **Validation Checklist**:
   - [ ] Keyword analysis identifies matches and gaps
   - [ ] Skill gap analysis provides actionable insights
   - [ ] Experience level alignment calculated correctly
   - [ ] Recommendations are specific and helpful
   - [ ] Score breakdown totals to overall match score

### Scenario 6: Freemium Quota Enforcement
**User Story**: As a free user, I should be limited to one optimization and see paywall for additional use

**Steps**:
1. **First Optimization** (should succeed)
2. **Second Optimization Attempt**:
   ```bash
   curl -X POST /api/optimize \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "resume_id": "resume-uuid",
       "job_description_id": "jd-uuid",
       "template_key": "ats-safe"
     }'
   ```

3. **Expected Quota Response**:
   ```json
   {
     "error": "Free tier optimization limit exceeded",
     "code": "QUOTA_EXCEEDED",
     "quota_info": {
       "current_tier": "free",
       "optimizations_used": 1,
       "optimizations_limit": 1
     },
     "upgrade_url": "/pricing"
   }
   ```

4. **Validation Checklist**:
   - [ ] Free users limited to 1 optimization
   - [ ] Clear paywall message with upgrade path
   - [ ] Premium users have unlimited access
   - [ ] Quota tracking accurate per user
   - [ ] Failed optimizations don't count against quota

## Performance Benchmarks

### Response Time Targets
- Resume upload: < 5 seconds
- Job description processing: < 3 seconds
- AI optimization: < 20 seconds (hard limit)
- Template rendering: < 2 seconds
- File download: < 5 seconds

### Load Testing Scenarios
```bash
# Concurrent resume uploads
artillery run load-tests/upload-scenario.yml

# Optimization throughput
artillery run load-tests/optimization-scenario.yml
```

## Error Handling Validation

### Expected Error Scenarios
1. **File too large (>10MB)**: HTTP 413 with clear message
2. **Unsupported file format**: HTTP 400 with supported formats list
3. **Parsing failure**: Graceful error with retry option
4. **AI optimization timeout**: HTTP 408 with retry suggestion
5. **Invalid template key**: HTTP 400 with available templates
6. **Unauthorized access**: HTTP 401 with auth instructions

## Database Integrity Checks

### Data Validation
```sql
-- Verify user data isolation
SELECT COUNT(*) FROM resumes WHERE user_id != auth.uid(); -- Should be 0

-- Check optimization constraints
SELECT COUNT(*) FROM optimizations 
WHERE match_score < 0 OR match_score > 100; -- Should be 0

-- Verify file size constraints
SELECT COUNT(*) FROM resumes WHERE file_size > 10485760; -- Should be 0
```

## Success Criteria

**All scenarios must pass** to consider the feature ready for production:
- [ ] All API endpoints respond correctly
- [ ] Performance targets met under normal load
- [ ] Error handling graceful and informative
- [ ] Data integrity maintained
- [ ] Security policies enforced
- [ ] Quota system functioning correctly
- [ ] Export files generated properly

## Deployment Checklist

Before production deployment:
- [ ] All integration tests passing
- [ ] Load testing completed successfully
- [ ] Security audit completed
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] OpenAI API limits verified
- [ ] File storage configured
- [ ] Error monitoring set up
- [ ] Performance monitoring enabled

---

**Next Steps**: Once all scenarios validate successfully, proceed to `/tasks` command for implementation task generation.

