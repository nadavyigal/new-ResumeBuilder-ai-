import { beforeEach, describe, expect, it, jest } from '@jest/globals';

function mockNextServer() {
  jest.doMock('next/server', () => ({
    __esModule: true,
    NextResponse: class {
      status: number;
      private body: unknown;

      constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
      }

      static json(body: unknown, init?: { status?: number }) {
        return new this(body, init);
      }

      async json() {
        return this.body;
      }

      async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      }
    },
  }));
}

function optimizationDetailSupabase(options: { appliedRunsError?: { message: string } | null } = {}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from(table: string) {
      if (table === 'optimizations') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: {
                          rewrite_data: {
                            summary: 'Builds reliable iOS apps.',
                            contact: {
                              name: 'Ada Lovelace',
                              email: 'ada@example.com',
                              phone: '+1 555 123 4567',
                              location: 'London',
                              linkedin: 'linkedin.com/in/ada',
                            },
                            skills: { technical: ['Swift'], soft: [] },
                            experience: [],
                            education: [],
                            certifications: [],
                          },
                          ats_score_original: 61,
                          ats_score_optimized: 82,
                          jd_id: 'jd-1',
                        },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'job_descriptions') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { title: 'iOS Engineer', company: 'Analytical Engines' },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === 'expert_workflow_runs') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      not() {
                        return {
                          limit: async () => ({
                            data: options.appliedRunsError ? null : [{ id: 'run-applied' }],
                            error: options.appliedRunsError ?? null,
                          }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function optimizationPatchSupabase() {
  const optimizationUpdates: Array<Record<string, unknown>> = [];
  const versionInserts: Array<Record<string, unknown>> = [];

  return {
    optimizationUpdates,
    versionInserts,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from(table: string) {
      if (table === 'optimizations') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: {
                          resume_id: 'resume-1',
                          jd_id: 'jd-1',
                          ats_score_original: 43,
                          ats_subscores_original: null,
                          jd_text: 'Build reliable iOS apps',
                        },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            optimizationUpdates.push(payload);
            return {
              eq() {
                return {
                  eq: async () => ({ data: null, error: null }),
                };
              },
            };
          },
        };
      }

      if (table === 'job_descriptions') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { raw_text: 'Build reliable iOS apps', clean_text: null, parsed_data: null },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === 'resumes') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { raw_text: 'Original resume' }, error: null }),
                };
              },
            };
          },
        };
      }

      if (table === 'resume_versions') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          maybeSingle: async () => ({ data: { version_number: 2 }, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            versionInserts.push(payload);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function jsonRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as any;
}

describe('iOS optimization/design contracts', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns contact data from optimization detail', async () => {
    mockNextServer();
    const createRouteHandlerClient = jest.fn().mockResolvedValue(optimizationDetailSupabase());
    jest.doMock('@/lib/supabase-server', () => ({
      __esModule: true,
      createRouteHandlerClient,
    }));

    const { GET } = require('@/app/api/v1/optimizations/[id]/route');
    const response = await GET({} as any, {
      params: Promise.resolve({ id: 'opt-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.contact).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+1 555 123 4567',
      location: 'London',
      linkedin: 'linkedin.com/in/ada',
    });
    expect(payload.sections[0]).toMatchObject({
      type: 'summary',
      content: 'Builds reliable iOS apps.',
    });
    expect(payload.job_title).toBe('iOS Engineer');
    expect(payload.ats_score_after).toBe(82);
    expect(payload.ats_improvement_applied).toBe(true);
  });

  it('fails closed when ATS improvement completion state cannot be read', async () => {
    mockNextServer();
    const createRouteHandlerClient = jest.fn().mockResolvedValue(
      optimizationDetailSupabase({ appliedRunsError: { message: 'temporary read failure' } })
    );
    jest.doMock('@/lib/supabase-server', () => ({
      __esModule: true,
      createRouteHandlerClient,
    }));

    const { GET } = require('@/app/api/v1/optimizations/[id]/route');
    const response = await GET({} as any, {
      params: Promise.resolve({ id: 'opt-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ats_improvement_applied).toBe(true);
  });

  it('normalizes responsibilities before PATCH scoring and persistence', async () => {
    mockNextServer();
    const supabase = optimizationPatchSupabase();
    const createRouteHandlerClient = jest.fn().mockResolvedValue(supabase);
    const scoreOptimization = jest.fn().mockResolvedValue({
      ats_score_original: 43,
      ats_score_optimized: 64,
    });
    jest.doMock('@/lib/supabase-server', () => ({
      __esModule: true,
      createRouteHandlerClient,
    }));
    jest.doMock('@/lib/ats/integration', () => ({
      __esModule: true,
      scoreOptimization,
    }));

    const rewriteData = {
      summary: 'Product leader',
      contact: {},
      skills: { technical: [], soft: [] },
      experience: [{
        title: 'Head of Product',
        company: 'Acme',
        achievements: [],
        responsibilities: ['Led discovery', 'Shipped the new funnel'],
      }],
      education: [],
      certifications: [],
    };
    const { PATCH } = require('@/app/api/v1/optimizations/[id]/route');
    const response = await PATCH(jsonRequest({ rewrite_data: rewriteData }), {
      params: Promise.resolve({ id: 'opt-1' }),
    });

    expect(response.status).toBe(200);
    const normalized = expect.objectContaining({
      experience: [expect.objectContaining({
        achievements: ['Led discovery', 'Shipped the new funnel'],
      })],
    });
    expect(scoreOptimization).toHaveBeenCalledWith(
      expect.objectContaining({ resumeOptimizedJson: normalized })
    );
    expect(supabase.optimizationUpdates[0]).toEqual(
      expect.objectContaining({ rewrite_data: normalized })
    );
    expect(supabase.versionInserts[0]).toEqual(
      expect.objectContaining({ content: normalized })
    );
  });

  it('renders UUID-backed templates differently and honors iOS customization keys', async () => {
    mockNextServer();
    const createRouteHandlerClient = jest.fn().mockResolvedValue({});
    const getDesignTemplateById = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'template-modern',
        slug: 'modern-pro',
        category: 'modern',
        default_config: {
          color_scheme: { primary: '#1D4ED8', secondary: '#475569', accent: '#22C55E' },
          font_family: { heading: 'Inter', body: 'Inter' },
          spacing_settings: { lineHeight: 1.5 },
        },
      })
      .mockResolvedValueOnce({
        id: 'template-creative',
        slug: 'portfolio',
        category: 'creative',
        default_config: {
          color_scheme: { primary: '#7C3AED', secondary: '#475569', accent: '#F59E0B' },
          font_family: { heading: 'Inter', body: 'Inter' },
          spacing_settings: { lineHeight: 1.5 },
        },
      });

    jest.doMock('@/lib/supabase-server', () => ({
      __esModule: true,
      createRouteHandlerClient,
    }));
    jest.doMock('@/lib/supabase/design-templates', () => ({
      __esModule: true,
      getDesignTemplateById,
      getDesignTemplateBySlug: jest.fn().mockResolvedValue(null),
    }));

    const { POST } = require('@/app/api/v1/design/render-preview/route');
    const resumeData = {
      contact: { name: 'Ada Lovelace', email: 'ada@example.com', phone: '', location: 'London' },
      summary: 'Builds reliable iOS apps.',
      skills: { technical: ['Swift'], soft: [] },
      experience: [],
      education: [],
    };

    const modernResponse = await POST(
      jsonRequest({
          templateId: 'template-modern',
          resumeData,
          customization: { accent_color: '22D3EE', font_style: 'minimal', spacing: 0.8 },
      })
    );
    const creativeResponse = await POST(
      jsonRequest({ templateId: 'template-creative', resumeData })
    );

    const modernHtml = await modernResponse.text();
    const creativeHtml = await creativeResponse.text();

    expect(modernResponse.status).toBe(200);
    expect(creativeResponse.status).toBe(200);
    expect(modernHtml).toContain('Ada Lovelace');
    expect(modernHtml).toContain('#22D3EE');
    expect(modernHtml).toContain('System UI');
    expect(creativeHtml).toContain('creative-header');
    expect(modernHtml).not.toEqual(creativeHtml);
  });
});
