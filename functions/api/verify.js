/**
 * Pages Function: POST /api/verify
 * 校验激活码。激活码由服务端密钥签名，源码里不再包含任何可用明文码。
 *
 * 绑定要求：Pages 项目环境变量 TZ_CODE_SECRET（用 wrangler pages secret put 设置）
 * 码格式：TZ-<4位ID>-<8位签名>
 */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  const secret = env.TZ_CODE_SECRET;
  if (!secret) return json({ ok: false, error: "服务未配置，请联系客服" }, 500);

  let code = "";
  try {
    const body = await request.json();
    code = String(body?.code || "").trim().toUpperCase();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }

  const m = /^TZ-([A-Z0-9]{4})-([A-F0-9]{8})$/.exec(code);
  if (!m) return json({ ok: false, error: "激活码格式不正确" }, 400);

  const [, id, sig] = m;
  const expect = (await hmacHex(secret, id)).slice(0, 8).toUpperCase();

  if (sig !== expect) return json({ ok: false, error: "激活码无效" }, 400);
  return json({ ok: true });
}

export function onRequestGet() {
  return json({ ok: false, error: "只支持 POST" }, 405);
}
