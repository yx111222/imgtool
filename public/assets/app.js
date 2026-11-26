/* 图压压 —— 纯前端图片工具
 * 压缩 / 格式转换 / 尺寸裁剪，全部在浏览器本地完成，图片不离开设备。
 *
 * 激活码：由服务端 /api/verify 校验（Cloudflare Pages Function + 密钥签名），
 * 源码里不含任何可用激活码。发码请用 tools/gen-code.mjs。
 */
const FREE_MAX_FILES = 3;
const FREE_MAX_QUALITY = 0.8;
const PRO_MAX_QUALITY = 0.95;
const PRO_KEY = "tzy_pro";

const state = {
  mode: "compress",
  files: [],
  urls: [],
  isPro: localStorage.getItem(PRO_KEY) === "1",
};

const $ = (sel) => document.querySelector(sel);
const bytes = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB");

/* ---------------- 初始化 ---------------- */
function init() {
  const fileInput = $("#fileInput");
  const dropZone = $("#dropZone");

  $("#pickBtn").addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target.id !== "fileInput") fileInput.click();
  });
  fileInput.addEventListener("change", (e) => addFiles([...e.target.files]));
  fileInput.addEventListener("click", (e) => (e.target.value = ""));

  ["dragenter", "dragover"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag");
    })
  );
  dropZone.addEventListener("drop", (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    addFiles(files);
  });

  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => switchMode(tab.dataset.tab))
  );

  $("#quality").addEventListener("input", (e) => {
    $("#qualityVal").textContent = Number(e.target.value).toFixed(2);
  });
  $("#convertQuality").addEventListener("input", (e) => {
    $("#convertQualityVal").textContent = Number(e.target.value).toFixed(2);
  });

  $("#runBtn").addEventListener("click", run);
  $("#clearBtn").addEventListener("click", clearAll);
  $("#downloadAllBtn").addEventListener("click", downloadAll);

  $("#proBtn").addEventListener("click", openPro);
  $("#proBtn2").addEventListener("click", openPro);
  $("#payBtn").addEventListener("click", startPay);
  $("#closeModal").addEventListener("click", () => {
    stopPoll();
    $("#proModal").classList.add("hidden");
  });
  $("#proModal").addEventListener("click", (e) => {
    if (e.target.id === "proModal") {
      stopPoll();
      $("#proModal").classList.add("hidden");
    }
  });
  $("#activateBtn").addEventListener("click", activate);
  $("#codeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") activate();
  });

  const payImg = $("#payImg");
  const payPh = $("#payPlaceholder");
  payImg.addEventListener("load", () => (payPh.style.display = "none"));
  payImg.addEventListener("error", () => (payPh.style.display = "grid"));
  // 图片可能在本脚本执行前就已加载完成（缓存命中），此时 load 事件已错过
  if (payImg.complete) {
    payPh.style.display = payImg.naturalWidth > 0 ? "none" : "grid";
  }

  applyProState();
}

function applyProState() {
  const q = $("#quality");
  q.max = state.isPro ? PRO_MAX_QUALITY : FREE_MAX_QUALITY;
  if (Number(q.value) > Number(q.max)) q.value = q.max;
  $("#qualityVal").textContent = Number(q.value).toFixed(2);

  const cq = $("#convertQuality");
  cq.max = state.isPro ? PRO_MAX_QUALITY : FREE_MAX_QUALITY;
  if (Number(cq.value) > Number(cq.max)) cq.value = cq.max;
  $("#convertQualityVal").textContent = Number(cq.value).toFixed(2);

  $("#downloadAllBtn").classList.toggle("hidden", !state.isPro);
  $("#dropHint").textContent = state.isPro
    ? "支持 JPG / PNG / WebP · Pro 已解锁，批量不限张数"
    : `支持 JPG / PNG / WebP · 免费版单次最多 ${FREE_MAX_FILES} 张`;
  ["#proBtn", "#proBtn2"].forEach((s) => {
    const el = $(s);
    if (el) el.textContent = state.isPro ? "Pro 已开通" : s === "#proBtn" ? "开通 Pro" : "立即开通 Pro";
  });
}

function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === mode));
  $("#compressOpts").classList.toggle("hidden", mode !== "compress");
  $("#convertOpts").classList.toggle("hidden", mode !== "convert");
  $("#cropOpts").classList.toggle("hidden", mode !== "crop");
  clearResults();
}

