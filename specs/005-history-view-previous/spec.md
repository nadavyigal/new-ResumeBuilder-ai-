# Feature Specification: History View - Previous Optimizations

**Feature Branch**: `005-history-view-previous`
**Created**: 2025-10-13
**Status**: Draft
**Input**: User description: "- History View previous optimizations as per the folowing scec.md ( without story 1 ) & 'c:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\ResumeBuilder AI\specs\004-c-users-nadav\spec.md'"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - View All Previous Optimizations (Priority: P1)

As a job seeker who has created multiple resume optimizations, I want to view a comprehensive list of all my previous optimizations with key details, so that I can quickly access and review my optimization history and decide which resume version to use for different applications.

**Why this priority**: This is the foundational capability that enables users to benefit from their optimization history. Without the ability to view past optimizations, users lose track of their work and cannot leverage previously optimized resumes for new applications.

**Independent Test**: Can be fully tested by navigating to `/dashboard/history` and verifying that all optimizations are displayed in a table with columns for Date Created, Job Title, Company, ATS Match %, Status, and Actions. This delivers immediate value by providing centralized access to all optimization work.

**Acceptance Scenarios**:

1. **Given** I have created multiple resume optimizations, **When** I navigate to `/dashboard/history`, **Then** I see a table listing all my optimizations sorted by date created (newest first)
2. **Given** I am viewing the history table, **When** I review each row, **Then** I see the date created, job title, company name, ATS match percentage, and current status for each optimization
3. **Given** I have no optimizations yet, **When** I navigate to `/dashboard/history`, **Then** I see an empty state with helpful text like "You haven't created any optimizations yet. Upload a resume and optimize it against a job description to get started."
4. **Given** I am viewing an optimization row, **When** I click "View Details", **Then** I am navigated to the full optimization page showing the complete analysis and suggestions
5. **Given** I am viewing an optimization row, **When** I click "Download PDF", **Then** the optimized resume PDF for that optimization downloads immediately

---

### User Story 2 - Quick Apply from History (Priority: P2)

As a job seeker reviewing my optimization history, I want to apply to jobs directly from the history view with one click, so that I can quickly leverage past optimizations for new applications without having to navigate to each optimization page individually.

**Why this priority**: This builds on P1 by enabling action directly from the history view. It provides significant value by reducing the number of clicks required to apply and creating a seamless workflow from history review to job application.

**Independent Test**: Can be fully tested by having optimizations in the history table, clicking "Apply Now" on a row, and verifying that: (1) a PDF downloads, (2) the job URL opens in a new tab, (3) an application record is created, and (4) the user receives confirmation feedback. This delivers value even without P3 by enabling quick re-application to similar jobs.

**Acceptance Scenarios**:

1. **Given** I am viewing an optimization in the history table with an associated job URL, **When** I click "Apply Now", **Then** the optimized resume is generated as a PDF and automatically downloads
2. **Given** I clicked "Apply Now" from history, **When** the PDF downloads, **Then** the job posting URL opens in a new browser tab (if available)
3. **Given** the apply flow completes successfully from history, **When** all actions finish, **Then** an application record is created with status "applied", the current date, job title, company name, job URL, and ATS match score
4. **Given** the application is created from history, **When** the flow completes, **Then** I see a success toast notification and the history table updates to show the new application status
5. **Given** the optimization has no associated job URL, **When** I click "Apply Now" from history, **Then** the PDF still downloads and an application record is created, but no job URL tab opens
6. **Given** I have already applied to an optimization, **When** I view it in history, **Then** the "Apply Now" button shows "Applied" badge or changed state to indicate previous application

---

### User Story 3 - Filter and Search Optimizations (Priority: P3)

As a job seeker with many optimizations, I want to filter my optimization history by date range, company, or ATS match score, and search by job title or company name, so that I can quickly find specific optimizations without scrolling through a long list.

