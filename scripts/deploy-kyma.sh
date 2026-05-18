#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# Kyma 배포 자동화 스크립트
# 사용법: ./scripts/deploy-kyma.sh [옵션]
# ══════════════════════════════════════════════════════════════════════

set -e

# ─── 색상 정의 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── 변수 설정 ───
NAMESPACE="store-pjt"
DOCKER_REGISTRY="ghcr.io/dohyun-mun"
APP_NAME="store-pjt"
KUBECONFIG_PATH="kubeconfig-dev.yaml"

# ─── 옵션 파싱 ───
DEPLOY_APP=false
DEPLOY_DB=false
DEPLOY_ROUTER=false
DEPLOY_ALL=false
SHOW_HELP=false

# 옵션이 없으면 도움말 표시
if [ $# -eq 0 ]; then
    SHOW_HELP=true
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --app)      DEPLOY_APP=true; shift ;;
        --db)       DEPLOY_DB=true; shift ;;
        --router)   DEPLOY_ROUTER=true; shift ;;
        --all)      DEPLOY_ALL=true; shift ;;
        --help|-h)  SHOW_HELP=true; shift ;;
        --kubeconfig) KUBECONFIG_PATH="$2"; shift 2 ;;
        *)
            # 인자가 .yaml 파일이면 kubeconfig로 간주 (하위호환)
            if [[ "$1" == *.yaml ]]; then
                KUBECONFIG_PATH="$1"; shift
            else
                echo -e "${RED}❌ 알 수 없는 옵션: $1${NC}"
                SHOW_HELP=true; shift
            fi
            ;;
    esac
done

# 전체 배포 플래그
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_APP=true
    DEPLOY_DB=true
    DEPLOY_ROUTER=true
fi

# ─── 도움말 ───
if [ "$SHOW_HELP" = true ]; then
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Kyma 배포 자동화 - ${APP_NAME}${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}사용법:${NC} ./scripts/deploy-kyma.sh [옵션]"
    echo ""
    echo -e "  ${CYAN}옵션:${NC}"
    echo "    --all         전체 배포 (DB + Backend + Approuter + APIRule)"
    echo "    --app         CAP Backend만 (srv/, app/ 수정 시) ⚡ 가장 빠름"
    echo "    --db          DB 스키마/데이터만 (db/ 수정 시)"
    echo "    --router      Approuter만 (approuter/, xs-app.json 수정 시)"
    echo "    --kubeconfig  kubeconfig 파일 경로 지정"
    echo "    --help, -h    이 도움말 표시"
    echo ""
    echo -e "  ${CYAN}조합 가능:${NC}"
    echo "    --app --router    Backend + Approuter (화면+서비스, DB 변경 없을 때)"
    echo "    --app --db        Backend + DB (스키마+서비스 동시 변경)"
    echo ""
    echo -e "  ${CYAN}예시:${NC}"
    echo "    ./scripts/deploy-kyma.sh --all             # 최초 배포 / 전체"
    echo "    ./scripts/deploy-kyma.sh --app             # CSS/JS/API 수정 후 빠른 배포 ⚡"
    echo "    ./scripts/deploy-kyma.sh --db              # 스키마/CSV 변경 후"
    echo "    ./scripts/deploy-kyma.sh --app --router    # 프론트+백 변경, DB는 그대로"
    echo ""
    echo -e "  ${CYAN}언제 뭘 쓸까?${NC}"
    echo "    ┌─────────────────────────────┬──────────────────┐"
    echo "    │ 수정한 파일                  │ 사용할 옵션      │"
    echo "    ├─────────────────────────────┼──────────────────┤"
    echo "    │ app/css, app/js, srv/       │ --app            │"
    echo "    │ db/schema.cds, db/data/     │ --db             │"
    echo "    │ approuter/, xs-app.json     │ --router         │"
    echo "    │ 최초 배포 / k8s/ 변경       │ --all            │"
    echo "    └─────────────────────────────┴──────────────────┘"
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    exit 0
fi

