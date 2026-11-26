import { json } from "../../_lib/util.js";

// 前端轮询订单状态：GET /api/pay/status?no=xxx
export async function onRequestGet({ request, env }) {
  const no = new URL(request.url).searchParams.get("no") || "";
  if (!no) return json({ ok: false, error: "缺少订单号" }, 400);
  if (!env.CODES) return json({ ok: false, error: "服务未配置" }, 500);

  const raw = await env.CODES.get(`order:${no}`);
  if (!raw) return json({ ok: true, state: "unknown" });
  let rec = {};
  try {
    rec = JSON.parse(raw);
  } catch {}

  if (rec.state === "paid" && rec.code) return json({ ok: true, state: "paid", code: rec.code });
  return json({ ok: true, state: rec.state || "pending" });
}
