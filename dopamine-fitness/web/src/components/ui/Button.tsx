import { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button(
  props: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>
) {
  return <button {...props} className={`btn ${props.className ?? ""}`.trim()} />;
}
