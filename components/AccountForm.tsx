"use client";

import { useActionState } from "react";
import { updateStaff, type AuthState } from "@/app/login/actions";

export default function AccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(updateStaff, {} as AuthState);

  return (
    <form action={action}>
      <div className="field">
        <label>Staff email</label>
        <input name="email" type="email" required defaultValue={email} autoComplete="username" />
      </div>
      <br />
      <div className="field">
        <label>Current password</label>
        <input name="current" type="password" required autoComplete="current-password" />
      </div>
      <br />
      <div className="field">
        <label>New password</label>
        <input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to keep the current password" />
      </div>
      <br />
      <div className="field">
        <label>Confirm new password</label>
        <input name="confirm" type="password" minLength={8} autoComplete="new-password" />
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? <p className="form-ok">{state.success}</p> : null}
      <br />
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save login"}
      </button>
    </form>
  );
}
