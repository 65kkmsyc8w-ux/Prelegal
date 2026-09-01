import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  getDraft,
  getGreeting,
  listDrafts,
  me,
  sendChatMessage,
  signIn,
  signOut,
  signUp,
} from "@/lib/api";

const respondWith = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    respondWith(200, { id: 1, email: "ada@example.com", display_name: "Ada" }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];

describe("the api client", () => {
  it("asks the backend who is signed in", async () => {
    expect(await me()).toEqual({
      id: 1,
      email: "ada@example.com",
      display_name: "Ada",
    });
    expect(lastCall()[0]).toBe("/api/auth/me");
  });

  it("sends the cookie with every request", async () => {
    await me();
    expect(lastCall()[1].credentials).toBe("include");
  });

  it("signs in with the email and password the user gave", async () => {
    await signIn("ada@example.com", "opensesame");

    const [path, init] = lastCall();
    expect(path).toBe("/api/auth/session");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "ada@example.com",
      password: "opensesame",
    });
  });

  it("registers an account with a name alongside the credentials", async () => {
    await signUp("ada@example.com", "Ada", "opensesame");

    const [path, init] = lastCall();
    expect(path).toBe("/api/auth/signup");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "ada@example.com",
      display_name: "Ada",
      password: "opensesame",
    });
  });

  it("reports a signed out caller as a 401", async () => {
    vi.stubGlobal("fetch", respondWith(401, { detail: "Not signed in" }));

    await expect(me()).rejects.toThrow(ApiError);
    await expect(me()).rejects.toMatchObject({ status: 401 });
  });

  it("carries the reason the backend gave", async () => {
    vi.stubGlobal("fetch", respondWith(422, { detail: "Name is required" }));

    await expect(signIn("", "")).rejects.toThrow("Name is required");
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

  it("sends the message, the thread, the document and the fields so far", async () => {
    vi.stubGlobal("fetch", respondWith(200, { reply: "Noted.", fields: {} }));
    const history = [{ role: "assistant" as const, content: "Hello" }];

    await sendChatMessage(
      "Delaware law",
      history,
      "mutual-nda",
      { governingLaw: "Delaware" },
      7,
    );

    const [path, init] = lastCall();
    expect(path).toBe("/api/chat/message");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      message: "Delaware law",
      history,
      document: "mutual-nda",
      fields: { governingLaw: "Delaware" },
      draftId: 7,
    });
  });

  it("says no document is settled on while the assistant is still asking", async () => {
    vi.stubGlobal("fetch", respondWith(200, { reply: "Noted.", fields: {} }));

    await sendChatMessage("I need something", [], null, {}, null);

    const body = JSON.parse(lastCall()[1].body);
    expect(body.document).toBeNull();
    // Nothing has been saved either, so there is no draft to write into yet.
    expect(body.draftId).toBeNull();
  });

  it("reports a provider failure with the reason the backend gave", async () => {
    vi.stubGlobal("fetch", respondWith(502, { detail: "The AI answered with nothing" }));

    await expect(sendChatMessage("Hi", [], null, {}, null)).rejects.toThrow(
      "The AI answered with nothing",
    );
  });
});

describe("the drafts client", () => {
  it("lists the caller's library", async () => {
    const card = {
      id: 7,
      document: "mutual-nda",
      title: "Mutual Non-Disclosure Agreement",
      updatedAt: "2026-09-01T10:00:00",
    };
    vi.stubGlobal("fetch", respondWith(200, [card]));

    expect(await listDrafts()).toEqual([card]);
    expect(lastCall()[0]).toBe("/api/drafts");
  });

  it("fetches one draft by its id", async () => {
    vi.stubGlobal("fetch", respondWith(200, { id: 7, transcript: [] }));

    await getDraft(7);

    expect(lastCall()[0]).toBe("/api/drafts/7");
  });

  it("reports a draft the caller cannot open as a 404", async () => {
    vi.stubGlobal("fetch", respondWith(404, { detail: "No such draft" }));

    await expect(getDraft(7)).rejects.toMatchObject({ status: 404 });
  });
});
