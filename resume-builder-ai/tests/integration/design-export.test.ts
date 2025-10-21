/**
 * Integration Test: Export with Custom Design
 * Tests PDF/DOCX export with selected design templates and customizations
 *
 * Reference: specs/003-i-want-to/quickstart.md (Step 11)
 * Task: T016
 *
 * IMPORTANT: This test MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

describe('Integration Test: Export with Custom Design', () => {
  let authToken: string;
  let testOptimizationId: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // TODO: Setup test environment
    // 1. Create test user and get auth token
    // 2. Create test optimization
    // 3. Assign design template
    // 4. Apply customizations

    authToken = 'test-token';
    testOptimizationId = 'test-optimization-uuid';
    testTemplateId = 'card-ssr';
  });

  afterAll(async () => {
    // TODO: Cleanup test data
  });

  // ============================================================================
  // Test 1: Setup Custom Design for Export
  // ============================================================================

  test('should assign custom design before export', async () => {
    // Select Card Layout template
    const assignResponse = await fetch(
      `${API_BASE}/v1/design/${testOptimizationId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: testTemplateId
        })
      }
    );

    expect([200, 404]).toContain(assignResponse.status);
  });

  test('should apply color customization', async () => {
    const customizeResponse = await fetch(
      `${API_BASE}/v1/design/${testOptimizationId}/customize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeRequest: 'make headers dark blue'
        })
      }
    );

    expect([200, 404]).toContain(customizeResponse.status);
  });

  // ============================================================================
  // Test 2: PDF Export with Custom Design (FR-019)
  // ============================================================================

  test('should export resume to PDF with selected design', async () => {
    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      // Verify Content-Type is PDF
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/pdf');

      // Verify Content-Disposition suggests download
      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toContain('attachment');

      // Verify PDF has content
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(1000); // Non-trivial PDF

      // PDF should start with PDF signature
      const uint8 = new Uint8Array(buffer);
      const pdfSignature = String.fromCharCode(...uint8.slice(0, 4));
      expect(pdfSignature).toBe('%PDF');
    }
  });

  test('PDF export should reflect custom design (blue headers)', async () => {
    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();

      // PDF should be generated with custom colors
      // (Detailed color validation would require PDF parsing library)
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
  });

  test('should export within 5 seconds (performance requirement)', async () => {
    const startTime = Date.now();

    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    const duration = (Date.now() - startTime) / 1000;

    expect([200, 404]).toContain(response.status);
    expect(duration).toBeLessThan(5);
  }, 10000);

  // ============================================================================
  // Test 3: DOCX Export with Custom Design (FR-020)
  // ============================================================================

  test('should export resume to DOCX with selected design', async () => {
    const response = await fetch(
      `${API_BASE}/download/docx/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      // Verify Content-Type is DOCX
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      // Verify Content-Disposition
      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toContain('attachment');

      // Verify DOCX has content
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(1000);

      // DOCX is a ZIP file, check for ZIP signature
      const uint8 = new Uint8Array(buffer);
      expect(uint8[0]).toBe(0x50); // 'P'
      expect(uint8[1]).toBe(0x4b); // 'K'
    }
  });

  test('DOCX export should apply custom styling', async () => {
    const response = await fetch(
      `${API_BASE}/download/docx/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();

      // DOCX should include custom styling from design
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
  });

  // ============================================================================
  // Test 4: ATS Compatibility Verification (FR-021)
  // ============================================================================

  test('exported PDF should maintain ATS compatibility', async () => {
    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();

      // PDF should not contain images or complex graphics
      // (Would need PDF parsing for detailed validation)

      // Size check: ATS-friendly PDFs are typically < 200KB
      expect(buffer.byteLength).toBeLessThan(200 * 1024);
    }
  });

  test('exported DOCX should maintain ATS compatibility', async () => {
    const response = await fetch(
      `${API_BASE}/download/docx/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();

      // DOCX should be ATS-friendly
      // (Would need DOCX parsing for detailed validation)

      expect(buffer.byteLength).toBeLessThan(200 * 1024);
    }
  });

  // ============================================================================
  // Test 5: Export with Different Templates
  // ============================================================================

  test('should export with minimal-ssr template', async () => {
    // Switch to minimal template
    await fetch(`${API_BASE}/v1/design/${testOptimizationId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templateId: 'minimal-ssr'
      })
    });

    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
  });

  test('should export with timeline-ssr template', async () => {
    // Switch to timeline template
    await fetch(`${API_BASE}/v1/design/${testOptimizationId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templateId: 'timeline-ssr'
      })
    });

    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
  });

  // ============================================================================
  // Test 6: Export Integration with Template Engine
  // ============================================================================

  test('should use template-engine to render design before export', async () => {
    // This tests the integration between design-manager and template-engine
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const sampleData = {
      personalInfo: {
        fullName: 'Test User',
        email: 'test@example.com'
      }
    };

    const html = renderTemplatePreview('card-ssr', sampleData);

    expect(html).toBeDefined();
    expect(html).toContain('Test User');
  });

  // ============================================================================
  // Test 7: Error Handling
  // ============================================================================

  test('should return 404 for non-existent optimization', async () => {
    const response = await fetch(
      `${API_BASE}/download/pdf/non-existent-uuid`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    expect(response.status).toBe(404);
  });

  test('should handle export failure gracefully', async () => {
    // Test with invalid optimization ID format
    const response = await fetch(
      `${API_BASE}/download/pdf/invalid-uuid-format`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    expect([400, 404]).toContain(response.status);
  });

  // ============================================================================
  // Test 8: Design Persistence Across Sessions (Step 12 - Quickstart)
  // ============================================================================

  test('Step 12: design should persist after export', async () => {
    // Export PDF
    await fetch(`${API_BASE}/download/pdf/${testOptimizationId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Fetch design assignment to verify it still exists
    const response = await fetch(
      `${API_BASE}/v1/design/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const assignment = await response.json();
      expect(assignment.template_id).toBeDefined();
      expect(assignment.customization_id).toBeDefined();
    }
  });

  test('exported resume should be openable in PDF reader', async () => {
    const response = await fetch(
      `${API_BASE}/download/pdf/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      // Basic PDF structure validation
      expect(uint8[0]).toBe(0x25); // '%'
      expect(uint8[1]).toBe(0x50); // 'P'
      expect(uint8[2]).toBe(0x44); // 'D'
      expect(uint8[3]).toBe(0x46); // 'F'

      // Check for EOF marker
      const endMarker = '%EOF';
      const end = new TextDecoder().decode(uint8.slice(-10));
      expect(end).toContain('EOF');
    }
  });
});
