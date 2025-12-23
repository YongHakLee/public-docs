# Audius 보안 사고 분석

## 개요

| 항목 | 내용 |
|------|------|
| 프로젝트 | Audius |
| 사고 일시 | 2022년 7월 23일 |
| 피해 규모 | ~$6M USD (~1800만 AUDIO 토큰) |
| 공격 유형 | 스토리지 충돌 (Storage Collision) + 거버넌스 공격 |
| 영향 체인 | Ethereum |

---

## 1. 프로젝트 배경

### 1.1 Audius란?

Audius는 탈중앙화 음악 스트리밍 플랫폼으로, 아티스트가 직접 팬들에게 음악을 제공하고 수익을 얻을 수 있는 Web3 서비스입니다.

**핵심 구성 요소:**
- **AUDIO 토큰**: 거버넌스 및 스테이킹 토큰
- **Governance 컨트랙트**: 제안 생성 및 투표 관리
- **Staking 컨트랙트**: 노드 운영자 스테이킹 관리
- **Treasury**: 커뮤니티 자금 관리

### 1.2 거버넌스 구조

```
1. 제안 생성: AUDIO 홀더가 제안 제출
2. 투표 기간: 3일간 투표 진행
3. 실행: 과반 동의 시 제안 실행
4. 타임락: 실행 전 대기 기간
```

---

## 2. 취약점 분석

### 2.1 스토리지 충돌 (Storage Collision)

Audius는 프록시 패턴을 사용했으나, 프록시와 구현체 간 스토리지 레이아웃 충돌이 발생했습니다.

**문제의 구조:**
```solidity
// Governance Proxy (EIP-1967 표준 미사용)
contract GovernanceProxy {
    address public proxyAdmin;  // slot 0
    address public implementation;  // slot 1
    bool public initialized;  // slot 2
}

// Governance Implementation
contract Governance {
    address public registryAddress;  // slot 0 - 충돌!
    uint256 public votingPeriod;  // slot 1 - 충돌!
    // ...
}
```

### 2.2 초기화 함수 재호출 가능

```solidity
function initialize(
    address _registryAddress,
    uint256 _votingPeriod,
    // ...
) public {
    require(!initialized, "Already initialized");
    // ...
    initialized = true;
}
```

**문제점:**
1. `initialized` 변수가 프록시의 다른 슬롯에 위치
2. 구현체 관점에서는 항상 `false`로 보임
3. `initialize()` 함수를 여러 번 호출 가능

### 2.3 공격 시나리오

1. **재초기화 호출**: 공격자가 `initialize()`를 호출하여 거버넌스 파라미터 변경
2. **투표권 조작**: 자신에게 대량의 투표권 할당
3. **악의적 제안 통과**: 즉시 투표 완료되는 제안 생성
4. **자금 탈취**: Treasury에서 AUDIO 토큰 전송 실행

---

## 3. 공격 타임라인

| 시간 (UTC) | 이벤트 |
|-----------|--------|
| 2022-07-23 16:27 | 블록 15201799: 초기화 함수 재호출 (거버넌스 탈취) |
| 2022-07-23 16:27 | 블록 15201800: 악의적 제안 실행 (자금 탈취) |
| 2022-07-23 17:xx | Audius 팀 대응 시작 |
| 2022-07-23 19:xx | 컨트랙트 일시 중단 |

---

## 4. 데이터셋 분석

### 4.1 데이터 구성

| 레이블 | 파일 수 | 설명 |
|--------|--------|------|
| Benign | 865 | 정상적인 스테이킹/거버넌스 트랜잭션 |
| Malicious | 2 | 공격 트랜잭션 |
| Excluded | 9 | 분석에서 제외된 트랜잭션 |

### 4.2 악성 트랜잭션 상세

