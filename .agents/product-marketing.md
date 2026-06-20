# Product Marketing Context

*Last updated: 2026-06-20*
*Assembled from: `Agentic OS/distribution-os/projects/resumebuilder/scaffold/{product-positioning,audience,messaging,competitors,metrics}.md` (synced 2026-05-28). Update there first, then re-sync here. Replaces the earlier positioning-only mirror of this file.*

## Product Overview
**One-liner:** ResumeBuilder AI helps you build and tailor a resume that passes ATS scans and reads like a confident professional — without sounding like a robot.
**What it does:** Paste a job posting, get a job-tailored draft in minutes, with ATS-aware scoring that shows where the parser will trip and how to fix it, plus templates designed to actually parse. Edits keep the candidate's voice rather than replacing it.
**Product category:** AI resume optimization. Adjacent: resume builders, career coaching, ATS-friendly templates.
**Product type:** Web app (Next.js + Supabase + OpenAI + Stripe) with a companion iOS app (Resumely). Web serves all platforms incl. Android; iOS app is iOS-only.
**Business model:** Freemium with a paid tier (Stripe). Revenue metrics not yet activated (`resumebuilder.revenue.mrr` tracked as "not tracked, activate when paid tier ships").

## Target Audience
**Target companies:** N/A — consumer (B2C) app.
**Decision-makers:** N/A — single end-user purchase decision (the job seeker).
**Primary use case:** Tailor a resume to a specific job posting fast — get the interview without losing the candidate's own voice.
**Jobs to be done:**
- "Help me tailor my resume to this role so I get the interview, and don't lose my voice doing it."
- "Tell me where the ATS parser will reject me, and how to fix it, before I submit."
- "Let me do this from my phone, between interviews or on a commute, and export a PDF before the interview."
**Use cases:**
- Active job seeker applying to multiple roles per week, often from their phone
- Career switcher translating prior experience into a new function
- Polisher improving one existing resume for one or two important roles
- Hebrew-speaking job seeker applying in the Israeli market

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Active job seeker, English (primary ICP) | Speed, beating ATS, not sounding generic | Every role needs a different resume; ATS rejection fear; ChatGPT output sounds like everyone else | A job-tailored, ATS-aware draft in minutes — exportable from the phone |
| Career switcher | Translating transferable skills credibly | How to reframe prior experience for a new function | Confidence-building edits that reposition experience without fabricating it |
| Polisher (existing resume) | Knowing what to cut, sounding stronger | Resume feels stale; unsure what to trim | Targeted edits that strengthen, not a full rewrite |
| Hebrew-speaking job seeker | Local conventions, not US-English assumptions | Most tools assume US English formatting | An authored (not auto-translated) Hebrew variant matching Israeli market norms |

## Problems & Pain Points
**Core problem:** Every job application needs a differently-tailored resume, and candidates fear silent ATS rejection while also fearing generic AI output that strips their voice.
**Why alternatives fall short:**
- ChatGPT prompts: inconsistent output, no parser awareness, no persistence
- Canva / design-first templates: often fail ATS parsing
- Google Docs / Word templates: manual, no tailoring, no ATS signal
- LinkedIn native builder: generic, not job-tailored, no PDF/ATS audit
**What it costs them:** Wasted applications, missed interviews, hours of manual re-tailoring, paid resume services.
**Emotional tension:** Stress of an active job search; fear of invisible ATS rejection; doubt about whether AI edits still "sound like me."

## Competitive Landscape
**Direct:** Teal (strong brand + job tracker), Rezi (ATS framing), Kickresume (templates + builder) — fall short on tailoring tightness and (for our wedge) an authored Hebrew variant.
**Secondary:** Resume.io / Zety / Enhancv (template-heavy or design-first) — fall short on consistent ATS parse quality.
**Indirect:** ChatGPT-as-resume-tool, Canva resumes, LinkedIn native builder, career coaches (slower/costlier, sometimes a partner channel) — fall short on parser awareness and job-posting-bound tailoring.

**When ResumeBuilder AI wins:** seeker needs a job-tailored, ATS-aware resume fast; has tried pasting a job description into ChatGPT and gotten generic output; wants Hebrew authored output; wants mobile paste-to-export.

