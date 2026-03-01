const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const params = new URLSearchParams(window.location.search);
const code = params.get("code") || "???";

const map = {
"400": "bad request",
"401": "unauthorized",
"403": "forbidden",
"404": "not found",
"405": "method not allowed",
"408": "request timeout",
"429": "too many requests",
"500": "internal server error",
"502": "bad gateway",
"503": "service unavailable",
"504": "gateway timeout",
};

const codeEl = document.getElementById("code");
const msgEl = document.getElementById("msg");

if (codeEl) codeEl.textContent = code;
if (msgEl) msgEl.textContent = map[code] || "error";
