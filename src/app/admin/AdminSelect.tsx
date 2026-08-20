import type { ReactNode, SelectHTMLAttributes } from "react";

type AdminSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export default function AdminSelect({ children, className = "", ...props }: AdminSelectProps) {
  return (
    <span className="admin-select-wrap">
      <select className={`admin-input admin-select ${className}`.trim()} {...props}>
        {children}
      </select>
      <span className="admin-select-caret" aria-hidden="true">⌄</span>
    </span>
  );
}
