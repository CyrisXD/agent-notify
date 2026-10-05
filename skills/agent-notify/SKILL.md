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

Typical yes: a build or deploy failed, you're blocked waiting on credentials or a decision, a long job finished, data looks wrong, an action needs approval.
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

**Subject**: `[TAG] project: what happened`, at most about 80 characters. Tags: `ACTION` (needs them), `FAILED`, `DONE`, `WARN`.
e.g. `[FAILED] billing-api: prod deploy rolled back`, `[ACTION] site-redesign: approve DNS cutover`

**Body**: what happened, why it matters, the one thing to do next, then links or details. Write it so it reads on a phone in 10 seconds. Use inline styles only (email clients drop `<style>` and scripts):

```html
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#111;line-height:1.5">
  <p style="margin:0 0 4px;font-size:12px;color:#c00;font-weight:600;letter-spacing:.04em">FAILED · billing-api</p>
  <h2 style="margin:0 0 12px;font-size:18px">Prod deploy rolled back</h2>
  <p style="margin:0 0 12px">Migration 0042 timed out after 5 min; the deploy auto-rolled back. Prod is healthy on v1.8.3.</p>
  <p style="margin:0 0 12px"><b>Next:</b> decide whether to run 0042 off-peak or split it.</p>
  <pre style="background:#f4f4f5;padding:10px;border-radius:6px;font-size:12px;white-space:pre-wrap">ERROR: canceling statement due to statement timeout</pre>
  <p style="margin:12px 0 0;font-size:12px;color:#666">Sent by Claude Code · ~/PROJECTS/billing-api</p>
</div>
```

Tag colors: FAILED `#c00`, ACTION `#b45309`, WARN `#a16207`, DONE `#15803d`.

Never put secrets, tokens, or full env dumps in an email. Keep logs to the relevant lines.
