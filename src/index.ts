import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { authorized, confirmPage, DailyLimitError, reveal, sendEmail, sendLink, startPage } from "./setup";

const Notification = z.object({
	subject: z.string().min(1).max(200).describe("Short, specific subject line"),
	html: z.string().max(500_000).optional().describe("HTML body"),
	text: z.string().max(500_000).optional().describe("Plain-text body (fallback, or use alone)"),
});
type Notification = z.infer<typeof Notification>;


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
			try {
				await sendEmail(env, n);
			} catch (e) {
				return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
			}
			return { content: [{ type: "text", text: "Sent" }] };
		},
	);
	return server;
};

export default {
	async fetch(req, env, ctx) {
		const { pathname } = new URL(req.url);
		if (pathname === "/" && req.method === "GET") return startPage(env);
		if (pathname === "/setup" && req.method === "POST") return sendLink(req, env);
		const code = pathname.match(/^\/setup\/([0-9a-f]{64})$/)?.[1];
		if (code) return req.method === "POST" ? reveal(req, code, env) : confirmPage(code, env);

		const auth = await authorized(req, env);
		if (auth === "unset") return new Response("Not set up yet: open this URL in a browser to get your token.", { status: 401 });
		if (!auth) return new Response("Unauthorized", { status: 401 });

		if (pathname === "/mcp") return createMcpHandler(mcpServer(env))(req, env, ctx);

		if (req.method !== "POST") return new Response("POST only", { status: 405 });
		const parsed = Notification.safeParse(await req.json().catch(() => null));
		if (!parsed.success || (!parsed.data.html && !parsed.data.text))
			return Response.json({ ok: false, error: "Need subject plus html or text" }, { status: 400 });

		try {
			await sendEmail(env, parsed.data);
			return Response.json({ ok: true });
		} catch (e) {
			const limited = e instanceof DailyLimitError;
			return Response.json({ ok: false, error: limited ? e.message : String(e) }, { status: limited ? 429 : 502 });
		}
	},
} satisfies ExportedHandler<Env>;
