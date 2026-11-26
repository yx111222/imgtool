import { json, hmacHex, CODE_RE } from "../_lib/util.js";

export async function onRequestPost({ request, env }) {
  const secret = env.TZ_CODE_SECRET;
  const kv = env.CODES;
  if (!secret || !kv) return json({ ok: false, error: "服务未配置，请联系客服" }, 500);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }

  const code = String(body?.code || "").trim().toUpperCase();
  const device = String(body?.device || "").slice(0, 64);

  const m = CODE_RE.exec(code);
  if (!m) return json({ ok: false, error: "激活码格式不正确" }, 400);

  const expect = (await hmacHex(secret, m[1])).slice(0, 8).toUpperCase();
  if (m[2] !== expect) return json({ ok: false, error: "激活码无效" }, 400);
  if (!device) return json({ ok: false, error: "缺少设备标识，请刷新页面重试" }, 400);

  const key = `code:${code}`;
  const raw = await kv.get(key);

  // 老码（未入库）：第一次使用即绑定当前设备
  if (!raw) {
    await kv.put(key, JSON.stringify({ device, at: Date.now(), src: "legacy" }));
    return json({ ok: true });
  }

  let rec = {};
  try {
    rec = JSON.parse(raw);
  } catch {}

  if (rec.unused) {
    rec.unused = false;
    rec.device = device;
    rec.at = Date.now();
    await kv.put(key, JSON.stringify(rec));
    return json({ ok: true });
  }

  if (rec.device === device) return json({ ok: true, reused: true });
  return json({ ok: false, error: "该激活码已在其他设备激活，如有疑问请联系客服" }, 409);
}

export function onRequestGet() {
  return json({ ok: false, error: "只支持 POST" }, 405);
}
