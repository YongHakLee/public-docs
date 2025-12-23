# JSON 스키마 상세 문서

## 개요

이 문서는 BlockScan 데이터셋의 JSON 파일 구조를 상세하게 정의합니다. 각 JSON 파일은 단일 Ethereum 트랜잭션의 실행 추적(execution trace)을 포함합니다.

---

## 1. 파일 명명 규칙

```
<block_number>-<index>.json
```

| 구성 요소 | 설명 | 예시 |
|-----------|------|------|
| `block_number` | Ethereum 블록 번호 (7-8자리 정수) | `15259101` |
| `index` | 동일 블록 내 트랜잭션 순서 (0부터 시작) | `0`, `1`, `2` |

**예시:**
- `15259101-0.json` → 블록 15,259,101의 첫 번째 트랜잭션
- `14881413-0.json` → 블록 14,881,413의 첫 번째 트랜잭션
- `15209076-2.json` → 블록 15,209,076의 세 번째 트랜잭션

---

## 2. 루트 구조

```json
{
  "<transaction_hash>": [<Call Object>, ...]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| 키 (Key) | `string` | 트랜잭션 해시 (66자 hex 문자열, `0x` 포함) |
| 값 (Value) | `array` | Call 객체 배열 (일반적으로 1개의 루트 콜) |

**예시:**
```json
{
  "0x61497a1a8a8659a06358e130ea590e1eed8956edbd99dbb2048cfb46850a8f17": [
    { "type": "CALL", ... }
  ]
}
```

---

## 3. Call 객체 스키마

### 3.1 전체 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| `type` | `string` | ✓ | 콜 타입: `CALL`, `STATICCALL`, `DELEGATECALL`, `CREATE` |
| `from` | `address` | ✓ | 호출자 주소 (42자 hex, `0x` 포함) |
| `to` | `address` | ✓ | 피호출 컨트랙트 주소 |
| `gas` | `integer` | ✓ | 할당된 가스량 |
| `gasUsed` | `integer` | ✓ | 실제 사용된 가스량 |
| `func` | `hex\|null` | | 함수 시그니처 (4바이트 selector, 예: `0xa9bd1226`) |
| `args` | `array\|null` | | 파싱된 함수 인자 배열 |
| `argsNotParsed` | `boolean\|null` | | 인자 파싱 실패 여부 (true면 ABI 디코딩 실패) |
| `output` | `array\|null` | | 반환값 배열 |
| `calls` | `array\|null` | | 중첩된 내부 콜 배열 (재귀 구조) |
| `value` | `number\|null` | | 전송된 ETH 양 (wei 단위, 없으면 0) |
| `logs` | `array\|null` | | EVM 로그/이벤트 배열 |
| `state` | `array\|null` | | 스토리지 읽기/쓰기 배열 |

### 3.2 콜 타입 (type) 상세

| 타입 | 설명 | 특징 | 사용 사례 |
|------|------|------|----------|
| `CALL` | 일반 컨트랙트 호출 | ETH 전송 가능, 상태 변경 가능 | 토큰 전송, 스왑 실행 |
| `STATICCALL` | 읽기 전용 호출 | 상태 변경 불가 | view/pure 함수, 잔액 조회 |
| `DELEGATECALL` | 위임 호출 | 호출자 컨텍스트에서 피호출자 코드 실행 | 프록시 패턴, 라이브러리 호출 |
| `CREATE` | 컨트랙트 생성 | 새 컨트랙트 배포 | 팩토리 패턴, 공격 컨트랙트 배포 |

**콜 타입별 분포 (데이터셋 기준):**
- CALL: ~45%
- STATICCALL: ~35%
- DELEGATECALL: ~19%
- CREATE: <1%

---

## 4. 인자 (args) 구조

### 4.1 파싱 성공 시

ABI 디코딩이 성공한 경우, 구조화된 인자 정보가 제공됩니다:

```json
{
  "index": 0,
  "data": "0x000000000000000000000000f1a91c7d44768070f711c68f33a7ca25c8d30268",
  "offset": "0x0",
  "name": "_token",
  "type": "address"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `index` | `integer` | 인자 순서 (0부터 시작) |
| `data` | `hex` | 32바이트 패딩된 hex 인코딩 값 |
| `offset` | `hex` | calldata 내 바이트 오프셋 |
| `name` | `string` | 파라미터 이름 (ABI에서 추출) |
| `type` | `string` | Solidity 타입 |

### 4.2 지원되는 Solidity 타입

| 타입 | 설명 | 예시 data 값 |
|------|------|-------------|
| `address` | 20바이트 주소 | `0x000000000000000000000000f1a91c7d...` |
| `uint256` | 256비트 부호 없는 정수 | `0x00000000000000000000000000000000...036b706532ee57340000` |
| `uint32` | 32비트 부호 없는 정수 | `0x0000000000000000000000000000000000000000000000000000000000006331` |
| `bool` | 불리언 값 | `0x0000...0000` (false) 또는 `0x0000...0001` (true) |
| `bytes32` | 32바이트 고정 크기 | `0x000000000000000000000000c3952869c41b1ea4c1a12d1574d90eabbb94933c` |
| `bytes` | 가변 크기 바이트 배열 | 동적 인코딩 |
| `offset` | 동적 데이터 오프셋 | `0x0000...0020` (32바이트 오프셋) |

### 4.3 파싱 실패 시 (argsNotParsed: true)

ABI 정보가 없거나 비표준 인코딩인 경우:

```json
{
  "args": [
    {
      "type": "data",
      "data": "0x01f57113d8f6ff35747737f026fe0b37d4d7f42777000100055d94309e5a0090"
    },
    {
      "type": "data",
      "data": "0xb165fa4181519701637b6daeba00012444928bc4b2c1201f45d16265616dd4d3"
    }
  ],
  "argsNotParsed": true
}
```

**주의사항:**
- 악성 트랜잭션에서 `argsNotParsed: true` 비율이 더 높음
- raw 데이터 분석이 필요한 경우가 많음

---

## 5. 출력 (output) 구조

반환값은 배열 형태로 저장됩니다:

```json
[
  {
    "type": "data",
    "data": "0x0000000000000000000000000000000000000000000000000000000000000001"
  }
]
```

또는 주소 반환 시:

```json
[
  {
    "type": "address",
    "data": "0xD3dfD3eDe74E0DCEBC1AA685e151332857efCe2d"
  }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `string` | `"data"` 또는 `"address"` |
| `data` | `hex` | hex 인코딩된 반환값 |

---

## 6. 로그 (logs) 구조

EVM 이벤트 로그는 다음 구조로 저장됩니다:

```json
{
  "address": "0xf1a91c7d44768070f711c68f33a7ca25c8d30268",
  "topics": [
    {"type": "data", "data": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"},
    {"type": "address", "data": "0xc3952869C41B1eA4C1a12D1574d90EaBBB94933c"},
    {"type": "address", "data": "0x88A69B4E698A4B090DF6CF5Bd7B2D47325Ad30A3"}
  ],
  "data": [
    {"type": "data", "data": "0x00000000000000000000000000000000000000000000036b706532ee57340000"}
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `address` | `address` | 이벤트를 발생시킨 컨트랙트 주소 |
| `topics` | `array` | 인덱싱된 파라미터 (최대 4개) |
| `data` | `array` | 인덱싱되지 않은 파라미터 |

### 6.1 일반적인 이벤트 시그니처

| 이벤트 | Topic 0 (시그니처 해시) |
|--------|------------------------|
| ERC20 Transfer | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| ERC20 Approval | `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925` |
| Dispatch (Nomad) | `0x9d4c83d2e57d7d381feb264b44a5015e7f9ef26340f4fc46b558a6dc16dd811a` |

---

## 7. 상태 변경 (state) 구조

스토리지 읽기/쓰기 작업이 기록됩니다:

```json
{
  "type": "READ",
  "address": "0x0a6f564c5c9bebd66f1595f1b51d1f3de6ef3b79",
  "key": "0x0b0a2e157d85546450849b3ad7c75402a17d63a4bed1f0fc9c3c8ee1550c62de",
  "value": "0x0"
}
```

```json
{
  "type": "WRITE",
  "address": "0xf1a91c7d44768070f711c68f33a7ca25c8d30268",
  "key": "0x4e16c0703b7661482650b380519910a0527b1aa64373feaca114b5b9b66bbbd3",
  "value": "0x36b70d1e8e9551701ef"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `string` | `"READ"` (읽기) 또는 `"WRITE"` (쓰기) |
| `address` | `address` | 스토리지가 속한 컨트랙트 주소 |
| `key` | `hex` | 스토리지 슬롯 키 (32바이트) |
| `value` | `hex` | 스토리지 값 (32바이트) |

---

## 8. 중첩 콜 구조 (Recursive Calls)

`calls` 필드는 재귀적으로 동일한 Call 객체 구조를 포함합니다:

```
CALL (루트)
├── STATICCALL
│   └── (output만 있음)
├── DELEGATECALL
│   ├── STATICCALL
│   │   ├── STATICCALL
│   │   └── DELEGATECALL
│   ├── CALL (토큰 전송)
│   │   └── logs, state 포함
│   └── CALL (추가 호출)
└── (logs 포함)
```

### 8.1 콜 깊이 통계

| 레이블 | 평균 깊이 | 최대 깊이 | 평균 총 콜 수 |
|--------|----------|----------|--------------|
| Benign | 5.19 | 11 | 12.79 |
| Malicious | 9.60 | 16 | 76.60 |
| Excluded | 3.56 | 16 | - |

**관찰 사항:**
- 악성 트랜잭션은 평균적으로 더 깊은 콜 트리를 가짐
- 악성 트랜잭션의 총 콜 수가 약 6배 더 많음

---

## 9. Precompile 컨트랙트 호출

Ethereum의 precompile 컨트랙트 호출이 데이터셋에 포함됩니다:

| 주소 | 이름 | 기능 |
|------|------|------|
| `0x0000...0001` | ecrecover | ECDSA 서명 복구 |
| `0x0000...0002` | sha256 | SHA-256 해시 |
| `0x0000...0003` | ripemd160 | RIPEMD-160 해시 |
| `0x0000...0004` | identity | 데이터 복사 (memcpy) |

**예시 (identity precompile):**
```json
{
  "type": "STATICCALL",
  "from": "0x88a69b4e698a4b090df6cf5bd7b2d47325ad30a3",
  "gas": 229961,
  "gasUsed": 21,
  "to": "0x0000000000000000000000000000000000000004",
  "func": "0x00657468",
  "args": [{"type": "address", "data": "0xf1a91C7d44768070F711c68f33A7CA25c8D30268"}],
  "argsNotParsed": true
}
```

---

## 10. 완전한 예시

### 10.1 Benign 트랜잭션 예시 (NomadBridge)

**파일:** `14881413-0.json`

```json
{
  "0x2b0afafd414c11ef6d48d225b1c0d4f1a94e1a7ca515cf6a902f558268064bfa": [
    {
      "type": "CALL",
      "from": "0xc3952869c41b1ea4c1a12d1574d90eabbb94933c",
      "gas": 327696,
      "gasUsed": 243950,
      "to": "0x88a69b4e698a4b090df6cf5bd7b2d47325ad30a3",
      "func": "0xa9bd1226",
      "args": [
        {"index": 0, "data": "0x...f1a91c7d44768070f711c68f33a7ca25c8d30268", "name": "_token", "type": "address"},
        {"index": 1, "data": "0x...036b706532ee57340000", "name": "_amount", "type": "uint256"},
        {"index": 2, "data": "0x...6331", "name": "_destination", "type": "uint32"},
        {"index": 3, "data": "0x...c3952869c41b1ea4c1a12d1574d90eabbb94933c", "name": "_recipient", "type": "bytes32"},
        {"index": 4, "data": "0x...00", "name": "_enableFast", "type": "bool"}
      ],
      "calls": [
        {"type": "STATICCALL", "to": "0xb70588b1a51f847d13158ff18e9cac861df5fb00", "...": "..."},
        {"type": "DELEGATECALL", "to": "0xd3dfd3ede74e0dcebc1aa685e151332857efce2d",
         "calls": [
           {"type": "STATICCALL", "...": "..."},
           {"type": "CALL", "func": "0x23b872dd", "logs": ["..."], "state": ["..."]},
           "..."
         ]
        }
      ],
      "logs": [{"address": "0x88a69b4e698a4b090df6cf5bd7b2d47325ad30a3", "...": "..."}],
      "state": [{"type": "READ", "...": "..."}, {"type": "READ", "...": "..."}],
      "value": 0
    }
  ]
}
```

### 10.2 Malicious 트랜잭션 특징 (NomadBridge)

**파일:** `15259101-0.json`

악성 트랜잭션의 특징:
1. `argsNotParsed: true` - 비표준 인코딩으로 인자 파싱 실패
2. 깊은 콜 트리 (depth: 11)
3. 많은 총 콜 수 (30개)
4. 복잡한 DELEGATECALL 체인

```json
{
  "0x61497a1a8a8659a06358e130ea590e1eed8956edbd99dbb2048cfb46850a8f17": [
    {
      "type": "CALL",
      "func": "0x37c8f01a",
      "argsNotParsed": true,
      "args": [
        {"type": "data", "data": "0x01f57113d8f6ff35747737f026fe0b37d4d7f42777000100055d94309e5a0090"},
        {"type": "data", "data": "0xb165fa4181519701637b6daeba00012444928bc4b2c1201f45d16265616dd4d3"},
        "..."
      ],
      "calls": [
        {
          "type": "DELEGATECALL",
          "argsNotParsed": true,
          "calls": [
            {"type": "CALL", "func": "0x928bc4b2", "...": "..."}
          ]
        }
      ]
    }
  ]
}
```

---

## 11. 프로젝트별 블록 번호 범위

| 프로젝트 | 최소 블록 | 최대 블록 | 대략적 시기 |
|---------|----------|----------|-----------|
| NomadBridge | ~14,833,000 | ~15,259,000 | 2022.05 ~ 2022.08 |
| TrustSwap | ~12,914,000 | ~12,962,000 | 2021.08 |
| AudiusProject | ~11,103,000 | ~15,201,000 | 2020.10 ~ 2022.07 |
| SushiSwap | ~16,980,000 | ~17,007,000 | 2023.04 |
| ShataCapital | ~15,698,000 | ~16,696,000 | 2022.10 ~ 2023.01 |

---

## 12. 데이터 접근 예시 (Python)

```python
import json
from pathlib import Path

def load_transaction(file_path: str) -> dict:
    """JSON 파일에서 트랜잭션 데이터 로드"""
    with open(file_path, 'r') as f:
        data = json.load(f)
    tx_hash = list(data.keys())[0]
    return tx_hash, data[tx_hash]

def get_call_depth(call: dict, current_depth: int = 1) -> int:
    """콜 트리의 최대 깊이 계산"""
    if not call.get('calls'):
        return current_depth
    return max(get_call_depth(c, current_depth + 1) for c in call['calls'])

def count_call_types(call: dict) -> dict:
    """콜 타입별 개수 집계"""
    counts = {call['type']: 1}
    for nested in call.get('calls') or []:
        for call_type, count in count_call_types(nested).items():
            counts[call_type] = counts.get(call_type, 0) + count
    return counts

# 사용 예시
tx_hash, calls = load_transaction('15259101-0.json')
print(f"Transaction: {tx_hash}")
print(f"Max depth: {get_call_depth(calls[0])}")
print(f"Call types: {count_call_types(calls[0])}")
```

---

## 부록: TypeScript 타입 정의

```typescript
interface TransactionTrace {
  [txHash: string]: Call[];
}

interface Call {
  type: 'CALL' | 'STATICCALL' | 'DELEGATECALL' | 'CREATE';
  from: string;
  to: string;
  gas: number;
  gasUsed: number;
  func?: string | null;
  args?: Argument[] | null;
  argsNotParsed?: boolean | null;
  output?: Output[] | null;
  calls?: Call[] | null;
  value?: number | null;
  logs?: Log[] | null;
  state?: StateChange[] | null;
}

interface Argument {
  index?: number;
  data: string;
  offset?: string;
  name?: string;
  type: string;
}

interface Output {
  type: 'data' | 'address';
  data: string;
}

interface Log {
  address: string;
  topics: Output[];
  data: Output[];
}

interface StateChange {
  type: 'READ' | 'WRITE';
  address: string;
  key: string;
  value: string;
}
```
