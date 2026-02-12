import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "bg-color": [
        "bg-mobile-cta",
        "bg-mobile-cta-hover",
        "bg-mobile-primary",
        "bg-mobile-primary-hover",
      ],
      "border-color": [
        "border-mobile-cta",
        "border-mobile-cta-hover",
        "border-mobile-primary",
      ],
      "text-color": [
        "text-mobile-cta",
        "text-mobile-cta-hover",
        "text-mobile-primary",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}