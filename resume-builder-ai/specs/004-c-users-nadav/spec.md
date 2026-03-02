# Feature Specification: JD Scraping + In-App Apply + Applications Tracker

**Feature Branch**: `004-c-users-nadav`
**Created**: 2025-10-12
**Status**: Draft
**Input**: User description: "- & 'c:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\ResumeBuilder AI\.cursor\plans\jd-8dcd7e80.plan.md'&"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Job Description URL Scraping and Preview (Priority: P1)

As a job seeker, I want to paste a job posting URL and automatically extract the job details, so that I don't have to manually copy-paste job descriptions and can quickly optimize my resume against real job postings.

**Why this priority**: This is the foundational capability that enables the entire workflow. Without automated scraping, users must manually copy-paste job descriptions, creating friction and reducing the likelihood of using the optimization feature.

**Independent Test**: Can be fully tested by navigating to `/dashboard/resume`, switching to "Enter URL" mode, pasting a job URL, clicking "Fetch", and verifying that the job title, company, requirements, and responsibilities are displayed in a preview card. This delivers immediate value by showing users what information was extracted before they commit to optimization.

**Acceptance Scenarios**:

1. **Given** I am on the resume upload page, **When** I switch to "Enter URL" mode and paste a valid job posting URL and click "Fetch", **Then** I see a preview card displaying the extracted job title, company name, requirements list, and responsibilities list
2. **Given** I have fetched a job description preview, **When** I click "Optimize" or submit the form, **Then** the system uses the scraped job description to create an optimization
3. **Given** I paste an invalid or non-job URL, **When** I click "Fetch", **Then** I see a clear error message explaining that the URL could not be scraped
4. **Given** I have a scraped preview displayed, **When** I change the URL, **Then** the preview clears or updates accordingly

---

### User Story 2 - One-Click Job Application from Optimization Page (Priority: P2)

As a job seeker who has optimized my resume, I want to apply to the job with one click that generates my resume PDF, opens the job posting, and tracks my application, so that I can streamline the application process and maintain a record of where I've applied.

**Why this priority**: This builds on P1 by completing the end-to-end workflow. It provides significant value by automating the tedious parts of job application (PDF generation, tab management) and automatically creating an application record for tracking.

**Independent Test**: Can be fully tested by having an existing optimization, clicking "Apply Now", and verifying that: (1) a PDF downloads, (2) the job URL opens in a new tab, (3) an application record is created, and (4) the user is redirected to the applications page. This delivers value even without P3 by enabling quick application submission with automatic tracking.

**Acceptance Scenarios**:

1. **Given** I am viewing an optimization with an associated job URL, **When** I click "Apply Now", **Then** my optimized resume is generated as a PDF and automatically downloads
2. **Given** I clicked "Apply Now", **When** the PDF downloads, **Then** the job posting URL opens in a new browser tab
3. **Given** the apply flow completes successfully, **When** all actions finish, **Then** an application record is created with status "applied", the current date, job title, company name, job URL, and ATS match score
4. **Given** the application record is created, **When** the flow completes, **Then** I am automatically redirected to the applications tracking page
5. **Given** the optimization has no associated job URL, **When** I click "Apply Now", **Then** the PDF still downloads and an application record is created, but no job URL tab opens

---

### User Story 3 - Applications Tracking Dashboard (Priority: P3)

As a job seeker managing multiple applications, I want to view all my applications in one place with key details and be able to update contact information and status, so that I can track my job search progress and know which applications need follow-up.

**Why this priority**: This completes the application management workflow by providing ongoing value through organization and tracking. While P1 and P2 enable the core application flow, P3 adds long-term value by helping users manage their job search over time.

**Independent Test**: Can be fully tested by navigating to `/dashboard/applications` and verifying that all applications are listed with company, position, contact person, status, ATS match, and days since applied. Inline editing of contact person and status can be tested independently. This delivers value by providing centralized application tracking.

**Acceptance Scenarios**:

1. **Given** I have submitted multiple applications, **When** I navigate to `/dashboard/applications`, **Then** I see a table listing all my applications with columns for Company, Position, Contact Person, Status, ATS Match %, and Days Since Applied
2. **Given** I am viewing the applications table, **When** I click to edit the Contact Person field for an application, **Then** I can type a name and the change is saved via PATCH request
3. **Given** I am viewing the applications table, **When** I change the Status dropdown for an application, **Then** the status updates immediately via PATCH request
4. **Given** I am viewing an application row, **When** I click "Open Job", **Then** the job posting URL opens in a new tab (if available)
5. **Given** I am viewing an application row, **When** I click "View JD", **Then** I am navigated to view the full job description details
6. **Given** I am viewing an application row, **When** I click "Download Resume", **Then** the optimized resume PDF for that application downloads
7. **Given** I submitted an application today, **When** I view the applications table, **Then** the "Days Since Applied" column shows "0 days" or "Today"
8. **Given** I submitted an application 5 days ago, **When** I view the applications table, **Then** the "Days Since Applied" column shows "5 days"

