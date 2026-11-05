import { useId } from "react";
import { X } from "lucide-react";

/* Floating-label field — same look as the Register form (styles live in RegisterPage.css) */
export default function AuthField({ icon: Icon, label, error, hint, right, wide, ...props }) {
  const id = useId();
  return (
    <div className={`rg-field${wide ? " wide" : ""}${error ? " bad" : ""}`}>
      <div className="rg-box">
        {Icon && <Icon size={17} className="rg-ico" />}
        <input id={id} placeholder=" " aria-invalid={!!error} {...props} />
        <label htmlFor={id}>{label}</label>
        {right}
      </div>
      {error ? <small className="rg-err"><X size={12} /> {error}</small> : hint ? <small className="rg-hint">{hint}</small> : null}
    </div>
  );
}
