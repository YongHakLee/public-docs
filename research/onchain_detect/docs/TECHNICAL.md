# BlockScan 데이터셋 기술 문서

## 개요

이 문서는 BlockScan 논문(NeurIPS 2025)에서 사용된 Ethereum 트랜잭션 실행 추적 데이터셋에 대한 종합적인 기술 문서입니다.

---

## 1. 데이터셋 개요

### 1.1 목적

BlockScan 데이터셋은 블록체인 이상 거래 탐지 연구를 위해 수집되었습니다:

- **주요 목표**: Transformer 기반 이상 탐지 모델 학습
- **연구 분야**: 블록체인 보안, 스마트 컨트랙트 분석
- **활용**: 사전 학습(Pre-training) 및 미세 조정(Fine-tuning)

### 1.2 수집 방법

데이터는 Ethereum 노드의 `debug_traceTransaction` RPC를 통해 수집되었습니다:

```bash
# 트랜잭션 추적 요청 예시
curl -X POST --data '{
  "jsonrpc": "2.0",
  "method": "debug_traceTransaction",
  "params": ["0x...", {"tracer": "callTracer"}],
  "id": 1
}' http://localhost:8545
```

---

## 2. 데이터 구조

### 2.1 디렉토리 구조

```
data_20240125/
├── NomadBridge/
│   ├── benign_txs/      # 9,915 파일
│   ├── malicious_txs/   # 4 파일
│   └── excluded_txs/    # 541 파일
├── TrustSwap/
│   ├── benign_txs/      # 27,024 파일
│   ├── malicious_txs/   # 0 파일 (빈 디렉토리)
│   └── excluded_txs/    # 3,122 파일
├── AudiusProject/
│   ├── benign_txs/      # 865 파일
│   ├── malicious_txs/   # 2 파일
│   └── excluded_txs/    # 9 파일
├── SushiSwap/
│   ├── benign_txs/      # 199 파일
│   ├── malicious_txs/   # 2 파일
│   └── excluded_txs/    # 5 파일
└── ShataCapital/
    ├── benign_txs/      # 20 파일
    ├── malicious_txs/   # 2 파일
    └── excluded_txs/    # 1 파일
```

### 2.2 파일 형식

- **형식**: JSON
- **인코딩**: UTF-8
- **명명 규칙**: `<block_number>-<tx_index>.json`

### 2.3 레이블 정의

| 레이블 | 의미 | 기준 |
|--------|------|------|
| `benign` | 정상 트랜잭션 | 알려진 보안 사고와 무관한 정상 사용 |
| `malicious` | 악성 트랜잭션 | 확인된 공격/익스플로잇 트랜잭션 |
| `excluded` | 제외 트랜잭션 | 실패하거나 분석 범위 외의 트랜잭션 |

---

## 3. JSON 스키마 요약

상세 스키마는 [schema.md](schema.md) 참조.

### 3.1 루트 구조

```json
{
  "<tx_hash>": [<Call>, ...]
}
```

### 3.2 Call 객체 핵심 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | CALL, STATICCALL, DELEGATECALL, CREATE |
| `from` | address | 호출자 주소 |
| `to` | address | 피호출자 주소 |
| `gas` | integer | 할당된 가스 |
| `gasUsed` | integer | 사용된 가스 |
| `func` | hex/null | 함수 시그니처 (4 bytes) |
| `args` | array/null | 함수 인자 |
| `calls` | array/null | 중첩 콜 (재귀) |

---

## 4. 통계 요약

상세 통계는 [statistics.md](statistics.md) 참조.

### 4.1 전체 통계

| 항목 | 값 |
|------|-----|
| 총 파일 수 | 41,711 |
| 총 크기 | 706 MB |
| Benign | 38,023 (91.15%) |
| Malicious | 10 (0.02%) |
| Excluded | 3,678 (8.82%) |

### 4.2 Benign vs Malicious

| 지표 | Benign | Malicious |
|------|--------|-----------|
| 평균 콜 깊이 | 5.19 | 9.60 |
| 평균 총 콜 수 | 12.79 | 76.60 |

---

## 5. 보안 사고 요약

상세 정보는 [incidents/](incidents/) 디렉토리 참조.

### 5.1 포함된 보안 사고

| 프로젝트 | 사고 일시 | 피해 규모 | 공격 유형 |
|---------|----------|----------|----------|
| NomadBridge | 2022.08 | $190M | 메시지 검증 우회 |
| Audius | 2022.07 | $6M | 스토리지 충돌 |
| SushiSwap | 2023.04 | $3.3M | External Call Injection |
| ShataCapital | 2023.01 | 미확인 | DeFi 익스플로잇 |

### 5.2 악성 트랜잭션 분포

| 프로젝트 | Malicious 수 |
|---------|-------------|
| NomadBridge | 4 |
| AudiusProject | 2 |
| SushiSwap | 2 |
| ShataCapital | 2 |
| TrustSwap | 0 |

---

## 6. BlockScan 모델 컨텍스트

### 6.1 토큰화 전략

BlockScan은 다중 모달 토크나이저를 사용합니다:

| 데이터 유형 | 토큰화 방식 |
|------------|-----------|
| 주소/해시 | Top-7000 주소는 단일 토큰, 나머지 OOV |
| 숫자 | 40자 hex 변환 후 서브워드 토큰화 |
| 로그 메시지 | WordPiece 서브워드 토큰화 |

