import { json, genCode } from "../../_lib/util.js";

// 人工发码：POST /api/admin/codes  header: x-admin-token
export async function onRequestPost({ request, env }) {
  const token = request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
    return json({ ok: false, error: "未授权" }, 401);
  if (!env.TZ_CODE_SECRET || !env.CODES)
    return json({ ok: false, error: "服务未配置" }, 500);

  let count = 1;
  try {
    const b = await request.json();
    count = Number(b?.count || 1);
  } catch {}
  count = Math.max(1, Math.min(200, count | 0));

  const codes = [];
  for (let i = 0; i < count; i++) {
    const { code } = await genCode(env.TZ_CODE_SECRET);
    await env.CODES.put(
      `code:${code}`,
      JSON.stringify({ unused: true, device: null, src: "admin", at: Date.now() })
    );
    codes.push(code);
  }
  return json({ ok: true, codes });
}
