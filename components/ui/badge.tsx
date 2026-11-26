import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-[var(--primary-foreground)]",
        secondary:
          "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
        outline: "border-[var(--border)] text-[var(--text)]",
        success:
          "border-transparent bg-[color-mix(in_oklab,var(--success)_22%,transparent)] text-[var(--success)]",
        warning:
          "border-transparent bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--warning)]",
        destructive:
          "border-transparent bg-[color-mix(in_oklab,var(--error)_22%,transparent)] text-[var(--error)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
