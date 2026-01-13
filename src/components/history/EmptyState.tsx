import { Link } from "@/navigation";
import { Button } from '@/components/ui/button';
import { FileText } from '@/lib/icons';
import { useTranslations } from "next-intl";

/**
 * EmptyState Component
 * Feature: 005-history-view-previous (User Story 1)
 *
 * Displayed when the user has no optimization history.
 * Provides a helpful message and CTA button to create their first optimization.
 */
export default function EmptyState() {
  const t = useTranslations("dashboard.history.empty");

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon illustration */}
      <div className="mb-6 rounded-full bg-muted p-6">
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>

      {/* Message */}
      <h3 className="text-lg font-semibold mb-2">
        {t("title")}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {t("description")}
      </p>

      {/* CTA Button */}
      <Button asChild>
        <Link href="/dashboard/resume">
          {t("cta")}
        </Link>
      </Button>
    </div>
  );
}
