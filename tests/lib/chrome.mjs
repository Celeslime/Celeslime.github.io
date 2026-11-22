/* 找一个本机的 Chrome / Chromium 并以 headless + CDP 端口启动。
 * 优先级：CHROME_PATH 环境变量 → Playwright 浏览器缓存 → 系统安装路径。
 * 用 GitHub Actions 时先 `npx playwright install --with-deps chromium`，
 * 就会命中第二种（缓存目录）。 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const CANDIDATES = {
	win32: [
		"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
		"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
		"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
	],
	darwin: [
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium"
	],
	linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
};

function playwrightCacheRoots() {
	const home = os.homedir();
	if (process.platform === "win32") {
		return [path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "ms-playwright")];
	}
	if (process.platform === "darwin") return [path.join(home, "Library", "Caches", "ms-playwright")];
	return [path.join(home, ".cache", "ms-playwright")];
}

function fromPlaywrightCache() {
	const found = [];
	for (const root of playwrightCacheRoots()) {
		if (!existsSync(root)) continue;
		for (const dir of readdirSync(root)) {
			if (!/^chromium/.test(dir)) continue;
			const base = path.join(root, dir);
			const suffixes =
				process.platform === "win32"
					? ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"]
					: process.platform === "darwin"
						? ["chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium"]
						: ["chrome-linux/chrome", "chrome-linux64/chrome"];
			for (const suffix of suffixes) {
				const exe = path.join(base, suffix);
				if (existsSync(exe)) found.push(exe);
			}
		}
	}
	return found.sort().reverse();
}

export function findChrome() {
	const explicit = process.env.CHROME_PATH;
	if (explicit) {
		if (!existsSync(explicit)) throw new Error(`CHROME_PATH 指向的文件不存在：${explicit}`);
		return explicit;
	}
	for (const exe of [...fromPlaywrightCache(), ...(CANDIDATES[process.platform] || [])]) {
		if (existsSync(exe)) return exe;
	}
	throw new Error(
		"没找到 Chrome / Chromium：设置 CHROME_PATH，或先跑 `npx playwright install chromium`（CI 里加 --with-deps）"
	);
}

function freePort() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.once("error", reject);
		srv.listen(0, "127.0.0.1", () => {
			const { port } = srv.address();
			srv.close(() => resolve(port));
		});
	});
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome() {
	const exe = findChrome();
	const port = await freePort();
	const profile = mkdtempSync(path.join(os.tmpdir(), "cele-site-check-"));
	const child = spawn(
		exe,
		[
			"--headless=new",
			"--disable-gpu",
			"--hide-scrollbars",
			"--force-device-scale-factor=1",
			"--window-size=1280,900",
			`--remote-debugging-port=${port}`,
			`--user-data-dir=${profile}`,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-extensions",
			"about:blank"
		],
		{ stdio: "ignore" }
	);

	let version = null;
	for (let i = 0; i < 100 && !version; i++) {
		await sleep(150);
		try {
			version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
		} catch (e) {
			/* 还没起来，继续等 */
		}
	}
	if (!version) {
		child.kill();
		throw new Error("Chrome 启动超时（CDP 端口没响应）");
	}

	return {
		exe,
		port,
		version,
		kill: () => {
			try {
				child.kill();
			} catch (e) {}
		}
	};
}
