<!--
Sync Impact Report:
- Version: 0.0.0 → 1.0.0
- Constitution Type: MAJOR (Initial ratification)
- Principles Added:
  * I. Library-First Architecture
  * II. CLI Interface
  * III. Test-Driven Development (TDD)
  * IV. Integration Testing
  * V. Observability
  * VI. Versioning & Breaking Changes
  * VII. Simplicity (YAGNI)
- Sections Added:
  * Performance Standards
  * Development Workflow
  * Governance
- Templates Status:
  ✅ plan-template.md - Constitution Check section alignment verified
  ✅ spec-template.md - Requirements and clarity standards aligned
  ✅ tasks-template.md - TDD ordering and parallel execution aligned
- Follow-up Items: None
- Notes: Initial constitution based on AI Resume Optimizer project architecture
-->

# AI Resume Optimizer Constitution

## Core Principles

### I. Library-First Architecture
Every feature MUST be implemented as a standalone library in `src/lib/` before integration into the application. Libraries MUST be:
- Self-contained with clear boundaries and single responsibility
- Independently testable without application context dependencies
- Documented with purpose, inputs, outputs, and usage examples
- Designed for reusability across different contexts (API routes, CLI, tests)

**Rationale**: Enforces separation of concerns, enables parallel development, simplifies testing, and prevents tight coupling between business logic and framework-specific code.

### II. CLI Interface
Every library MUST expose its core functionality via a command-line interface. CLI implementations MUST:
- Accept input via stdin or command-line arguments
- Output results to stdout (success data) and stderr (errors/logs)
- Support both JSON output (for programmatic use) and human-readable formats
- Enable standalone testing and debugging without running the full application

**Rationale**: Provides direct access to library functionality for testing, debugging, and automation. Enforces clear contracts and enables integration testing without UI dependencies.

### III. Test-Driven Development (NON-NEGOTIABLE)
Test-Driven Development is MANDATORY for all code. The RED-GREEN-REFACTOR cycle MUST be strictly followed:
1. Write failing tests first (contract tests, integration tests, or unit tests)
2. Obtain user/stakeholder approval of test scenarios before implementation
3. Verify tests fail with clear, expected error messages
4. Implement minimum code to make tests pass
5. Refactor while keeping tests green

No implementation code may be written before corresponding tests exist and fail. Violations of TDD discipline require immediate remediation.

**Rationale**: Prevents accidental complexity, ensures testability by design, provides living documentation, and catches regressions early. Non-negotiable because code without tests cannot be safely maintained.

### IV. Integration Testing
Integration tests MUST be written for:
- All new library contract tests (public API validation)
- Changes to existing library contracts (breaking changes, new parameters)
- Inter-service communication (API calls, database queries, external services)
- Shared schemas and data models (entity relationships, validation rules)

Integration tests MUST verify complete workflows, not just individual functions. Tests MUST use realistic data and simulate actual usage patterns.

**Rationale**: Unit tests alone miss issues at integration boundaries. Real-world failures occur when components interact, requiring explicit validation of contracts and dependencies.

### V. Observability
All code MUST be debuggable through text input/output protocols. Observability requirements:
- Structured logging with context (user ID, request ID, timestamps) to stderr
- Text-based I/O for all CLI interfaces (no binary protocols without text alternatives)
- Error messages MUST include actionable context (what failed, why, how to fix)
- Performance-critical paths MUST include timing logs at INFO level

**Rationale**: Text-based I/O ensures debuggability without special tools. Structured logging enables production troubleshooting. Clear error messages reduce support burden and debugging time.

### VI. Versioning & Breaking Changes
All libraries and APIs MUST follow semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes to public APIs or contracts
- MINOR: New features, backward-compatible additions
- PATCH: Bug fixes, performance improvements, documentation

Breaking changes MUST include:
- Migration guide with before/after examples
- Deprecation warnings in previous MINOR version (where possible)
- Updated contract tests demonstrating new behavior
- CHANGELOG entry with upgrade instructions

**Rationale**: Semantic versioning enables safe dependency management. Migration guides prevent breaking downstream consumers. Explicit versioning documents API evolution.

### VII. Simplicity (YAGNI)
Start with the simplest solution that solves the current problem. Complexity MUST be justified:
- Prefer direct implementations over abstractions until patterns emerge
- Avoid speculative features ("we might need this later")
- Three-strike rule: Abstract after third similar implementation
- Complexity additions require documentation in plan.md Complexity Tracking section

Rejected complexity MUST be documented with rationale for future reference.

**Rationale**: Premature abstraction creates maintenance burden. YAGNI prevents over-engineering. Simplicity reduces cognitive load and onboarding time.

## Performance Standards

### Response Time Targets
All API endpoints MUST meet performance targets defined in feature specifications:
- Resume upload processing: < 5 seconds (including parsing)
- Job description extraction: < 3 seconds (including URL scraping)
- AI optimization generation: < 20 seconds (hard timeout)
- File download generation: < 5 seconds (PDF/DOCX export)

Performance violations MUST be tracked, investigated, and resolved before production deployment.

### Resource Constraints
- File uploads: 10MB maximum size limit
- Database queries: MUST use indexes for foreign key lookups
- AI API calls: MUST implement exponential backoff retry logic
- Serverless functions: MUST handle cold start latency (< 3s p95)

**Rationale**: Performance is a feature. Users abandon slow applications. Constraints prevent resource exhaustion and cost overruns in serverless environments.

## Development Workflow

### Code Review Requirements
All code changes MUST pass the following gates before merging:
1. **Constitution Compliance**: Verify adherence to all seven core principles
2. **Test Coverage**: All new code has corresponding failing-then-passing tests
3. **Contract Validation**: API changes reflected in OpenAPI specs and contract tests
4. **Documentation**: README/docs updated for user-facing changes

Pull requests violating constitutional principles MUST be rejected with specific violation details.

### Quality Gates
- Linting: No TypeScript errors, ESLint warnings resolved
- Testing: All tests pass (contract, integration, unit)
- Build: Production build succeeds without warnings
- Performance: Response time targets met for affected endpoints

**Rationale**: Automated gates prevent regressions. Constitutional compliance ensures architectural consistency. Code review catches issues automation misses.

## Governance

### Amendment Process
Constitution amendments require:
1. Documented proposal with rationale and impact analysis
2. Approval from project maintainers or technical lead
3. Migration plan for existing code (if principles change)
4. Version bump (MAJOR for principle removals, MINOR for additions, PATCH for clarifications)
5. Update to dependent templates (plan-template.md, spec-template.md, tasks-template.md)

### Compliance Review
Constitutional compliance MUST be verified:
- During code reviews (reviewer responsibility)
- In implementation plan Phase 1 Constitution Check section
- Before production deployment (release checklist)

Complexity violations MUST be documented in plan.md Complexity Tracking table with justification.

### Living Document
This constitution supersedes all other development practices and guidelines. When conflicts arise between this document and other guidance, constitution takes precedence. For runtime development guidance specific to Claude Code, reference `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2025-10-06 | **Last Amended**: 2025-10-06
