import { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
  return (
    <section className={`card${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </section>
  );
}
