# GA4 + GTM Quickstart

## 1) GTM 삽입

- 모든 페이지 `<head>`: `<!-- GTM_HEAD_SLOT -->`
- 모든 페이지 `<body>` 시작 직후: `<!-- GTM_BODY_SLOT -->`

## 2) GTM 기본 구성

- GA4 Configuration Tag 1개 (All Pages)
- Data Layer Variables
  - `event`
  - `ecommerce.items`
  - `value`
  - `currency`
  - `transaction_id`

## 3) GA4 Event Tags

- 표준 이벤트명 사용:
  - `view_item_list`, `select_item`, `view_item`, `add_to_cart`
  - `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`

## 4) Custom HTML로 직접 push할 이벤트

- 상세 페이지: `add_to_cart` (버튼 dataset 사용)
- 구매완료 페이지: `purchase` (`#orderJson` 또는 `sessionStorage` 사용)
- 폼 페이지: `form_submit` (폼 DOM payload 사용)

## 5) 검증

- GTM Preview에서 트리거/태그 발화 확인
- GA4 DebugView에서 이벤트/파라미터 확인
- 페이지 하단 Debug Panel로 `dataLayer.push` 확인
