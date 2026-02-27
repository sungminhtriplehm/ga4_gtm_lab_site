(function (window, document) {
  "use strict";

  var KEY = "lab_gtm_config_v1";
  var INJECTED_FLAG = "__LAB_GTM_HEAD_INJECTED";
  var HEAD_MARKER_ATTR = "data-lab-gtm-head";

  function safeParse(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  function normalizeSnippet(text) {
    return String(text || "").trim();
  }

  function extractContainerIds(text) {
    var ids = String(text || "").match(/GTM-[A-Z0-9]+/gi) || [];
    var uniqueIds = [];
    for (var i = 0; i < ids.length; i += 1) {
      var id = String(ids[i]).toUpperCase();
      if (uniqueIds.indexOf(id) === -1) uniqueIds.push(id);
    }
    return uniqueIds;
  }

  function materializeSnippetNode(node, markerAttr) {
    if (node.nodeType === 3) return document.createTextNode(node.textContent || "");
    if (node.nodeType === 8) return document.createComment(node.textContent || "");
    if (node.nodeType !== 1) return null;

    if (node.tagName === "SCRIPT") {
      var script = document.createElement("script");
      for (var i = 0; i < node.attributes.length; i += 1) {
        script.setAttribute(node.attributes[i].name, node.attributes[i].value);
      }
      script.setAttribute(markerAttr, "1");
      script.text = node.text || node.textContent || "";
      return script;
    }

    var clone = node.cloneNode(true);
    clone.setAttribute(markerAttr, "1");
    return clone;
  }

  function injectHtmlSnippet(parent, snippetHtml, markerAttr) {
    if (!parent) return false;
    var html = normalizeSnippet(snippetHtml);
    if (!html) return false;

    var template = document.createElement("template");
    template.innerHTML = html;
    var nodes = Array.prototype.slice.call(template.content.childNodes);
    if (!nodes.length) return false;

    for (var i = 0; i < nodes.length; i += 1) {
      var node = materializeSnippetNode(nodes[i], markerAttr);
      if (!node) continue;
      parent.appendChild(node);
    }
    return true;
  }

  function hasAnyGtmScript() {
    return !!document.querySelector('script[src*="googletagmanager.com/gtm.js"]') ||
      !!document.querySelector("[" + HEAD_MARKER_ATTR + "]");
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

    if (!config.head_snippet && config.head_script_src) {
      config.head_snippet = '<script async src="' + String(config.head_script_src) + '"></script>';
      config.container_id = String(config.container_id || "").toUpperCase();
    }

    var headSnippet = normalizeSnippet(config.head_snippet);
    if (!headSnippet) return null;
    if (headSnippet.indexOf("googletagmanager.com") === -1) return null;

    var ids = extractContainerIds(headSnippet);
    if (ids.length < 1) return null;

    return config;
  }

  function injectHeadSnippet() {
    if (window[INJECTED_FLAG]) return;

    var config = readConfig();
    if (!config) return;
    if (!document.head) return;

    if (hasAnyGtmScript()) {
      window[INJECTED_FLAG] = true;
      return;
    }

    injectHtmlSnippet(document.head, config.head_snippet, HEAD_MARKER_ATTR);
    window[INJECTED_FLAG] = true;
  }

  injectHeadSnippet();
})(window, document);
