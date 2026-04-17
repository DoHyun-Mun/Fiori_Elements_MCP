# Kyma Deployment Guide

## 아키텍처

```
[브라우저] → [APIRule/Istio Gateway] → [Approuter (XSUAA 인증)] → [CAP Backend]
                                              ↓
                                    [XSUAA (BTP Service Operator)]
                                              ↓
                                         [IAS (IdP)]
```

## 사전 요구사항

1. Kyma 클러스터에 접근 가능한 kubeconfig (`kubeconfig-dev.yaml`)
2. BTP Service Operator가 설치되어 있어야 함
3. Docker 이미지가 ghcr.io에 push 되어 있어야 함
4. ghcr-secret이 namespace에 생성되어 있어야 함

## 배포 순서

### 1. Namespace 생성
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/namespace.yaml
```

### 2. XSUAA ServiceInstance & ServiceBinding 생성 (BTP Service Operator)
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/xsuaa-serviceinstance.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/xsuaa-servicebinding.yaml
```

ServiceInstance와 ServiceBinding이 Ready 상태인지 확인:
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl get serviceinstances,servicebindings -n fiori-mcp-test
```

ServiceBinding이 생성되면 `xsuaa-binding-secret` Secret이 자동 생성됩니다.
이 Secret의 credentials를 사용하여 `uaa-default-services-secret.yaml`의 `default-services.json`을 업데이트합니다.

### 3. Secrets & ConfigMap 배포
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/uaa-default-services-secret.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/approuter-xs-app-configmap.yaml
```

### 4. CAP Backend 배포
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/deployment.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/service.yaml
```

### 5. Approuter 배포
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/approuter-deployment.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/approuter-service.yaml
```

### 6. APIRule (Istio Ingress) 배포
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/apirule.yaml
```

### 7. 접속 확인
```
https://fiori-mcp-test.c56380c.kyma.ondemand.com/
```

## 인증 흐름

1. 사용자가 앱 URL에 접속
2. Approuter가 XSUAA authorize URL로 리다이렉트
3. XSUAA가 설정된 IAS (Identity Authentication Service)로 인증 위임
4. 사용자가 IAS에서 로그인
5. IAS → XSUAA → Approuter로 토큰 발급
6. Approuter가 JWT 토큰을 CAP Backend로 전달

## 주요 파일

| 파일 | 설명 |
|------|------|
| `k8s/xsuaa-serviceinstance.yaml` | XSUAA ServiceInstance (BTP Service Operator) |
| `k8s/xsuaa-servicebinding.yaml` | XSUAA ServiceBinding → `xsuaa-binding-secret` 자동 생성 |
| `k8s/uaa-default-services-secret.yaml` | Approuter의 default-services.json (XSUAA credentials) |
| `k8s/approuter-xs-app-configmap.yaml` | Approuter의 xs-app.json (라우팅 설정) |
| `k8s/approuter-deployment.yaml` | Approuter Deployment |
| `k8s/approuter-service.yaml` | Approuter Service |
| `k8s/deployment.yaml` | CAP Backend Deployment |
| `k8s/service.yaml` | CAP Backend Service |
| `k8s/apirule.yaml` | Istio Gateway APIRule |
| `k8s/namespace.yaml` | Namespace 정의 |

## Docker 이미지 빌드 & Push

```bash
# CAP Backend
docker build -t ghcr.io/dohyun-mun/fiori-mcp-test:latest .
docker push ghcr.io/dohyun-mun/fiori-mcp-test:latest

# Approuter
cd approuter
docker build -t ghcr.io/dohyun-mun/fiori-mcp-test-approuter:latest .
docker push ghcr.io/dohyun-mun/fiori-mcp-test-approuter:latest
```

## 전체 재배포
```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl rollout restart deployment fiori-mcp-test -n fiori-mcp-test
KUBECONFIG=kubeconfig-dev.yaml kubectl rollout restart deployment approuter -n fiori-mcp-test