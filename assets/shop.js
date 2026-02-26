/**
 * GA4 + GTM ecommerce lab mini shop
 * - Static pages (GitHub Pages friendly)
 * - dataLayer 기반 이벤트 push (Custom Event trigger로 GTM에서 수집)
 *
 * 참고:
 *  - dataLayer는 GTM과 gtag.js가 데이터를 주고받는 JS 객체이며, event 키를 이용해 트리거가 동작합니다.
 *    (공식 문서: https://developers.google.com/tag-platform/tag-manager/datalayer)
 */

const CURRENCY = "KRW";

const CATALOG = [
  {
    item_id: "SKU_001",
    item_name: "SnapYourScope Notebook",
    item_brand: "LabShop",
    item_category: "Stationery",
    regular_price: 12000,
    member_price: 9900
  },
  {
    item_id: "SKU_002",
    item_name: "SnapYourScope Hoodie",
    item_brand: "LabShop",
    item_category: "Apparel",
    regular_price: 49000,
    member_price: 39000
  }
];

const STORAGE = {
  MEMBER: "lab_is_member",
  CART: "lab_cart",
  ORDER: "lab_pending_order",
  SENT: "lab_sent_purchase_ids"
};

function dlPush(obj) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(obj);
}

/**
 * GTM에서 stale 값(이전 items)이 남는 걸 방지하기 위해 ecommerce를 null로 한번 초기화.
 * (실무에서 자주 쓰는 패턴)
 */
function pushEcomEvent(eventName, payload) {
  dlPush({ ecommerce: null });
  dlPush(Object.assign({ event: eventName }, payload));
}

function isMember() {
  return localStorage.getItem(STORAGE.MEMBER) === "1";
}
function setMember(flag) {
  localStorage.setItem(STORAGE.MEMBER, flag ? "1" : "0");
}

function formatKRW(n) {
  try {
    return new Intl.NumberFormat("ko-KR").format(n);
  } catch (e) {
    return String(n);
  }
}

function getProduct(itemId) {
  return CATALOG.find(p => p.item_id === itemId);
}

function getPriceInfo(product, memberFlag = isMember()) {
  const price_type = memberFlag ? "member" : "regular";
  const price = memberFlag ? product.member_price : product.regular_price;
  const discount = memberFlag ? (product.regular_price - product.member_price) : 0;
  const item_variant = memberFlag ? "member" : "regular";
  return { price_type, price, discount, item_variant };
}

/**
 * GA4 items[]에 넣을 item 객체 생성
 * - price는 "할인 적용된 단가", discount는 "단가 할인액"으로 두는 게 권장됩니다.
 */
function buildItem(product, quantity = 1, ctx = {}) {
  const { price_type, price, discount, item_variant } = getPriceInfo(product, ctx.memberFlag);
  const item = {
    item_id: product.item_id,
    item_name: product.item_name,
    item_brand: product.item_brand,
    item_category: product.item_category,
    item_variant,
    price,
    quantity
  };

  if (discount > 0) item.discount = discount;

  // 리스트 컨텍스트(선택)
  if (ctx.item_list_id) item.item_list_id = ctx.item_list_id;
  if (ctx.item_list_name) item.item_list_name = ctx.item_list_name;
  if (Number.isFinite(ctx.index)) item.index = ctx.index;

  // "회원가/정가"를 item-scope 커스텀 파라미터로도 넣어보기(학습용)
  // GA4는 items 배열에 커스텀 파라미터를 추가할 수 있습니다.
  item.regular_price = product.regular_price;
  item.member_price = product.member_price;

  return { item, price_type };
}

function calcValue(items) {
  return items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
}

// ---------------- Cart helpers ----------------

function getCart() {
  try { return JSON.parse(localStorage.getItem(STORAGE.CART) || "[]"); }
  catch (e) { return []; }
}
function saveCart(cart) {
  localStorage.setItem(STORAGE.CART, JSON.stringify(cart));
  updateCartBadge();
}
function clearCart() {
  localStorage.removeItem(STORAGE.CART);
  updateCartBadge();
}
function cartCount() {
  return getCart().reduce((sum, it) => sum + Number(it.quantity || 0), 0);
}
function updateCartBadge() {
  const el = document.querySelector("[data-cart-count]");
  if (el) el.textContent = String(cartCount());
}

function addToCart(item) {
  const cart = getCart();
  const key = item.item_id + "::" + (item.item_variant || "");
  const idx = cart.findIndex(it => (it.item_id + "::" + (it.item_variant || "")) === key);
  if (idx >= 0) {
    cart[idx].quantity = Number(cart[idx].quantity || 0) + Number(item.quantity || 1);
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

// ---------------- UI helpers ----------------

function setMemberToggleUI() {
  const toggles = document.querySelectorAll("[data-member-toggle]");
  toggles.forEach(t => { t.checked = isMember(); });

  const labels = document.querySelectorAll("[data-member-label]");
  labels.forEach(l => { l.textContent = isMember() ? "회원가 ON" : "회원가 OFF"; });
}

function bindMemberToggle(onChange) {
  const toggles = document.querySelectorAll("[data-member-toggle]");
  toggles.forEach(t => {
    t.addEventListener("change", () => {
      setMember(t.checked);
      setMemberToggleUI();
      if (typeof onChange === "function") onChange();
    });
  });
}

// ---------------- Purchase de-dupe helpers ----------------

function getSentPurchases() {
  try { return JSON.parse(localStorage.getItem(STORAGE.SENT) || "[]"); }
  catch (e) { return []; }
}
function hasPurchaseSent(tid) {
  return getSentPurchases().includes(tid);
}
function markPurchaseSent(tid) {
  const arr = getSentPurchases();
  if (!arr.includes(tid)) {
    arr.push(tid);
    localStorage.setItem(STORAGE.SENT, JSON.stringify(arr));
  }
}