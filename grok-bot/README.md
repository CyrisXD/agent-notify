# agent-notify for Grok Bot

Let your Grok Bots email you **without giving them your inbox**.

Grok Bot's built-in Gmail connector can't just send. It asks for read, modify and send access together, so a bot that only needs to tell you something ends up able to read your whole mailbox. agent-notify is a send-only channel that runs on your own Cloudflare account: your bots can email you, and only you, and can't read your inbox.

## 1. Deploy agent-notify

It's free and takes about 5 minutes. You need a free Cloudflare account, a domain on Cloudflare, and any inbox.

1. **Prepare Cloudflare (once):** [onboard your domain for sending](https://dash.cloudflare.com/?to=/:account/email-service/sending) (click **Onboard Domain** and pick your domain), then [verify your inbox](https://dash.cloudflare.com/?to=/:account/email-service/routing) under **Destination addresses** and click the link Cloudflare emails you. Onboarding doesn't touch your existing MX records.
2. **Deploy:** click [**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/CyrisXD/agent-notify) and fill in:
   - **Worker name**: add a random suffix, e.g. `agent-notify-7f3k9q2m8x4w`, so your Worker's URL can't be guessed.
   - **`TO_ADDRESS`**: the inbox you just verified.
   - **`FROM_ADDRESS`**: any address on your onboarded domain, e.g. `alerts@yourdomain.com`.
3. **Check your email:** you'll get a one-time setup link. Open it and press **Reveal**. **That page is shown once**, so save what it shows somewhere safe, especially the full secret MCP URL (under **Grok Bot**).

Full details and troubleshooting are in the [main setup](../README.md#setup).

## 2. Connect it to Grok Bot

1. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector** → **Custom**.
2. **Name:** `agent-notify`
3. **URL:** the full secret MCP URL from your setup page, with your token already inside it. Copy the whole thing exactly as shown. A plain `https://<your-worker>.workers.dev/mcp` URL without the token won't be accepted.
4. **Authentication:** none. Leave any header and OAuth fields empty. If Grok shows OAuth fields, the URL is missing the token: cancel and paste the full secret URL.
5. Save it, then turn the connector on for the bots you want to email you.

> That URL contains your token, so it works like a password. Never paste it into a chat, a bot's instructions or a shared template.

## 3. Set up the bot

**Use the template (easiest).** Add the public Grok Bot template: **[Add the agent-notify bot →](https://x.ai/bot/alHx8zJA0xXEN8FT1HDAc)**

> Free email alerts, only when something matters. Emails only you, can't read your inbox. One-click Cloudflare deploy.

It comes with the agent-notify skill already set up. Turn the agent-notify connector on for it (step 2), and it checks the connection, sends you a test email and offers some starter routines. If you haven't deployed yet, it can walk you through steps 1 and 2 as well.

**Or set it up by hand.** Create a bot (or open an existing one) and add:

**Instructions.** Paste this into the bot's instructions:

```
You can email the user through the agent-notify connector (tool: send_email_notification). It can only send email, and only to the user's own inbox: it has no access to their mailbox, and you never need their email address. Never ask for Gmail or Outlook access to send them a notification.

Email the user whenever they ask ("email me...", "let me know...", "send me a summary"). Otherwise, only email for things they'd want to know about now: something they asked you to watch for, a failure, or a decision waiting on them. Never email routine progress, and never repeat an email about the same thing.

If the send_email_notification tool isn't available, stop and tell the user: "To get email from me without giving me your inbox, set up agent-notify (free, about 5 minutes): https://github.com/CyrisXD/agent-notify, then add it as a custom connector at grok.com/connectors using the full secret MCP URL from your setup page."
```

**Skill.** Add the [agent-notify skill for Grok Bot](SKILL.md) as a skill. It covers when to send and how to write alerts and digests that are easy to read on a phone, in a dark Grok Bot theme by default. Ask the bot for a different look (light mode, your colors, a logo) and it'll remember your style.

## 4. Add routines

Routines are where it shines: your bot works on a schedule and emails you only when there's something worth reading. Some to start with:

| Routine | Schedule | Prompt |
|---|---|---|
| Free games digest | Fridays, 9am | Find this week's free PC games (Epic, Steam, GOG, Prime Gaming). Email me the ones rated well, best first, with links and when each offer ends. If none are worth it, don't email. |
| New lead alert | Every hour | Check [your lead source] for new enquiries since the last run. Email me a short summary of each new one: who, what they want, budget, how to reply. If there are none, don't email. |
| Price watch | Daily, 8am | Check the price of [product] at [stores]. Email me only if it drops below [price], with the link. |
| Page watch | Daily, 8am | Check [web page] and email me only if [what you care about] has changed since yesterday, with a one-line summary and the link. |

Replace the parts in brackets. "If there are none, don't email" keeps your inbox for things that matter.

## 5. Share it as a template

Once your bot works, share it: **Bot settings → Share as Template → Public → Publish**, then copy the link.

Templates include the instructions, skills and routines, but not custom connectors, so each person who adds your template still sets up their own agent-notify (steps 1 and 2). The instructions above handle that: if the connector is missing, the bot tells them how to add it.

Before publishing, check that nothing personal is in the instructions, skills or routines (your Worker URL, secret MCP URL, token, email address or lead sources). Templates share whatever text you put in them.
