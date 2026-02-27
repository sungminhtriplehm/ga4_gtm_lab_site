(function (window, document) {
  "use strict";

  var STORAGE = {
    CART: "lab_cart",
    PENDING_ORDER: "lab_pending_order",
    LAST_ORDER: "lab_last_order",
    DEBUG_CONSOLE: "lab_debug_console",
    DL_HISTORY: "lab_dl_history",
    GTM_CONFIG: "lab_gtm_config_v1"
  };

  var DEFAULT_MODE = "standard";
  var CURRENCY = (window.LAB_DATA && window.LAB_DATA.currency) || "KRW";
  var GTM_HEAD_MARKER_ATTR = "data-lab-gtm-head";
  var GTM_BODY_MARKER_ATTR = "data-lab-gtm-body";

  function assign(target) {
    var to = target || {};
    for (var i = 1; i < arguments.length; i += 1) {
      var source = arguments[i];
      if (!source) continue;
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          to[key] = source[key];
        }
      }
    }
    return to;
  }

  function forEachNode(selector, callback) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i += 1) {
      callback(nodes[i], i);
    }
  }

  function leftPad2(value) {
    var text = String(value);
    return text.length < 2 ? "0" + text : text;
  }

  function safeJsonParse(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    try {
      var parsed = JSON.parse(value);
      return parsed === null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function normalizeArray(value, fallback) {
    if (Array.isArray(value)) return value;
    return Array.isArray(fallback) ? fallback : [];
  }

  function readArrayFromStorage(store, key) {
    var parsed = safeJsonParse(store.getItem(key), []);
    if (Array.isArray(parsed)) return parsed;
    store.setItem(key, "[]");
    return [];
  }

  function normalizeUrl(url) {
    var text = String(url || "").trim();
    if (!text) return "";
    if (text.indexOf("//") === 0) {
      text = "https:" + text;
    }
    return text;
  }

  function isAllowedGtmScriptSrc(src) {
    return /^https?:\/\/(www\.)?googletagmanager\.com\/gtm\.js(\?|$)/i.test(normalizeUrl(src));
  }

  function isAllowedGtmIframeSrc(src) {
    return /^https?:\/\/(www\.)?googletagmanager\.com\/ns\.html(\?|$)/i.test(normalizeUrl(src));
  }

  function extractContainerIdFromUrl(url) {
    var normalized = normalizeUrl(url);
    var match = normalized.match(/[?&]id=(GTM-[A-Z0-9]+)/i);
    return match ? String(match[1]).toUpperCase() : null;
  }

  function extractAttributeUrls(html, tagName, attrName) {
    var values = [];
    var pattern = new RegExp("<" + tagName + "[^>]*\\s" + attrName + "\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>", "gi");
    var match;
    while ((match = pattern.exec(html))) {
      values.push(normalizeUrl(match[1]));
    }
    return values;
  }

  function deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (err) {
      return obj;
    }
  }

  function createStorageAdapter(type) {
    var nativeStorage = null;
    var errorLogged = false;
    try {
      nativeStorage = type === "local" ? window.localStorage : window.sessionStorage;
      var testKey = "__lab_storage_test__";
      nativeStorage.setItem(testKey, "1");
      nativeStorage.removeItem(testKey);
    } catch (err) {
      nativeStorage = null;
    }

    function logStorageError() {
      if (errorLogged) return;
      errorLogged = true;
      console.error("[LAB] " + type + "Storage unavailable. fallback is disabled.");
    }

    return {
      isAvailable: !!nativeStorage,
      getItem: function (key) {
        if (!nativeStorage) {
          logStorageError();
          return null;
        }
        try {
          return nativeStorage.getItem(key);
        } catch (err) {
          logStorageError();
          return null;
        }
      },
      setItem: function (key, value) {
        if (!nativeStorage) {
          logStorageError();
          return;
        }
        try {
          nativeStorage.setItem(key, String(value));
        } catch (err) {
          logStorageError();
        }
      },
      removeItem: function (key) {
        if (!nativeStorage) {
          logStorageError();
          return;
        }
        try {
          nativeStorage.removeItem(key);
        } catch (err) {
          logStorageError();
        }
      }
    };
  }

  var localStore = createStorageAdapter("local");
  var sessionStore = createStorageAdapter("session");

  function extractContainerIds(text) {
    var ids = String(text || "").match(/GTM-[A-Z0-9]+/gi) || [];
    var uniqueIds = [];
    for (var i = 0; i < ids.length; i += 1) {
      var id = String(ids[i]).toUpperCase();
      if (uniqueIds.indexOf(id) === -1) uniqueIds.push(id);
    }
    return uniqueIds;
  }

  function normalizeSnippet(text) {
    return String(text || "").trim();
  }

  function materializeSnippetNode(node, markerAttr) {
    if (node.nodeType === 3) {
      return document.createTextNode(node.textContent || "");
    }
    if (node.nodeType === 8) {
      return document.createComment(node.textContent || "");
    }
    if (node.nodeType !== 1) {
      return null;
    }

    if (node.tagName === "SCRIPT") {
      var script = document.createElement("script");
      for (var i = 0; i < node.attributes.length; i += 1) {
        var attr = node.attributes[i];
        script.setAttribute(attr.name, attr.value);
      }
      script.setAttribute(markerAttr, "1");
      script.text = node.text || node.textContent || "";
      return script;
    }

    var clone = node.cloneNode(true);
    clone.setAttribute(markerAttr, "1");
    return clone;
  }

  function injectHtmlSnippet(parent, snippetHtml, markerAttr, insertAtTop) {
    if (!parent) return false;
    var html = normalizeSnippet(snippetHtml);
    if (!html) return false;

    var template = document.createElement("template");
    template.innerHTML = html;
    var nodes = Array.prototype.slice.call(template.content.childNodes);
    if (!nodes.length) return false;

    var referenceNode = insertAtTop ? parent.firstChild : null;
    for (var i = 0; i < nodes.length; i += 1) {
      var materialized = materializeSnippetNode(nodes[i], markerAttr);
      if (!materialized) continue;
      if (insertAtTop) {
        parent.insertBefore(materialized, referenceNode);
      } else {
        parent.appendChild(materialized);
      }
    }
    return true;
  }

  function removeInjectedNodes(markerAttr) {
    forEachNode("[" + markerAttr + "]", function (node) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  function migrateLegacyGtmConfig(config) {
    if (!config || typeof config !== "object") return null;
    if (config.head_snippet) return config;
    if (!config.head_script_src) return config;

    var containerId = String(config.container_id || extractContainerIdFromUrl(config.head_script_src) || "").toUpperCase();
    var headSnippet = '<script async src="' + normalizeUrl(config.head_script_src) + '"></script>';
    var bodySnippet = "";
    if (config.body_iframe_src) {
      bodySnippet =
        '<noscript><iframe src="' + normalizeUrl(config.body_iframe_src) +
        '" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>';
    }

    return {
      container_id: containerId,
      head_snippet: headSnippet,
      body_snippet: bodySnippet,
      raw_head_snippet: config.raw_snippet || headSnippet,
      raw_body_snippet: bodySnippet,
      saved_at: config.saved_at || new Date().toISOString()
    };
  }

  function isValidGtmConfig(config) {
    if (!config || typeof config !== "object") return false;

    var containerId = String(config.container_id || "").toUpperCase();
    if (!/^GTM-[A-Z0-9]+$/.test(containerId)) return false;

    var headSnippet = normalizeSnippet(config.head_snippet);
    if (!headSnippet) return false;
    if (headSnippet.indexOf("googletagmanager.com") === -1) return false;

    var headIds = extractContainerIds(headSnippet);
    if (headIds.indexOf(containerId) === -1) return false;

    var headScriptSrcs = extractAttributeUrls(headSnippet, "script", "src");
    for (var i = 0; i < headScriptSrcs.length; i += 1) {
      if (!isAllowedGtmScriptSrc(headScriptSrcs[i])) return false;
    }

    var headIframeSrcs = extractAttributeUrls(headSnippet, "iframe", "src");
    for (var j = 0; j < headIframeSrcs.length; j += 1) {
      if (!isAllowedGtmIframeSrc(headIframeSrcs[j])) return false;
    }

    var bodySnippet = normalizeSnippet(config.body_snippet);
    if (bodySnippet) {
      if (bodySnippet.indexOf("googletagmanager.com/ns.html") === -1) return false;

      var bodyIds = extractContainerIds(bodySnippet);
      if (bodyIds.length && bodyIds.indexOf(containerId) === -1) return false;

      var bodyScriptSrcs = extractAttributeUrls(bodySnippet, "script", "src");
      for (var k = 0; k < bodyScriptSrcs.length; k += 1) {
        if (!isAllowedGtmScriptSrc(bodyScriptSrcs[k])) return false;
      }

      var bodyIframeSrcs = extractAttributeUrls(bodySnippet, "iframe", "src");
      for (var m = 0; m < bodyIframeSrcs.length; m += 1) {
        if (!isAllowedGtmIframeSrc(bodyIframeSrcs[m])) return false;
      }
    }

    return true;
  }

  function getGtmConfig() {
    var raw = localStore.getItem(STORAGE.GTM_CONFIG);
    var parsed = migrateLegacyGtmConfig(safeJsonParse(raw, null));
    if (!isValidGtmConfig(parsed)) {
      if (raw !== null) {
        localStore.removeItem(STORAGE.GTM_CONFIG);
      }
      return null;
    }
    return parsed;
  }

  function saveGtmConfig(config) {
    var normalized = migrateLegacyGtmConfig(config);
    if (!isValidGtmConfig(normalized)) {
      throw new Error("??? GTM ?? ??? ????.");
    }
    localStore.setItem(STORAGE.GTM_CONFIG, JSON.stringify(normalized));
    return normalized;
  }

  function clearGtmConfig() {
    localStore.removeItem(STORAGE.GTM_CONFIG);
    removeInjectedNodes(GTM_HEAD_MARKER_ATTR);
    removeInjectedNodes(GTM_BODY_MARKER_ATTR);

    var legacyHeadScript = document.getElementById("labGtmHeadScript");
    if (legacyHeadScript && legacyHeadScript.parentNode) {
      legacyHeadScript.parentNode.removeChild(legacyHeadScript);
    }
    var legacyBodySnippet = document.getElementById("labGtmBodySnippet");
    if (legacyBodySnippet && legacyBodySnippet.parentNode) {
      legacyBodySnippet.parentNode.removeChild(legacyBodySnippet);
    }

    window.__LAB_GTM_HEAD_INJECTED = false;
    window.__LAB_GTM_BODY_INJECTED = false;
  }

  function validateAndParseGtmSnippet(rawHeadSnippet, rawBodySnippet) {
    var headSnippet = normalizeSnippet(rawHeadSnippet);
    var bodySnippet = normalizeSnippet(rawBodySnippet);

    if (!headSnippet) {
      throw new Error("head ???? ?????.");
    }
    if (headSnippet.indexOf("googletagmanager.com") === -1) {
      throw new Error("head ????? googletagmanager.com ???? ?? ? ????.");
    }

    var headIds = extractContainerIds(headSnippet);
    if (headIds.length !== 1) {
      throw new Error("head ????? GTM ???? ID? 1?? ????? ???.");
    }
    var containerId = headIds[0];

    var headScriptSrcs = extractAttributeUrls(headSnippet, "script", "src");
    for (var i = 0; i < headScriptSrcs.length; i += 1) {
      if (!isAllowedGtmScriptSrc(headScriptSrcs[i])) {
        throw new Error("???? ?? head script src: " + headScriptSrcs[i]);
      }
    }

    var headIframeSrcs = extractAttributeUrls(headSnippet, "iframe", "src");
    for (var j = 0; j < headIframeSrcs.length; j += 1) {
      if (!isAllowedGtmIframeSrc(headIframeSrcs[j])) {
        throw new Error("???? ?? head iframe src: " + headIframeSrcs[j]);
      }
    }

    if (bodySnippet) {
      if (bodySnippet.indexOf("googletagmanager.com/ns.html") === -1) {
        throw new Error("body ???? googletagmanager.com/ns.html ????? ???.");
      }

      var bodyIds = extractContainerIds(bodySnippet);
      if (bodyIds.length > 1) {
        throw new Error("body ????? ??? GTM ID? ???? ???.");
      }
      if (bodyIds.length === 1 && bodyIds[0] !== containerId) {
        throw new Error("head/body ???? GTM ID? ?? ????.");
      }

      var bodyScriptSrcs = extractAttributeUrls(bodySnippet, "script", "src");
      for (var k = 0; k < bodyScriptSrcs.length; k += 1) {
        if (!isAllowedGtmScriptSrc(bodyScriptSrcs[k])) {
          throw new Error("???? ?? body script src: " + bodyScriptSrcs[k]);
        }
      }

      var bodyIframeSrcs = extractAttributeUrls(bodySnippet, "iframe", "src");
      for (var m = 0; m < bodyIframeSrcs.length; m += 1) {
        if (!isAllowedGtmIframeSrc(bodyIframeSrcs[m])) {
          throw new Error("???? ?? body iframe src: " + bodyIframeSrcs[m]);
        }
      }
    }

    return {
      container_id: containerId,
      head_snippet: headSnippet,
      body_snippet: bodySnippet,
      raw_head_snippet: headSnippet,
      raw_body_snippet: bodySnippet,
      saved_at: new Date().toISOString()
    };
  }

  function applyGtmBodySnippet() {
    var config = getGtmConfig();
    removeInjectedNodes(GTM_BODY_MARKER_ATTR);

    if (!config) return false;
    if (!normalizeSnippet(config.body_snippet)) return false;

    if (document.querySelector('noscript iframe[src*="googletagmanager.com/ns.html"]') &&
      !document.querySelector("[" + GTM_BODY_MARKER_ATTR + "]")) {
      window.__LAB_GTM_BODY_INJECTED = true;
      return true;
    }

    var body = document.body;
    if (!body) return false;
    var injected = injectHtmlSnippet(body, config.body_snippet, GTM_BODY_MARKER_ATTR, true);
    window.__LAB_GTM_BODY_INJECTED = injected;
    return injected;
  }

  function getMode() {
    return DEFAULT_MODE;
  }

  function setMode() {
    var eventObj;
    try {
      eventObj = new CustomEvent("lab:modechange", { detail: { mode: DEFAULT_MODE } });
    } catch (err) {
      eventObj = document.createEvent("CustomEvent");
      eventObj.initCustomEvent("lab:modechange", false, false, { mode: DEFAULT_MODE });
    }
    document.dispatchEvent(eventObj);
    syncModeSelectors();
    syncModeBadges();
    renderDebugPanel();
  }

  function mapEventName(eventName) {
    return eventName;
  }

  function getDlHistory() {
    return readArrayFromStorage(sessionStore, STORAGE.DL_HISTORY);
  }

  function saveDlHistory(history) {
    sessionStore.setItem(STORAGE.DL_HISTORY, JSON.stringify(history));
  }

  function isConsoleLoggingEnabled() {
    return localStore.getItem(STORAGE.DEBUG_CONSOLE) === "1";
  }

  function setConsoleLogging(flag) {
    localStore.setItem(STORAGE.DEBUG_CONSOLE, flag ? "1" : "0");
    renderDebugPanel();
  }

  function recordPush(payload) {
    var history = normalizeArray(getDlHistory(), []);
    history.unshift({
      pushed_at: new Date().toISOString(),
      payload: deepClone(payload)
    });
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    saveDlHistory(history);
  }

  function wrapDataLayerPush() {
    window.dataLayer = window.dataLayer || [];
    if (window.dataLayer.__labWrapped) return;

    var originalPush = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function () {
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i < args.length; i += 1) {
        recordPush(args[i]);
      }
      if (isConsoleLoggingEnabled()) {
        console.log("[LAB dataLayer.push]", args);
      }
      var result = originalPush.apply(window.dataLayer, args);
      renderDebugPanel();
      return result;
    };
    window.dataLayer.__labWrapped = true;
  }

  function dlPush(payload) {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.dataLayer.push !== "function") {
      throw new Error("dataLayer.push is not available");
    }
    window.dataLayer.push(payload);
  }

  function pushEvent(eventName, payload) {
    if (!eventName || typeof eventName !== "string") {
      throw new Error("eventName is required");
    }
    var mappedName = mapEventName(eventName);
    var body = payload || {};
    var eventPayload = assign({ event: mappedName }, body);
    dlPush(eventPayload);
    return eventPayload;
  }

  function pushEcomEvent(eventName, payload) {
    dlPush({ ecommerce: null });
    return pushEvent(eventName, payload || {});
  }

  function mustPushEcomEvent(eventName, payload) {
    var result = pushEcomEvent(eventName, payload || {});
    if (!result || result.event !== eventName) {
      throw new Error("mustPushEcomEvent failed: " + eventName);
    }
    return result;
  }

  function getProducts() {
    var products = (window.LAB_DATA && window.LAB_DATA.products) || [];
    return deepClone(products);
  }

  function getProductById(itemId) {
    var products = getProducts();
    for (var i = 0; i < products.length; i += 1) {
      if (products[i].item_id === itemId) return products[i];
    }
    return null;
  }

  function getProductUrl(itemId) {
    var product = getProductById(itemId);
    if (!product) throw new Error("Unknown product id: " + itemId);
    var slug = product.slug;
    if (!slug) {
      var digits = String(product.item_id || "").replace(/[^0-9]/g, "");
      if (!digits) throw new Error("Cannot build product URL: " + itemId);
      slug = "sku-" + digits.slice(-3);
    }
    return "product-" + slug + ".html";
  }

  function buildItem(product, quantity, extra) {
    var qty = Math.max(1, Number(quantity || 1));
    var item = {
      item_id: product.item_id,
      item_name: product.item_name,
      item_category: product.item_category,
      item_variant: product.item_variant || "default",
      price: Number(product.price || 0),
      quantity: qty
    };
    return assign(item, extra || {});
  }

  function calcValue(items) {
    return (items || []).reduce(function (sum, item) {
      return sum + Number(item.price || 0) * Number(item.quantity || 1);
    }, 0);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }

  function getCart() {
    return readArrayFromStorage(localStore, STORAGE.CART);
  }

  function setCart(cart) {
    localStore.setItem(STORAGE.CART, JSON.stringify(cart || []));
    updateCartBadge();
    renderDebugPanel();
  }

  function clearCart() {
    setCart([]);
  }

  function getCartCount() {
    var cart = normalizeArray(getCart(), []);
    return cart.reduce(function (count, item) {
      return count + Number(item.quantity || 0);
    }, 0);
  }

  function addToCart(item) {
    var cart = normalizeArray(getCart(), []);
    var key = item.item_id + "::" + (item.item_variant || "");
    var index = -1;
    for (var i = 0; i < cart.length; i += 1) {
      var currentKey = cart[i].item_id + "::" + (cart[i].item_variant || "");
      if (currentKey === key) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      cart[index].quantity = Number(cart[index].quantity || 0) + Number(item.quantity || 1);
    } else {
      cart.push(deepClone(item));
    }
    setCart(cart);
  }

  function updateCartBadge() {
    var count = String(getCartCount());
    forEachNode("[data-cart-count]", function (badge) {
      badge.textContent = count;
    });
  }

  function generateTransactionId() {
    var date = new Date();
    var stamp = "" + date.getFullYear() + leftPad2(date.getMonth() + 1) + leftPad2(date.getDate()) +
      leftPad2(date.getHours()) + leftPad2(date.getMinutes()) + leftPad2(date.getSeconds());
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var random = "";
    for (var i = 0; i < 8; i += 1) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return "T_" + stamp + "_" + random;
  }

  function savePendingOrder(order) {
    sessionStore.setItem(STORAGE.PENDING_ORDER, JSON.stringify(order));
  }

  function getPendingOrder() {
    var raw = sessionStore.getItem(STORAGE.PENDING_ORDER);
    return safeJsonParse(raw, null);
  }

  function saveLastOrder(order) {
    sessionStore.setItem(STORAGE.LAST_ORDER, JSON.stringify(order));
  }

  function getLastOrder() {
    var raw = sessionStore.getItem(STORAGE.LAST_ORDER);
    return safeJsonParse(raw, null);
  }

  function clearPendingOrder() {
    sessionStore.removeItem(STORAGE.PENDING_ORDER);
  }

  function getQueryParam(name) {
    var search = String(window.location.search || "");
    if (!search || search.length < 2) return null;
    var query = search.charAt(0) === "?" ? search.slice(1) : search;
    var pairs = query.split("&");
    for (var i = 0; i < pairs.length; i += 1) {
      var pair = pairs[i].split("=");
      var key = decodeURIComponent(pair[0] || "");
      if (key === name) {
        return decodeURIComponent(pair[1] || "");
      }
    }
    return null;
  }

  function syncModeSelectors() {
    var currentMode = getMode();
    forEachNode("[data-tracking-mode]", function (select) {
      select.value = currentMode;
    });
  }

  function syncModeBadges() {
    var mode = getMode();
    forEachNode("[data-current-mode]", function (node) {
      node.textContent = mode;
    });
  }

  function bindModeSelectors() {
    forEachNode("[data-tracking-mode]", function (select) {
      if (select.dataset.bound === "1") return;
      select.dataset.bound = "1";
      select.addEventListener("change", function () {
        setMode();
      });
    });
  }

  function setActiveNav(pageId) {
    forEachNode("[data-nav-page]", function (link) {
      if (link.getAttribute("data-nav-page") === pageId) {
        link.classList.add("active");
      }
    });
  }

  function injectDebugPanel() {
    if (document.getElementById("labDebugContainer")) return;

    var container = document.createElement("div");
    container.id = "labDebugContainer";
    container.className = "lab-debug-container";
    container.innerHTML =
      '<button id="labDebugToggle" class="lab-debug-toggle" type="button">Debug Panel</button>' +
      '<aside id="labDebugPanel" class="lab-debug-panel" hidden>' +
      '<div class="lab-debug-header"><strong>Debug Panel</strong>' +
      '<button id="labDebugClose" type="button" class="lab-debug-close">Close</button></div>' +
      '<div class="lab-debug-grid">' +
      '<section><h4>Current Mode</h4><pre id="labDebugMode"></pre></section>' +
      '<section><h4>Cart State</h4><pre id="labDebugCart"></pre></section>' +
      '<section class="wide"><h4>Latest dataLayer.push (20)</h4><pre id="labDebugHistory"></pre></section>' +
      '</div>' +
      '<label class="lab-debug-console"><input id="labDebugConsole" type="checkbox" /> Console log dataLayer.push</label>' +
      '</aside>';
    document.body.appendChild(container);

    var panel = document.getElementById("labDebugPanel");
    document.getElementById("labDebugToggle").addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderDebugPanel();
    });
    document.getElementById("labDebugClose").addEventListener("click", function () {
      panel.hidden = true;
    });
    document.getElementById("labDebugConsole").addEventListener("change", function (event) {
      setConsoleLogging(event.target.checked);
    });
  }

  function renderDebugPanel() {
    var modeEl = document.getElementById("labDebugMode");
    var cartEl = document.getElementById("labDebugCart");
    var historyEl = document.getElementById("labDebugHistory");
    var checkbox = document.getElementById("labDebugConsole");
    if (!modeEl || !cartEl || !historyEl || !checkbox) return;

    var cart = normalizeArray(getCart(), []);
    modeEl.textContent = JSON.stringify({ mode: getMode() }, null, 2);
    cartEl.textContent = JSON.stringify({
      count: getCartCount(),
      value: calcValue(cart),
      items: cart
    }, null, 2);
    historyEl.textContent = JSON.stringify(getDlHistory(), null, 2);
    checkbox.checked = isConsoleLoggingEnabled();
    syncModeBadges();
  }

  function initCommon(pageId) {
    applyGtmBodySnippet();
    bindModeSelectors();
    syncModeSelectors();
    syncModeBadges();
    updateCartBadge();
    setActiveNav(pageId);
    injectDebugPanel();
    renderDebugPanel();
  }

  wrapDataLayerPush();

  window.LAB = {
    currency: CURRENCY,
    getMode: getMode,
    setMode: setMode,
    mapEventName: mapEventName,
    pushEvent: pushEvent,
    pushEcomEvent: pushEcomEvent,
    mustPushEcomEvent: mustPushEcomEvent,
    getProducts: getProducts,
    getProductById: getProductById,
    getProductUrl: getProductUrl,
    buildItem: buildItem,
    calcValue: calcValue,
    formatMoney: formatMoney,
    getCart: getCart,
    setCart: setCart,
    clearCart: clearCart,
    getCartCount: getCartCount,
    addToCart: addToCart,
    updateCartBadge: updateCartBadge,
    generateTransactionId: generateTransactionId,
    savePendingOrder: savePendingOrder,
    getPendingOrder: getPendingOrder,
    saveLastOrder: saveLastOrder,
    getLastOrder: getLastOrder,
    clearPendingOrder: clearPendingOrder,
    getGtmConfig: getGtmConfig,
    saveGtmConfig: saveGtmConfig,
    clearGtmConfig: clearGtmConfig,
    applyGtmBodySnippet: applyGtmBodySnippet,
    validateAndParseGtmSnippet: validateAndParseGtmSnippet,
    getQueryParam: getQueryParam,
    initCommon: initCommon,
    renderDebugPanel: renderDebugPanel,
    isConsoleLoggingEnabled: isConsoleLoggingEnabled,
    setConsoleLogging: setConsoleLogging
  };
})(window, document);
