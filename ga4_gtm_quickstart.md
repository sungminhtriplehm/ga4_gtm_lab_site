# GA4 + GTM Quickstart

## 1) GTM Setup 페이지에서 1회 설정

- `gtm-setup.html` 접속
- 공식 GTM 전체 스니펫(head + noscript) 붙여넣기
- `저장/적용` 클릭
- 저장 후 모든 페이지에서 자동 주입

## 2) 초기화(원복)

- `gtm-setup.html`에서 `초기화` 클릭
- localStorage 설정 제거 + 주입된 GTM 요소 제거 후 새로고침

## 3) GTM 기본 구성

- GA4 Configuration Tag 1개 (All Pages)
- Data Layer Variables
  - `event`
  - `ecommerce.items`
  - `value`
  - `currency`
  - `transaction_id`

## 4) GA4 Event Tags

- 표준 이벤트명 사용:
  - `view_item_list`, `select_item`, `view_item`, `add_to_cart`
  - `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`

## 5) Custom HTML로 직접 push할 이벤트

- 상세 페이지: `add_to_cart` (버튼 dataset 사용)
- 구매완료 페이지: `purchase` (`#orderJson` 또는 `sessionStorage` 사용)
- 폼 페이지: `form_submit` (폼 DOM payload 사용)

## 6) 검증

- GTM Preview에서 트리거/태그 발화 확인
- GA4 DebugView에서 이벤트/파라미터 확인
- 페이지 하단 Debug Panel로 `dataLayer.push` 확인
