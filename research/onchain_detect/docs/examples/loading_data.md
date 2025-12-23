# 데이터 로딩 예제

이 문서는 BlockScan 데이터셋을 로딩하고 분석하는 다양한 예제를 제공합니다.

---

## 1. 기본 데이터 로딩

### 1.1 단일 파일 로딩

```python
import json
from pathlib import Path

def load_transaction(file_path: str) -> tuple:
    """
    JSON 파일에서 트랜잭션 데이터 로드
    
    Args:
        file_path: JSON 파일 경로
    
    Returns:
        (트랜잭션 해시, 콜 객체 리스트) 튜플
    """
    with open(file_path, 'r') as f:
        data = json.load(f)
    tx_hash = list(data.keys())[0]
    return tx_hash, data[tx_hash]

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
print(f"Transaction Hash: {tx_hash}")
print(f"Root Call Type: {calls[0]['type']}")
print(f"From: {calls[0]['from']}")
print(f"To: {calls[0]['to']}")
```

### 1.2 프로젝트별 데이터 로딩

```python
from pathlib import Path

DATA_ROOT = Path("data_20240125")

def iter_project_files(project: str, label: str = "benign"):
    """
    프로젝트의 특정 레이블 데이터 이터레이터
    
    Args:
        project: 프로젝트 이름 (NomadBridge, TrustSwap, etc.)
        label: 레이블 (benign, malicious, excluded)
    
    Yields:
        (파일 경로, 트랜잭션 해시, 콜 리스트) 튜플
    """
    label_dir = DATA_ROOT / project / f"{label}_txs"
    for json_file in sorted(label_dir.glob("*.json")):
        tx_hash, calls = load_transaction(json_file)
        yield json_file, tx_hash, calls

# 사용 예시: NomadBridge의 악성 트랜잭션 출력
for file_path, tx_hash, calls in iter_project_files("NomadBridge", "malicious"):
    print(f"File: {file_path.name}")
    print(f"TX Hash: {tx_hash[:40]}...")
    print(f"Call Depth: {get_call_depth(calls[0])}")
    print("---")
```

### 1.3 모든 프로젝트 로딩

```python
PROJECTS = ["NomadBridge", "TrustSwap", "AudiusProject", "SushiSwap", "ShataCapital"]
LABELS = ["benign", "malicious", "excluded"]

def load_all_data():
    """
    전체 데이터셋 로딩
    
    Returns:
        dict: {project: {label: [(file_path, tx_hash, calls), ...]}}
    """
    all_data = {}
    for project in PROJECTS:
        all_data[project] = {}
        for label in LABELS:
            all_data[project][label] = list(iter_project_files(project, label))
    return all_data

# 사용 예시
data = load_all_data()
print(f"NomadBridge benign count: {len(data['NomadBridge']['benign'])}")
print(f"Total malicious: {sum(len(data[p]['malicious']) for p in PROJECTS)}")
```

---

## 2. 콜 트리 분석

### 2.1 콜 깊이 계산

```python
def get_call_depth(call: dict, current_depth: int = 1) -> int:
    """
    콜 트리의 최대 깊이 계산
    
    Args:
        call: 콜 객체
        current_depth: 현재 깊이 (재귀용)
    
    Returns:
        최대 깊이
    """
    if not call.get('calls'):
        return current_depth
    return max(get_call_depth(c, current_depth + 1) for c in call['calls'])

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/malicious_txs/15259101-0.json")
depth = get_call_depth(calls[0])
print(f"Call depth: {depth}")  # 11
```

### 2.2 총 콜 수 계산

```python
def count_total_calls(call: dict) -> int:
    """
    총 내부 콜 수 계산
    
    Args:
        call: 콜 객체
    
    Returns:
        총 콜 수
    """
    count = 1  # 현재 콜
    for nested in call.get('calls') or []:
        count += count_total_calls(nested)
    return count

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/ShataCapital/malicious_txs/16696240-0.json")
total = count_total_calls(calls[0])
print(f"Total calls: {total}")  # 308
```

### 2.3 콜 타입별 집계

```python
def count_call_types(call: dict) -> dict:
    """
    콜 타입별 개수 집계
    
    Args:
        call: 콜 객체
    
    Returns:
        {call_type: count} 딕셔너리
    """
    counts = {call['type']: 1}
    for nested in call.get('calls') or []:
        for call_type, count in count_call_types(nested).items():
            counts[call_type] = counts.get(call_type, 0) + count
    return counts

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
types = count_call_types(calls[0])
print(f"Call types: {types}")
# {'CALL': 5, 'STATICCALL': 8, 'DELEGATECALL': 6}
```

### 2.4 콜 트리 플래트닝