# ─── 배포 대상 표시 ───
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Kyma 배포 자동화 - ${APP_NAME}${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  📋 배포 대상:"
[ "$DEPLOY_APP" = true ] && echo -e "     ${GREEN}✓${NC} CAP Backend (store-pjt)"
[ "$DEPLOY_DB" = true ] && echo -e "     ${GREEN}✓${NC} HDI Deployer (DB 스키마/데이터)"
[ "$DEPLOY_ROUTER" = true ] && echo -e "     ${GREEN}✓${NC} Approuter"
echo ""

# ─── Step 0: 사전 확인 ───
echo -e "${YELLOW}[Step 0] 사전 요구사항 확인...${NC}"

# kubeconfig 파일 확인
if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo -e "${RED}❌ kubeconfig 파일을 찾을 수 없습니다: $KUBECONFIG_PATH${NC}"
    echo ""
    echo -e "${YELLOW}Kyma Runtime kubeconfig를 다운로드하려면:${NC}"
    echo "  1. BTP Cockpit → Subaccount → Overview 페이지"
    echo "  2. 'Kyma Environment' 탭 → 'KubeconfigURL' 링크 클릭"
    echo "  3. 다운로드한 파일을 프로젝트 루트에 저장:"
    echo "     mv ~/Downloads/kubeconfig.yaml ./kubeconfig-dev.yaml"
    echo ""
    echo "  사용법: $0 --kubeconfig [kubeconfig-파일-경로]"
    exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"
echo -e "  ✅ kubeconfig: ${KUBECONFIG_PATH}"

# kubectl 확인
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl이 설치되어 있지 않습니다.${NC}"
    echo "  brew install kubectl"
    exit 1
fi
echo -e "  ✅ kubectl: $(kubectl version --client --short 2>/dev/null || kubectl version --client -o json | jq -r '.clientVersion.gitVersion')"

# docker 확인
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ docker가 설치되어 있지 않습니다.${NC}"
    exit 1
fi
echo -e "  ✅ docker: $(docker --version | awk '{print $3}')"

# Docker daemon 확인
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}  ⚠️  Docker Desktop이 실행되지 않고 있습니다. 시작합니다...${NC}"
    open -a Docker
    for i in $(seq 1 30); do
        docker info &> /dev/null && break || sleep 2
    done
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker Desktop을 시작할 수 없습니다. 수동으로 실행해주세요.${NC}"
        exit 1
    fi
fi

# 클러스터 연결 확인
echo -e "  클러스터 연결 확인 중..."
if ! kubectl cluster-info --request-timeout=10s &> /dev/null; then
    echo -e "${RED}❌ Kyma 클러스터에 연결할 수 없습니다.${NC}"
    echo "  kubeconfig가 유효한지, OIDC 로그인이 필요한지 확인하세요."
    echo "  kubectl-oidc_login 플러그인이 필요합니다:"
    echo "    brew install int128/kubelogin/kubelogin"
    exit 1
fi
CLUSTER_URL=$(kubectl cluster-info 2>/dev/null | head -1 | grep -oE 'https://[^ ]+' || echo "연결됨")
echo -e "  ✅ 클러스터: ${CLUSTER_URL}"
echo ""

# ═══════════════════════════════════════════════════════════════
# 전체 배포 시에만 실행되는 단계 (--all)
# ═══════════════════════════════════════════════════════════════

