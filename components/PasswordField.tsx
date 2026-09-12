"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  minLength,
  required = true,
  className = "auth-field",
}: {
  name: string;
  label: string;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <label className={className}>
      <span>{label}</span>
      <span className="auth-password">
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="auth-eye"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
