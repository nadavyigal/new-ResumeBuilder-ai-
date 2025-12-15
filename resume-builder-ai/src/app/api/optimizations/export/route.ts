import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import JSZip from 'jszip';
import type { BulkExportRequest } from '@/types/history';
import { generateResumePDF } from '@/lib/pdf-generator';

/**
 * POST /api/optimizations/export
 * Feature: 005-history-view-previous (User Story 4 - T039)
 *
 * Bulk export optimizations as ZIP file with PDFs and manifest
 *
 * Request Body:
 * - ids: number[] (array of optimization IDs, max 20)
 * - includeManifest: boolean (optional, default: true)
 *
 * Response:
 * - ZIP file stream with PDFs and manifest.txt
 */
export async function POST(req: NextRequest) {
  // Initialize Supabase client with auth
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authentication check
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
  }

  try {
    // Parse and validate request body
    const body: BulkExportRequest = await req.json();

    if (!body.ids || !Array.isArray(body.ids)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: 'ids must be an array of numbers',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    // Validate array length
    if (body.ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No IDs provided',
          code: 'EMPTY_IDS',
        },
        { status: 400 }
      );
    }

    if (body.ids.length > 20) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many IDs',
          details: 'Maximum 20 IDs allowed per request',
          code: 'TOO_MANY_IDS',
        },
        { status: 400 }
      );
    }

    // Validate all IDs are numbers
    if (!body.ids.every((id) => typeof id === 'number' && id > 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid ID format',
          details: 'All IDs must be positive numbers',
          code: 'INVALID_IDS',
        },
        { status: 400 }
      );
    }

    // Fetch optimization details with job descriptions
    const { data: optimizations, error: fetchError} = await supabase
      .from('optimizations')
      .select(`
        id,
        created_at,
        match_score,
        status,
        template_key,
        optimization_data,
        job_descriptions!jd_id (
          id,
          title,
          company
        )
      `)
      .in('id', body.ids)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching optimizations:', fetchError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch optimizations',
          details: fetchError.message,
          code: 'FETCH_FAILED',
        },
        { status: 500 }
      );
    }

    if (!optimizations || optimizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No optimizations found',
          details: 'None of the requested optimizations were found or belong to you',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Create ZIP file
    const zip = new JSZip();
    const manifest: string[] = [];
    const failed: Array<{ id: number; error: string }> = [];

    // Add each optimization to ZIP
    for (const opt of optimizations) {
      try {
        const jd = opt.job_descriptions as { id?: string; title?: string; company?: string } | null;
        const jobTitle = jd?.title || 'Unknown Position';
        const company = jd?.company || 'Unknown Company';
        const date = new Date(opt.created_at).toISOString().split('T')[0];
        const score = Math.round(opt.match_score * 100);

        // Generate filename
        const filename = `optimization-${opt.id}-${company}-${jobTitle}-${score}pct-${date}.pdf`
          .replace(/[^a-z0-9.-]/gi, '_')
          .replace(/_+/g, '_')
          .substring(0, 200); // Limit filename length

        // Check if optimization_data exists (resume JSON data)
        if (opt.optimization_data) {
          try {
            // Generate PDF from optimization_data
            const pdfBuffer = await generateResumePDF(
              opt.optimization_data,
              opt.template_key || 'default'
            );

            // Add PDF to ZIP
            zip.file(filename, pdfBuffer, { binary: true });

            manifest.push(`✅ ${filename}`);
            manifest.push(`   ID: ${opt.id}`);
            manifest.push(`   Company: ${company}`);
            manifest.push(`   Position: ${jobTitle}`);
            manifest.push(`   ATS Match: ${score}%`);
            manifest.push(`   Created: ${date}`);
            manifest.push('');
          } catch (pdfError) {
            console.error(`Error generating PDF for optimization ${opt.id}:`, pdfError);

            // Fallback: Export JSON if PDF generation fails
            const jsonContent = JSON.stringify(opt.optimization_data, null, 2);
            const jsonFilename = filename.replace('.pdf', '.json');
            zip.file(jsonFilename, jsonContent);

            failed.push({
              id: opt.id,
              error: 'PDF generation failed, exported as JSON',
            });

            manifest.push(`⚠️  ${jsonFilename} (PDF generation failed)`);
            manifest.push(`   ID: ${opt.id}`);
            manifest.push(`   Company: ${company}`);
            manifest.push(`   Position: ${jobTitle}`);
            manifest.push(`   Error: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
            manifest.push('');
          }
        } else {
          // Resume data not available
          failed.push({
            id: opt.id,
            error: 'Resume data not available',
          });

          manifest.push(`❌ ${filename} - Resume data not available`);
          manifest.push(`   ID: ${opt.id}`);
          manifest.push(`   Company: ${company}`);
          manifest.push(`   Position: ${jobTitle}`);
          manifest.push('');
        }
      } catch (err) {
        console.error(`Error processing optimization ${opt.id}:`, err);
        failed.push({
          id: opt.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Add manifest file if requested
    const includeManifest = body.includeManifest !== false;
    if (includeManifest) {
      const manifestHeader = [
        'Resume Optimization Export',
        `Generated: ${new Date().toLocaleString()}`,
        `Total Items: ${optimizations.length}`,
        `Successful: ${optimizations.length - failed.length}`,
        `Failed: ${failed.length}`,
        '',
        '═══════════════════════════════════════════════════',
        '',
      ];

      const manifestFooter = [
        '',
        '═══════════════════════════════════════════════════',
        '',
        'Failed Items:',
      ];

      if (failed.length > 0) {
        failed.forEach((f) => {
          manifestFooter.push(`  ID ${f.id}: ${f.error}`);
        });
      } else {
        manifestFooter.push('  None');
      }

      const fullManifest = [
        ...manifestHeader,
        ...manifest,
        ...manifestFooter,
      ].join('\n');

      zip.file('manifest.txt', fullManifest);
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Generate filename for ZIP
    const timestamp = new Date().toISOString().split('T')[0];
    const zipFilename = `resume-optimizations-${timestamp}.zip`;

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: unknown) {
    console.error('Error in POST /api/optimizations/export:', error);
    const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process bulk export',
        details: errorMessage,
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
