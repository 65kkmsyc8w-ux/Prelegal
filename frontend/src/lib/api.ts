import type { DocumentSpec, Fields } from "@/lib/documents";

export interface ApiUser {
  id: number;
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

export const createSession = (displayName: string) =>
  request<ApiUser>("/auth/session", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName }),
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
}

export const getGreeting = () => request<{ reply: string }>("/chat/greeting");

export const sendChatMessage = (
  message: string,
  history: ChatEntry[],
  document: string | null,
  fields: Fields,
) =>
  request<ChatReply>("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message, history, document, fields }),
  });
