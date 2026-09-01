"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError, createSession } from "@/lib/api";

const LoginPage = () => {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSigningIn(true);
    setError(null);
    try {
      await createSession(displayName);
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not reach the server. Try again.",
      );
      setSigningIn(false);
    }
  };

  return (
    <main className="login">
      <form className="form login-card" onSubmit={handleSubmit}>
        <h1>Prelegal</h1>
        <p className="hint">Draft legal agreements from standard templates.</p>

        <label htmlFor="display-name">Your name</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
          autoFocus
          required
        />
        <p className="hint">No password yet. Your name is how work is kept apart.</p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="submit" disabled={signingIn}>
          {signingIn ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
};

export default LoginPage;