**Why this priority**: This completes the history management workflow by providing organization tools for power users with extensive optimization history. While P1 and P2 enable core history functionality, P3 adds long-term value by scaling the feature for users with dozens or hundreds of optimizations.

**Independent Test**: Can be fully tested by having multiple optimizations in history, using the search box to filter by job title/company, using date range filters, and using ATS match score filters, then verifying that the table updates to show only matching results. This delivers value by improving efficiency for users with large optimization libraries.

**Acceptance Scenarios**:

1. **Given** I am viewing the history page with many optimizations, **When** I type in the search box, **Then** the table filters in real-time to show only optimizations where the job title or company name contains my search text
2. **Given** I am viewing the history page, **When** I select a date range filter (e.g., "Last 7 days", "Last 30 days", "Custom range"), **Then** the table shows only optimizations created within that date range
3. **Given** I am viewing the history page, **When** I set an ATS match score filter (e.g., "80% and above"), **Then** the table shows only optimizations meeting that threshold
4. **Given** I have applied multiple filters, **When** I click "Clear Filters", **Then** all filters reset and the full optimization list is displayed
5. **Given** my filters result in no matches, **When** the table updates, **Then** I see a message like "No optimizations match your filters. Try adjusting your search criteria."
6. **Given** I am viewing filtered results, **When** I click on column headers, **Then** the filtered results sort by that column (ascending/descending toggle)

---

### User Story 4 - Bulk Actions on Optimizations (Priority: P4)

As a job seeker managing multiple optimizations, I want to select multiple optimizations and perform bulk actions like delete or export, so that I can efficiently manage my optimization library and clean up old or irrelevant optimizations.

**Why this priority**: This is a convenience feature for power users who accumulate many optimizations over time. While useful for maintenance, it's not essential for the core value proposition of viewing and reusing optimizations.

**Independent Test**: Can be fully tested by selecting multiple optimization rows via checkboxes, clicking "Delete Selected" or "Export Selected", and verifying that the action applies to all selected items with appropriate confirmation dialogs. This delivers value by reducing repetitive actions for library maintenance.

**Acceptance Scenarios**:

1. **Given** I am viewing the history table, **When** I click the checkbox in the table header, **Then** all visible optimizations are selected
2. **Given** I have selected multiple optimizations, **When** I click "Delete Selected", **Then** I see a confirmation dialog showing the count of items to be deleted
3. **Given** I confirm bulk deletion, **When** the action completes, **Then** the selected optimizations are removed from the table and database, and I see a success notification
4. **Given** I have selected multiple optimizations, **When** I click "Export Selected", **Then** a ZIP file downloads containing all selected optimization PDFs with descriptive filenames (e.g., "optimization-google-software-engineer-2025-10-13.pdf")
5. **Given** I have items selected, **When** I click "Deselect All", **Then** all checkboxes are cleared and bulk action buttons are disabled

---

### Edge Cases

