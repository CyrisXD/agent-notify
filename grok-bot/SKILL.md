---
name: agent-notify
description: "Email the user through the agent-notify connector (send_email_notification), which can only send to their own inbox and has no access to their mailbox. Use whenever the user asks to be emailed, and unprompted only when something needs them soon: something they asked you to watch for, a failure, or a decision waiting on them. Not for routine progress."
---

# agent-notify

Sends one email to the user's own inbox through the agent-notify connector. It can only send, and only to them: it has no access to their mailbox, and the recipient is fixed. Never ask for Gmail or Outlook access to notify them. When you explain how you email them, say plainly that you can only send them email and can't read their inbox, never that you just don't need access. Their inbox is the high-signal channel, so every email must be worth reading.

## Send or not?

**The user asked for an email**: always send, with what they asked for, when it's ready.

**Unprompted**, send only when all are true:
- They need to know or act, and you can't resolve it yourself.
- You haven't already emailed about the same thing.

Typical yes: something they asked you to watch for showed up (a new lead, a price drop, free games), a job failed, you're blocked on a decision, a long task finished.
Typical no: progress updates, minor issues you handled, a routine run that found nothing new. If a routine finds nothing, don't email.

When unsure, don't send. Batch related findings into one email.

## How to send

Call `send_email_notification` with `subject` and `html` (`text` is optional). The recipient is fixed, so there's no address to fill in.

- "Sent": done.
- "Daily email limit reached": don't retry. Tell the user in chat.
- The tool isn't available: tell the user to set up agent-notify (https://github.com/CyrisXD/agent-notify) and add it as a custom connector at grok.com/connectors, using the full secret MCP URL from their setup page.

## Writing it

By default every email uses the Grok Bot theme: a black page, a dark rounded card, white headings, soft gray body text, thin dark dividers, white pill buttons, and a small "Grok Bot" label at the top. Start from the templates below.

**The user's own style wins.** If they ask for a different look (light mode, their brand colors, a logo URL, a different label or footer, plainer or shorter emails), save it to memory as their email style and use it in every email from then on, adapting the templates rather than these defaults. Changes they ask for in one email ("make this one shorter") apply only to that email unless they say otherwise.

Whatever the style, make it easy to scan on a phone, use inline styles only (email clients drop `<style>` and scripts), and never include passwords, tokens or other secrets.

### Alerts: something happened

Short. What happened, why it matters, the one thing to do next, then details. Readable in about 10 seconds.

**Subject**: `[TAG] topic: what happened`, at most about 80 characters. Tags: `ACTION` (needs them), `FAILED`, `DONE`, `WARN`.
e.g. `[FAILED] nightly backup: disk full`, `[ACTION] website: approve the new homepage`, `[DONE] tax report: ready to review`

```html
<div style="background:#000000;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#0f0f10;border:1px solid #27272a;border-radius:16px;padding:24px;color:#f4f4f5;line-height:1.55">
    <p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#a1a1aa;letter-spacing:.02em">Grok Bot</p>
    <p style="margin:0 0 10px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#3b0d0d;color:#f87171;font-size:11px;font-weight:700;letter-spacing:.08em">FAILED</span> <span style="font-size:12px;color:#71717a">&nbsp;nightly backup</span></p>
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#ffffff">Last night's backup didn't finish</h2>
    <p style="margin:0 0 16px;color:#d4d4d8">The backup drive filled up at 2:14am, so only 2 of 3 folders were saved. Nothing was lost.</p>
    <div style="margin:0 0 16px;padding:12px 14px;background:#18181b;border-radius:12px;color:#f4f4f5"><b>Next:</b> free up about 20 GB on the backup drive, then I'll retry tonight.</div>
    <pre style="margin:0;background:#000000;border:1px solid #27272a;color:#e4e4e7;padding:12px;border-radius:10px;font-size:12px;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace">Error: no space left on device</pre>
    <p style="margin:20px 0 0;padding-top:14px;border-top:1px solid #27272a;font-size:12px;color:#71717a">Sent by your Grok Bot · nightly backup</p>
  </div>
</div>
```

Tag pill colors (background / text): FAILED `#3b0d0d` / `#f87171`, ACTION `#3a2206` / `#fbbf24`, WARN `#3a3006` / `#facc15`, DONE `#0b2e1a` / `#4ade80`. Leave out the error block when there's no error, and keep any error output to the relevant lines.

### Digests and reports: content they asked for

A list of free games, new leads, research results, a weekly summary. As long as the content needs, but easy to skim: a one-line summary at the top, then one block per item with the key facts (price, deadline, contact, link) and a line on why it's worth their time. Lead with the best items, cut filler, and link out rather than pasting everything. Give each item a white pill button with a short label for its main action (Open, Claim, Reply, View).

**Subject**: what's inside, e.g. `Free games this week: 3 worth grabbing`, `5 new leads: 2 look hot`.

```html
<div style="background:#000000;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#0f0f10;border:1px solid #27272a;border-radius:16px;padding:24px;color:#f4f4f5;line-height:1.55">
    <p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#a1a1aa;letter-spacing:.02em">Grok Bot</p>
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:600;color:#ffffff">Free games this week</h2>
    <p style="margin:0 0 20px;color:#a1a1aa">3 worth grabbing, all free until Thursday.</p>
    <div style="padding:16px 0;border-top:1px solid #27272a">
      <a href="https://example.com/game" style="font-size:16px;font-weight:600;color:#ffffff;text-decoration:none">Game title</a>
      <p style="margin:4px 0 0;font-size:13px;color:#a1a1aa">Epic Games · usually $24.99 · free until Thu 9 Oct</p>
      <p style="margin:8px 0 12px;color:#d4d4d8">One or two lines on why it's worth it.</p>
      <a href="https://example.com/game" style="display:inline-block;padding:8px 16px;border-radius:999px;background:#ffffff;color:#000000;font-size:13px;font-weight:600;text-decoration:none">Open</a>
    </div>
    <!-- repeat one block per item -->
    <p style="margin:8px 0 0;padding-top:14px;border-top:1px solid #27272a;font-size:12px;color:#71717a">Sent by your Grok Bot · weekly free games check</p>
  </div>
</div>
```

Images are fine if they have a public URL: `<img src="..." alt="..." style="width:100%;max-width:600px;border-radius:12px;margin:8px 0">`.
