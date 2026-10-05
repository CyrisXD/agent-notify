---
name: agent-notify
description: Send the user an email (HTML) through their agent-notify Cloudflare Worker, using the send_email_notification tool or HTTP. Use whenever the user asks to be emailed - "email me the results", "send me an email when done", "email me a summary", "notify me", "ping me when done", "let me know if it breaks". Also use unprompted when something needs a human soon and they may not be watching - a task failed or is blocked, a decision or approval is needed, a long-running job finished. Not for routine progress updates.
---

# agent-notify

Sends one HTML email to the user. Their inbox is the high-signal channel, so every email must be worth interrupting them for.

## Send or not?

**The user asked for an email** ("email me the results", "send me an email when it's done"): always send, with what they asked for, when it's ready.

**Unprompted**, send only when **all** are true:
- A human needs to know or act, and you can't resolve it yourself.
- They're probably not watching this session (long job, background or scheduled run, or they asked you to tell them).
- You haven't already emailed about this same issue in this session.

Typical yes: something they asked you to watch for showed up (a new lead, a price drop, free games), a build or deploy failed, you're blocked waiting on credentials or a decision, a long job finished, data looks wrong, an action needs approval.
Typical no: step done, minor warning you handled, anything already shown in the chat they're reading.

When unsure, don't send. Batch related findings into one email.

## How to send

1. **MCP available?** If a `send_email_notification` tool exists (often `mcp__agent-notify__send_email_notification`), call it with `subject` and `html` (`text` is optional).
2. **Otherwise use HTTP**, with env vars `AGENT_NOTIFY_URL` and `AGENT_NOTIFY_TOKEN`:

```bash
jq -n --arg s "$SUBJECT" --arg h "$HTML" '{subject:$s, html:$h}' |
  curl -sf -X POST "$AGENT_NOTIFY_URL" \
    -H "Authorization: Bearer $AGENT_NOTIFY_TOKEN" -H "Content-Type: application/json" --data-binary @-
```

Use `jq` (or Python `json.dumps`) to build the JSON. Never hand-escape HTML into a JSON string. If neither the tool nor the env vars exist, tell the user to set it up (https://github.com/CyrisXD/agent-notify) instead of failing silently. If they have deployed but have no token, they open their Worker URL in a browser and click "Email me a setup link", then open the one-time link from their inbox. If they say they already added the MCP server but the tool isn't here, it was probably added without `--scope user`, so it only works in the folder where they ran the command. They can check with `claude mcp list` and re-add it with `--scope user`.

`{"ok":true}` means sent. A 401 means the token is wrong; 400 means `subject` is missing or both bodies are empty; 429 means the daily email limit is reached, so don't retry: tell the user in chat instead.

## Writing it

Pick the shape that fits. Either way: easy to scan on a phone, inline styles only (email clients drop `<style>` and scripts), and never secrets, tokens or full env dumps.

### Alerts: something happened

Short. What happened, why it matters, the one thing to do next, then details. Readable in about 10 seconds.

**Subject**: `[TAG] topic: what happened`, at most about 80 characters. Tags: `ACTION` (needs them), `FAILED`, `DONE`, `WARN`.
e.g. `[FAILED] nightly backup: disk full`, `[ACTION] website: approve the new homepage`, `[DONE] tax report: ready to review`

```html
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#111;line-height:1.5">
  <p style="margin:0 0 4px;font-size:12px;color:#c00;font-weight:600;letter-spacing:.04em">FAILED · nightly backup</p>
  <h2 style="margin:0 0 12px;font-size:18px">Last night's backup didn't finish</h2>
  <p style="margin:0 0 12px">The backup drive filled up at 2:14am, so only 2 of 3 folders were saved. Nothing was lost.</p>
  <p style="margin:0 0 12px"><b>Next:</b> free up about 20 GB on the backup drive, then I'll retry tonight.</p>
  <pre style="background:#f4f4f5;padding:10px;border-radius:6px;font-size:12px;white-space:pre-wrap">Error: no space left on device</pre>
  <p style="margin:12px 0 0;font-size:12px;color:#666">Sent by your agent · nightly backup</p>
</div>
```

Tag colors: FAILED `#c00`, ACTION `#b45309`, WARN `#a16207`, DONE `#15803d`. Keep any error output to the relevant lines.

### Digests and reports: content they asked for

A list of free games, new leads, research results, a weekly summary. As long as the content needs, but easy to skim: a one-line summary at the top, then one block per item with the key facts (price, deadline, contact, link) and a line on why it's worth their time. Lead with the best items, cut filler, and link out rather than pasting everything.

**Subject**: what's inside, e.g. `Free games this week: 3 worth grabbing`, `5 new leads: 2 look hot`.

```html
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:600px;color:#111;line-height:1.5">
  <h2 style="margin:0 0 4px;font-size:20px">Free games this week</h2>
  <p style="margin:0 0 20px;color:#555">3 worth grabbing, all free until Thursday.</p>
  <div style="padding:14px 0;border-top:1px solid #e5e5e5">
    <a href="https://example.com/game" style="font-size:16px;font-weight:600;color:#111">Game title</a>
    <p style="margin:4px 0 0;font-size:13px;color:#666">Epic Games · usually $24.99 · free until Thu 9 Oct</p>
    <p style="margin:6px 0 0">One or two lines on why it's worth it.</p>
  </div>
  <!-- repeat one block per item -->
  <p style="margin:16px 0 0;font-size:12px;color:#666">Sent by your agent · weekly free games check</p>
</div>
```

Images are fine if they have a public URL: `<img src="..." alt="..." style="width:100%;max-width:600px;border-radius:6px">`.
