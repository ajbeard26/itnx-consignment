"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { login, type AuthState } from "@/app/login/actions";
import PasswordField from "@/components/PasswordField";

export default function LoginForm({
  nextPath = "/dashboard",
}: {
  nextPath?: string;
}) {
  const [state, action, pending] = useActionState(login, {} as AuthState);
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={nextPath} />
      <label className="auth-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@itnx.tech"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
      />
      {state.error ? <p className="auth-error">{state.error}</p> : null}
      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
