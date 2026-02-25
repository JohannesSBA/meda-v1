import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl  shadow-[0_18px_45px_rgba(0,0,0,0.28)]",
        className,
      )}
      {...props}
    />
  );
}
