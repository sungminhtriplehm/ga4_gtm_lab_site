(function (window, document) {
  "use strict";

  var KEY = "lab_gtm_config_v1";
  var INJECTED_FLAG = "__LAB_GTM_HEAD_INJECTED";
  var HEAD_SCRIPT_ID = "labGtmHeadScript";

  function safeParse(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  function normalizeUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    if (value.indexOf("//") === 0) {
      value = "https:" + value;
    }
    return value;
  }

  function isAllowedGtmScriptSrc(src) {
    return /^https?:\/\/(www\.)?googletagmanager\.com\/gtm\.js(\?|$)/i.test(normalizeUrl(src));
  }

  function readConfig() {
    var raw;
    try {
      raw = window.localStorage ? window.localStorage.getItem(KEY) : null;
    } catch (err) {
      raw = null;
    }

    var config = safeParse(raw);
    if (!config || typeof config !== "object") return null;
    if (!isAllowedGtmScriptSrc(config.head_script_src || "")) return null;
    return config;
  }

  function hasAnyGtmScript() {
    return !!document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
  }

  function injectHeadScript() {
    if (window[INJECTED_FLAG]) return;

    var config = readConfig();
    if (!config) return;

    if (hasAnyGtmScript()) {
      window[INJECTED_FLAG] = true;
      return;
    }

    if (!document.head) return;

    var script = document.createElement("script");
    script.async = true;
    script.id = HEAD_SCRIPT_ID;
    script.src = normalizeUrl(config.head_script_src);
    document.head.appendChild(script);

    window[INJECTED_FLAG] = true;
  }

  injectHeadScript();
})(window, document);
