// Setup flow, one time only: anyone can ask for a link, but it only goes to the owner's inbox.
// The link opens a confirm page; pressing "Reveal" (a POST, so email link scanners can't trigger it)
// burns the link, creates the token, and shows it exactly once. Only the token's hash is stored.
// Once a token exists, setup is closed for good: getting a new token means deploying a fresh Worker.

const RESEND_COOLDOWN_MS = 10 * 60_000;
const LINK_TTL_S = 60 * 60;
// Setup-link emails have their own small allowance, so a stranger requesting links can't use up the alert limit.
const LINKS_PER_DAY = 3;

const hex = (buf: ArrayBuffer | Uint8Array) =>
	[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1•••$2");

export class DailyLimitError extends Error {}

/** Every email goes through here: fixed recipient, and a daily cap so usage can never become a bill. */
export async function sendEmail(env: Env, msg: { subject: string; html?: string; text?: string }, kind: "alert" | "link" = "alert") {
	const key = `${kind === "alert" ? "sent" : "links"}:${new Date().toISOString().slice(0, 10)}`;
	const limit = kind === "alert" ? Number(env.DAILY_LIMIT) || 100 : LINKS_PER_DAY;
	const sent = Number(await env.KV.get(key));
	// ponytail: KV counters are eventually consistent, so parallel bursts can overshoot the cap slightly. Durable Object if exactness matters.
	if (sent >= limit) throw new DailyLimitError(`Daily ${kind === "alert" ? "email" : "setup link"} limit (${limit}) reached. Resets at 00:00 UTC.`);
	await env.EMAIL.send({ to: env.TO_ADDRESS, from: env.FROM_ADDRESS, ...msg });
	await env.KV.put(key, String(sent + 1), { expirationTtl: 2 * 86400 });
}

/** True if the request carries the current token (in the Authorization header, or in a secret MCP URL). */
export async function authorized(req: Request, env: Env, urlToken?: string) {
	const stored = await env.KV.get("token_sha256");
	if (!stored) return "unset" as const;
	const token = urlToken ?? (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
	const got = await sha256(token);
	const want = new Uint8Array(stored.match(/../g)!.map((h) => parseInt(h, 16)));
	return crypto.subtle.timingSafeEqual(got, want);
}

const page = (body: string) =>
	new Response(
		`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>agent-notify</title>
<style>
:root{--fg:#111;--bg:#fff;--muted:#666;--line:#e4e4e7;--code:#f4f4f5;--warn-bg:#fff4e5;--warn-fg:#8a4b00;--accent:#f6821f}
@media(prefers-color-scheme:dark){:root{--fg:#eee;--bg:#111;--muted:#999;--line:#333;--code:#1e1e21;--warn-bg:#2b1d0b;--warn-fg:#ffc078}}
body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:8vh auto;padding:0 16px;color:var(--fg);background:var(--bg)}
button{font:inherit;padding:10px 18px;border:0;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer}
.muted{color:var(--muted);font-size:14px}
.warn{background:var(--warn-bg);color:var(--warn-fg);padding:12px 14px;border-radius:8px;margin:16px 0}
.block{position:relative;margin:6px 0 18px}
pre{background:var(--code);padding:12px;padding-right:72px;border-radius:8px;font-size:13px;white-space:pre-wrap;word-break:break-all;margin:0}
.copy{position:absolute;top:6px;right:6px;padding:4px 10px;font-size:13px}
h3{margin:22px 0 4px;font-size:15px}
a{color:var(--accent)}.warn a{color:inherit;font-weight:600}
.step{display:grid;grid-template-columns:28px 1fr;gap:14px;margin:32px 0}
.num{width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:600;font-size:14px}
.step h2{margin:0 0 4px;font-size:18px;line-height:28px}
.step p{margin:4px 0 10px}
details{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0}
details[open]{padding-bottom:4px}
summary{cursor:pointer;font-weight:600}
summary span{font-weight:400;color:var(--muted);font-size:14px}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:14px}
</style>
${body}`,
		{
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
				"X-Frame-Options": "DENY",
			},
		},
	);

const isSetUp = async (env: Env) => !!(await env.KV.get("token_sha256"));

const setUpPage = () =>
	page(`<h1>agent-notify is set up</h1>
<p>This Worker already has a token, so no more setup links can be sent.</p>
<p class="muted">Lost your token? In the <a href="https://dash.cloudflare.com">Cloudflare dashboard</a>, delete the <code>token_sha256</code> key from this Worker's KV namespace, then reload this page to request a new link.</p>`);

const gone = () =>
	page(`<h1>This link has expired or was already used</h1>
<p>Setup links work once and expire after an hour. Go to the <a href="/">setup page</a> to request a new one.</p>`);

export const startPage = async (env: Env) =>
	(await isSetUp(env)) ? setUpPage() : page(`<h1>agent-notify</h1>
<p>Get your access token and connection details (MCP, curl, Claude Code skill). We'll email a <b>one-time link</b> to <b>${esc(mask(env.TO_ADDRESS))}</b>.</p>
<form method="post" action="/setup"><button>Email me a setup link</button></form>
<p class="muted">Safe to share this page: the link only ever goes to the owner's inbox. You can request a link once every 10 minutes.</p>`);

// `?auto` is the post-deploy script (JSON replies). Nothing is sent once setup is done,
// so redeploys (every git push) don't email you again.
export async function sendLink(req: Request, env: Env) {
	const auto = new URL(req.url).searchParams.has("auto");
	const to = mask(env.TO_ADDRESS);
	const reply = (status: string, html: string, error?: string) => (auto ? Response.json({ status, to, error }) : page(html));

	if (await isSetUp(env)) return auto ? reply("already_setup", "") : setUpPage();
	const last = Number(await env.KV.get("link_sent_at"));
	if (Date.now() - last < RESEND_COOLDOWN_MS)
		return reply("cooldown", `<h1>Link already sent</h1><p>Check <b>${esc(to)}</b> (and spam). You can request another in a few minutes.</p>`);

	const code = randomHex();
	await env.KV.put(`setup:${code}`, "1", { expirationTtl: LINK_TTL_S });
	await env.KV.put("link_sent_at", String(Date.now()));
	const link = `${new URL(req.url).origin}/setup/${code}`;

	try {
		await sendEmail(env, {
			subject: "Your agent-notify setup link",
			text: `Open this link to get your agent-notify token and setup instructions:\n\n${link}\n\nIt works once and expires in 1 hour.\nDidn't request this? Ignore it. Nothing changes unless the link is used.`,
			html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#111;line-height:1.5">
<h2 style="margin:0 0 12px">Your agent-notify setup link</h2>
<p style="margin:0 0 16px">Open this link to get your access token and setup instructions.</p>
<p style="margin:0 0 16px"><a href="${link}" style="display:inline-block;background:#f6821f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open setup page</a></p>
<p style="margin:0 0 8px"><b>It works once and expires in 1 hour.</b></p>
<p style="margin:0;font-size:13px;color:#666">Didn't request this? Ignore it. Nothing changes unless the link is used.</p>
</div>`,
		}, "link");
	} catch (e) {
		await env.KV.delete("link_sent_at");
		if (e instanceof DailyLimitError)
			return reply("limit", `<h1>Too many setup links today</h1><p>For safety, only ${LINKS_PER_DAY} setup links can be sent per day. Try again tomorrow (00:00 UTC).</p>`, e.message);
		return reply("error", `<h1>Couldn't send the email</h1><p>${esc(String(e))}</p>
<p>Usually the domain of ${esc(env.FROM_ADDRESS)} isn't <a href="https://dash.cloudflare.com/?to=/:account/email-service/sending">onboarded for sending</a> yet. Also check ${esc(to)} is a <a href="https://dash.cloudflare.com/?to=/:account/email-service/routing">verified destination address</a>.</p>
<p class="muted">Fixed it? Wait a few minutes for DNS, then <a href="/">try again</a>. No redeploy needed.</p>`, String(e));
	}
	return reply("sent", `<h1>Check your inbox</h1><p>We sent a one-time setup link to <b>${esc(to)}</b>. It expires in 1 hour.</p>
<p class="muted">Getting that email also confirms sending works.</p>`);
}

// GET: confirm page only. Never burns the link, so email scanners that prefetch it can't use it up.
export async function confirmPage(code: string, env: Env) {
	if (await isSetUp(env)) return setUpPage();
	if (!(await env.KV.get(`setup:${code}`))) return gone();
	return page(`<h1>Reveal your access token</h1>
<div class="warn"><b>This can only be viewed once.</b> After you reveal it, this link stops working and the token can never be shown again. Have somewhere ready to save it (e.g. a password manager).</div>
<form method="post"><button>Reveal token and setup instructions</button></form>`);
}

// POST: burn the link, create the token, show it once.
export async function reveal(req: Request, code: string, env: Env) {
	if (await isSetUp(env)) return setUpPage();
	const key = `setup:${code}`;
	if (!(await env.KV.get(key))) return gone();
	// ponytail: KV get+delete isn't atomic, so the same link opened twice within seconds could reveal twice. Both are the owner's clicks; use a Durable Object if that ever matters.
	await env.KV.delete(key);

	const token = randomHex();
	await env.KV.put("token_sha256", hex(await sha256(token)));

	const url = new URL(req.url).origin;
	// Tells the owner if someone else revealed it first (e.g. the setup link leaked via a public URL scanner).
	// Best effort: a failed notice must not lose a token that's only shown once.
	await sendEmail(env, {
		subject: "Your agent-notify token was just revealed",
		text: `Your agent-notify access token was revealed at ${new Date().toISOString()} (UTC) on ${url}.\n\nWas that you? Then there's nothing to do.\n\nIf not, cancel it: in the Cloudflare dashboard go to Storage & Databases → KV, open this Worker's namespace and delete the token_sha256 key. The token stops working within about a minute, and you can request a new setup link at ${url}`,
	}).catch(() => {});
	const block = (s: string) => `<div class="block"><pre>${esc(s)}</pre><button class="copy" type="button">Copy</button></div>`;
	const step = (n: number, title: string, body: string) =>
		`<section class="step"><div class="num">${n}</div><div><h2>${title}</h2>${body}</div></section>`;
	const skillUrl = "https://raw.githubusercontent.com/CyrisXD/agent-notify/main/skills/agent-notify/SKILL.md";
	const mcpJson = JSON.stringify({ mcpServers: { "agent-notify": { url: `${url}/mcp`, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);

	return page(`<h1>Set up agent-notify</h1>
<div class="warn"><b>This page is shown once.</b> If you refresh or leave, the token is gone for good. It can never be shown again, and no new setup links can be sent.</div>

${step(1, "Save your token", `<p>Put it in your password manager now. Anyone with it can send you email.</p>
${block(token)}`)}

${step(2, "Connect your agent", `<p>Pick the tool you use. You can set up more than one.</p>
<details name="client" open><summary>Claude Code <span>· recommended</span></summary>
<p>Run this in your terminal. It works in every Claude Code session and folder:</p>
${block(`claude mcp add --scope user --transport http agent-notify ${url}/mcp --header "Authorization: Bearer ${token}"`)}
<p class="muted">Already-open sessions won't see it, so start a new one.</p></details>
<details name="client"><summary>Cursor, Windsurf, other MCP apps</summary>
<p>Add this to your app's MCP config: <code>~/.cursor/mcp.json</code> for Cursor, <code>~/.codeium/windsurf/mcp_config.json</code> for Windsurf. If the file already has an <code>mcpServers</code> block, add just the <code>agent-notify</code> entry.</p>
${block(mcpJson)}</details>
<details name="client"><summary>ChatGPT, Grok Bot and apps that only take a URL</summary>
<p>Add a custom MCP server (or connector) with this URL and choose <b>no authentication</b>. The token is inside the URL, so treat it like a password.</p>
${block(`${url}/mcp/${token}`)}</details>
<details name="client"><summary>Scripts, CI and other agents <span>· plain HTTP</span></summary>
<p>Save the endpoint and token in your shell profile so scripts (and the skill's fallback) can use them:</p>
${block(`echo 'export AGENT_NOTIFY_URL=${url}' >> ~/.zshrc\necho 'export AGENT_NOTIFY_TOKEN=${token}' >> ~/.zshrc\nsource ~/.zshrc`)}
<p>Then send with:</p>
${block(`curl -X POST "$AGENT_NOTIFY_URL" \\\n  -H "Authorization: Bearer $AGENT_NOTIFY_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"subject":"Hello","html":"<p>It works</p>"}'`)}
<p class="muted">On bash, use <code>~/.bashrc</code> instead of <code>~/.zshrc</code>.</p></details>`)}

${step(3, "Install the skill <span class=\"muted\">(Claude Code, optional)</span>", `<p>Teaches your agent <i>when</i> an email is worth sending and how to make it easy to read, so you can just say "email me the results". Other agents work without it.</p>
${block(`mkdir -p ~/.claude/skills/agent-notify && curl -fsSL ${skillUrl} -o ~/.claude/skills/agent-notify/SKILL.md`)}`)}

${step(4, "Send a test", `<p>Ask your agent (in a new session or chat, so it picks up the connection):</p>
${block("Send me a test email with agent-notify")}
<p>It should arrive at <b>${esc(mask(env.TO_ADDRESS))}</b> within a few seconds. The token can take up to a minute to start working.</p>`)}

<p class="muted">Endpoint: ${esc(url)} · <a href="https://github.com/CyrisXD/agent-notify">Docs</a></p>

<script>
for (const b of document.querySelectorAll(".copy")) b.onclick = async () => {
  await navigator.clipboard.writeText(b.previousElementSibling.textContent);
  b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500);
};
addEventListener("beforeunload", (e) => e.preventDefault());
</script>`);
}
