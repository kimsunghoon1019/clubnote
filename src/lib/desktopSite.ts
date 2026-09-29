import { CONSOLE_MIN_PX } from "./compact";

/**
 * 갤럭시 S24 기본 화면은 360px다.
 * 크롬 PC 버전은 기종과 상관없이 레이아웃을 980px로 펼친다.
 * 삼성 인터넷은 UA만 `X11; Linux x86_64`로 바꾸고 너비는 360px로 남기는 경우가 있어,
 * 그 UA이고 아직 980보다 좁으면 viewport를 980 하나로 맞춘다.
 * Next가 `width=device-width` 메타를 다시 넣으면 관찰해서 같은 값으로 되돌린다.
 */
export const desktopSiteBoot = `(function(){try{if(window.__clubnoteDesktopSite)return;var ua=navigator.userAgent||"";if(!/X11;\\s*Linux x86_64|Windows NT/i.test(ua)||/Mobile/i.test(ua))return;if(!(navigator.maxTouchPoints>0))return;window.__clubnoteDesktopSite=1;var content="width=${CONSOLE_MIN_PX}, initial-scale=1, viewport-fit=cover";function apply(){var metas=document.querySelectorAll('meta[name="viewport"]');if(metas.length===1&&metas[0].getAttribute("content")===content)return;if(window.innerWidth>=${CONSOLE_MIN_PX}&&metas.length<=1)return;for(var i=metas.length-1;i>=0;i--)metas[i].parentNode.removeChild(metas[i]);var meta=document.createElement("meta");meta.setAttribute("name","viewport");meta.setAttribute("content",content);(document.head||document.documentElement).appendChild(meta);}apply();new MutationObserver(apply).observe(document.head||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["content"]});}catch(e){}})();`;

export function applyDesktopSiteViewport() {
  if (typeof window === "undefined") return;
  new Function(desktopSiteBoot)();
}