| 파일명 | 블록 번호 | 콜 깊이 | 총 콜 수 | 역할 |
|--------|----------|--------|---------|------|
| `15201799-0.json` | 15,201,799 | 5 | 8 | 거버넌스 탈취 (재초기화) |
| `15201800-0.json` | 15,201,800 | 5 | 15 | 자금 탈취 (제안 실행) |

### 4.3 공격 트랜잭션 분석

**첫 번째 트랜잭션 (15201799-0.json):**
- `initialize()` 함수 호출
- 거버넌스 파라미터 재설정
- 공격자에게 투표권 할당

**두 번째 트랜잭션 (15201800-0.json):**
- 악의적 제안 생성 및 즉시 실행
- Treasury에서 AUDIO 토큰 전송
- 약 1800만 AUDIO 탈취

### 4.4 콜 트리 구조

**거버넌스 탈취 (15201799-0.json):**
```
CALL (initialize)
├── STATICCALL (registry 조회)
├── CALL (파라미터 설정)
│   └── DELEGATECALL
├── STATICCALL (검증)
└── ...
```

**자금 탈취 (15201800-0.json):**
```
CALL (executeProposal)
├── DELEGATECALL (Governance 구현체)
│   ├── CALL (투표 검증)
│   ├── CALL (제안 실행)
│   │   ├── CALL (토큰 전송)
│   │   └── ...
│   └── ...
└── logs (Transfer 이벤트)
```

---

## 5. 주요 컨트랙트 주소

| 역할 | 주소 |
|------|------|
| Governance Proxy | `0x...` (데이터에서 추출 필요) |
| AUDIO Token | `0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998` |
| Treasury | `0x...` |
| Staking | `0x...` |

---

## 6. 탐지 지표

### 6.1 정적 분석 지표

- `initialize()` 함수 호출 (이미 초기화된 컨트랙트에)
- 거버넌스 파라미터 변경 이벤트
- 비정상적인 제안 생성 패턴

### 6.2 동적 분석 지표

- 동일 블록 또는 연속 블록에서의 다중 거버넌스 작업
- 매우 짧은 투표 기간의 제안
- 단일 주소로의 대량 토큰 전송

---

## 7. Benign vs Malicious 비교

| 특성 | Benign | Malicious |
|------|--------|-----------|
| 평균 콜 깊이 | 4.15 | 5.00 |
| 평균 총 콜 수 | 10.10 | 11.50 |
| 주요 함수 | stake, vote | initialize, execute |
| 패턴 | 분산된 시간대 | 연속 블록 (1블록 차이) |

---

## 8. 교훈 및 권장사항

### 8.1 개발 측면

1. **EIP-1967 표준 사용**: 스토리지 충돌 방지를 위한 표준 프록시 패턴 적용
2. **Initializable 패턴**: OpenZeppelin의 `Initializable` 사용
3. **스토리지 갭**: 업그레이드 시 스토리지 확장을 위한 갭 예약

```solidity
// 권장 패턴
abstract contract Initializable {
    bool private _initialized;
    bool private _initializing;
    
    modifier initializer() {
        require(_initializing || !_initialized, "Already initialized");
        // ...
    }
}
```

### 8.2 거버넌스 보안

1. **타임락 필수화**: 모든 중요 작업에 대기 기간 적용
2. **다중 서명**: 중요 파라미터 변경에 다중 승인 필요
3. **투표 기간 최소화 방지**: 투표 기간 하한선 설정

### 8.3 모니터링 측면

1. **초기화 함수 호출 감지**: 배포 후 initialize 호출 경보
2. **거버넌스 이상 탐지**: 비정상적인 제안/투표 패턴 모니터링
3. **대량 전송 경보**: Treasury에서의 대량 출금 감지

---

## 참고 자료

- [Audius Post-Mortem](https://blog.audius.co/article/audius-governance-takeover-post-mortem-7-23-22)
- [Rekt News - Audius](https://rekt.news/audius-rekt/)
- [OpenZeppelin Initializable](https://docs.openzeppelin.com/contracts/4.x/api/proxy#Initializable)
