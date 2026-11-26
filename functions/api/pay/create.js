import { json, paySign } from "../../_lib/util.js";

// 创建支付订单：POST /api/pay/create  { plan?: "pro" }
// 需要环境变量：PAY_PID / PAY_KEY / PAY_GATEWAY（易支付兼容网关），可选 PAY_TYPE / PAY_AMOUNT
export async function onRequestPost({ request, env }) {
  const pid = env.PAY_PID;
  const key = env.PAY_KEY;
  const gateway = env.PAY_GATEWAY;
  if (!pid || !key || !gateway) return json({ ok: false, error: "支付通道未配置" }, 503);
  if (!env.CODES || !env.TZ_CODE_SECRET) return json({ ok: false, error: "服务未配置" }, 500);

  const origin = new URL(request.url).origin;
  const no =
    "TZ" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

  const params = {
    pid,
    type: env.PAY_TYPE || "wxpay",
    out_trade_no: no,
    notify_url: `${origin}/api/pay/notify`,
    return_url: `${origin}/`,
    name: "图压压 Pro 永久版",
    money: env.PAY_AMOUNT || "9.90",
    sitename: "图压压",
  };
  params.sign = paySign(params, key);
  params.sign_type = "MD5";

  await env.CODES.put(`order:${no}`, JSON.stringify({ state: "pending", at: Date.now() }), {
    expirationTtl: 3600,
  });

  const url = `${String(gateway).replace(/\/+$/, "")}/submit.php?` + new URLSearchParams(params).toString();
  return json({ ok: true, no, url });
}
