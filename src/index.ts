import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const Notification = z.object({
	subject: z.string().min(1).max(200).describe("Short, specific subject line"),
	html: z.string().max(500_000).optional().describe("HTML body"),
	text: z.string().max(500_000).optional().describe("Plain-text body (fallback, or use alone)"),
});
type Notification = z.infer<typeof Notification>;

const send = (env: Env, { subject, html, text }: Notification) =>
	env.EMAIL.send({ to: env.TO_ADDRESS, from: env.FROM_ADDRESS, subject, html, text });

const mcpServer = (env: Env) => () => {
	const server = new McpServer({ name: "agent-notify", version: "1.0.0" });
	server.registerTool(
		"send_email_notification",
		{
			description:
				"Send an email to the user (the owner of this server). Use whenever the user asks to be emailed, " +
				'e.g. "email me the results", "send me an email when done", "notify me by email". ' +
				"Unprompted, use only for things a human must see or act on soon (failures, blocked work, " +
				"decisions needed, finished long-running jobs), never for routine progress. The recipient is fixed; " +
				"you only provide subject and body.",
			inputSchema: Notification,
		},
		async (n) => {
			if (!n.html && !n.text) return { content: [{ type: "text", text: "Provide html or text" }], isError: true };
			await send(env, n);
			return { content: [{ type: "text", text: "Sent" }] };
		},
	);
	return server;
};

const enc = new TextEncoder();
const authorized = (req: Request, env: Env) => {
	const got = enc.encode(req.headers.get("Authorization") ?? "");
	const want = enc.encode(`Bearer ${env.AUTH_TOKEN}`);
	return got.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(got, want);
};

export default {
	async fetch(req, env, ctx) {
		// Refuse to run with a missing or guessable token (e.g. someone clicked through the deploy form).
		if ((env.AUTH_TOKEN ?? "").length < 32)
			return new Response("AUTH_TOKEN must be at least 32 characters. Set it with: openssl rand -hex 32", { status: 500 });
		if (!authorized(req, env)) return new Response("Unauthorized", { status: 401 });

		if (new URL(req.url).pathname === "/mcp") return createMcpHandler(mcpServer(env))(req, env, ctx);

		if (req.method !== "POST") return new Response("POST only", { status: 405 });
		const parsed = Notification.safeParse(await req.json().catch(() => null));
		if (!parsed.success || (!parsed.data.html && !parsed.data.text))
			return Response.json({ ok: false, error: "Need subject plus html or text" }, { status: 400 });

		try {
			await send(env, parsed.data);
			return Response.json({ ok: true });
		} catch (e) {
			return Response.json({ ok: false, error: String(e) }, { status: 502 });
		}
	},
} satisfies ExportedHandler<Env>;