```python
def flatten_calls(call: dict, result: list = None) -> list:
    """
    중첩된 콜 트리를 플랫 리스트로 변환
    
    Args:
        call: 콜 객체
        result: 결과 리스트 (재귀용)
    
    Returns:
        플랫 콜 리스트
    """
    if result is None:
        result = []
    result.append(call)
    for nested in call.get('calls') or []:
        flatten_calls(nested, result)
    return result

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
flat_calls = flatten_calls(calls[0])
print(f"Total calls in flat list: {len(flat_calls)}")

# 모든 콜의 gas 사용량 합계
total_gas = sum(c.get('gasUsed', 0) for c in flat_calls)
print(f"Total gas used: {total_gas:,}")
```

---

## 3. 이벤트 로그 분석

### 3.1 모든 로그 추출

```python
def extract_all_logs(call: dict) -> list:
    """
    콜 트리에서 모든 이벤트 로그 추출
    
    Args:
        call: 콜 객체
    
    Returns:
        로그 리스트
    """
    logs = call.get('logs') or []
    for nested in call.get('calls') or []:
        logs.extend(extract_all_logs(nested))
    return logs

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
logs = extract_all_logs(calls[0])
print(f"Total logs: {len(logs)}")

for log in logs[:3]:
    print(f"Contract: {log['address']}")
    print(f"Topics: {len(log['topics'])}")
```

### 3.2 ERC20 Transfer 이벤트 디코딩

```python
TRANSFER_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

def decode_transfer_events(logs: list) -> list:
    """
    ERC20 Transfer 이벤트 디코딩
    
    Args:
        logs: 로그 리스트
    
    Returns:
        Transfer 이벤트 리스트
    """
    transfers = []
    for log in logs:
        if not log.get('topics') or len(log['topics']) < 3:
            continue
        if log['topics'][0]['data'].lower() == TRANSFER_SIGNATURE:
            transfers.append({
                'token': log['address'],
                'from': log['topics'][1]['data'],
                'to': log['topics'][2]['data'],
                'amount': log['data'][0]['data'] if log.get('data') else None
            })
    return transfers

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
logs = extract_all_logs(calls[0])
transfers = decode_transfer_events(logs)

for t in transfers:
    print(f"Token: {t['token'][:20]}...")
    print(f"From: {t['from'][-10:]}")
    print(f"To: {t['to'][-10:]}")
    print("---")
```

---

## 4. 상태 변경 분석

### 4.1 스토리지 변경 추출

```python
def extract_state_changes(call: dict) -> list:
    """
    콜 트리에서 모든 상태 변경 추출
    
    Args:
        call: 콜 객체
    
    Returns:
        상태 변경 리스트
    """
    changes = call.get('state') or []
    for nested in call.get('calls') or []:
        changes.extend(extract_state_changes(nested))
    return changes

def separate_reads_writes(changes: list) -> tuple:
    """
    상태 변경을 읽기/쓰기로 분리
    
    Args:
        changes: 상태 변경 리스트
    
    Returns:
        (reads, writes) 튜플
    """
    reads = [c for c in changes if c['type'] == 'READ']
    writes = [c for c in changes if c['type'] == 'WRITE']
    return reads, writes

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
changes = extract_state_changes(calls[0])
reads, writes = separate_reads_writes(changes)

print(f"Storage READs: {len(reads)}")
print(f"Storage WRITEs: {len(writes)}")
```

---

## 5. PyTorch 데이터 로더

### 5.1 기본 데이터셋 클래스

```python
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path

class BlockScanDataset(Dataset):
    def __init__(self, data_root, projects=None, labels=None):
        """
        BlockScan PyTorch Dataset
        
        Args:
            data_root: 데이터 루트 경로
            projects: 포함할 프로젝트 리스트 (None이면 전체)
            labels: 포함할 레이블 리스트 (None이면 benign, malicious)
        """
        self.files = []
        data_root = Path(data_root)
        
        projects = projects or ["NomadBridge", "TrustSwap", "AudiusProject", 
                                 "SushiSwap", "ShataCapital"]
        labels = labels or ["benign", "malicious"]
        
        for project in projects:
            for label in labels:
                label_dir = data_root / project / f"{label}_txs"
                if label_dir.exists():
                    for f in label_dir.glob("*.json"):
                        self.files.append((f, 0 if label == "benign" else 1))
    
    def __len__(self):
        return len(self.files)
    
    def __getitem__(self, idx):
        file_path, label = self.files[idx]
        tx_hash, calls = load_transaction(file_path)
        
        # 기본 특성 추출
        root_call = calls[0]
        features = {
            'call_depth': get_call_depth(root_call),
            'total_calls': count_total_calls(root_call),
            'gas_used': root_call.get('gasUsed', 0),
            'has_create': 1 if any(c['type'] == 'CREATE' 
                                   for c in flatten_calls(root_call)) else 0
        }
        
        return {
            'tx_hash': tx_hash,
            'features': torch.tensor(list(features.values()), dtype=torch.float32),
            'label': torch.tensor(label, dtype=torch.long)
        }

# 사용 예시
dataset = BlockScanDataset("data_20240125", labels=["benign", "malicious"])
loader = DataLoader(dataset, batch_size=32, shuffle=True)

for batch in loader:
    print(f"Features shape: {batch['features'].shape}")
    print(f"Labels: {batch['label']}")
    break
```