/* ---------------- 选文件 ---------------- */
function addFiles(files) {
  const imgs = files.filter((f) => f.type.startsWith("image/"));
  if (!imgs.length) {
    setStatus("请选择图片文件（JPG / PNG / WebP 等）", true);
    return;
  }
  const limit = state.isPro ? Infinity : FREE_MAX_FILES;
  const room = limit - state.files.length;
  if (room <= 0) {
    setStatus(`免费版单次最多 ${FREE_MAX_FILES} 张，升级 Pro 可批量不限张数`, true);
    openPro();
    return;
  }
  const accepted = imgs.slice(0, room);
  state.files.push(...accepted);
  if (accepted.length < imgs.length) {
    setStatus(`已选择 ${accepted.length} 张，超出的 ${imgs.length - accepted.length} 张因免费版限额被跳过`, true);
  } else {
    setStatus(`已选择 ${state.files.length} 张图片`);
  }
  syncActions();
}

function syncActions() {
  const has = state.files.length > 0;
  $("#runBtn").disabled = !has;
  $("#clearBtn").disabled = !has;
  $("#runBtn").textContent = has ? `开始处理（${state.files.length} 张）` : "开始处理";
}

function setStatus(msg, isError = false) {
  const el = $("#status");
  el.textContent = msg || "";
  el.classList.toggle("error", !!isError);
}

/* ---------------- 图片处理 ---------------- */
async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch (_) {
      /* 降级到 Image */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(Object.assign(img, { __url: url }));
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解码失败"));
    };
    img.src = url;
  });
}

function releaseSource(src) {
  if (!src) return;
  if (src.close) src.close();
  if (src.__url) URL.revokeObjectURL(src.__url);
}

function pickFormat(file, mode) {
  if (mode === "convert") return $("#convertFormat").value;
  const sel = $("#format").value;
  if (sel !== "auto") return sel;
  const t = file.type;
  if (t === "image/png" || t === "image/jpeg" || t === "image/webp") return t;
  if (t === "image/gif" || t === "image/bmp") return "image/png";
  return "image/jpeg";
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function compressSize(iw, ih, maxEdge) {
  if (!maxEdge) return [iw, ih];
  const longest = Math.max(iw, ih);
  if (longest <= maxEdge) return [iw, ih];
  const s = maxEdge / longest;
  return [Math.round(iw * s), Math.round(ih * s)];
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("导出失败，可能是浏览器不支持该格式"))),
      type,
      type === "image/png" ? undefined : quality
    );
  });
}

