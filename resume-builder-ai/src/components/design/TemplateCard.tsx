/**
 * TemplateCard Component
 * Individual template preview card in the design browser
 *
 * Reference: specs/003-i-want-to/quickstart.md Step 2
 * Task: T035
 */

'use client';

import React, { useState } from 'react';
import { Check, Eye, Sparkles } from 'lucide-react';

interface DesignTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'traditional' | 'modern' | 'corporate' | 'creative';
  is_premium: boolean;
  file_path: string;
  preview_thumbnail_url: string | null;
  ats_compatibility_score: number;
  supported_customizations: {
    fonts: boolean;
    colors: boolean;
    layout: boolean;
  };
  default_config: {
    font_family: {
      heading: string;
      body: string;
    };
    color_scheme: {
      primary: string;
      secondary: string;
      accent: string;
    };
    spacing_settings: {
      compact: boolean;
      lineHeight: number;
    };
  };
  created_at: string;
  updated_at: string;
}

interface TemplateCardProps {
  template: DesignTemplate;
  isSelected: boolean;
  onSelect: () => void;
  optimizationId: string;
  isApplying?: boolean;
  isApplyingThis?: boolean;
}

export function TemplateCard({
  template,
  isSelected,
  onSelect,
  optimizationId,
  isApplying = false,
  isApplyingThis = false
}: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'traditional':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'corporate':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'creative':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'modern':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Open preview modal when card is clicked
  const handleCardClick = () => {
    if (isApplying) return;
    setShowPreview(true);
  };

  return (
    <>
      <div
        className={`relative group cursor-pointer rounded-lg border-2 transition-all duration-200 overflow-hidden hover:scale-[1.02] ${
          isSelected
            ? 'border-blue-600 shadow-lg ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-900'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-xl'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
      >
        {/* Thumbnail/Preview */}
        <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 overflow-hidden">
          {template.preview_thumbnail_url ? (
            <img
              src={template.preview_thumbnail_url}
              alt={`${template.name} preview`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
              <iframe
                src={`/api/v1/design/templates/${template.id}/preview`}
                className="border-none pointer-events-none w-[200%] h-[200%]"
                title={`${template.name} preview`}
                loading="lazy"
                style={{
                  transform: "scale(0.5)",
                  transformOrigin: "center center",
                }}
              />
            </div>
          )}

          {/* Hover Overlay with Visual Feedback */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity pointer-events-none">
              <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-6 py-3 rounded-lg text-gray-900 dark:text-white font-medium flex items-center gap-2 shadow-lg">
                <Eye className="w-5 h-5" />
                Click to Preview
              </div>
            </div>
          )}

          {/* Selected Badge */}
          {isSelected && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
              <Check className="w-3 h-3" />
              Currently Selected
            </div>
          )}

          {/* Premium Badge */}
          {template.is_premium && (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
              <Sparkles className="w-3 h-3" />
              Premium
            </div>
          )}

          {/* ATS Score */}
          <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
            <span className="text-gray-600 dark:text-gray-400">ATS Score: </span>
            <span
              className={`font-bold ${
                template.ats_compatibility_score >= 95
                  ? 'text-green-600 dark:text-green-400'
                  : template.ats_compatibility_score >= 90
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {template.ats_compatibility_score}
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
              {template.name}
            </h3>
            <span
              className={`px-2 py-1 rounded text-xs font-medium capitalize whitespace-nowrap ${getCategoryColor(
                template.category
              )}`}
            >
              {template.category}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {template.description}
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-2">
            {template.supported_customizations.colors && (
              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                Custom Colors
              </span>
            )}
            {template.supported_customizations.fonts && (
              <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs rounded">
                Custom Fonts
              </span>
            )}
            {template.supported_customizations.layout && (
              <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs rounded">
                Custom Layout
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Template</p>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {template.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onSelect();
                    setShowPreview(false);
                  }}
                  disabled={isApplying}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {isApplyingThis ? 'Applying...' : 'Apply'}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  aria-label="Close preview"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="relative h-[calc(90vh-120px)] overflow-auto">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}
              <iframe
                src={`/api/v1/design/templates/${template.id}/preview`}
                className="w-full h-full border-none"
                title={`${template.name} Preview`}
                onLoad={() => setPreviewLoading(false)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onSelect();
                  setShowPreview(false);
                }}
                disabled={isApplying}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {isApplyingThis ? 'Applying...' : 'Apply This Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
