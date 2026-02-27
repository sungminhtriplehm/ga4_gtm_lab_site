# GA4 + GTM Static Mini Commerce Lab

정적 HTML 기반 GA4/GTM 실습용 미니 커머스 사이트입니다.  
백엔드/DB 없이 `dataLayer` 중심으로 이벤트를 다룹니다.

## 빠른 GA4 + GTM 설정 가이드 (간단)

1. GTM 컨테이너 생성 후 각 페이지의 슬롯에 스니펫 삽입
   - `<head>`: `<!-- GTM_HEAD_SLOT -->`
   - `<body>` 시작 직후: `<!-- GTM_BODY_SLOT -->`
2. GTM에서 GA4 Configuration 태그 1개 생성 (모든 페이지)
3. Data Layer Variable 생성
   - `event`, `ecommerce.items`, `value`, `currency`, `transaction_id`
4. GA4 Event 태그 생성
   - 표준 이벤트명 기준(`view_item_list`, `select_item` 등)
5. 누락 지점 3곳은 Custom HTML 태그로 `dataLayer.push` 실습
   - `product.html` add_to_cart, `thankyou.html` purchase, `form.html` form_submit
6. GTM Preview + GA4 DebugView로 동작 확인

## 페이지 구성

- `index.html`: 메인 상품 리스트
- `product.html`: 상품 상세
- `cart.html`: 장바구니
- `checkout.html`: 체크아웃
- `thankyou.html`: 구매완료
- `form.html`: 가짜 리드 폼
- `buttons.html`: 버튼 추적 실습
- `builder.html`: 플랫폼 구조 참고 페이지

## 이벤트 발생 맵

- `index.html`
  - `view_item_list` (로드 시 1회)
  - `select_item` (상세 이동 클릭 시)
  - `add_to_cart` (빠른 담기 클릭 시)
- `product.html`
  - `view_item` (로드 시 1회)
  - `add_to_cart`는 **페이지 코드에서 미전송**
- `cart.html`
  - `view_cart` (로드 시 1회)
  - `begin_checkout` (주문하기 클릭 시)
- `checkout.html`
  - `add_shipping_info` (배송정보 제출 버튼)
  - `add_payment_info` (결제정보 제출 버튼)
- `thankyou.html`
  - `purchase`는 **페이지 코드에서 미전송**
- `form.html`
  - `form_submit`은 **페이지 코드에서 미전송**
- `buttons.html`
  - 페이지 코드 자동 전송 없음 (GTM 클릭 트리거 실습용)

## Custom HTML 실습용 의도적 누락 3곳

1. `product.html`: `add_to_cart` 누락, `#btnAddToCart` dataset 제공
2. `thankyou.html`: `purchase` 누락, `#orderJson` + `sessionStorage` 주문 데이터 제공
3. `form.html`: `form_submit` 누락, 폼 DOM payload/속성 제공

## 플랫폼 참고

- 이 프로젝트는 GA4 표준 이벤트명으로 고정되어 있습니다.
- `builder.html`은 플랫폼별 DOM 구조 예시를 참고하기 위한 페이지입니다.

## GTM 최소 셋업 체크리스트

1. 변수 생성(Data Layer Variable)
   - `event`
   - `ecommerce.items`
   - `value`
   - `currency`
   - `transaction_id`
2. 트리거 생성
   - Page View (thankyou 구매 실습용)
   - Click (버튼/상품 담기 실습용)
   - Form Submission 또는 Click (폼 제출 실습용)
   - Custom Event (필요 시 커스텀 이벤트 수신용)
3. 태그 생성
   - GA4 Event 태그(표준 이벤트명 기준)
   - Custom HTML 태그(누락된 `add_to_cart`, `purchase`, `form_submit`을 `dataLayer.push`)

## 검증 방법

1. GTM Preview 모드 실행
2. 각 페이지 이동/클릭/폼 제출 수행
3. GA4 DebugView에서 이벤트 순서와 파라미터 확인
4. 하단 Debug Panel에서 최근 `dataLayer.push` 20건 확인

## 참고

- 모든 페이지는 다음 슬롯을 포함합니다.
  - `<head>`: `<!-- GTM_HEAD_SLOT -->`
  - `<body>` 시작 직후: `<!-- GTM_BODY_SLOT -->`
- 공통 로직은 `assets/app.js`, 상품 데이터는 `assets/data.js`에 있습니다.
