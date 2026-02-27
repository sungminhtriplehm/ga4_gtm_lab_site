# GA4_GTM Quickstart (요약)

1. 각 페이지의 GTM 슬롯에 컨테이너 스니펫 삽입
   - `<head>`: `<!-- GTM_HEAD_SLOT -->`
   - `<body>` 시작 직후: `<!-- GTM_BODY_SLOT -->`
2. GTM에서 GA4 Configuration 태그 1개 생성 (All Pages)
3. Data Layer Variable 생성
   - `event`
   - `ecommerce.items`
   - `value`
   - `currency`
   - `transaction_id`
4. GA4 Event 태그 생성 (표준 이벤트명 기준)
   - `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `view_cart`
   - `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`
5. 의도적 누락 3개는 GTM Custom HTML로 push
   - `product.html`: `add_to_cart`
   - `thankyou.html`: `purchase`
   - `form.html`: `form_submit`
6. GTM Preview + GA4 DebugView로 검증
