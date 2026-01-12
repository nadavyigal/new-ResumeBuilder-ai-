import { SupabaseClient } from "@supabase/supabase-js";
import type { DesignCustomizationLike } from "./design-manager/render-preview-html";
import { getDesignAssignment } from "./supabase/resume-designs";
import { getDesignTemplateById } from "./supabase/design-templates";

export interface PdfDesignContext {
  templateSlug: string;
  customization: DesignCustomizationLike | null;
  usedDesignAssignment: boolean;
}

export async function resolvePdfDesignContext(
  supabase: SupabaseClient,
  optimizationId: string,
  userId: string,
  defaultTemplateSlug = "minimal-ssr"
): Promise<PdfDesignContext> {
  const assignment = await getDesignAssignment(supabase, optimizationId, userId);
  let templateSlug = defaultTemplateSlug;
  let customization: DesignCustomizationLike | null = null;
  let usedDesignAssignment = false;

  if (assignment) {
    usedDesignAssignment = true;
    const template = await getDesignTemplateById(supabase, assignment.template_id);
    templateSlug = template?.slug || defaultTemplateSlug;

    if (assignment.customization_id) {
      const { data: customizationData, error: customizationError } = await supabase
        .from("design_customizations")
        .select("*")
        .eq("id", assignment.customization_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (customizationError) {
        console.warn("[PDF] Failed to load design customization:", customizationError);
      } else {
        customization = customizationData as DesignCustomizationLike;
      }
    }
  }

  return {
    templateSlug,
    customization,
    usedDesignAssignment,
  };
}
