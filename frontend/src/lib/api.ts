import type { DocumentSpec, Fields } from "@/lib/documents";

export interface ApiUser {
  id: number;
  email: string;
  display_name: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** What to show the reader when a call fails: the server's own reason where
 * there is one, and otherwise the only thing that can be said about a request
 * that never got an answer. */
export const failureText = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Could not reach the server. Try again.";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => body.detail)
      .catch(() => null);
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : `Request failed (${response.status})`,
    );
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const signUp = (email: string, displayName: string, password: string) =>
  request<ApiUser>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, display_name: displayName, password }),
  });

export const signIn = (email: string, password: string) =>
  request<ApiUser>("/auth/session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const signOut = () => request<void>("/auth/signout", { method: "POST" });

export const me = () => request<ApiUser>("/auth/me");

export interface ChatEntry {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  /** The agreement settled on, or null while the assistant is still working
   * out what is wanted. */
  document: string | null;
  documentSpec: DocumentSpec | null;
  fields: Fields;
  /** The draft this turn was saved into. Null while nothing has been settled
   * on, because nothing is saved before then. */
  draftId: number | null;
}

export const getGreeting = () => request<{ reply: string }>("/chat/greeting");

export const sendChatMessage = (
  message: string,
  history: ChatEntry[],
  document: string | null,
  fields: Fields,
  draftId: number | null,
) =>
  request<ChatReply>("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message, history, document, fields, draftId }),
  });

/** One card in the library. The title is resolved by the server: the browser
 * holds a slug but not what it is called. */
export interface DraftSummary {
  id: number;
  document: string;
  title: string;
  updatedAt: string;
}

export interface DraftDetail extends DraftSummary {
  documentSpec: DocumentSpec;
  fields: Fields;
  transcript: ChatEntry[];
}

export const listDrafts = () => request<DraftSummary[]>("/drafts");

export const getDraft = (id: number) => request<DraftDetail>(`/drafts/${id}`);
