#!/usr/bin/env node
/**
 * 激活码发放脚本（只在你自己电脑上跑，密钥绝不提交到仓库）
 *
 * 用法：
 *   PowerShell:  $env:TZ_CODE_SECRET="你的密钥"; node tools/gen-code.mjs 10
 *   Bash:        TZ_CODE_SECRET=你的密钥 node tools/gen-code.mjs 10
 *
 * 输出 10 个一次性发给买家的激活码。密钥必须与 Pages 项目里的 TZ_CODE_SECRET 完全一致。
 */
import { createHmac, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const secret = process.env.TZ_CODE_SECRET;

if (!secret) {
  console.error("缺少环境变量 TZ_CODE_SECRET，请先设置后再运行。");
  process.exit(1);
}

const count = Math.max(1, Math.min(500, Number(process.argv[2] || 1)));
const codes = new Set();

while (codes.size < count) {
  let id = "";
  for (let i = 0; i < 4; i++) id += ALPHABET[randomInt(ALPHABET.length)];
  const sig = createHmac("sha256", secret).update(id).digest("hex").slice(0, 8).toUpperCase();
  codes.add(`TZ-${id}-${sig}`);
}

console.log([...codes].join("\n"));
