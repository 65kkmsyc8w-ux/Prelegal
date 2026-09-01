"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ApiError, me, signOut, type ApiUser } from "@/lib/api";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Holds the platform behind a session. There is no password yet: signing in
 * only carries a display name, so this decides whether the caller has been
 * through the login screen, not who they have proved themselves to be.
 */
export const AuthGate = ({ children }: AuthGateProps) => {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    me()
      .then(setUser)
      .catch((cause) => {
        // 401 is the ordinary signed-out case. Anything else means the request
        // never got an answer, and sending the user to a login screen that
        // cannot reach the server either would just bounce them back.
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace("/login/");
          return;
        }
        setUnreachable(true);
      });
  }, [router]);

  if (unreachable) {
    return (
      <main className="notice">
        <p role="alert">Could not reach the server. Reload to try again.</p>
      </main>
    );
  }

  if (user === null) {
    return (
      <main className="notice">
        <p>Loading</p>
      </main>
    );
  }

  const endSession = async () => {
    await signOut();
    router.replace("/login/");
  };

  return (
    <>
      <div className="session-bar">
        <span>Signed in as {user.display_name}</span>
        <button type="button" onClick={endSession}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
};
