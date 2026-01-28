"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface Template {
  id: number;
  name: string;
  family: string;
}

export function TemplateSelector() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  useEffect(() => {
    const fetchTemplates = async () => {
      // Mock data for now
      const mockTemplates: Template[] = [
        { id: 1, name: "ATS-Safe", family: "ats" },
        { id: 2, name: "Modern", family: "modern" },
      ];
      setTemplates(mockTemplates);
    };

    fetchTemplates();
  }, []);

  return (
    <div>
      <h3 className="text-lg font-medium">Select a Template</h3>
      <div className="grid grid-cols-2 gap-4 mt-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer ${selectedTemplate === template.id ? "border-primary" : ""}`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <CardContent className="p-4">
              <h4 className="font-medium">{template.name}</h4>
              <p className="text-sm text-muted-foreground">{template.family}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
