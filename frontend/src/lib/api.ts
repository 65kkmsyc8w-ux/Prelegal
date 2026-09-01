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
