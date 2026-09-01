"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DISCLAIMER } from "@/lib/disclaimer";
import type { ApiUser } from "@/lib/api";

interface AppHeaderProps {
  user: ApiUser;
  onSignOut: () => void;
}

const NAV = [
  { href: "/", label: "New document" },
  { href: "/drafts/", label: "My drafts" },
];

/** The export writes every route as a directory, so a link is "/drafts/" while
 * the path may read either way. Comparing them without the trailing slash is
 * what makes the current screen mark itself. */
const samePath = (one: string, other: string) =>
  one.replace(/\/$/, "") === other.replace(/\/$/, "");

export const AppHeader = ({ user, onSignOut }: AppHeaderProps) => {
  const pathname = usePathname();

  return (
    <>
      <header className="app-bar">
        <Link className="wordmark" href="/">
          Prelegal
        </Link>

        <nav aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={samePath(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="app-bar-session">
          <span>Signed in as {user.display_name}</span>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <p className="disclaimer-banner" role="note">
        {DISCLAIMER}
      </p>
    </>
  );
};
