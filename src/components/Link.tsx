import type { ReactNode } from "react";
import { navigate } from "../router";

type LinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
  current?: boolean;
};

export function Link({ to, children, className, current }: LinkProps) {
  return (
    <a
      href={to}
      className={className}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
