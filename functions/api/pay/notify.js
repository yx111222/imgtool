import { paySign, genCode } from "../../_lib/util.js";

// 聚合支付异步回调：GET/POST /api/pay/notify
// 校验签名 → 生成一码一用的激活码 → 写入订单，前端轮询 /api/pay/status 自动取码
async function handle(request, env) {
  if (!env.PAY_KEY) return new Response("fail", { status: 503 });

  const url = new URL(request.url);
  let p = Object.fromEntries(url.searchParams);
  if (request.method === "POST") {
    try {
      const form = await request.formData();
      if ([...form.keys()].length) p = Object.fromEntries(form);
    } catch {}
  }

  const sign = p.sign;
  const payload = { ...p };
  delete payload.sign;
  delete payload.sign_type;
  if (!sign || paySign(payload, env.PAY_KEY) !== sign) return new Response("fail");

  if (p.trade_status !== "TRADE_SUCCESS") return new Response("success");

  const no = p.out_trade_no;
  if (!no) return new Response("fail");

  const existing = await env.CODES.get(`order:${no}`);
  if (existing) {
    try {
      if (JSON.parse(existing).state === "paid") return new Response("success");
    } catch {}
  }

  const { code } = await genCode(env.TZ_CODE_SECRET);
  await env.CODES.put(
    `code:${code}`,
    JSON.stringify({ unused: true, device: null, src: "pay", order: no, at: Date.now() })
  );
  await env.CODES.put(
    `order:${no}`,
    JSON.stringify({ state: "paid", code, money: p.money, at: Date.now() }),
    { expirationTtl: 86400 }
  );
  return new Response("success");
}

export function onRequestGet(ctx) {
  return handle(ctx.request, ctx.env);
}
export function onRequestPost(ctx) {
  return handle(ctx.request, ctx.env);
}
