/**
 * POST /api/v1/styles/validate
 * Phase 4, Task T030
 *
 * Validate color combinations for WCAG compliance and font professionalism
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateWCAG, type WCAGValidationResult } from '@/lib/agent/accessibilityValidator';
import { normalizeFont, isProfessional, isATSSafe, getFontCategory } from '@/lib/agent/fontValidator';

export const runtime = 'edge';

interface ValidationRequest {
  colors?: {
    foreground: string;
    background: string;
    textSize?: 'normal' | 'large';
  };
  font?: string;
}

interface ColorValidationResult {
  valid: boolean;
  wcagAA: WCAGValidationResult;
  wcagAAA: WCAGValidationResult;
  warnings: string[];
  recommendations: string[];
}

interface FontValidationResult {
  valid: boolean;
  normalizedName: string | null;
  isProfessional: boolean;
  isATSSafe: boolean;
  category: 'serif' | 'sans-serif' | 'monospace' | null;
  warnings: string[];
  recommendations: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidationRequest;

    const response: {
      colors?: ColorValidationResult;
      font?: FontValidationResult;
    } = {};

    // Validate colors if provided
    if (body.colors) {
      const { foreground, background, textSize = 'normal' } = body.colors;

      if (!foreground || !background) {
        return NextResponse.json(
          { error: 'Both foreground and background colors are required' },
          { status: 400 }
        );
      }

      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Validate WCAG AA and AAA
      const wcagAA = validateWCAG(foreground, background, 'AA', textSize);
      const wcagAAA = validateWCAG(foreground, background, 'AAA', textSize);

      // Generate warnings
      if (!wcagAA.passes) {
        const minRatio = textSize === 'normal' ? '4.5:1' : '3:1';
        warnings.push(
          `Color combination fails WCAG AA standards (${wcagAA.ratio.toFixed(2)}:1, needs ${minRatio})`
        );
        recommendations.push(
          'Use a darker foreground color or lighter background for better contrast'
        );
      } else if (!wcagAAA.passes) {
        const minRatio = textSize === 'normal' ? '7:1' : '4.5:1';
        warnings.push(
          `Color combination meets AA but not AAA standards (${wcagAA.ratio.toFixed(2)}:1, AAA needs ${minRatio})`
        );
        recommendations.push(
          'For maximum accessibility, consider increasing contrast to meet AAA standards'
        );
      }

      response.colors = {
        valid: wcagAA.passes,
        wcagAA,
        wcagAAA,
        warnings,
        recommendations,
      };
    }

    // Validate font if provided
    if (body.font) {
      const warnings: string[] = [];
      const recommendations: string[] = [];

      const normalizedName = normalizeFont(body.font);
      const professional = isProfessional(body.font);
      const atsSafe = isATSSafe(body.font);
      const category = getFontCategory(body.font);

      if (!normalizedName) {
        warnings.push(`Font "${body.font}" is not recognized`);
        recommendations.push(
          'Use a standard professional font like Arial, Calibri, or Times New Roman'
        );
      } else {
        if (!professional) {
          warnings.push(`Font "${normalizedName}" is not recommended for professional resumes`);
          recommendations.push(
            'Consider using a professional serif (Times New Roman, Georgia) or sans-serif (Arial, Calibri) font'
          );
        }

        if (!atsSafe) {
          warnings.push(`Font "${normalizedName}" may not be ATS-friendly`);
          recommendations.push('Use an ATS-safe font for better parsing by applicant tracking systems');
        }
      }

      response.font = {
        valid: normalizedName !== null && professional,
        normalizedName,
        isProfessional: professional,
        isATSSafe: atsSafe,
        category,
        warnings,
        recommendations,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in style validation endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
