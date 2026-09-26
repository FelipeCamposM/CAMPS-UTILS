import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}

const TONE: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "text-text-secondary bg-overlay/10 border-border-subtle",
  success: "text-success bg-success/10 border-success/25",
  warning: "text-warning bg-warning/10 border-warning/25",
  danger: "text-danger bg-danger/10 border-danger/25",
  accent: "text-accent bg-accent/10 border-accent/25",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${TONE[tone]}`}>{children}</span>;
}
