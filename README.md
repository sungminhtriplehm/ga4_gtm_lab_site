# GA4 + GTM Static Mini Commerce Lab

정적 HTML 기반 GA4/GTM 실습용 미니 커머스 사이트입니다. 백엔드/DB 없이 `dataLayer.push` 흐름만 검증합니다.

## 1. 실습 목표

이 프로젝트에서 아래를 직접 실습합니다.

1. GA4 권장 전자상거래 이벤트 흐름 검증
2. GTM 기본 구성(Variables / Triggers / Tags)
3. 의도적 누락 이벤트를 GTM Custom HTML로 보완
4. 버튼/폼 추적 구성
5. GTM Preview + GA4 DebugView 검증

## 2. 페이지 구성

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
- `gtm-setup.html`: GTM head/body 스니펫 1회 설정/초기화 페이지

## 3. 사전 준비

1. GA4 속성 + Web 데이터 스트림 생성
2. GTM 컨테이너 생성
3. 측정용 브라우저 준비
4. 로컬 실행

예시(Windows PowerShell):

```powershell
cd C:\Users\user\Desktop\ga4\ga4-gtm-lab-site
python -m http.server 5500
```

접속: `http://localhost:5500/index.html`

## 4. GTM 스니펫 1회 연결

### 4.1 GTM Setup 페이지에서 스니펫 저장

1. `http://localhost:5500/gtm-setup.html` 접속
2. GTM에서 복사한 Head 스니펫을 `Head 스니펫 (필수)`에 붙여넣기
3. GTM에서 복사한 Body 스니펫을 `Body 스니펫 (선택)`에 붙여넣기
4. `저장/적용` 클릭
5. `현재 설정 확인` 클릭 후 `container_id`, `saved_at` 확인

### 4.2 동작 방식

- head: 저장된 `head_snippet`을 `</head>` 직전에 그대로 주입
- body: 저장된 `body_snippet`이 있을 때만 `<body>` 시작부에 주입
- 저장 키: `localStorage.lab_gtm_config_v1`

저장 객체 예시:

```json
{
  "container_id": "GTM-XXXXXXX",
  "head_snippet": "...",
  "body_snippet": "...",
  "raw_head_snippet": "...",
  "raw_body_snippet": "...",
  "saved_at": "2026-02-27T12:34:56.000Z"
}
```

### 4.3 초기화(원복)

- `gtm-setup.html`에서 `초기화` 클릭
- 저장값 삭제 + 주입 노드 제거 + 새로고침

## 5. 이 사이트 이벤트 설계

### 5.1 전자상거래 이벤트(페이지 코드에서 발생)

- `index.html`
  - `view_item_list`
  - `select_item` (must-push 성공 시 이동)
  - `add_to_cart` (빠른 담기)
- `product-sku-001/002/003.html`
  - `view_item`
- `cart.html`
  - `view_cart`
  - `remove_from_cart` (장바구니 비우기 클릭)
  - `begin_checkout`
- `checkout.html`
  - `add_shipping_info`
  - `add_payment_info`

### 5.2 의도적 누락 이벤트(직접 GTM으로 보완)

- 상세 페이지 `add_to_cart` 누락
- `thankyou.html`의 `purchase` 누락
- `form.html`의 `form_submit` 누락

## 6. GTM 기본 세팅 (먼저 1회)

## 6.1 Variables 생성

아래 Data Layer Variable 생성:

- `DLV - event` -> `event`
- `DLV - ecommerce.items` -> `ecommerce.items`
- `DLV - value` -> `value`
- `DLV - currency` -> `currency`
- `DLV - transaction_id` -> `transaction_id`

## 6.2 GA4 Configuration Tag 생성

- Tag Type: `Google Analytics: GA4 Configuration`
- Measurement ID: 본인 스트림 ID
- Trigger: `All Pages`

## 6.3 기본 전자상거래 이벤트용 GA4 Event Tag 생성

권장 방식:

1. GA4 Event Tag 템플릿 1개 생성
2. Event Name: `{{DLV - event}}`
3. Event Parameters 매핑
   - `items` -> `{{DLV - ecommerce.items}}`
   - `value` -> `{{DLV - value}}`
   - `currency` -> `{{DLV - currency}}`
   - `transaction_id` -> `{{DLV - transaction_id}}`
4. Trigger: Custom Event (`.*` 정규식) 또는 필요한 이벤트명별 Trigger

실습 초반에는 다음 이벤트를 우선 허용:

- `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `remove_from_cart`
- `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`

## 7. 단계별 실습 시나리오

## 7.1 기본 플로우 검증 (코드에서 이미 push되는 이벤트)

1. `index.html` 접속
2. 상품 카드 상세 보기 클릭
3. 상세 페이지에서 장바구니 이동
4. `cart.html`에서 주문하기
5. `checkout.html`에서 배송정보 제출, 결제정보 제출

기대 결과:

- GTM Preview 타임라인에 아래 순서로 이벤트 확인
- `view_item_list` -> `select_item` -> `view_item` -> `view_cart` -> `begin_checkout` -> `add_shipping_info` -> `add_payment_info`

## 7.2 누락 이벤트 실습 1: 상세 페이지 `add_to_cart`

대상: `product-sku-001/002/003.html`

현재 상태:

- 페이지 코드에서 `add_to_cart`는 일부러 전송하지 않음
- `#btnAddToCart`에 dataset 제공

