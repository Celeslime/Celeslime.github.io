/* avatar-run.js —— avatar.svg 的调用脚本。
 * SVG 作为文档（直接访问 / iframe / object）加载时执行：
 * 按 ?name= 等参数用 FlowerGen.generateAvatar 动态自绘并替换内容。
 * 作为 <img src> 引用时脚本不执行，avatar.svg 将显示内置默认花。 */
(function () {
	"use strict";
	if (typeof FlowerGen === "undefined" || typeof document === "undefined") return;

	function q(k) {
		var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.search || "");
		return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : undefined;
	}

	var opts = {}, v;
	v = q("size");        if (v !== undefined) opts.size = parseInt(v, 10) || 128;
	v = q("grid");        if (v !== undefined) opts.grid = (v === "1" || v === "true");
	v = q("color");       if (v !== undefined) opts.color = v;
	v = q("bg");          if (v !== undefined) opts.bg = v;
	v = q("petals");      if (v !== undefined) opts.petals = parseInt(v, 10);
	v = q("fillopacity"); if (v !== undefined) opts.fillOpacity = parseFloat(v);
	v = q("rotation");    if (v !== undefined) opts.rotation = parseFloat(v);
	v = q("res");         if (v !== undefined) opts.res = parseInt(v, 10);

	var svgStr = FlowerGen.generateAvatar(q("name") || "", opts);
	var root = document.documentElement;
	var head = svgStr.slice(0, svgStr.indexOf(">"));
	var inner = svgStr.slice(head.length + 1, svgStr.lastIndexOf("</svg>"));
	var re = function (k) { var m = head.match(new RegExp(k + '="([^"]*)"')); return m ? m[1] : null; };
	var w = re("width"), h = re("height"), vb = re("viewBox");
	if (w) root.setAttribute("width", w);
	if (h) root.setAttribute("height", h);
	if (vb) root.setAttribute("viewBox", vb);
	root.innerHTML = inner;
})();
