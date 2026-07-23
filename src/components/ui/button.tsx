import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-teal-800 text-white hover:bg-teal-900",
          variant === "secondary" &&
            "bg-stone-200 text-stone-900 hover:bg-stone-300",
          variant === "ghost" && "hover:bg-stone-100 text-stone-700",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
          size === "sm" && "h-8 min-h-8 px-3 text-sm",
          size === "md" && "h-10 min-h-11 px-4 text-sm md:min-h-10",
          size === "lg" && "h-11 min-h-11 px-6",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
