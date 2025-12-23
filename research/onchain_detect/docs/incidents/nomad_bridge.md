# NomadBridge 보안 사고 분석

## 개요

| 항목 | 내용 |
|------|------|
| 프로젝트 | Nomad Bridge |
| 사고 일시 | 2022년 8월 1일 ~ 2일 |
| 피해 규모 | ~$190M USD |
| 공격 유형 | 메시지 검증 우회 (Initialization Bug) |
| 영향 체인 | Ethereum, Moonbeam, Avalanche, Evmos, Milkomeda |

---

## 1. 프로젝트 배경

### 1.1 Nomad Bridge란?

Nomad는 크로스체인 브릿지 프로토콜로, 서로 다른 블록체인 간 자산 전송을 가능하게 합니다.

**핵심 구성 요소:**
- **Home**: 원본 체인에서 메시지를 발송하는 컨트랙트
- **Replica**: 대상 체인에서 메시지를 수신/검증하는 컨트랙트
- **Bridge Router**: 자산 잠금 및 민팅을 관리하는 라우터

### 1.2 정상 작동 흐름

```
1. 사용자가 Ethereum에서 Bridge Router에 토큰 전송 요청
2. Home 컨트랙트가 메시지 생성 및 Merkle 트리에 추가
3. 오프체인 에이전트가 메시지 해시를 다른 체인으로 전달
4. Replica 컨트랙트가 메시지 검증 (Merkle proof 확인)
5. 검증 성공 시 대상 체인에서 토큰 민팅
```

---

## 2. 취약점 분석

### 2.1 근본 원인

2022년 6월 21일 업그레이드 과정에서 `Replica` 컨트랙트의 초기화 버그가 발생했습니다.

**문제의 코드:**
```solidity
// Replica.sol
function initialize(...) public initializer {
    // ...
    committedRoot = _committedRoot;  // 0x00으로 설정됨
}
```

`committedRoot`가 `0x00` (zero bytes32)로 초기화되어, 모든 메시지가 유효한 것으로 처리되었습니다.

### 2.2 취약한 검증 로직

```solidity
function process(bytes memory _message) public returns (bool _success) {
    // ...
    require(acceptableRoot(messages[_messageHash]), "!root");
    // ...
}

function acceptableRoot(bytes32 _root) public view returns (bool) {
    if (_root == committedRoot) return true;  // 0x00 == 0x00 항상 true
    // ...
}
```

`messages[_messageHash]`가 설정되지 않은 경우 `0x00`을 반환하며, 이는 `committedRoot`와 일치하여 검증을 통과합니다.

### 2.3 공격 벡터

1. 공격자가 임의의 메시지 생성 (예: "100 WBTC를 공격자에게 전송")
2. 메시지가 Merkle 트리에 포함되지 않았으므로 `messages[hash]`는 `0x00`
3. `acceptableRoot(0x00)`이 true 반환 (committedRoot = 0x00)
4. 검증 통과, 브릿지가 토큰 전송 실행

---

## 3. 공격 타임라인

| 시간 (UTC) | 이벤트 |
|-----------|--------|
| 2022-08-01 21:32 | 최초 공격 트랜잭션 실행 (100 WBTC 탈취) |
| 2022-08-01 22:xx | 다른 공격자들이 트랜잭션 복사 시작 (Copycat Attack) |
| 2022-08-02 00:xx | 총 수백 명의 참여자가 자금 탈취 |
| 2022-08-02 02:xx | Nomad 팀 대응 시작 |

---

## 4. Copycat Attack 현상

이 사고의 특이점은 "Copycat Attack" (모방 공격) 현상입니다:

1. **최초 공격자**가 취약점을 발견하고 공격 트랜잭션 실행
2. **블록 익스플로러**에서 공격 트랜잭션이 공개됨
3. **다른 사용자들**이 트랜잭션 데이터를 복사하여:
   - `from` 주소만 자신의 주소로 변경
   - 동일한 calldata로 트랜잭션 전송
