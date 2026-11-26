#!/usr/bin/env node
/**
 * Web 核心算法对拍校验（Node 端）
 * 读取 Python 生成的测试向量，用 core.js 计算并对比
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsDir = path.resolve(__dirname, '../js');

// 共享同一个 vm 对象，模拟浏览器全局环境
const vm = { ARMath: null, ARColor: null, ARBrowser: null, ARCore: null };

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(jsDir, relPath), 'utf-8');
  eval(code.replace('typeof self !== \'undefined\' ? self : this', 'vm'));
}

// 按依赖顺序加载
loadModule('math.js');
loadModule('color.js');
loadModule('browser.js');
loadModule('core.js');

// 合并到 AR（math + color + browser 覆盖 core 中的占位符）
const AR = {
  ...vm.ARMath,
  ...vm.ARColor,
  ...vm.ARBrowser,
  ...vm.ARCore
};

if (!AR) {
    console.error('❌ 无法加载 ARCore');
    process.exit(1);
}

// 读取测试向量
const vecPath = process.argv[2];
if (!vecPath) {
    console.error('用法: node web_parity_check.mjs <vectors.json>');
    process.exit(1);
}
const data = JSON.parse(fs.readFileSync(vecPath, 'utf-8'));

// ---------- 比较工具 ----------
function flattenToUint8(arr) {
    const flat = arr.flat ? arr.flat() : arr;
    return new Uint8Array(flat);
}

function compareArrays(name, got, expected, tol = 0) {
    const expFlat = expected.flat ? expected.flat() : expected;
    if (got.length !== expFlat.length) {
        throw new Error(`${name}: 长度不一致 got=${got.length} exp=${expFlat.length}`);
    }
    let maxDiff = 0;
    let diffCount = 0;
    for (let i = 0; i < got.length; i++) {
        const d = Math.abs(got[i] - expFlat[i]);
        if (d > tol) {
            diffCount++;
            if (d > maxDiff) maxDiff = d;
        }
    }
    if (diffCount > 0) {
        throw new Error(`${name}: ${diffCount} 个元素差异 >${tol}，最大差 ${maxDiff}`);
    }
}

let totalTests = 0, passed = 0, failed = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        passed++;
    } catch (e) {
        failed++;
        console.error(`❌ ${name}: ${e.message}`);
    }
}

// ---------- 1. pipeline 对拍 ----------
console.log('\n=== Pipeline 对拍 ===');

for (const tc of data.pipeline) {
    const { name, g1, g2, ref } = tc;
    const g1Arr = flattenToUint8(g1);
    const g2Arr = flattenToUint8(g2);
    const tolerance = tc.tolerance || 0;

    test(`${name}: autoXY`, () => {
        const [x, y, violating] = AR.autoXY(g1Arr, g2Arr, tolerance);
        if (x !== ref.x || y !== ref.y) throw new Error(`x,y 不符: got ${x},${y} exp ${ref.x},${ref.y}`);
        const expViol = ref.violating || [];
        if (violating.length !== expViol.length) {
            throw new Error(`violating 数量不符: got ${violating.length} exp ${expViol.length}`);
        }
        for (let k = 0; k < expViol.length; k++) {
            if (violating[k] !== expViol[k]) {
                throw new Error(`violating[${k}] 不符: got ${violating[k]} exp ${expViol[k]}`);
            }
        }
    });

    test(`${name}: applyMapping`, () => {
        const [, , violating] = AR.autoXY(g1Arr, g2Arr, tolerance);
        const { dark, light } = AR.applyMapping(g1Arr, g2Arr, ref.x, ref.y, violating);
        compareArrays('dark', dark, ref.dark);
        compareArrays('light', light, ref.light);
    });

    test(`${name}: derive`, () => {
        const [, , violating] = AR.autoXY(g1Arr, g2Arr, tolerance);
        const { dark, light } = AR.applyMapping(g1Arr, g2Arr, ref.x, ref.y, violating);
        const derived = AR.derive(dark, light);
        compareArrays('fg', derived.fg, ref.fg);
        compareArrays('ab', derived.ab, ref.ab);
        compareArrays('valid', derived.valid, ref.valid);
        if (derived.validCount !== ref.valid_count) throw new Error(`validCount: got ${derived.validCount} exp ${ref.valid_count}`);
        if (Math.abs(derived.semiPct - ref.semi_pct) > 0.1) throw new Error(`semiPct: got ${derived.semiPct} exp ${ref.semi_pct}`);
    });

    test(`${name}: computeErrors`, () => {
        const [, , violating] = AR.autoXY(g1Arr, g2Arr, tolerance);
        const { dark, light } = AR.applyMapping(g1Arr, g2Arr, ref.x, ref.y, violating);
        const derived = AR.derive(dark, light);
        const { errB, errW } = AR.computeErrors(dark, light, derived.fg, derived.ab);
        if (errB !== ref.errB || errW !== ref.errW) throw new Error(`err: got ${errB},${errW} exp ${ref.errB},${ref.errW}`);
    });
}

// ---------- 2. toGray 对拍 ----------
console.log('\n=== toGray 对拍 ===');
for (let i = 0; i < data.togray.length; i++) {
    const { rgba, ref_gray } = data.togray[i];
    const h = rgba.length;
    const w = rgba[0].length;
    const flat = new Uint8ClampedArray(w * h * 4);
    let idx = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            flat[idx++] = rgba[y][x][0];
            flat[idx++] = rgba[y][x][1];
            flat[idx++] = rgba[y][x][2];
            flat[idx++] = rgba[y][x][3];
        }
    }
    test(`togray_${i}`, () => {
        const got = AR.toGray(flat, w, h);
        compareArrays('gray', got, new Uint8Array(ref_gray.flat()));
    });
}

// ---------- 3. planUnify 对拍 ----------
console.log('\n=== planUnify 对拍 ===');
for (let i = 0; i < data.unify.length; i++) {
    const { w1, h1, w2, h2, ref_w, ref_h } = data.unify[i];
    test(`unify_${i} (${w1}x${h1}, ${w2}x${h2})`, () => {
        const plan = AR.planUnify(w1, h1, w2, h2);
        if (plan.w !== ref_w || plan.h !== ref_h) {
            throw new Error(`尺寸不符: got ${plan.w}x${plan.h} exp ${ref_w}x${ref_h}`);
        }
    });
}

// ---------- 总结 ----------
console.log(`\n=== 结果: ${passed}/${totalTests} 通过, ${failed} 失败 ===`);
if (failed > 0) process.exit(1);