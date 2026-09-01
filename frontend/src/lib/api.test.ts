import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createSession,
  getGreeting,
  me,
  sendChatMessage,
  signOut,
} from "@/lib/api";
import { emptyNda } from "@/lib/nda";

const respondWith = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

beforeEach(() => {
  vi.stubGlobal("fetch", respondWith(200, { id: 1, display_name: "Ada" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];

describe("the api client", () => {
  it("asks the backend who is signed in", async () => {
    expect(await me()).toEqual({ id: 1, display_name: "Ada" });
    expect(lastCall()[0]).toBe("/api/auth/me");
  });

  it("sends the cookie with every request", async () => {
    await me();
    expect(lastCall()[1].credentials).toBe("include");
  });

  it("opens a session under the name the user gave", async () => {
    await createSession("Ada");

    const [path, init] = lastCall();
    expect(path).toBe("/api/auth/session");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ display_name: "Ada" });
  });

  it("reports a signed out caller as a 401", async () => {
    vi.stubGlobal("fetch", respondWith(401, { detail: "Not signed in" }));

    await expect(me()).rejects.toThrow(ApiError);
    await expect(me()).rejects.toMatchObject({ status: 401 });
  });

  it("carries the reason the backend gave", async () => {
    vi.stubGlobal("fetch", respondWith(422, { detail: "Name is required" }));

    await expect(createSession("")).rejects.toThrow("Name is required");
  });

  it("stands in a message when the failure carries no reason", async () => {
    vi.stubGlobal("fetch", respondWith(500, "not json"));

    await expect(me()).rejects.toThrow("Request failed (500)");
  });

  it("returns nothing for a signout, which answers 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null }),
    );

    expect(await signOut()).toBeUndefined();
  });
});

describe("the chat client", () => {
  it("fetches the assistant's opening line", async () => {
    vi.stubGlobal("fetch", respondWith(200, { reply: "Hello" }));

    expect(await getGreeting()).toEqual({ reply: "Hello" });
    expect(lastCall()[0]).toBe("/api/chat/greeting");
  });

  it("sends the message, the thread and the fields so far", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(200, { reply: "Noted.", fields: emptyNda() }),
    );
    const history = [{ role: "assistant" as const, content: "Hello" }];

    await sendChatMessage("Delaware law", history, emptyNda());

    const [path, init] = lastCall();
    expect(path).toBe("/api/chat/message");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      message: "Delaware law",
      history,
      fields: emptyNda(),
    });
  });

  it("reports a provider failure with the reason the backend gave", async () => {
    vi.stubGlobal("fetch", respondWith(502, { detail: "The AI answered with nothing" }));

    await expect(sendChatMessage("Hi", [], emptyNda())).rejects.toThrow(
      "The AI answered with nothing",
    );
  });
});
