# agent-notify

Your agents are noisy. Let them email you only for the things that matter.

A single Cloudflare Worker that turns an HTTP call or MCP tool call into an HTML email to **you**. It is free: see [Cost](#cost).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/CyrisXD/agent-notify)

## Requirements

- A free **Cloudflare account**.
- A **domain on Cloudflare DNS** to send from. Its nameservers must point to Cloudflare.
- An **inbox you can receive at**. It can be on any provider (Gmail, Proton, etc.) and doesn't need to be on that domain.

Nothing to install locally. Everything runs in your browser and on Cloudflare.

## Before you deploy (2 minutes, once)

The deploy can't do these for you, because Cloudflare doesn't give deploy builds permission to change email settings. If you skip them, the deploy still succeeds but the setup email can't be sent, and the deploy log tells you what's missing.

1. **Allow the domain to send:** [open Email Sending](https://dash.cloudflare.com/?to=/:account/email-service/sending), click **Onboard Domain** and pick your domain. You can also onboard a subdomain such as `notify.yourdomain.com`. Cloudflare adds the sending records itself, all under a `cf-bounce` subdomain plus DKIM.
2. **Verify your inbox:** [open Email Routing](https://dash.cloudflare.com/?to=/:account/email-service/routing), go to **Destination addresses**, add the address where you want alerts, and click the link in the verification email Cloudflare sends.

> ⚠️ **Already have email on this domain (Google Workspace, Proton, Fastmail…)?** That's fine: sending works alongside it. Just **don't enable Email Routing** on the domain, because that replaces your MX records and your existing inbox stops receiving mail. If the onboarding screen offers to add a DMARC record and you already have one, keep your existing one (a domain can only have one).

## Deploy

Click the button. When asked, fill in:

| Name | What |
|---|---|
| `TO_ADDRESS` | The inbox you verified in step 2 |
| `FROM_ADDRESS` | Any address on the domain (or subdomain) you onboarded in step 1, e.g. `alerts@yourdomain.com` |
| `DAILY_LIMIT` | Max emails per day. Leave at `100` (see [Cost](#cost)) |

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

## Cost

**On the Workers Free plan this costs nothing and can't cost anything.** Free-plan limits (100,000 requests and 1,000 KV writes a day) make requests fail until the daily reset; they never bill you. Sending to your own verified address is free on every plan.

**On the Workers Paid plan** ($5/month, if you already use it for other things):
- Emails to your **verified** `TO_ADDRESS` are free and don't count toward any quota. Verify it (step 2 above).
- If `TO_ADDRESS` isn't verified, emails count toward the 3,000 included per month, then cost $0.35 per 1,000. `DAILY_LIMIT=100` caps you at about 3,000 a month, so even then it stays within what's included.
- Like any public Worker, someone flooding your URL creates billable requests ($0.30 per million after 10 million a month), even though they're rejected.

**Set a budget alert** if you're on a paid plan: **Manage Account → Billing → Billable Usage → Create budget alert**, e.g. at $1. Alerts notify you; they don't stop usage.

## Troubleshooting

- **Build fails with "build token … deleted or rolled":** open the Worker → **Settings → Builds** → **API token** → **Create new token**, save, then **Retry build**.
- **"email sending not authorized" in the deploy log or on the setup page:** the `FROM_ADDRESS` domain isn't onboarded yet. [Onboard the domain](https://dash.cloudflare.com/?to=/:account/email-service/sending) (step 1 of [Before you deploy](#before-you-deploy-2-minutes-once)), wait a few minutes for DNS, then click **Email me a setup link** on your Worker's URL. No redeploy needed.
- **Other send errors:** check that `TO_ADDRESS` is a verified destination address and `FROM_ADDRESS` is on the onboarded domain (Worker → **Settings → Variables**).
- **429 "Daily email limit reached":** `DAILY_LIMIT` was hit. It resets at 00:00 UTC.

## Limits

- 200-character subject, about 5 MiB per message (Cloudflare limit).
- `DAILY_LIMIT` emails per day (default 100), including setup-link emails.
