# SushiSwap RouteProcessor2 보안 사고 분석

## 개요

| 항목 | 내용 |
|------|------|
| 프로젝트 | SushiSwap (RouteProcessor2) |
| 사고 일시 | 2023년 4월 9일 |
| 피해 규모 | ~$3.3M USD |
| 공격 유형 | External Call Injection |
| 영향 체인 | Ethereum, Arbitrum, Polygon, Optimism, Avalanche 등 |

---

## 1. 프로젝트 배경

### 1.1 SushiSwap이란?

SushiSwap은 탈중앙화 거래소(DEX)로, 다중 풀을 통한 최적 스왑 경로를 제공합니다.

**핵심 구성 요소:**
- **SushiSwap AMM**: 자동화된 마켓 메이커 풀
- **RouteProcessor**: 여러 DEX를 통한 최적 경로 라우팅
- **BentoBox**: 대출 및 레버리지 기능

### 1.2 RouteProcessor2 역할

RouteProcessor2는 다음 기능을 수행합니다:
1. 여러 DEX 간 최적 스왑 경로 계산
2. 복잡한 다단계 스왑 실행
3. 가스 효율적인 토큰 교환

---

## 2. 취약점 분석

### 2.1 취약한 함수

```solidity
function processRoute(
    address tokenIn,
    uint256 amountIn,
    address tokenOut,
    uint256 amountOutMin,
    address to,
    bytes memory route
) external payable {
    // 사용자가 제공한 route 데이터를 파싱
    // route에 포함된 풀 주소로 외부 호출 실행
}
```

### 2.2 External Call Injection

**문제점:**
1. `route` 매개변수가 사용자 입력을 신뢰
2. 악성 컨트랙트 주소를 풀로 위장 가능
3. 임의의 컨트랙트에 대한 호출 실행 가능

**공격 벡터:**
```solidity
// 악성 route 데이터
route = encode([
    poolType: INTERNAL,
    pool: attackerContract,  // 악성 컨트랙트
    data: maliciousCalldata
]);

// RouteProcessor2가 악성 컨트랙트 호출
attackerContract.swap(...);  // 공격자가 원하는 로직 실행
```

### 2.3 approve 취약점

특히 문제가 된 부분은 `approve` 된 토큰 처리입니다:

```solidity
// 사용자가 RouteProcessor2에 토큰 approve
token.approve(routeProcessor2, amount);

// 공격자가 악성 route로 호출
routeProcessor2.processRoute(
    token,
    amount,
    ...,
    maliciousRoute
);

// 악성 route가 사용자의 토큰을 공격자에게 전송
```

---

## 3. 공격 타임라인

| 시간 (UTC) | 이벤트 |
|-----------|--------|
| 2023-04-09 06:25 | 블록 17007839: 공격 컨트랙트 배포 |
| 2023-04-09 06:25 | 블록 17007842: 주요 공격 실행 |
| 2023-04-09 07:xx | 여러 체인에서 공격 확산 |
| 2023-04-09 08:xx | SushiSwap 팀 대응 |
| 2023-04-09 10:xx | RouteProcessor2 사용 중단 권고 |

---

## 4. 데이터셋 분석

### 4.1 데이터 구성

| 레이블 | 파일 수 | 설명 |
|--------|--------|------|
| Benign | 199 | 정상적인 스왑 트랜잭션 |
| Malicious | 2 | 공격 트랜잭션 |
| Excluded | 5 | 분석에서 제외된 트랜잭션 |

### 4.2 악성 트랜잭션 상세

| 파일명 | 블록 번호 | 콜 깊이 | 총 콜 수 | 특징 |
|--------|----------|--------|---------|------|
| `17007839-0.json` | 17,007,839 | 5 | 11 | CREATE 포함 (공격 컨트랙트 배포) |
| `17007842-0.json` | 17,007,842 | 5 | 67 | 주요 공격 실행 |

### 4.3 공격 패턴 분석

**첫 번째 트랜잭션 (17007839-0.json):**
- CREATE 연산으로 공격 컨트랙트 배포
- 공격 준비 단계

**두 번째 트랜잭션 (17007842-0.json):**
- 67개의 콜 실행 (대량 토큰 탈취)
- 여러 사용자의 approve된 토큰 탈취
- 복잡한 콜 체인

### 4.4 Benign vs Malicious 비교

