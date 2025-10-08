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
  category: 'minimal' | 'professional' | 'creative' | 'modern';
  is_premium: boolean;
  thumbnail_url: string | null;
  preview_image_url: string | null;
  ats_score: number;
  supports_custom_colors: boolean;
  supports_custom_fonts: boolean;
}

interface TemplateCardProps {
  template: DesignTemplate;
  isSelected: boolean;
  onSelect: () => void;
  optimizationId: string;
}

export function TemplateCard({
  template,
  isSelected,
  onSelect,
  optimizationId
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
      case 'minimal':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'professional':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'creative':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'modern':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <>
      <div
        className={`relative group cursor-pointer rounded-lg border-2 transition-all duration-200 overflow-hidden ${
          isSelected
            ? 'border-blue-600 shadow-lg ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-900'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onSelect}
      >
        {/* Thumbnail/Preview */}
        <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 overflow-hidden">
          {template.thumbnail_url || template.preview_image_url ? (
            <img
              src={template.thumbnail_url || template.preview_image_url || ''}
              alt={`${template.name} preview`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
              <div className="text-center p-4">
                <div className="text-4xl mb-2">📄</div>
                <p className="text-sm">Preview unavailable</p>
              </div>
            </div>
          )}

          {/* Hover Overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">
              <button
                onClick={handlePreview}
                className="px-4 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Full Preview
              </button>
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
                template.ats_score >= 95
                  ? 'text-green-600 dark:text-green-400'
                  : template.ats_score >= 90
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {template.ats_score}
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
            {template.supports_custom_colors && (
              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                Custom Colors
              </span>
            )}
            {template.supports_custom_fonts && (
              <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs rounded">
                Custom Fonts
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
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {template.name} - Full Preview
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                ×
              </button>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Apply This Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
