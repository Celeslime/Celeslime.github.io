/* 静态文件服务：直接以仓库根目录为根，供检查脚本用。
 * 不依赖任何 npm 包；目录请求回落到 index.html。 */
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const MIME = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".webmanifest": "application/manifest+json"
};

export async function startServer(root) {
	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url, "http://127.0.0.1");
			let file = path.join(root, decodeURIComponent(url.pathname));
			if (!file.startsWith(root)) {
				res.writeHead(403).end("forbidden");
				return;
			}
			let info = await stat(file).catch(() => null);
			if (info && info.isDirectory()) {
				file = path.join(file, "index.html");
				info = await stat(file).catch(() => null);
			}
			if (!info || !info.isFile()) {
				/* 和 GitHub Pages 一样：页面导航落到 404.html，其它资源仍是纯文本 404 */
				const wantsHtml = (req.headers.accept || "").includes("text/html");
				const fallback = path.join(root, "404.html");
				const fallbackInfo = wantsHtml ? await stat(fallback).catch(() => null) : null;
				if (fallbackInfo && fallbackInfo.isFile()) {
					res.writeHead(404, {
						"Content-Type": "text/html; charset=utf-8",
						"Content-Length": fallbackInfo.size,
						"Cache-Control": "no-store"
					});
					createReadStream(fallback).pipe(res);
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found");
				return;
			}
			res.writeHead(200, {
				"Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
				"Content-Length": info.size,
				"Cache-Control": "no-store"
			});
			createReadStream(file).pipe(res);
		} catch (e) {
			res.writeHead(500).end(String(e && e.message));
		}
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address();
	return {
		url: `http://127.0.0.1:${port}`,
		close: () => new Promise((resolve) => server.close(resolve))
	};
}