## Differentiation
**Key differentiators:**
- Job-tailored output bound to the actual posting
- ATS-aware scoring with concrete suggestions
- Templates designed to parse, not just to look beautiful
- Confidence-building edits (not just rewrites) that keep the candidate's voice
- English plus an authored Hebrew variant (not auto-translated)
**How we do it differently:** Tailoring responds to the pasted posting; ATS scoring is shown before submission.
**Why that's better:** Reduces silent ATS rejection and the "this doesn't sound like me" problem that pushes seekers back to manual editing.
**Why customers choose us:** Output quality + parser awareness + Hebrew authored variant, in a category where "AI-powered" alone is no longer a differentiator.

## Objections
| Objection | Response |
|-----------|----------|
| "Can't I just use ChatGPT for free?" | ChatGPT gives inconsistent output with no parser awareness or persistence; we bind tailoring to the posting and show where the ATS will trip. |
| "Will the AI make it sound generic / not like me?" | Edits are confidence-building, not wholesale rewrites — they keep the candidate's voice. |
| "Do beautiful templates actually pass ATS?" | Our templates are designed to parse, unlike design-first tools (Canva, Enhancv) that risk parsing failure. |

**Anti-persona:** Senior executives wanting bespoke human help (refer out), students with zero experience (usable but not core), recruiters/TA professionals (not the buyer), Android-only users for the iOS app (web still serves them).

## Switching Dynamics
**Push:** Getting silently rejected; exhausting manual re-tailoring; generic ChatGPT output.
**Pull:** A tailored, ATS-aware draft in minutes that still sounds like the candidate.
**Habit:** Reusing the same Word/Google Docs resume "just edited"; default LinkedIn builder.
**Anxiety:** Will a paid tool actually be better than free ChatGPT, and will it preserve my voice?

## Customer Language
**How they describe the problem:** "ATS resume," "tailor my resume," "resume template," "applicant tracking," "beat the ATS" (Segment A) — "career change resume," "career pivot," "transferable skills" (B) — "improve my resume," "make my resume stronger" (C) — Hebrew equivalents and local job titles (D).
**How they describe us:** Not yet captured — no verbatim user quotes logged. *(Gap: pull 2-3 from App Store reviews, support, or interviews and add here.)*
**Words to use:** "tailor," "ATS-aware," "parses," "keeps your voice," "in minutes."
**Words to avoid:** "Guaranteed interview," "Beat the ATS" (alarmist), "AI that writes your resume for you" (replacement vibe), "100% ATS pass rate."
**Glossary:**
| Term | Meaning |
|------|---------|
| ATS-aware | Scoring/edits informed by how applicant tracking systems parse resumes |
| Job-tailored | Output bound to a specific pasted job posting |
| Parse | Whether an ATS can correctly read a resume's structure |
| Authored Hebrew | Hebrew copy written for the Israeli market, not machine-translated |

## Brand Voice
**Tone:** Calm, practical, professional; honest about ATS realities, never alarmist.
**Style:** Treats the job seeker as a competent adult under stress; avoids "guaranteed" language.
**Personality:** Trustworthy, grounded, voice-preserving, anti-hype. Hebrew variant: same calm with appropriate local idiom.

## Proof Points
**Metrics:** None tracked yet — `resumebuilder.activation.first_resume_exported` and `resumebuilder.retention.returned_within_14_days` are the north-star metrics but tracking status is "not tracked" pending analytics instrumentation.
**Customers:** None named yet.
**Testimonials:** None captured yet. *(Gap: pull from reviews once available.)*
**Value themes:**
| Theme | Proof |
|-------|-------|
| Parses, doesn't just look good | Templates designed for ATS parsing |
| Keeps your voice | Confidence edits over full rewrites |
| Authored Hebrew | Hebrew is written, not translated |

## Goals
**Business goal:** Grow activations from the active-job-seeker wedge (incl. Hebrew share); SEO/programmatic is the primary growth channel for web.
**Conversion action:** First resume exported within the first session (`resume_exported` event); secondary free-tool CTA "Score my current resume."
**Current metrics:** Not yet tracked — `app_opened`, `onboarding_completed`, `resume_started`, `job_posting_pasted`, `resume_exported`, `app_returned` events are specified but not confirmed live as of 2026-05-28.

---

**Bound claims (must be backed):** "ATS-aware" only where parser behavior is verified; "job-tailored" only where tailoring actually responds to the posting; "parse success" only with cited examples or rates.

**Known gaps to fill before high-stakes copy:** real verbatim customer quotes (problem + product language), at least one testimonial, live activation/retention numbers once analytics is instrumented, and confirmation of which surface (web vs iOS) a given campaign targets.
