/**
 * DesignBrowser Component
 * Template browser modal for selecting resume designs
 *
 * Reference: specs/003-i-want-to/quickstart.md Step 2
 * Task: T034
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { TemplateCard } from './TemplateCard';

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

interface DesignBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplateId?: string | null;
  optimizationId: string;
  onTemplateSelect: (templateId: string) => void;
}

export function DesignBrowser({
  isOpen,
  onClose,
  currentTemplateId,
  optimizationId,
  onTemplateSelect
}: DesignBrowserProps) {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['traditional', 'modern', 'corporate', 'creative'];

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, selectedCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/v1/design/templates', window.location.origin);
      if (selectedCategory) {
        url.searchParams.set('category', selectedCategory);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      console.log('🎨 Design Browser - Response data:', data);
      console.log('🎨 Design Browser - Templates count:', data.templates?.length || 0);
      console.log('🎨 Design Browser - First template:', data.templates?.[0]);
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (category: string | null) => {
    setSelectedCategory(category);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Choose a Design
            </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select a template to customize your resume&rsquo;s appearance
              </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <button
            onClick={() => handleCategoryFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All Templates
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryFilter(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
              <p className="font-medium">Error loading templates</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={fetchTemplates}
                className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && templates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                No templates found
                {selectedCategory && ` in "${selectedCategory}" category`}
              </p>
            </div>
          )}

          {!loading && !error && templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={template.id === currentTemplateId}
                  onSelect={() => onTemplateSelect(template.id)}
                  optimizationId={optimizationId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {templates.length} template{templates.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