if [ "$DEPLOY_ALL" = true ]; then
    # ─── Step 1: Namespace 생성 ───
    echo -e "${YELLOW}[Step 1] Namespace 생성...${NC}"
    kubectl apply -f k8s/namespace.yaml
    echo -e "  ${GREEN}✅ Namespace '${NAMESPACE}' 준비 완료${NC}"
    echo ""

    # ─── BTP Service Operator 리소스 배포 ───
    echo -e "${YELLOW}[Step 2] BTP Service Operator 리소스 배포 (XSUAA + HANA)...${NC}"
    kubectl apply -f k8s/xsuaa-serviceinstance.yaml
    kubectl apply -f k8s/xsuaa-servicebinding.yaml
    echo -e "  ✅ XSUAA ServiceInstance/ServiceBinding 적용"
    kubectl apply -f k8s/hana-serviceinstance.yaml
    kubectl apply -f k8s/hana-servicebinding.yaml
    echo -e "  ✅ HANA HDI ServiceInstance/ServiceBinding 적용"

    echo -e "  ⏳ ServiceBinding이 Ready 될 때까지 대기 중..."
    for i in $(seq 1 60); do
        HANA_STATUS=$(kubectl get servicebinding hana-hdi-binding -n ${NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        XSUAA_STATUS=$(kubectl get servicebinding xsuaa-binding -n ${NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        if [ "$HANA_STATUS" = "True" ] && [ "$XSUAA_STATUS" = "True" ]; then
            echo -e "  ${GREEN}✅ 모든 ServiceBinding Ready!${NC}"
            break
        fi
        if [ $i -eq 60 ]; then
            echo -e "  ${YELLOW}⚠️  타임아웃 (5분). 계속 진행합니다...${NC}"
            break
        fi
        echo -ne "  ⏳ 대기 중... (${i}/60) HANA=${HANA_STATUS}, XSUAA=${XSUAA_STATUS}\r"
        sleep 5
    done
    echo ""

    # ─── ConfigMap 배포 ───
    echo -e "${YELLOW}[Step 3] ConfigMap 배포...${NC}"
    kubectl apply -f k8s/approuter-xs-app-configmap.yaml
    echo -e "  ${GREEN}✅ ConfigMap 적용 완료${NC}"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════
# DB 배포 (--db)
# ═══════════════════════════════════════════════════════════════

if [ "$DEPLOY_DB" = true ]; then
    echo -e "${YELLOW}[DB] HDI Deployer 빌드 & 실행...${NC}"

    echo -e "  📦 HDI Deployer 이미지 빌드 중..."
    docker build -f Dockerfile.hdi-deployer -t ${DOCKER_REGISTRY}/${APP_NAME}-hdi-deployer:latest --platform linux/amd64 .
    echo -e "  🚀 Push 중..."
    docker push ${DOCKER_REGISTRY}/${APP_NAME}-hdi-deployer:latest
    echo -e "  ${GREEN}✅ HDI Deployer 이미지 빌드+Push 완료${NC}"

    echo -e "  ⏳ HDI Deployer Job 실행..."
    kubectl delete job hdi-deployer -n ${NAMESPACE} 2>/dev/null || true
    sleep 2
    kubectl apply -f k8s/hdi-deployer-job.yaml
    kubectl wait --for=condition=complete job/hdi-deployer -n ${NAMESPACE} --timeout=300s 2>/dev/null || {
        echo -e "  ${YELLOW}⚠️  HDI Deployer 타임아웃. 로그:${NC}"
        kubectl logs job/hdi-deployer -n ${NAMESPACE} --tail=10
    }
    echo -e "  ${GREEN}✅ HDI Deploy 완료${NC}"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════
# CAP Backend 배포 (--app)
# ═══════════════════════════════════════════════════════════════

if [ "$DEPLOY_APP" = true ]; then
    echo -e "${YELLOW}[APP] CAP Backend 빌드 & 배포...${NC}"

    echo -e "  📦 이미지 빌드 중... (linux/amd64, 진행 로그 표시)"
    # -q 제거 → push/build 진행률 표시. -srv 접미사 제거 → k8s/deployment.yaml 의 image와 일치
    docker build -t ${DOCKER_REGISTRY}/${APP_NAME}:latest --platform linux/amd64 .
    echo -e "  🚀 Push 중..."
    docker push ${DOCKER_REGISTRY}/${APP_NAME}:latest
    echo -e "  ${GREEN}✅ CAP Backend 이미지 빌드+Push 완료${NC}"

    echo -e "  📋 Deployment 적용..."
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl rollout restart deployment/${APP_NAME} -n ${NAMESPACE}
    kubectl rollout status deployment/${APP_NAME} -n ${NAMESPACE} --timeout=180s 2>/dev/null || {
        echo -e "  ${YELLOW}⚠️  Rollout 타임아웃. 상태 확인:${NC}"
        kubectl get pods -n ${NAMESPACE} -l app=${APP_NAME}
    }
    echo -e "  ${GREEN}✅ CAP Backend 배포 완료${NC}"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════
# Approuter 배포 (--router)
# ═══════════════════════════════════════════════════════════════

if [ "$DEPLOY_ROUTER" = true ]; then
    echo -e "${YELLOW}[ROUTER] Approuter 빌드 & 배포...${NC}"

    echo -e "  📦 이미지 빌드 중..."
    docker build -f approuter/Dockerfile -t ${DOCKER_REGISTRY}/${APP_NAME}-approuter:latest --platform linux/amd64 ./approuter
    echo -e "  🚀 Push 중..."
    docker push ${DOCKER_REGISTRY}/${APP_NAME}-approuter:latest
    echo -e "  ${GREEN}✅ Approuter 이미지 빌드+Push 완료${NC}"

    echo -e "  📋 Deployment 적용..."
    kubectl apply -f k8s/approuter-xs-app-configmap.yaml
    kubectl apply -f k8s/approuter-deployment.yaml
    kubectl apply -f k8s/approuter-service.yaml
    # k8s/approuter-deployment.yaml의 deployment 이름은 'approuter' (APP_NAME prefix 없음)
    kubectl rollout restart deployment/approuter -n ${NAMESPACE}
    kubectl rollout status deployment/approuter -n ${NAMESPACE} --timeout=180s 2>/dev/null || {
        echo -e "  ${YELLOW}⚠️  Rollout 타임아웃. 상태 확인:${NC}"
        kubectl get pods -n ${NAMESPACE} -l app=approuter
    }
    echo -e "  ${GREEN}✅ Approuter 배포 완료${NC}"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════
# APIRule 배포 (전체 배포 시)
# ═══════════════════════════════════════════════════════════════

if [ "$DEPLOY_ALL" = true ]; then
    echo -e "${YELLOW}[APIRule] 외부 접근 경로 설정...${NC}"
    kubectl apply -f k8s/apirule.yaml
    echo -e "  ${GREEN}✅ APIRule 적용 완료${NC}"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════
# 완료
# ═══════════════════════════════════════════════════════════════

echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 배포 완료!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""

# 접근 URL 표시
APIRULE_HOST=$(kubectl get apirule -n ${NAMESPACE} -o jsonpath='{.items[0].spec.host}' 2>/dev/null || echo "")
if [ -n "$APIRULE_HOST" ]; then
    echo -e "  🌐 접근 URL: ${CYAN}https://${APIRULE_HOST}${NC}"
    echo ""
fi

# Pod 상태 표시
echo -e "  📋 Pod 상태:"
kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | while read line; do
    echo "     $line"
done
echo ""
