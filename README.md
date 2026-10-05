# agent-notify

Your agents are noisy. Let them email you only for the things that matter.

A single Cloudflare Worker that turns an HTTP call or MCP tool call into an HTML email to **you**. It is free on the Workers Free plan, because sending to your own verified address costs nothing.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/CyrisXD/agent-notify)

## Before you deploy (5 minutes, once)

1. Use a domain on Cloudflare, then open **Email → Email Routing** and enable it.
2. Under **Destination addresses**, add the inbox where you want alerts and click the link in the verification email.

## Deploy

Click the button. When asked, fill in:

| Name | What |
|---|---|
| `TO_ADDRESS` | Your verified destination address |
| `FROM_ADDRESS` | Any address on your Email Routing domain, e.g. `alerts@yourdomain.com` |

When the deploy finishes, **check your email**: the first deploy automatically sends a one-time setup link to `TO_ADDRESS`, and the deploy log says so. (No email? Open your Worker's URL and click **Email me a setup link**.) Open the one-time link from your inbox and press **Reveal** to see your access token plus copy-paste config for Claude Code, Cursor and other MCP clients, curl, and the skill. **That page is shown once, so save the token straight away.** Getting the email also confirms sending works.

<details><summary>Prefer the CLI?</summary>

```bash
git clone https://github.com/CyrisXD/agent-notify && cd agent-notify && npm i
# edit TO_ADDRESS / FROM_ADDRESS in wrangler.jsonc
npm run deploy
```
Then check your email for the setup link.
</details>

## Use it

**HTTP** (any script, cron job, CI, agent):

```bash
curl -X POST https://agent-notify.<you>.workers.dev \
  -H "Authorization: Bearer $AGENT_NOTIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Deploy failed","html":"<b>prod</b> is down"}'
```

Body: `subject` (required, max 200 chars) plus `html` and/or `text`. Returns `{"ok":true}`.

**MCP** at `/mcp` exposes one tool, `send_email_notification`:

```bash
claude mcp add --transport http agent-notify https://agent-notify.<you>.workers.dev/mcp \
  --header "Authorization: Bearer <token>"
```

Any MCP client that can send a custom header works. Clients that only support OAuth (claude.ai custom connectors) aren't supported yet.

**Claude Code skill.** [`skills/agent-notify`](skills/agent-notify/SKILL.md) teaches agents *when* an alert is worth sending and how to format it. Copy it to `~/.claude/skills/`.

Check a deployment end to end (sends one real test email):

```bash
./smoke.sh https://agent-notify.<you>.workers.dev $AGENT_NOTIFY_TOKEN
```

## Security

- Setup links only go to the owner's inbox, work once, and expire after an hour, so a public setup page is safe. A link can be requested once every 10 minutes.
- The token itself is never emailed. It is 64 random hex characters, shown once on the revealed page, and only its SHA-256 hash is stored.
- Opening the link only shows a confirm page. The token appears after you press **Reveal**, so email security scanners that prefetch links can't use it up.
- Every request needs the token, checked in constant time.
- The recipient is fixed when you deploy. Callers can't choose who gets the email.
- Cloudflare only delivers to verified addresses, so even a leaked token can't spam anyone else.
- Each person deploys their own Worker. There's no shared service, and nothing is stored except the token.
- **Lost or leaked token?** Request a new setup link. Revealing it creates a new token and the old one stops working immediately.

## Troubleshooting

- **Build fails with "build token … deleted or rolled":** open the Worker → **Settings → Builds** → **API token** → **Create new token**, save, then **Retry build**.
- **Setup page says it couldn't send:** `FROM_ADDRESS` must be on a domain with Email Routing enabled, and `TO_ADDRESS` must be a verified destination address. Fix them under the Worker's **Settings → Variables**.

## Limits

- 200-character subject, about 5 MiB per message (Cloudflare limit).
- For many alerts a day, add a [rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
