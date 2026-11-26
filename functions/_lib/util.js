// 共享工具（下划线目录不会被当成路由）

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function hmacHex(secret, msg) {
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

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function genCode(secret) {
  let id = "";
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 4; i++) id += ALPHABET[buf[i] % ALPHABET.length];
  const sig = (await hmacHex(secret, id)).slice(0, 8).toUpperCase();
  return { code: `TZ-${id}-${sig}`, id };
}

export const CODE_RE = /^TZ-([A-Z0-9]{4})-([A-F0-9]{8})$/;

/* ---- MD5（WebCrypto 不支持 MD5，聚合支付签名要用） ---- */
export function md5(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const len = bytes.length;
  const nWords = (((len + 8) >>> 6) + 1) * 16;
  const M = new Int32Array(nWords);
  for (let i = 0; i < len; i++) M[i >> 2] |= bytes[i] << ((i % 4) * 8);
  M[len >> 2] |= 0x80 << ((len % 4) * 8);
  M[nWords - 2] = (len * 8) >>> 0;

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = new Int32Array(64);
  for (let i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) | 0;

  for (let off = 0; off < nWords; off += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i] + M[off + g]) | 0;
      B = (B + ((sum << S[i]) | (sum >>> (32 - S[i])))) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }

  const hex = (n) => {
    let s = "";
    for (let i = 0; i < 4; i++) s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    return s;
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

// 易支付/彩虹易支付 签名规则：参数按 key 升序拼接 + key，再 md5
export function paySign(params, key) {
  const str = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return md5(str + key);
}
