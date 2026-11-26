import { onRequestGet as __api_verify_js_onRequestGet } from "C:\\Users\\123\\Documents\\Trae-CN\\default\\imgtool\\functions\\api\\verify.js"
import { onRequestPost as __api_verify_js_onRequestPost } from "C:\\Users\\123\\Documents\\Trae-CN\\default\\imgtool\\functions\\api\\verify.js"

export const routes = [
    {
      routePath: "/api/verify",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_verify_js_onRequestGet],
    },
  {
      routePath: "/api/verify",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_verify_js_onRequestPost],
    },
  ]