### 5.2 불균형 데이터 처리

```python
from torch.utils.data import WeightedRandomSampler

def create_balanced_loader(dataset, batch_size=32):
    """
    클래스 균형을 맞춘 데이터 로더 생성
    """
    # 레이블별 카운트
    labels = [dataset[i]['label'].item() for i in range(len(dataset))]
    class_counts = [labels.count(0), labels.count(1)]
    
    # 가중치 계산 (희소 클래스에 높은 가중치)
    weights = [1.0 / class_counts[l] for l in labels]
    sampler = WeightedRandomSampler(weights, len(labels))
    
    return DataLoader(dataset, batch_size=batch_size, sampler=sampler)

# 사용 예시
balanced_loader = create_balanced_loader(dataset)
```

---

## 6. 분석 유틸리티

### 6.1 파일 메타데이터 추출

```python
import re

def parse_filename(filename: str) -> dict:
    """
    파일명에서 블록 번호와 인덱스 추출
    
    Args:
        filename: 파일명 (예: "15259101-0.json")
    
    Returns:
        {'block': int, 'index': int}
    """
    match = re.match(r'(\d+)-(\d+)\.json', filename)
    if match:
        return {
            'block': int(match.group(1)),
            'index': int(match.group(2))
        }
    return None

def get_file_metadata(file_path: Path) -> dict:
    """
    파일 메타데이터 수집
    """
    meta = parse_filename(file_path.name)
    meta['project'] = file_path.parent.parent.name
    meta['label'] = file_path.parent.name.replace('_txs', '')
    meta['size_kb'] = file_path.stat().st_size / 1024
    return meta

# 사용 예시
file_path = Path("data_20240125/NomadBridge/malicious_txs/15259101-0.json")
meta = get_file_metadata(file_path)
print(meta)
# {'block': 15259101, 'index': 0, 'project': 'NomadBridge', 
#  'label': 'malicious', 'size_kb': 45.2}
```

### 6.2 프로젝트 통계 요약

```python
def summarize_project(project: str) -> dict:
    """
    프로젝트 통계 요약
    """
    summary = {'benign': 0, 'malicious': 0, 'excluded': 0}
    depths = []
    
    for label in ['benign', 'malicious', 'excluded']:
        for file_path, tx_hash, calls in iter_project_files(project, label):
            summary[label] += 1
            depths.append(get_call_depth(calls[0]))
    
    summary['avg_depth'] = sum(depths) / len(depths) if depths else 0
    summary['max_depth'] = max(depths) if depths else 0
    
    return summary

# 사용 예시
for project in PROJECTS:
    stats = summarize_project(project)
    print(f"{project}: {stats}")
```

---

## 7. 시각화 예제

### 7.1 콜 트리 시각화 (텍스트)

```python
def print_call_tree(call: dict, indent: int = 0) -> None:
    """
    콜 트리를 텍스트로 시각화
    """
    prefix = "  " * indent + ("├── " if indent > 0 else "")
    func = call.get('func', 'N/A')[:10] if call.get('func') else 'N/A'
    to_addr = call.get('to', '')[-8:]
    print(f"{prefix}{call['type']} → {to_addr} ({func})")
    
    for nested in call.get('calls') or []:
        print_call_tree(nested, indent + 1)

# 사용 예시
tx_hash, calls = load_transaction("data_20240125/NomadBridge/benign_txs/14881413-0.json")
print_call_tree(calls[0])
```

### 7.2 Matplotlib 시각화

```python
import matplotlib.pyplot as plt

def plot_call_type_distribution(calls: list) -> None:
    """
    콜 타입 분포 파이 차트
    """
    type_counts = {}
    for call in calls:
        types = count_call_types(call)
        for t, c in types.items():
            type_counts[t] = type_counts.get(t, 0) + c
    
    plt.figure(figsize=(8, 8))
    plt.pie(type_counts.values(), labels=type_counts.keys(), autopct='%1.1f%%')
    plt.title('Call Type Distribution')
    plt.show()

# 사용 예시
all_calls = []
for _, _, calls in iter_project_files("NomadBridge", "benign"):
    all_calls.append(calls[0])
    if len(all_calls) >= 100:  # 샘플링
        break

plot_call_type_distribution(all_calls)
```
