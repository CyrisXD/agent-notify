// `npm run deploy`: runs `wrangler deploy`, then on first deploy asks the Worker to email the owner
// a setup link and prints a banner in the deploy log. Only a failed `wrangler deploy` fails the build.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const OUTPUT = ".wrangler/deploy-output.json";

rmSync(OUTPUT, { force: true });
const deploy = spawnSync("npx", ["wrangler", "deploy", ...process.argv.slice(2)], {
	stdio: "inherit",
	shell: process.platform === "win32",
	env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: OUTPUT },
});
if (deploy.status !== 0) process.exit(deploy.status ?? 1);

const banner = (lines) => {
	const width = Math.max(...lines.map((l) => l.length)) + 4;
	const bar = "=".repeat(width);
	console.log(`\n${bar}\n${lines.map((l) => `  ${l}`).join("\n")}\n${bar}\n`);
};

let url;
try {
	const records = readFileSync(OUTPUT, "utf8").trim().split("\n").map((l) => JSON.parse(l));
	url = records.filter((r) => r.type === "deploy").at(-1)?.targets?.[0];
} catch {}

if (!url) {
	banner(["agent-notify deployed.", "Open your Worker's URL and click \"Email me a setup link\" to get your token."]);
	process.exit(0);
}

// A brand-new workers.dev URL can take a few seconds to go live.
let result;
for (let i = 0; i < 10 && !result; i++) {
	try {
		const res = await fetch(`${url}/setup?auto`, { method: "POST" });
		if (res.headers.get("content-type")?.includes("json")) result = await res.json();
	} catch {}
	if (!result) await new Promise((r) => setTimeout(r, 3000));
}

const lines = {
	sent: [
		"📬  CHECK YOUR EMAIL",
		"",
		`A one-time setup link was sent to ${result?.to}.`,
		"Open it to get your access token and setup steps for your agent",
		"(Claude, ChatGPT, Grok Bot, Cursor, scripts).",
		"",
		"The link expires in 1 hour and the token is shown only once, so save it.",
		"No email? Check spam, then request a new link at:",
		`  ${url}`,
	],
	already_setup: [
		"agent-notify updated. Already set up, so no setup email was sent.",
		"Lost your token? Delete this Worker and deploy agent-notify again.",
	],
	cooldown: [
		`📬  A setup link was sent to ${result?.to} in the last 10 minutes. Check your email.`,
		`Need another? Request one at: ${url}`,
	],
	limit: [
		"Deployed. Today's setup-link allowance is used up, so no email was sent.",
		`Request one tomorrow (00:00 UTC) at: ${url}`,
	],
	error: [
		"⚠️  DEPLOYED, BUT THE SETUP EMAIL COULD NOT BE SENT",
		`   ${result?.error}`,
		"",
		"Usually the FROM_ADDRESS domain isn't onboarded for sending yet:",
		"  https://dash.cloudflare.com/?to=/:account/email-service/sending",
		"Also check TO_ADDRESS is a verified destination address:",
		"  https://dash.cloudflare.com/?to=/:account/email-service/routing",
		"No redeploy needed:",
		"wait a few minutes, then request a link at:",
		`  ${url}`,
	],
}[result?.status] ?? [
	"agent-notify deployed, but the Worker didn't respond yet.",
	`Open ${url} and click "Email me a setup link" to get your token.`,
];

banner(lines);
