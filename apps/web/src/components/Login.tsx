import { useState, type FormEvent } from "react";
import { ApiError, api, clearKey, setKey } from "../api";
import { Logo } from "./shell/Sidebar";

export function Login() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key || busy) return;
    setBusy(true);
    setError("");
    setKey(key);
    try {
      await api.me();
      window.location.reload();
    } catch (err) {
      clearKey();
      setError(err instanceof ApiError && err.status === 401 ? "That key was not accepted" : err instanceof Error ? err.message : "Could not reach the Mesh server");
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <form className="login-card" onSubmit={submit} aria-label="Sign in">
        <Logo />
        <h1>Welcome to Mesh</h1>
        <p className="muted">Enter the access key your team gave you</p>
        <input
          type="password"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Access key"
          aria-label="Access key"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
        />
        {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>{busy ? "Checking…" : "Continue"}</button>
      </form>
    </div>
  );
}
