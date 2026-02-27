(function (window, document) {
  "use strict";

  var STORAGE = {
    CART: "lab_cart",
    PENDING_ORDER: "lab_pending_order",
    LAST_ORDER: "lab_last_order",
    DEBUG_CONSOLE: "lab_debug_console",
    DL_HISTORY: "lab_dl_history"
  };

  var DEFAULT_MODE = "standard";
  var CURRENCY = (window.LAB_DATA && window.LAB_DATA.currency) || "KRW";

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

  function createStorageAdapter(type) {
    var nativeStorage = null;
    var unavailableLogged = false;
    try {
      nativeStorage = type === "local" ? window.localStorage : window.sessionStorage;
      var testKey = "__lab_storage_test__";
      nativeStorage.setItem(testKey, "1");
      nativeStorage.removeItem(testKey);
    } catch (err) {
      nativeStorage = null;
    }

    function logUnavailable() {
      if (unavailableLogged) return;
      unavailableLogged = true;
      console.error("[LAB] " + type + "Storage is unavailable. state persistence is disabled.");
    }

    return {
      isAvailable: !!nativeStorage,
      getItem: function (key) {
        if (!nativeStorage) {
          logUnavailable();
          return null;
        }
        try {
          return nativeStorage.getItem(key);
        } catch (err) {
          nativeStorage = null;
          logUnavailable();
          return null;
        }
      },
      setItem: function (key, value) {
        if (!nativeStorage) {
          logUnavailable();
          return;
        }
        var nextValue = String(value);
        try {
          nativeStorage.setItem(key, nextValue);
        } catch (err) {
          nativeStorage = null;
          logUnavailable();
        }
      },
      removeItem: function (key) {
        if (!nativeStorage) {
          logUnavailable();
          return;
        }
        try {
          nativeStorage.removeItem(key);
        } catch (err) {
          nativeStorage = null;
          logUnavailable();
        }
      }
    };
  }

  var localStore = createStorageAdapter("local");
  var sessionStore = createStorageAdapter("session");

  function getMode() {
    return DEFAULT_MODE;
  }

  function setMode() {
    var nextMode = DEFAULT_MODE;
    syncModeSelectors();
    syncModeBadges();
    renderDebugPanel();
    var eventObj;
    try {
      eventObj = new CustomEvent("lab:modechange", { detail: { mode: nextMode } });
    } catch (err) {
      eventObj = document.createEvent("CustomEvent");
      eventObj.initCustomEvent("lab:modechange", false, false, { mode: nextMode });
    }
    document.dispatchEvent(eventObj);
  }

  function toUpperSnake(value) {
    return String(value || "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .toUpperCase();
  }

  function mapEventName(eventName) {
    return eventName;
  }

  function getDlHistory() {
    var raw = sessionStore.getItem(STORAGE.DL_HISTORY);
    return safeJsonParse(raw, []);
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
    return assign(item, extra || {});
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
    var raw = localStore.getItem(STORAGE.CART);
    return safeJsonParse(raw, []);
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
    return getCart().reduce(function (count, item) {
      return count + Number(item.quantity || 0);
    }, 0);
  }

  function addToCart(item) {
    var cart = getCart();
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
      cart[index].quantity =
        Number(cart[index].quantity || 0) + Number(item.quantity || 1);
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
    var year = date.getFullYear();
    var month = leftPad2(date.getMonth() + 1);
    var day = leftPad2(date.getDate());
    var hour = leftPad2(date.getHours());
    var minute = leftPad2(date.getMinutes());
    var second = leftPad2(date.getSeconds());
    var stamp = "" + year + month + day + hour + minute + second;
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
    saveLastOrder: saveLastOrder,
    getLastOrder: getLastOrder,
    clearPendingOrder: clearPendingOrder,
    getQueryParam: getQueryParam,
    initCommon: initCommon,
    renderDebugPanel: renderDebugPanel,
    isConsoleLoggingEnabled: isConsoleLoggingEnabled,
    setConsoleLogging: setConsoleLogging
  };
})(window, document);
