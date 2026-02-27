# GA4 + GTM Static Mini Commerce Lab

정적 HTML 기반 GA4/GTM 실습용 미니 커머스 사이트입니다. 백엔드/DB 없이 `dataLayer.push` 흐름만 검증합니다.

## 페이지 구성

- `index.html`: 메인 상품 목록
- `product-sku-001.html`: 상세 1
- `product-sku-002.html`: 상세 2
- `product-sku-003.html`: 상세 3
- `cart.html`: 장바구니
- `checkout.html`: 체크아웃
- `thankyou.html`: 구매완료
- `form.html`: 폼 추적 실습
- `buttons.html`: 버튼 클릭 추적 실습 + 실시간 이벤트 로그
- `builder.html`: 플랫폼 DOM 구조 참고 페이지
- `gtm-setup.html`: GTM 전체 스니펫 1회 설정/초기화 페이지

## 전자상거래 이벤트 발생 지점

- `index.html`
  - `view_item_list` (페이지 로드 1회)
  - `select_item` (상세 보기 클릭 시 must-push)
  - `add_to_cart` (빠른 담기 클릭)
- `product-sku-001/002/003.html`
  - `view_item` (페이지 로드 1회)
  - `add_to_cart`는 페이지 코드에서 전송하지 않음 (의도적 누락)
- `cart.html`
  - `view_cart` (페이지 로드 1회)
  - `begin_checkout` (주문하기 클릭)
- `checkout.html`
  - `add_shipping_info` (배송정보 제출)
  - `add_payment_info` (결제정보 제출)
- `thankyou.html`
  - `purchase`는 페이지 코드에서 전송하지 않음 (의도적 누락)
- `form.html`
  - `form_submit`는 페이지 코드에서 전송하지 않음 (의도적 누락)

## 버튼 실습 페이지 이벤트 (`buttons.html`)

버튼 클릭 시 페이지 코드에서 `LAB.pushEvent(...)`로 아래 이벤트를 전송합니다.

- `cta_click` (`#btnCtaPrimary`, `#btnCtaSecondary`)
- `phone_click` (`#btnCall`)
- `file_download_click` (`#btnDownload`)
- `outbound_click` (`#btnExternal`)
- `modal_open` (`#btnOpenModal`)
- `modal_close` (`#btnCloseButtonModal`)

또한 페이지 하단의 실시간 로그 UI에서 확인할 수 있습니다.

- `#buttonEventStatus`: 마지막 전송 성공/실패 상태
- `#buttonEventLog`: 최근 버튼 이벤트 JSON (최대 30개)

## 의도적 push 누락 3지점

1. 상세 페이지(`product-sku-001/002/003.html`)의 `add_to_cart`
   - `#btnAddToCart` dataset 제공
   - `data-sku`, `data-name`, `data-price`, `data-category`, `data-currency`, `data-quantity`, `data-variant`
2. `thankyou.html`의 `purchase`
   - `#orderJson` + `sessionStorage` 주문 데이터 제공
3. `form.html`의 `form_submit`
   - 폼 payload를 DOM attribute/`#formPayload`로 제공

## must-push 정책

- 메인 상세 이동은 `select_item` 전송 성공 시에만 이동합니다.
- 실패 시 이동이 차단되고 화면에 오류 메시지가 표시됩니다.

## GTM 최소 셋업 체크리스트

1. `gtm-setup.html`에서 공식 GTM 전체 스니펫(head + noscript) 입력 후 `저장/적용`
   - `googletagmanager.com` 도메인만 허용
   - 저장 후 모든 페이지에서 자동 주입
2. 필요 시 `gtm-setup.html`의 `초기화` 버튼으로 원복
   - localStorage 설정 삭제
   - 주입된 GTM script/iframe 제거
3. Variables (Data Layer Variable)
   - `event`, `ecommerce.items`, `value`, `currency`, `transaction_id`
4. Triggers
   - Page View, Click, Form Submission, Custom Event
5. Tags
   - GA4 Event 태그(표준 이벤트명)
   - Custom HTML 태그(누락된 `add_to_cart`, `purchase`, `form_submit` push)

## 빠른 검증 시나리오

1. `index.html`에서 상세 보기 클릭 -> 상세 페이지 이동 확인
2. `index.html` 빠른 담기 클릭 -> 카트 배지 증가 확인
3. `product-sku-001/002/003.html`에서 장바구니 담기 클릭 -> `cart.html` 수량 반영 확인
4. `buttons.html`에서 버튼 클릭 -> `#buttonEventStatus`, `#buttonEventLog` 갱신 확인
5. GTM Preview + GA4 DebugView에서 이벤트/파라미터 확인

## GTM Setup 페이지 동작 요약

- 저장 키: `localStorage.lab_gtm_config_v1`
- 저장 데이터:
  - `container_id`
  - `head_script_src`
  - `body_iframe_src`
  - `raw_snippet`
  - `saved_at`
- 자동 적용:
  - head: `assets/gtm-head-bootstrap.js`가 `gtm.js` script 주입
  - body: `LAB.applyGtmBodySnippet()`가 noscript iframe 주입
- 주의:
  - 이 기능은 브라우저 저장소(localStorage) 기준이므로 브라우저/프로필별로 설정이 다를 수 있음

## 참고

- 모든 HTML 페이지는 아래 두 슬롯을 포함합니다.
  - `<!-- GTM_HEAD_SLOT -->`
  - `<!-- GTM_BODY_SLOT -->`
- 이벤트명은 GA4 표준 이벤트명을 사용합니다.
- GTM 설정 변경은 `gtm-setup.html`에서 가능하며, 기능 반영 이후에는 추가 git push 없이 운영 가능합니다.
