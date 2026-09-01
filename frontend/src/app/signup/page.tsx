"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { failureText, signUp } from "@/lib/api";

const SignUpPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegistering(true);
    setError(null);
    try {
      // Registering signs you in, so there is no second step to get wrong.
      await signUp(email, displayName, password);
      router.replace("/");
    } catch (cause) {
      setError(failureText(cause));
      setRegistering(false);
    }
  };

  return (
    <main className="login">
      <form className="form login-card" onSubmit={handleSubmit}>
        <p className="wordmark">Prelegal</p>
        <h1>Create an account</h1>
        <p className="hint">Draft legal agreements from standard templates.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoFocus
          required
        />

        <label htmlFor="display-name">Your name</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="hint">At least eight characters.</p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="submit" disabled={registering}>
          {registering ? "Creating your account" : "Create account"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link href="/login/">Sign in</Link>
        </p>
      </form>
    </main>
  );
};

export default SignUpPage;
