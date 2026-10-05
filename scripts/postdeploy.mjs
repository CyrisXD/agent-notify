// Runs after `wrangler deploy`: on first deploy, asks the Worker to email the owner a setup link,
// then prints a banner in the deploy log. Never fails the build.
import { readFileSync } from "node:fs";

const OUTPUT = ".wrangler/deploy-output.json";

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
		"Open it to get your access token and agent setup instructions",
		"(Claude Code, Cursor and other MCP clients, curl, skill).",
		"",
		"The link expires in 1 hour and the token is shown only once, so save it.",
		"No email? Check spam, then request a new link at:",
		`  ${url}`,
	],
	already_setup: [
		"agent-notify updated. Already set up, so no setup email was sent.",
		`Lost your token? Request a new link at: ${url}`,
	],
	cooldown: [
		`📬  A setup link was sent to ${result?.to} in the last 10 minutes. Check your email.`,
		`Need another? Request one at: ${url}`,
	],
	error: [
		"⚠️  DEPLOYED, BUT THE SETUP EMAIL COULD NOT BE SENT",
		`   ${result?.error}`,
		"",
		"Check that FROM_ADDRESS is on a domain with Email Routing enabled",
		"and TO_ADDRESS is a verified destination address",
		"(Worker → Settings → Variables), then request a link at:",
		`  ${url}`,
	],
}[result?.status] ?? [
	"agent-notify deployed, but the Worker didn't respond yet.",
	`Open ${url} and click "Email me a setup link" to get your token.`,
];

banner(lines);
