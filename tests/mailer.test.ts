import { test } from "node:test";
import assert from "node:assert/strict";
import { sesCommand, sesTransport, transport } from "../src/lib/automation/mailer";

const email = { to: "ann@example.com", subject: "Your visit is booked", body: "Hi Ann" };

test("SES request carries only the recipient, subject and plain-text body", () => {
  const input = sesCommand(email, "FindYourDoc <no-reply@findyourdoc.com>").input;
  assert.deepEqual(input.Destination, { ToAddresses: ["ann@example.com"] });
  assert.equal(input.FromEmailAddress, "FindYourDoc <no-reply@findyourdoc.com>");
  assert.equal(input.Content?.Simple?.Subject?.Data, "Your visit is booked");
  assert.equal(input.Content?.Simple?.Body?.Text?.Data, "Hi Ann");
  assert.equal(input.Content?.Simple?.Body?.Html, undefined);
});

test("SES transport sends through the client and reports success", async () => {
  process.env.EMAIL_FROM = "no-reply@findyourdoc.com";
  const sent: unknown[] = [];
  const t = sesTransport({ send: async (c) => void sent.push(c) });
  assert.equal(t.name, "ses");
  assert.equal(await t.send(email), true);
  assert.equal(sent.length, 1);
});

test("SES errors propagate so the outbox retries", async () => {
  process.env.EMAIL_FROM = "no-reply@findyourdoc.com";
  const t = sesTransport({ send: async () => { throw new Error("Throttling"); } });
  await assert.rejects(t.send(email), /Throttling/);
});

test("SES without a sender address keeps emails queued", async () => {
  delete process.env.EMAIL_FROM;
  const t = sesTransport({ send: async () => assert.fail("must not send") });
  assert.equal(await t.send(email), false);
});

test("production holds email unless a transport is chosen", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { node: env.NODE_ENV, tr: env.EMAIL_TRANSPORT };
  env.NODE_ENV = "production";
  delete env.EMAIL_TRANSPORT;
  assert.equal(transport().name, "hold");
  env.NODE_ENV = saved.node;
  if (saved.tr !== undefined) env.EMAIL_TRANSPORT = saved.tr;
});