- What happens when the history table has more than 100 optimizations? Implement pagination with 20 items per page and display page numbers with previous/next navigation.
- What happens when an optimization has no associated job URL? Show "N/A" in the company column and disable the "Open Job" action button.
- What happens when fetching optimization history fails (network error)? Show an error banner at the top of the page with a "Retry" button.
- What happens when downloading a PDF fails during the apply flow from history? Show an error toast and allow retry without recreating the application record.
- What happens when a user tries to apply to the same optimization multiple times? Allow re-application but show a warning toast "You've already applied to this position on [date]. Creating a new application record."
- What happens when sorting or filtering takes longer than expected? Show a loading skeleton in the table to indicate processing.
- What happens when bulk delete includes optimizations that have already been applied to? Include a warning in the confirmation dialog: "X of the selected optimizations have associated applications. These application records will be preserved."
- What happens when export includes optimizations whose PDFs are no longer available? Include a manifest.txt in the ZIP file listing which optimizations could not be exported and why.
- What happens when search query contains special characters? Sanitize input and perform case-insensitive partial matching without regex vulnerabilities.
- What happens when the user's free tier quota shows in the history context? Display a banner indicating "Free tier: X optimizations remaining" and link to upgrade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated history page at `/dashboard/history` to display all user optimizations
- **FR-002**: System MUST fetch and display optimization records including: date created, job title, company name, ATS match score, status, job URL
- **FR-003**: System MUST sort optimizations by date created in descending order (newest first) by default
- **FR-004**: System MUST provide "View Details" action to navigate to the full optimization page
- **FR-005**: System MUST provide "Download PDF" action to retrieve the optimized resume PDF for each optimization
- **FR-006**: System MUST provide "Apply Now" action that triggers the complete application flow (PDF generation + URL opening + record creation)
- **FR-007**: System MUST display an empty state with helpful guidance when the user has no optimizations
- **FR-008**: System MUST show loading states (skeletons or spinners) while fetching optimization data
- **FR-009**: System MUST implement real-time search filtering by job title and company name
- **FR-010**: System MUST provide date range filters (Last 7 days, Last 30 days, Last 90 days, Custom range)
- **FR-011**: System MUST provide ATS match score filters (e.g., 90%+, 80%+, 70%+, All)
- **FR-012**: System MUST allow clearing all active filters with a single action
- **FR-013**: System MUST show a message when filter results are empty
- **FR-014**: System MUST implement column sorting (ascending/descending) for Date, Company, ATS Match %
- **FR-015**: System MUST implement pagination when optimization count exceeds 20 items
- **FR-016**: System MUST provide row selection via checkboxes for bulk actions
- **FR-017**: System MUST provide "Select All" / "Deselect All" functionality
- **FR-018**: System MUST implement bulk delete with confirmation dialog showing affected item count
- **FR-019**: System MUST implement bulk export that generates a ZIP file with multiple PDFs
- **FR-020**: System MUST preserve application records when optimizations are deleted via bulk delete
- **FR-021**: System MUST update "Apply Now" button state to show "Applied" badge when an application exists for that optimization
- **FR-022**: System MUST handle missing job URLs gracefully by showing "N/A" and disabling job-related actions
- **FR-023**: System MUST sanitize search input to prevent XSS or injection vulnerabilities
- **FR-024**: System MUST use API endpoint `/api/optimizations` to fetch optimization history
- **FR-025**: System MUST respect user authentication and only show optimizations owned by the current user

### Key Entities

- **Optimization History Entry**: Represents a single optimization record in the history view, containing metadata (created date, job title, company, ATS score, status, job URL), relationships (optimization ID, user ID), and computed properties (days since created, application status). Relationships: belongs to one user, has zero or one application
- **Filter State**: Client-side state managing active filters (search text, date range, ATS score threshold) and sort configuration (column, direction)
- **Bulk Selection State**: Client-side state tracking which optimization IDs are currently selected for bulk actions
- **Optimization PDF**: The generated resume PDF associated with each optimization, stored in Supabase Storage or generated on-demand

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The history page loads and displays optimization records in under 2 seconds for users with up to 100 optimizations
- **SC-002**: Search filtering updates the table in under 200ms after the user stops typing (debounced)
- **SC-003**: Date range and ATS score filters apply and update the table in under 500ms
- **SC-004**: Sorting by any column completes in under 300ms
- **SC-005**: The "Apply Now" flow from history completes in under 10 seconds (same as from optimization page)
- **SC-006**: PDF downloads initiated from history complete successfully 95% of the time
- **SC-007**: Bulk delete of up to 50 optimizations completes in under 5 seconds
- **SC-008**: Bulk export of up to 20 optimizations completes in under 15 seconds
- **SC-009**: Users can find a specific optimization using search/filter in under 10 seconds (usability test with 5 users shows 100% success rate)
- **SC-010**: The empty state converts 80% of new users to create their first optimization within the session
- **SC-011**: Zero data races occur when multiple browser tabs interact with the history table simultaneously
- **SC-012**: Pagination navigation loads new pages in under 1 second
