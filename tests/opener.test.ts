import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { route } from "../src/lib/opener/guard";
import { parseEvents, validSignature, sendRequest } from "../src/lib/opener/meta";
import { enforce, parseDecision, type Decision } from "../src/lib/opener/ai";
import { plan } from "../src/lib/opener/handle";
import { DISCLOSURE } from "../src/lib/opener/templates";

const dm = (text: string) => ({ platform: "instagram" as const, kind: "dm" as const, replyTo: "u1", senderId: "u1", text });
const never = async (): Promise<Decision | null> => {
  throw new Error("AI must not be called");
};

test("guard: crisis words win over everything", () => {
  assert.equal(route("I want to die, can you help me book").kind, "crisis");
  assert.equal(route("having chest pain right now").kind, "crisis");
});

test("guard: keywords route to guides without AI", () => {
  assert.deepEqual(route("RATE"), { kind: "keyword", keyword: "RATE" });
  assert.deepEqual(route("contract!"), { kind: "keyword", keyword: "CONTRACT" });
  assert.equal(route("what rate do you pay for night shifts in Atlanta?").kind, "ai");
});

test("guard: patients never reach the AI", () => {
  assert.equal(route("my knee hurts, who can see me this week?").kind, "patient");
  assert.deepEqual(route("how do I book an appointment?"), { kind: "patient", template: "general" });
  assert.equal(route("does anyone take my insurance").kind, "patient");
});

test("guard: health words from a clinician go to a human", () => {
  assert.equal(route("I'm an NP looking for a pain management locums job").kind, "human");
});

test("guard: ordinary clinician and practice messages go to the AI", () => {
  assert.equal(route("Here for the videos, love the contract stuff").kind, "ai");
  assert.equal(route("We're a 4-doctor ortho group in Macon hiring a PA").kind, "ai");
});

test("meta: signature check", () => {
  const body = '{"object":"page"}';
  const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
  assert.ok(validSignature(body, sig, "s3cret"));
  assert.ok(!validSignature(body, sig, "other"));
  assert.ok(!validSignature(body, null, "s3cret"));
  assert.ok(!validSignature(body, sig, undefined));
});

test("meta: parses DMs and comments, skips echoes and our own posts", () => {
  const ig = {
    object: "instagram",
    entry: [
      {
        id: "OUR",
        messaging: [
          { sender: { id: "u1" }, message: { text: "hi" } },
          { sender: { id: "OUR" }, message: { text: "echo", is_echo: true } },
          { sender: { id: "u2" }, message: { attachments: [] } },
        ],
        changes: [
          { field: "comments", value: { id: "c1", text: "RATE", from: { id: "u3" } } },
          { field: "comments", value: { id: "c2", text: "thanks all", from: { id: "OUR" } } },
        ],
      },
    ],
  };
  const events = parseEvents(ig);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { platform: "instagram", kind: "dm", replyTo: "u1", senderId: "u1", text: "hi" });
  assert.equal(events[1].kind, "comment");
  assert.equal(events[1].replyTo, "c1");
  const fb = { object: "page", entry: [{ id: "P", changes: [{ field: "feed", value: { item: "comment", verb: "add", comment_id: "c9", message: "HIRE", from: { id: "u9" } } }] }] };
  assert.equal(parseEvents(fb)[0].replyTo, "c9");
  assert.deepEqual(parseEvents({ object: "whatsapp_business_account" }), []);
});

test("meta: comments get a private reply, DMs a normal reply", () => {
  const c = JSON.parse(sendRequest({ ...dm("x"), kind: "comment", replyTo: "c1" }, "hello").init.body);
  assert.deepEqual(c.recipient, { comment_id: "c1" });
  const d = JSON.parse(sendRequest(dm("x"), "hello").init.body);
  assert.deepEqual(d.recipient, { id: "u1" });
});

const base: Decision = { audience: "clinician", action: "send", messages: ["Hi Sam, thanks for the follow!"], reason: "" };

test("ai: parses JSON even inside a code fence", () => {
  const d = parseDecision('```json\n{"audience":"practice","action":"send","messages":["Hi"],"reason":"ok"}\n```');
  assert.equal(d?.audience, "practice");
  assert.equal(parseDecision("no json here"), null);
});

test("ai: unapproved prices, patients and long replies never go out", () => {
  assert.equal(enforce(base).action, "send");
  assert.equal(enforce({ ...base, audience: "practice", messages: ["Solo is $299/month and locums is 12% on top."] }).action, "send");
  assert.equal(enforce({ ...base, messages: ["We can do $199 a month for you."] }).action, "draft_for_jabari");
  assert.equal(enforce({ ...base, messages: ["We take 15%."] }).action, "draft_for_jabari");
  assert.equal(enforce({ ...base, audience: "patient" }).action, "escalate");
  assert.equal(enforce({ ...base, messages: ["x".repeat(700)] }).action, "draft_for_jabari");
});

test("handle: off by default", async () => {
  assert.equal((await plan(dm("RATE"), { mode: "off", decide: never })).action, "ignored");
});

test("handle: draft mode sends nothing", async () => {
  for (const text of ["RATE", "my back hurts", "I want to die"]) {
    const o = await plan(dm(text), { mode: "draft", decide: never });
    assert.equal(o.reply, undefined, text);
    assert.ok(o.notify, text);
  }
});

test("handle: patient text is never copied into the email to Dr. Martin", async () => {
  const text = "my daughter has a rash and fever since Tuesday";
  for (const mode of ["draft", "send"]) {
    const o = await plan(dm(text), { mode, decide: never });
    assert.ok(!o.notify || !o.notify.text.includes("rash"), mode);
  }
});

test("handle: send mode sends templates and approved AI replies with the AI disclosure", async () => {
  const kw = await plan(dm("CONTRACT"), { mode: "send", decide: never });
  assert.equal(kw.action, "sent");
  assert.ok(kw.reply?.includes(DISCLOSURE));
  const crisis = await plan(dm("I want to kill myself"), { mode: "send", decide: never });
  assert.equal(crisis.action, "urgent");
  assert.match(crisis.reply ?? "", /988/);
  const ai = await plan(dm("Here for the videos"), { mode: "send", decide: async () => base });
  assert.equal(ai.action, "sent");
  assert.ok(ai.reply?.endsWith(DISCLOSURE));
  const drafted = await plan(dm("Here for the videos"), { mode: "send", decide: async () => ({ ...base, action: "draft_for_jabari" }) });
  assert.equal(drafted.reply, undefined);
});
