(function (window, document) {
  "use strict";

  var STORAGE = {
    MODE: "lab_tracking_mode",
    CART: "lab_cart",
    PENDING_ORDER: "lab_pending_order",
    DEBUG_CONSOLE: "lab_debug_console",
    DL_HISTORY: "lab_dl_history"
  };

  var MODES = ["standard", "cafe24", "makeshop", "godomall"];
  var MODE_PREFIX = {
    standard: "",
    cafe24: "CAFE24",
    makeshop: "MAKESHOP",
    godomall: "GODOMALL"
  };
  var DEFAULT_MODE = "standard";
  var CURRENCY = (window.LAB_DATA && window.LAB_DATA.currency) || "KRW";

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  }

  function deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (err) {
      return obj;
    }
  }

  function normalizeMode(mode) {
    var candidate = String(mode || "").toLowerCase();
    return MODES.indexOf(candidate) >= 0 ? candidate : DEFAULT_MODE;
  }

  function getMode() {
    return normalizeMode(localStorage.getItem(STORAGE.MODE));
  }

  function setMode(mode) {
    var nextMode = normalizeMode(mode);
    localStorage.setItem(STORAGE.MODE, nextMode);
    syncModeSelectors();
    syncModeBadges();
    renderDebugPanel();
    document.dispatchEvent(
      new CustomEvent("lab:modechange", {
        detail: { mode: nextMode }
      })
    );
  }

  function toUpperSnake(value) {
    return String(value || "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .toUpperCase();
  }

  function mapEventName(eventName) {
    var mode = getMode();
    if (mode === "standard") return eventName;
    return MODE_PREFIX[mode] + "_" + toUpperSnake(eventName);
  }

  function getDlHistory() {
    var raw = sessionStorage.getItem(STORAGE.DL_HISTORY);
    return safeJsonParse(raw, []);
  }

  function saveDlHistory(history) {
    sessionStorage.setItem(STORAGE.DL_HISTORY, JSON.stringify(history));
  }

  function isConsoleLoggingEnabled() {
    return localStorage.getItem(STORAGE.DEBUG_CONSOLE) === "1";
  }

  function setConsoleLogging(flag) {
    localStorage.setItem(STORAGE.DEBUG_CONSOLE, flag ? "1" : "0");
    renderDebugPanel();
  }

  function recordPush(payload) {
    var history = getDlHistory();
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

    if (window.dataLayer.length) {
      window.dataLayer.forEach(function (existingPush) {
        recordPush(existingPush);
      });
    }

    var originalPush = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function () {
      var args = Array.prototype.slice.call(arguments);
      args.forEach(function (entry) {
        recordPush(entry);
      });
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
    window.dataLayer.push(payload);
  }

  function pushEvent(eventName, payload) {
    var mappedName = mapEventName(eventName);
    var body = payload || {};
    var eventPayload = Object.assign({ event: mappedName }, body);
    dlPush(eventPayload);
    return eventPayload;
  }

  function pushEcomEvent(eventName, payload) {
    dlPush({ ecommerce: null });
    return pushEvent(eventName, payload || {});
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
    return Object.assign(item, extra || {});
  }

  function calcValue(items) {
    return (items || []).reduce(function (sum, item) {
      return sum + Number(item.price || 0) * Number(item.quantity || 1);
    }, 0);
  }

  function formatMoney(value) {
    var numberValue = Number(value || 0);
    return new Intl.NumberFormat("ko-KR").format(numberValue);
  }

  function getCart() {
    var raw = localStorage.getItem(STORAGE.CART);
    return safeJsonParse(raw, []);
  }

  function setCart(cart) {
    localStorage.setItem(STORAGE.CART, JSON.stringify(cart || []));
    updateCartBadge();
    renderDebugPanel();
  }

  function clearCart() {
    setCart([]);
  }

  function getCartCount() {
    return getCart().reduce(function (count, item) {
      return count + Number(item.quantity || 0);
    }, 0);
  }

  function addToCart(item) {
    var cart = getCart();
    var key = item.item_id + "::" + (item.item_variant || "");
    var index = cart.findIndex(function (cartItem) {
      return cartItem.item_id + "::" + (cartItem.item_variant || "") === key;
    });

    if (index >= 0) {
      cart[index].quantity =
        Number(cart[index].quantity || 0) + Number(item.quantity || 1);
    } else {
      cart.push(deepClone(item));
    }
    setCart(cart);
  }

  function updateCartBadge() {
    var count = String(getCartCount());
    document.querySelectorAll("[data-cart-count]").forEach(function (badge) {
      badge.textContent = count;
    });
  }

  function generateTransactionId() {
    var date = new Date();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    var hour = String(date.getHours()).padStart(2, "0");
    var minute = String(date.getMinutes()).padStart(2, "0");
    var second = String(date.getSeconds()).padStart(2, "0");
    var stamp = "" + year + month + day + hour + minute + second;
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var random = "";
    for (var i = 0; i < 8; i += 1) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return "T_" + stamp + "_" + random;
  }

  function savePendingOrder(order) {
    sessionStorage.setItem(STORAGE.PENDING_ORDER, JSON.stringify(order));
  }

  function getPendingOrder() {
    var raw = sessionStorage.getItem(STORAGE.PENDING_ORDER);
    return safeJsonParse(raw, null);
  }

  function clearPendingOrder() {
    sessionStorage.removeItem(STORAGE.PENDING_ORDER);
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function syncModeSelectors() {
    var currentMode = getMode();
    document.querySelectorAll("[data-tracking-mode]").forEach(function (select) {
      select.value = currentMode;
    });
  }

  function syncModeBadges() {
    var mode = getMode();
    document.querySelectorAll("[data-current-mode]").forEach(function (node) {
      node.textContent = mode;
    });
  }

  function bindModeSelectors() {
    document.querySelectorAll("[data-tracking-mode]").forEach(function (select) {
      if (select.dataset.bound === "1") return;
      select.dataset.bound = "1";
      select.addEventListener("change", function () {
        setMode(select.value);
      });
    });
  }

  function setActiveNav(pageId) {
    document.querySelectorAll("[data-nav-page]").forEach(function (link) {
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
      '  <div class="lab-debug-header">' +
      '    <strong>Debug Panel</strong>' +
      '    <button id="labDebugClose" type="button" class="lab-debug-close">Close</button>' +
      "  </div>" +
      '  <div class="lab-debug-grid">' +
      '    <section><h4>Current Mode</h4><pre id="labDebugMode"></pre></section>' +
      '    <section><h4>Cart State</h4><pre id="labDebugCart"></pre></section>' +
      '    <section class="wide"><h4>Latest dataLayer.push (20)</h4><pre id="labDebugHistory"></pre></section>' +
      "  </div>" +
      '  <label class="lab-debug-console">' +
      '    <input id="labDebugConsole" type="checkbox" /> Console log dataLayer.push' +
      "  </label>" +
      "</aside>";
    document.body.appendChild(container);

    var panel = document.getElementById("labDebugPanel");
    var toggle = document.getElementById("labDebugToggle");
    var close = document.getElementById("labDebugClose");
    var consoleCheckbox = document.getElementById("labDebugConsole");

    toggle.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderDebugPanel();
    });
    close.addEventListener("click", function () {
      panel.hidden = true;
    });
    consoleCheckbox.addEventListener("change", function () {
      setConsoleLogging(consoleCheckbox.checked);
    });
  }

  function renderDebugPanel() {
    var modeEl = document.getElementById("labDebugMode");
    var cartEl = document.getElementById("labDebugCart");
    var historyEl = document.getElementById("labDebugHistory");
    var checkbox = document.getElementById("labDebugConsole");
    if (!modeEl || !cartEl || !historyEl || !checkbox) return;

    var cart = getCart();
    var mode = getMode();
    var history = getDlHistory();
    var cartState = {
      count: getCartCount(),
      value: calcValue(cart),
      items: cart
    };

    modeEl.textContent = JSON.stringify({ mode: mode }, null, 2);
    cartEl.textContent = JSON.stringify(cartState, null, 2);
    historyEl.textContent = JSON.stringify(history, null, 2);
    checkbox.checked = isConsoleLoggingEnabled();
    syncModeBadges();
  }

  function initCommon(pageId) {
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
    getProducts: getProducts,
    getProductById: getProductById,
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
    clearPendingOrder: clearPendingOrder,
    getQueryParam: getQueryParam,
    initCommon: initCommon,
    renderDebugPanel: renderDebugPanel,
    isConsoleLoggingEnabled: isConsoleLoggingEnabled,
    setConsoleLogging: setConsoleLogging
  };
})(window, document);
