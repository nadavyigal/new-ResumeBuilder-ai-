"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface ContextualSignupPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrimaryAction: () => void;
}

export function ContextualSignupPopup({
  open,
  onOpenChange,
  onPrimaryAction
}: ContextualSignupPopupProps) {
  const t = useTranslations("landing.popup");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          <Button
            className="w-full bg-[hsl(216_65%_33%)] hover:bg-[hsl(216_65%_27%)] text-white"
            onClick={onPrimaryAction}
          >
            {t("primaryCta")}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("secondaryCta")}
          </Button>
          <p className="text-xs text-foreground/60 text-center">{t("privacyNote")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