GTM 구성:

1. Trigger: Click - All Elements
2. 조건: `Click ID equals btnAddToCart`
3. Tag: Custom HTML

예시 코드:

```html
<script>
window.dataLayer = window.dataLayer || [];
var btn = document.getElementById('btnAddToCart');
if (btn) {
  var item = {
    item_id: btn.dataset.sku,
    item_name: btn.dataset.name,
    price: Number(btn.dataset.price || 0),
    quantity: Number(btn.dataset.quantity || 1),
    item_category: btn.dataset.category || '',
    item_variant: btn.dataset.variant || 'default'
  };
  var value = item.price * item.quantity;
  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: 'add_to_cart',
    currency: btn.dataset.currency || 'KRW',
    value: value,
    ecommerce: { items: [item] }
  });
}
</script>
```

## 7.3 누락 이벤트 실습 2: 구매완료 `purchase`

대상: `thankyou.html`

현재 상태:

- 페이지 코드에서 `purchase`를 일부러 전송하지 않음
- `#orderJson`에 주문 JSON 노출

GTM 구성:

1. Trigger: Page View (`Page Path contains thankyou.html`)
2. Tag: Custom HTML

예시 코드:

```html
<script>
window.dataLayer = window.dataLayer || [];
var raw = document.getElementById('orderJson');
if (raw) {
  try {
    var order = JSON.parse(raw.textContent || '{}');
    if (order && order.transaction_id) {
      dataLayer.push({ ecommerce: null });
      dataLayer.push({
        event: 'purchase',
        transaction_id: order.transaction_id,
        currency: order.currency,
        value: Number(order.value || 0),
        ecommerce: { items: order.items || [] }
      });
    }
  } catch (e) {}
}
</script>
```

## 7.4 누락 이벤트 실습 3: 폼 완료 `form_submit`

대상: `form.html`

현재 상태:

- 페이지 코드에서 `form_submit` 전송하지 않음
- 폼 DOM에 payload 노출

GTM 구성:

1. Trigger: Form Submission 또는 Click (`Click ID equals btnFormSubmit`)
2. Tag: Custom HTML

예시 코드:

```html
<script>
window.dataLayer = window.dataLayer || [];
var form = document.getElementById('leadForm');
if (form && form.getAttribute('data-form-submit-ready') === 'true') {
  var raw = form.getAttribute('data-form-submit-payload') || '{}';
  try {
    var payload = JSON.parse(raw);
    dataLayer.push({
      event: 'form_submit',
      form_id: payload.form_id,
      interest_category: payload.interest_category,
      budget_range: payload.budget_range,
      inquiry_type: payload.inquiry_type
    });
  } catch (e) {}
}
</script>
```

## 7.5 버튼 이벤트 실습

대상: `buttons.html`

페이지 코드에서 이미 아래 이벤트를 push합니다.

- `cta_click`
- `phone_click`
- `file_download_click`
- `outbound_click`
- `modal_open`
- `modal_close`

확인 방법:

1. 버튼 클릭
2. `#buttonEventStatus` 상태 메시지 확인
3. `#buttonEventLog` JSON 누적 확인
4. GTM Preview 이벤트 타임라인 확인

## 8. 검증 체크리스트

1. `index.html` 상세 보기 클릭 시 정상 이동
2. `index.html` 빠른 담기 시 카트 배지 증가
3. 상세페이지 장바구니 담기 후 `cart.html` 수량 반영
4. `checkout.html` 배송/결제 버튼 클릭 시 이벤트 발생
5. `thankyou.html`에서 GTM Custom HTML로 `purchase` 전송 확인
6. `form.html`에서 GTM Custom HTML로 `form_submit` 전송 확인
7. `buttons.html` 로그 패널 갱신 확인
8. GA4 DebugView에서 이벤트/파라미터 확인

## 9. 문제 해결 가이드

1. 이벤트가 안 보일 때
- GTM Preview 연결 여부 확인
- GA4 Configuration Tag가 All Pages인지 확인
- Event Tag Trigger 조건이 너무 좁지 않은지 확인

2. `add_to_cart`/`purchase`/`form_submit` 누락일 때
- 의도적 누락 지점이므로 GTM Custom HTML 태그를 별도로 만들어야 정상

3. GTM 자동 주입이 안 될 때
- `gtm-setup.html`에서 저장 상태 재확인
- 브라우저 localStorage 초기화 여부 확인
- 다른 브라우저/시크릿 모드에서는 설정이 별도임

## 10. 참고

- 모든 HTML 페이지는 아래 두 슬롯을 포함합니다.
  - `<!-- GTM_HEAD_SLOT -->`
  - `<!-- GTM_BODY_SLOT -->`
- 이벤트명은 GA4 표준 이벤트명을 사용합니다.
- GTM 설정은 기능 반영 후 `gtm-setup.html`에서 변경 가능하며, 추가 git push 없이 운영할 수 있습니다.