4. **스킬 불필요**: 복잡한 해킹 기술 없이 단순 복사만으로 공격 가능

**결과:**
- 수백 명의 참여자가 브릿지 자금 탈취
- 일부는 화이트햇으로 자금 반환
- 대부분의 자금은 회수 불가

---

## 5. 데이터셋 분석

### 5.1 데이터 구성

| 레이블 | 파일 수 | 설명 |
|--------|--------|------|
| Benign | 9,915 | 정상적인 브릿지 사용 트랜잭션 |
| Malicious | 4 | 공격 트랜잭션 |
| Excluded | 541 | 분석에서 제외된 트랜잭션 |

### 5.2 악성 트랜잭션 상세

| 파일명 | 블록 번호 | 콜 깊이 | 총 콜 수 | 특징 |
|--------|----------|--------|---------|------|
| `15259101-0.json` | 15,259,101 | 11 | 30 | argsNotParsed: true |
| `15259303-0.json` | 15,259,303 | 11 | 25 | argsNotParsed: true |
| `15259451-0.json` | 15,259,451 | 11 | 33 | argsNotParsed: true |
| `15259601-0.json` | 15,259,601 | 11 | 30 | argsNotParsed: true |

### 5.3 Benign vs Malicious 비교

| 특성 | Benign (평균) | Malicious (평균) |
|------|--------------|-----------------|
| 콜 깊이 | 6.80 | 11.00 |
| 총 콜 수 | 24.61 | 29.50 |
| argsNotParsed | ~30% | 100% |
| 주요 함수 | `0xa9bd1226` (send) | `0x37c8f01a` (process) |

### 5.4 공격 트랜잭션 구조

```
CALL (0x37c8f01a - process)
├── DELEGATECALL (Replica 구현체)
│   ├── CALL (0x928bc4b2 - 메시지 처리)
│   │   ├── DELEGATECALL (BridgeRouter)
│   │   │   ├── CALL (토큰 전송)
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── ...
```

---

## 6. 주요 컨트랙트 주소

| 역할 | 주소 |
|------|------|
| Nomad Bridge Router | `0x88a69b4e698a4b090df6cf5bd7b2d47325ad30a3` |
| Replica Proxy | `0x5d94309e5a0090b165fa4181519701637b6daeba` |
| Replica Implementation | `0xb88189cd5168c4676bd93e9768497155956f8445` |
| Token Registry | `0x0a6f564c5c9bebd66f1595f1b51d1f3de6ef3b79` |

---

## 7. 탐지 지표

### 7.1 정적 분석 지표

- 함수 시그니처 `0x37c8f01a` (process) 호출
- `argsNotParsed: true` 플래그
- Replica 컨트랙트로의 DELEGATECALL

### 7.2 동적 분석 지표

- 깊은 콜 트리 (depth > 10)
- 비정상적인 토큰 전송 패턴
- 단시간 내 대량 반복 트랜잭션

---

## 8. 교훈 및 권장사항

### 8.1 개발 측면

1. **초기화 검증**: 중요 상태 변수가 올바르게 초기화되었는지 검증
2. **업그레이드 테스트**: 프록시 업그레이드 전 철저한 통합 테스트
3. **Zero Value 검사**: `0x00` 값이 유효하지 않도록 명시적 검증

### 8.2 모니터링 측면

1. **이상 트랜잭션 탐지**: 비정상적인 함수 호출 패턴 모니터링
2. **대량 인출 경보**: 단시간 대량 인출 시 자동 일시 중단
3. **Copycat 방지**: 의심스러운 트랜잭션 패턴 복제 탐지

---

## 참고 자료

- [Nomad Bridge Post-Mortem (공식)](https://medium.com/nomad-xyz-blog/nomad-bridge-hack-root-cause-analysis-875ad2e5aacd)
- [Rekt News - Nomad Bridge](https://rekt.news/nomad-rekt/)
- [Ethereum Block 15259101](https://etherscan.io/block/15259101)
