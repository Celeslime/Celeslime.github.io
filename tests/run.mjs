/* 站点检查入口：node tests/run.mjs [--only guestbook,theme,interaction]
 * 零依赖：自己起静态服务、自己找 Chrome（可用 CHROME_PATH 指定）。
 * 全部通过退出码 0，有失败退出码 1。 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { start, wait } from "./lib/harness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const only = (() => {
	const i = process.argv.indexOf("--only");
	if (i === -1) return null;
	return process.argv[i + 1] ? process.argv[i + 1].split(",").map((s) => s.trim()) : null;
})();

let passed = 0;
let failed = 0;
const failures = [];
let current = "";

function check(name, ok, extra = "") {
	if (ok) {
		passed++;
		return;
	}
	failed++;
	const line = `${current} · ${name}${extra ? " → " + extra : ""}`;
	failures.push(line);
	console.log("  ✗ " + name + (extra ? " → " + extra : ""));
}

const files = (await readdir(path.join(here, "checks"))).filter((f) => f.endsWith(".mjs")).sort();
const env = await start();

try {
	for (const file of files) {
		const name = file.replace(/\.mjs$/, "");
		if (only && !only.includes(name)) continue;
		current = name;
		const mod = await import(new URL(`./checks/${file}`, import.meta.url));
		const title = mod.title || name;
		console.log(`\n▶ ${title}  (${name})`);
		const started = Date.now();
		try {
			await mod.default({ env, check, wait });
		} catch (e) {
			failed++;
			failures.push(`${name} · 中断：${e && e.message}`);
			console.log("  ✗ 检查中断：" + (e && e.message));
		}
		console.log(`  ${Date.now() - started}ms`);
	}
} finally {
	await env.close();
}

console.log("\n" + "─".repeat(60));
if (failed === 0) {
	console.log(`ALL PASS · ${passed} 项断言`);
	process.exit(0);
}
console.log(`${passed} 项通过，${failed} 项失败：`);
for (const line of failures) console.log("  - " + line);
process.exit(1);
