/* 检查用的运行环境：本地静态服务 + headless Chrome + 一个 CDP 页面封装。
 * 页面封装里顺手把 cele-api 的请求 mock 掉（留言 / 访问量），这样离线也能跑。 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { startServer } from "./server.mjs";
import { launchChrome } from "./chrome.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const FIXTURES = path.resolve(here, "../fixtures");

async function loadFixtures() {
	const [comments, empty] = await Promise.all([
		readFile(path.join(FIXTURES, "mock-comments.json"), "utf8"),
		readFile(path.join(FIXTURES, "empty-comments.json"), "utf8")
	]);
	return { comments, empty };
}

export async function start(options = {}) {
	const server = await startServer(options.root || repoRoot);
	const chrome = await launchChrome();
	const fixtures = await loadFixtures();
	let closed = false;

	async function openPage({ width = 1280, height = 900 } = {}) {
		const target = await (
			await fetch(`http://127.0.0.1:${chrome.port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })
		).json();
		const ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			ws.onopen = resolve;
			ws.onerror = reject;
		});

		let seq = 0;
		const pending = new Map();
		const errors = [];
		const paused = [];

		ws.onmessage = (ev) => {
			const msg = JSON.parse(ev.data);
			if (msg.id && pending.has(msg.id)) {
				const { resolve, reject } = pending.get(msg.id);
				pending.delete(msg.id);
				msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
				return;
			}
			if (msg.method === "Fetch.requestPaused") paused.push(msg.params);
			if (msg.method === "Runtime.exceptionThrown") {
				const d = msg.params.exceptionDetails;
				errors.push("exception: " + (d.exception?.description || d.text));
			}
			if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
				errors.push("log: " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
			}
		};

		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const id = ++seq;
				pending.set(id, { resolve, reject });
				ws.send(JSON.stringify({ id, method, params }));
			});

		/* 把 API 请求排空（mock 留言与访问量），其它请求继续。
		 * stats 用的是 credentials:include，所以 Access-Control-Allow-Origin 必须回显 Origin。 */
		const pump = setInterval(() => {
			while (paused.length) {
				const p = paused.shift();
				const isComments = p.request.url.includes("/api/comments");
				const body = isComments ? fixtures.comments : JSON.stringify({ ok: true, total: 1234 });
				const origin = p.request.headers.Origin || p.request.headers.origin || "*";
				send("Fetch.fulfillRequest", {
					requestId: p.requestId,
					responseCode: 200,
					responseHeaders: [
						{ name: "Content-Type", value: "application/json; charset=utf-8" },
						{ name: "Access-Control-Allow-Origin", value: origin },
						{ name: "Access-Control-Allow-Credentials", value: "true" },
						{ name: "Vary", value: "Origin" }
					],
					body: Buffer.from(body, "utf8").toString("base64")
				}).catch(() => {});
			}
		}, 10);

		const evaluate = async (expression) => {
			const r = await send("Runtime.evaluate", {
				expression: `(async () => { ${expression} })()`,
				awaitPromise: true,
				returnByValue: true
			});
			if (r.exceptionDetails) {
				const d = r.exceptionDetails;
				throw new Error(d.exception?.description || d.text);
			}
			return r.result.value;
		};

		await send("Page.enable");
		await send("Runtime.enable");
		await send("Log.enable");
		await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 520 });
		await send("Fetch.enable", {
			patterns: [
				{ urlPattern: "*cele-api.pages.dev/api/comments*", requestStage: "Request" },
				{ urlPattern: "*cele-api.pages.dev/api/stats*", requestStage: "Request" }
			]
		});

		const page = {
			send,
			evaluate,
			errors,
			/* 进页面 → 写 localStorage → 重载，保证主题在首次绘制时就正确 */
			async load(pathname, storage = {}) {
				await send("Page.navigate", { url: server.url + pathname });
				await wait(700);
				await evaluate(`
					localStorage.clear();
					${Object.entries(storage)
						.map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
						.join("\n")}
					localStorage.setItem("vis", "1");
					return 1;
				`);
				await send("Page.reload", { ignoreCache: true });
				await wait(900);
			},
			async setViewport(width, height = 900) {
				await send("Emulation.setDeviceMetricsOverride", {
					width,
					height,
					deviceScaleFactor: 1,
					mobile: width < 520
				});
				await evaluate("window.dispatchEvent(new Event('resize')); return 1;");
				await wait(450);
			},
			async close() {
				clearInterval(pump);
				try {
					ws.close();
				} catch (e) {}
				await fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(() => {});
			}
		};
		return page;
	}

	return {
		SITE: server.url,
		openPage,
		mockComments: fixtures.comments,
		async close() {
			if (closed) return;
			closed = true;
			chrome.kill();
			await server.close();
		}
	};
}