---

### Edge Cases

- What happens when a job URL returns a non-HTML response (PDF, image, etc.)? System should show an error message explaining that the URL format is not supported.
- What happens when scraping times out (>10s)? System should show a timeout error and suggest the user try manual paste instead.
- What happens when the scraped page has no recognizable job description structure? System should return the raw text with a note that structured extraction failed, allowing manual review.
- What happens when a user tries to apply without an optimization? The "Apply Now" button should not appear on pages without a valid optimization.
- What happens when PDF generation fails during apply flow? Show an error toast and allow retry without recreating the application record.
- What happens when the job URL is no longer accessible (404/403) during apply flow? Proceed with PDF generation and application record creation, but show a warning that the job URL couldn't be opened.
- What happens when a user has no applications yet? Show an empty state with helpful text like "You haven't applied to any jobs yet. Optimize a resume and click 'Apply Now' to get started."
- What happens when editing contact person or status fails (network error)? Show an error toast and revert the UI to the previous value.
- What happens when multiple browser tabs try to apply to the same optimization simultaneously? The API should handle idempotent creation to avoid duplicate application records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an API endpoint to scrape job descriptions from URLs and extract structured information (title, company, requirements, responsibilities)
- **FR-002**: System MUST display a preview of scraped job information before optimization, showing title, company, and key sections
- **FR-003**: System MUST support optimizing resumes against job descriptions provided via URL scraping
- **FR-004**: System MUST provide a "Apply Now" action on optimization pages that generates a PDF resume
- **FR-005**: System MUST automatically open the job posting URL in a new browser tab when user clicks "Apply Now" (if URL is available)
- **FR-006**: System MUST create an application record tracking: optimization ID, job title, company name, job URL, application status, applied date, ATS match score, and optional contact person
- **FR-007**: System MUST provide a dedicated applications tracking page at `/dashboard/applications`
- **FR-008**: System MUST display all user applications in a table with sortable/filterable columns
- **FR-009**: System MUST allow inline editing of contact person and application status via PATCH API
- **FR-010**: System MUST calculate and display "days since applied" for each application in real-time
- **FR-011**: System MUST provide quick actions for each application: Open Job URL, View Job Description, Download Resume PDF
- **FR-012**: System MUST only scrape URLs with `http://` or `https://` protocols for security
- **FR-013**: System MUST rate-limit the scrape endpoint to prevent abuse
- **FR-014**: System MUST use a proper User-Agent header when fetching job URLs to avoid being blocked
- **FR-015**: System MUST handle scraping errors gracefully with clear user feedback
- **FR-016**: System MUST respect existing optimization quota limits when creating optimizations from scraped URLs
- **FR-017**: System MUST preserve the job description URL in the optimization record for later reference
- **FR-018**: System MUST set default applied date to current timestamp when creating application records
- **FR-019**: System MUST validate that optimizations exist before allowing "Apply Now" action
- **FR-020**: System MUST support downloading previously generated resume PDFs via download API

### Key Entities

- **Job Scrape Result**: Represents the structured output from scraping a job URL, containing raw text, metadata (title, company), and extracted sections (requirements array, responsibilities array)
- **Application Record**: Represents a job application submission, linking to an optimization, containing job details (title, company, URL), tracking information (status, applied date, contact person), and performance metrics (ATS match score). Relationships: belongs to one user, belongs to one optimization
- **Optimization**: Extended to include job description URL reference for scraping and re-scraping purposes
- **Job Description Preview**: Temporary UI state containing scraped job data before optimization submission, including title, company, requirements list, and responsibilities list

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can fetch and preview job descriptions from URLs in under 5 seconds (90th percentile response time)
- **SC-002**: The complete "Apply Now" flow (PDF generation + URL opening + record creation + navigation) completes in under 10 seconds
- **SC-003**: 90% of scraped job URLs successfully extract at least title and company name
- **SC-004**: The applications page loads and displays all records in under 2 seconds for users with up to 100 applications
- **SC-005**: Inline editing of contact person or status completes within 1 second with visual feedback
- **SC-006**: "Days since applied" calculation is accurate to the day and updates in real-time on page load
- **SC-007**: PDF downloads initiated from "Apply Now" or "Download Resume" complete successfully 95% of the time
- **SC-008**: Zero application records are created if the "Apply Now" flow is interrupted before completion
- **SC-009**: Users can successfully apply to jobs and track applications without reading documentation (usability test with 5 users shows 100% task completion)
- **SC-010**: The scrape endpoint handles at least 100 requests per minute without performance degradation
