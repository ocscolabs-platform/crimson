import { ChevronDown } from "lucide-react";
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
      <ChevronDown className="admin-select-caret" aria-hidden="true" size={16} strokeWidth={1.8} />
    </span>
  );
}