### 6.2 특수 토큰

```
[START] - 콜 시작
[END] - 콜 종료
[INs] - 입력 인자 시작
[OUTs] - 출력 시작
[logs] - 로그 시작
[NONE] - 빈 값
```

### 6.3 시퀀스 구조

```
[START] [CALL] <from> <to> <func_sig>
<gas_hex> <value_hex> [INs] <arg_type> <arg_data> ...
[OUTs] <out_type> <out_data> [logs] <log_msg> ...
[END] [START] [DELEGATECALL] ... [END]
```

### 6.4 학습 파라미터

| 파라미터 | 값 |
|---------|-----|
| 모델 | BERT-base (100M params) |
| 최대 시퀀스 | 1,024 토큰 |
| 마스킹 비율 | 15% |
| 학습/테스트 분할 | 80%/20% (시간순) |

---

## 7. 데이터 로딩

### 7.1 Python 예시

```python
import json
from pathlib import Path

DATA_ROOT = Path("data_20240125")

def load_transaction(file_path):
    with open(file_path) as f:
        data = json.load(f)
    tx_hash = list(data.keys())[0]
    return tx_hash, data[tx_hash]

def iter_project(project_name, label="benign"):
    label_dir = DATA_ROOT / project_name / f"{label}_txs"
    for json_file in label_dir.glob("*.json"):
        yield load_transaction(json_file)

# 사용 예시
for tx_hash, calls in iter_project("NomadBridge", "malicious"):
    print(f"TX: {tx_hash[:20]}... Calls: {len(calls)}")
```

### 7.2 데이터 로더 (PyTorch)

```python
from torch.utils.data import Dataset

class BlockScanDataset(Dataset):
    def __init__(self, data_root, projects=None, labels=None):
        self.files = []
        data_root = Path(data_root)
        
        projects = projects or ["NomadBridge", "TrustSwap", ...]
        labels = labels or ["benign", "malicious"]
        
        for project in projects:
            for label in labels:
                label_dir = data_root / project / f"{label}_txs"
                if label_dir.exists():
                    for f in label_dir.glob("*.json"):
                        self.files.append((f, label))
    
    def __len__(self):
        return len(self.files)
    
    def __getitem__(self, idx):
        file_path, label = self.files[idx]
        tx_hash, calls = load_transaction(file_path)
        return {
            "tx_hash": tx_hash,
            "calls": calls,
            "label": 0 if label == "benign" else 1
        }
```

---

## 8. 분석 도구

### 8.1 콜 트리 분석

```python
def get_call_depth(call, depth=1):
    """최대 콜 깊이 계산"""
    if not call.get("calls"):
        return depth
    return max(get_call_depth(c, depth + 1) for c in call["calls"])

def count_call_types(call):
    """콜 타입별 개수 집계"""
    counts = {call["type"]: 1}
    for nested in call.get("calls") or []:
        for t, c in count_call_types(nested).items():
            counts[t] = counts.get(t, 0) + c
    return counts

def flatten_calls(call, result=None):
    """콜 트리를 플랫 리스트로 변환"""
    if result is None:
        result = []
    result.append(call)
    for nested in call.get("calls") or []:
        flatten_calls(nested, result)
    return result
```

### 8.2 로그 분석

```python
def extract_logs(call):
    """모든 로그 이벤트 추출"""
    logs = call.get("logs") or []
    for nested in call.get("calls") or []:
        logs.extend(extract_logs(nested))
    return logs

def decode_transfer_event(log):
    """ERC20 Transfer 이벤트 디코딩"""
    TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    if log["topics"][0]["data"] == TRANSFER_SIG:
        return {
            "from": log["topics"][1]["data"],
            "to": log["topics"][2]["data"],
            "amount": log["data"][0]["data"]
        }
    return None
```

---

## 9. 알려진 제한사항

### 9.1 데이터 불균형

- Malicious가 전체의 0.02%에 불과
- 모델 학습 시 오버샘플링/가중치 조정 필요

### 9.2 프로젝트 편향

- TrustSwap이 72%를 차지
- 일부 프로젝트는 샘플 수가 매우 적음 (ShataCapital: 23개)

### 9.3 시간적 제한

- 2020년 10월 ~ 2023년 4월 데이터만 포함
- 최신 공격 패턴은 반영되지 않음

### 9.4 체인 제한

- Ethereum 메인넷만 포함
- L2 및 다른 EVM 체인 미포함

---

## 10. 파일 경로 참조

| 파일 | 경로 |
|------|------|
| 데이터 루트 | `data_20240125/` |
| 스키마 문서 | `docs/schema.md` |
| 통계 문서 | `docs/statistics.md` |
| 사고 문서 | `docs/incidents/*.md` |
| 시각화 | `docs/figures/*.png` |
| 분석 스크립트 | `scripts/analyze_data.py` |

---

## 부록: 환경 설정

### A.1 Python 환경

```bash
# uv로 가상환경 생성
cd research/onchain_detect/data
uv venv
source .venv/bin/activate

# 의존성 설치
uv pip install pandas numpy matplotlib seaborn tqdm
```

### A.2 분석 스크립트 실행

```bash
# 전체 분석 실행
uv run python scripts/analyze_data.py

# 출력 파일
# - docs/statistics_raw.json
# - docs/analysis_data.csv
# - docs/figures/*.png
```