| 특성 | Benign | Malicious |
|------|--------|-----------|
| 평균 콜 깊이 | 3.33 | 5.00 |
| 평균 총 콜 수 | 14.10 | 39.00 |
| CREATE 사용 | 0% | 50% (1/2) |
| 함수 | processRoute | processRoute |

**주요 차이점:**
- Malicious 트랜잭션의 총 콜 수가 훨씬 많음 (67 vs 평균 14)
- 공격 전 CREATE로 컨트랙트 배포
- 단일 트랜잭션에서 다수 피해자 토큰 탈취

---

## 5. 공격 트랜잭션 구조

### 5.1 컨트랙트 배포 (17007839-0.json)

```
CALL (외부 컨트랙트)
├── CREATE (공격 컨트랙트 배포)
│   └── (생성자 로직)
├── CALL (초기화)
└── ...
```

### 5.2 주요 공격 (17007842-0.json)

```
CALL (RouteProcessor2.processRoute)
├── CALL (악성 route 처리)
│   ├── CALL (토큰 전송 1)
│   ├── CALL (토큰 전송 2)
│   ├── ... (반복)
│   └── CALL (토큰 전송 N)
├── STATICCALL (잔액 확인)
└── ...
```

---

## 6. 주요 컨트랙트 주소

| 역할 | 주소 |
|------|------|
| RouteProcessor2 (취약) | `0x044b75f554b886A065b9567891e45c79542d7357` |
| 공격 컨트랙트 | 트랜잭션에서 CREATE로 배포됨 |
| SushiSwap Router | `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F` |

---

## 7. 탐지 지표

### 7.1 정적 분석 지표

- RouteProcessor2 컨트랙트 호출
- 비정상적인 route 데이터 패턴
- 동일 트랜잭션 내 CREATE 연산

### 7.2 동적 분석 지표

- 매우 많은 내부 콜 수 (> 50)
- 다수의 토큰 전송 이벤트
- 단일 수혜자에게 다중 토큰 유입

### 7.3 온체인 지표

```solidity
// 의심스러운 패턴
1. processRoute 호출 직전 CREATE
2. route 데이터에 알려지지 않은 풀 주소
3. 비정상적으로 많은 Transfer 이벤트
```

---

## 8. 피해 범위

### 8.1 영향 받은 체인

| 체인 | 피해 규모 |
|------|----------|
| Ethereum | ~$1.8M |
| Arbitrum | ~$800K |
| Polygon | ~$400K |
| 기타 | ~$300K |

### 8.2 피해 토큰 종류

- WETH
- USDC
- USDT
- DAI
- 기타 ERC20 토큰

---

## 9. 교훈 및 권장사항

### 9.1 개발 측면

1. **입력 검증 강화**: 외부 입력 데이터의 철저한 검증
2. **화이트리스트 사용**: 허용된 풀/컨트랙트만 호출 가능
3. **최소 권한 원칙**: 필요한 권한만 요청

```solidity
// 권장 패턴
mapping(address => bool) public allowedPools;

function processRoute(...) external {
    for (pool in route.pools) {
        require(allowedPools[pool], "Pool not whitelisted");
    }
}
```

### 9.2 사용자 측면

1. **Approval 최소화**: 필요한 양만 approve
2. **Revoke 정기적**: 사용하지 않는 approval 취소
3. **무한 Approval 금지**: `type(uint256).max` approval 피하기

### 9.3 모니터링 측면

1. **이상 route 패턴 탐지**: 알려지지 않은 풀 주소 경보
2. **대량 Transfer 이벤트 모니터링**: 단일 트랜잭션 내 다수 전송 감지
3. **CREATE + DeFi 패턴**: 공격 컨트랙트 배포 후 즉시 사용 패턴 탐지

---

## 10. 수정된 RouteProcessor3

SushiSwap은 사고 후 RouteProcessor3를 배포했습니다:

**주요 변경사항:**
1. 풀 화이트리스트 도입
2. 외부 호출 대상 검증 강화
3. 추가 보안 감사 수행

---

## 참고 자료

- [SushiSwap Post-Mortem](https://www.sushi.com/blog/routeprocessor2-post-mortem)
- [BlockSec Analysis](https://twitter.com/BlockSecTeam/status/1645001619155296257)
- [Rekt News - SushiSwap](https://rekt.news/sushi-yoink-rekt/)
