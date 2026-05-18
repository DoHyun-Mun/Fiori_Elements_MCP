# Kubernetes (Kyma) 배포 가이드

## 배포 순서

### 자동 배포 (권장)

```bash
./scripts/deploy-kyma.sh
```

이 스크립트가 아래 모든 단계를 자동으로 실행합니다.

---

### 수동 배포

#### 0. 사전 설정 - GHCR Secret 생성

```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl create secret docker-registry ghcr-secret \
  --namespace store-pjt \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_USERNAME> \
  --docker-password=<GITHUB_PAT>
```

#### 1. Namespace 생성
```bash
kubectl apply -f k8s/namespace.yaml
```

#### 2. Docker 이미지 빌드 & Push
```bash
# CAP Backend
docker build -t ghcr.io/dohyun-mun/store-pjt:latest --platform linux/amd64 .
docker push ghcr.io/dohyun-mun/store-pjt:latest

# HDI Deployer
docker build -f Dockerfile.hdi-deployer -t ghcr.io/dohyun-mun/store-pjt-hdi-deployer:latest --platform linux/amd64 .
docker push ghcr.io/dohyun-mun/store-pjt-hdi-deployer:latest

cd approuter
docker build -t ghcr.io/dohyun-mun/store-pjt-approuter:latest --platform linux/amd64 .
docker push ghcr.io/dohyun-mun/store-pjt-approuter:latest
cd ..
```

#### 3. BTP Service Operator 리소스
```bash
kubectl apply -f k8s/xsuaa-serviceinstance.yaml
kubectl apply -f k8s/xsuaa-servicebinding.yaml
kubectl apply -f k8s/hana-serviceinstance.yaml
kubectl apply -f k8s/hana-servicebinding.yaml

# 바인딩 Ready 확인
KUBECONFIG=kubeconfig-dev.yaml kubectl get serviceinstances,servicebindings -n store-pjt
```

#### 4. HDI Deployer (스키마 + 데이터 배포)
```bash
# 기존 Job 삭제
KUBECONFIG=kubeconfig-dev.yaml kubectl delete job hdi-deployer -n store-pjt 2>/dev/null || true

kubectl apply -f k8s/hdi-deployer-job.yaml

# 로그 확인
KUBECONFIG=kubeconfig-dev.yaml kubectl logs job/hdi-deployer -n store-pjt --tail=20 -f
```

#### 5. CAP Backend + Approuter + APIRule
```bash
kubectl apply -f k8s/approuter-xs-app-configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/approuter-deployment.yaml
kubectl apply -f k8s/approuter-service.yaml
kubectl apply -f k8s/apirule.yaml
```

---

## 환경별 설정 변경

| 파일 | 변경 항목 | 현재 값 |
|------|-----------|---------|
| `k8s/apirule.yaml` | `spec.hosts[0]` | `store-pjt.c56380c.kyma.ondemand.com` |
| `k8s/xsuaa-serviceinstance.yaml` | `redirect-uris` | `https://store-pjt.c56380c.kyma.ondemand.com/login/callback` |

---

## 접속 URL

```
https://store-pjt.c56380c.kyma.ondemand.com/
```

---

## 트러블슈팅

```bash
# 전체 재배포
KUBECONFIG=kubeconfig-dev.yaml kubectl rollout restart deployment store-pjt -n store-pjt
KUBECONFIG=kubeconfig-dev.yaml kubectl rollout restart deployment approuter -n store-pjt

# HDI Deployer 재실행 (스키마 변경 시)
KUBECONFIG=kubeconfig-dev.yaml kubectl delete job hdi-deployer -n store-pjt 2>/dev/null || true
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/hdi-deployer-job.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl logs job/hdi-deployer -n store-pjt --tail=20 -f

# Pod 상태 확인
KUBECONFIG=kubeconfig-dev.yaml kubectl get pods -n store-pjt

# 실시간 로그
KUBECONFIG=kubeconfig-dev.yaml kubectl logs -f deploy/store-pjt -n store-pjt

# ServiceBinding 상태 확인
KUBECONFIG=kubeconfig-dev.yaml kubectl get serviceinstances,servicebindings -n store-pjt
```

### HANA Secret 확인

```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl get secret hana-hdi-secret -n store-pjt
```

### CAP Backend 이전 로그 확인

```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl logs deploy/store-pjt -n store-pjt --previous