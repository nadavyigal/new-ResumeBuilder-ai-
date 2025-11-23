"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, ArrowLeft } from "lucide-react";
import { TemplateCard } from "@/components/design/TemplateCard";

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

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['traditional', 'modern', 'corporate', 'creative'];

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory]);

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

  const handleTemplateSelect = (templateId: string) => {
    // Store selected template in session storage and redirect to dashboard
    // User can then create a new optimization with this template pre-selected
    sessionStorage.setItem('selectedTemplateId', templateId);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Resume Templates
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Browse and select from our collection of professional resume templates
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-red-800 dark:text-red-200">
            <p className="font-medium text-lg">Error loading templates</p>
            <p className="text-sm mt-2">{error}</p>
            <button
              onClick={fetchTemplates}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && templates.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No templates found
              {selectedCategory && ` in "${selectedCategory}" category`}
            </p>
          </div>
        )}

        {!loading && !error && templates.length > 0 && (
          <>
            <div className="mb-6 text-gray-600 dark:text-gray-400">
              {templates.length} template{templates.length !== 1 ? 's' : ''} available
              {selectedCategory && ` in "${selectedCategory}" category`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={false}
                  onSelect={() => handleTemplateSelect(template.id)}
                  optimizationId="" // No optimization ID needed for browse mode
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