async function processOne(file) {
  const src = await decode(file);
  const iw = src.width || src.naturalWidth;
  const ih = src.height || src.naturalHeight;

  let tw = iw;
  let th = ih;
  let quality = state.isPro ? PRO_MAX_QUALITY : FREE_MAX_QUALITY;

  if (state.mode === "compress") {
    [tw, th] = compressSize(iw, ih, Number($("#maxEdge").value));
    quality = Math.min(Number($("#quality").value), Number($("#quality").max));
  } else if (state.mode === "convert") {
    quality = Math.min(Number($("#convertQuality").value), Number($("#convertQuality").max));
  } else {
    const [pw, ph] = $("#preset").value.split("x").map(Number);
    tw = pw;
    th = ph;
    quality = state.isPro ? PRO_MAX_QUALITY : FREE_MAX_QUALITY;
  }

  if (!state.isPro && quality > FREE_MAX_QUALITY) quality = FREE_MAX_QUALITY;

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";

  const type = pickFormat(file, state.mode);
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, tw, th);
  }

  if (state.mode === "crop") {
    const s = Math.max(tw / iw, th / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(src, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(src, 0, 0, tw, th);
  }

  const blob = await canvasToBlob(canvas, type, quality);
  releaseSource(src);

  const base = file.name.replace(/\.[^.]+$/, "");
  const suffix = state.mode === "compress" ? "-compressed" : state.mode === "convert" ? "-converted" : `-${tw}x${th}`;
  return {
    name: `${base}${suffix}.${EXT[type] || "jpg"}`,
    blob,
    before: file.size,
    after: blob.size,
    w: tw,
    h: th,
  };
}

async function run() {
  if (!state.files.length) return;
  const btn = $("#runBtn");
  btn.disabled = true;
  clearResults();

  const total = state.files.length;
  let ok = 0;
  for (let i = 0; i < total; i++) {
    setStatus(`正在处理 ${i + 1} / ${total} …`);
    try {
      const out = await processOne(state.files[i]);
      renderResult(out);
      ok++;
    } catch (err) {
      console.error(err);
      setStatus(`第 ${i + 1} 张处理失败：${err.message}`, true);
    }
  }
  setStatus(`完成 ${ok} / ${total} 张${ok < total ? "，部分图片处理失败" : ""}`, ok < total);
  btn.disabled = false;
}

function renderResult(out) {
  const url = URL.createObjectURL(out.blob);
  state.urls.push(url);
  const save = out.before > 0 ? Math.max(0, Math.round((1 - out.after / out.before) * 100)) : 0;
  const card = document.createElement("div");
  card.className = "result";
  card.innerHTML = `
    <div class="result-thumb"><img alt="" src="${url}" /></div>
    <div class="result-body">
      <div class="result-name" title="${out.name}">${out.name}</div>
      <div class="result-meta">
        <span>${out.w}×${out.h}</span>
        <span class="save">${save > 0 ? "↓ " + save + "%" : "—"}</span>
      </div>
      <div class="result-meta"><span>${bytes(out.before)}</span><span>→ ${bytes(out.after)}</span></div>
      <a class="dl" href="${url}" download="${out.name}">下载</a>
    </div>`;
  $("#results").appendChild(card);
  card.querySelector("a.dl").dataset.name = out.name;
  return card;
}

function downloadAll() {
  const links = [...document.querySelectorAll("#results a.dl")];
  if (!links.length) {
    setStatus("还没有可下载的结果", true);
    return;
  }
  links.forEach((a, i) => setTimeout(() => a.click(), i * 350));
}

function clearResults() {
  state.urls.forEach((u) => URL.revokeObjectURL(u));
  state.urls = [];
  $("#results").innerHTML = "";
}

function clearAll() {
  clearResults();
  state.files = [];
  syncActions();
  setStatus("");
}

/* ---------------- 激活 ---------------- */
function openPro() {
  $("#modalMsg").textContent = "";
  $("#modalMsg").className = "modal-msg";
  $("#proModal").classList.remove("hidden");
  if (state.isPro) {
    $("#modalMsg").textContent = "你已经是 Pro 用户，感谢支持！";
    $("#modalMsg").className = "modal-msg ok";
  }
}

async function activate() {
  const input = $("#codeInput").value.trim().toUpperCase();
  const msg = $("#modalMsg");
  const btn = $("#activateBtn");
  if (!input) {
    msg.textContent = "请输入激活码";
    msg.className = "modal-msg err";
    return;
  }

  btn.disabled = true;
  btn.textContent = "验证中…";
  msg.textContent = "";
  msg.className = "modal-msg";

  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: input, device: deviceId() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      localStorage.setItem(PRO_KEY, "1");
      state.isPro = true;
      applyProState();
      msg.textContent = "激活成功，Pro 已解锁！";
      msg.className = "modal-msg ok";
      setTimeout(() => $("#proModal").classList.add("hidden"), 1200);
    } else {
      msg.textContent = data.error || "激活码无效，请核对后重试";
      msg.className = "modal-msg err";
    }
  } catch (_) {
    msg.textContent = "验证服务暂时不可用，请稍后再试或联系客服";
    msg.className = "modal-msg err";
  } finally {
    btn.disabled = false;
    btn.textContent = "激活";
  }
}

/* 设备标识：一码绑一台设备 */
function deviceId() {
  let d = localStorage.getItem("tz_device");
  if (!d) {
    d = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
    localStorage.setItem("tz_device", d);
  }
  return d;
}

/* 在线支付 → 回调自动发码 → 轮询取码自动激活 */
let pollTimer = null;

function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function startPay() {
  const btn = $("#payBtn");
  const msg = $("#modalMsg");
  btn.disabled = true;
  btn.textContent = "创建订单…";
  msg.textContent = "";
  msg.className = "modal-msg";
  try {
    const res = await fetch("/api/pay/create", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      msg.textContent = (data.error || "支付通道暂时不可用") + "，请扫码付款后联系客服获取激活码";
      msg.className = "modal-msg err";
      return;
    }
    window.open(data.url, "_blank");
    msg.textContent = "已打开支付页，付款完成后本页会自动激活，请勿关闭…";
    pollOrder(data.no);
  } catch (_) {
    msg.textContent = "网络异常，请稍后重试";
    msg.className = "modal-msg err";
  } finally {
    btn.disabled = false;
    btn.textContent = "微信支付 ¥9.9 · 自动激活";
  }
}

function pollOrder(no) {
  stopPoll();
  const started = Date.now();
  pollTimer = setInterval(async () => {
    if (Date.now() - started > 5 * 60 * 1000) {
      stopPoll();
      return;
    }
    try {
      const r = await fetch(`/api/pay/status?no=${encodeURIComponent(no)}`);
      const d = await r.json();
      if (d.state === "paid" && d.code) {
        stopPoll();
        $("#codeInput").value = d.code;
        activate();
      }
    } catch (_) {
      /* 网络抖动忽略，继续轮询 */
    }
  }, 3000);
}

init();
