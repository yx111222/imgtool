# 图压压 · 免费在线图片压缩工具

图压压是一个完全在浏览器本地运行的图片处理工具：批量压缩、格式转换（JPG/PNG/WebP）、按平台尺寸裁剪（小红书封面、公众号首图、抖音、头像、证件照等）。

- 在线使用：https://imgtool-7bw.pages.dev
- 图片不上传服务器，压缩/转换/裁剪全部在本地完成，隐私安全。
- 免费版单次最多 3 张；Pro 永久版解锁不限张数、最高画质、一键全部下载。

## 支持我们

如果这个工具帮到了你，欢迎在爱发电支持作者，让项目持续免费维护：

**爱发电主页：https://afdian.com/a/imgtool-7bw**

## 技术栈

- 前端：原生 HTML / CSS / JavaScript（Canvas + File API）
- 部署：Cloudflare Pages
- 服务端：Cloudflare Pages Functions + KV（激活码校验、设备绑定）

## 本地开发

```bash
npx wrangler@latest pages dev ./public
```

## 部署

```bash
npx wrangler@latest pages deploy --project-name imgtool --branch main --commit-dirty=true
```
