REGISTRY  ?= docker.io/your-org
IMAGE_TAG ?= latest

BACKEND_IMAGE  = $(REGISTRY)/parish-backend:$(IMAGE_TAG)
FRONTEND_IMAGE = $(REGISTRY)/parish-frontend:$(IMAGE_TAG)

.PHONY: build push deploy-compose stop-compose logs-compose \
        deploy-k8s delete-k8s status-k8s secrets-k8s

# ── Local Docker Compose ─────────────────────────────────────────────────────

build:
	docker build -t $(BACKEND_IMAGE) ./backend
	docker build -t $(FRONTEND_IMAGE) ./frontend

push: build
	docker push $(BACKEND_IMAGE)
	docker push $(FRONTEND_IMAGE)

deploy-compose:
	REGISTRY=$(REGISTRY) IMAGE_TAG=$(IMAGE_TAG) docker compose up -d

stop-compose:
	docker compose down

logs-compose:
	docker compose logs -f

# ── Kubernetes ───────────────────────────────────────────────────────────────

# Apply all manifests in dependency order
deploy-k8s:
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/secret.yaml
	kubectl apply -f k8s/postgres/
	kubectl rollout status statefulset/postgres -n parish --timeout=120s
	kubectl apply -f k8s/backend/
	kubectl rollout status deployment/backend -n parish --timeout=120s
	kubectl apply -f k8s/frontend/
	kubectl rollout status deployment/frontend -n parish --timeout=60s
	kubectl apply -f k8s/ingress.yaml

# Tear down everything (PVC is preserved — postgres data survives)
delete-k8s:
	kubectl delete -f k8s/ingress.yaml      --ignore-not-found
	kubectl delete -f k8s/frontend/         --ignore-not-found
	kubectl delete -f k8s/backend/          --ignore-not-found
	kubectl delete -f k8s/postgres/         --ignore-not-found
	kubectl delete -f k8s/configmap.yaml    --ignore-not-found
	kubectl delete -f k8s/secret.yaml       --ignore-not-found
	kubectl delete -f k8s/namespace.yaml    --ignore-not-found

status-k8s:
	kubectl get all -n parish

# Helper: generate secrets interactively from env vars
secrets-k8s:
	@echo "Generating k8s secret from current shell env..."
	@[ -n "$$POSTGRES_PASSWORD" ] || (echo "ERROR: POSTGRES_PASSWORD not set"; exit 1)
	@[ -n "$$JWT_SECRET" ]        || (echo "ERROR: JWT_SECRET not set"; exit 1)
	@[ -n "$$JWT_REFRESH_SECRET" ]|| (echo "ERROR: JWT_REFRESH_SECRET not set"; exit 1)
	kubectl create secret generic parish-secrets -n parish \
	  --from-literal=POSTGRES_PASSWORD="$$POSTGRES_PASSWORD" \
	  --from-literal=DATABASE_URL="postgresql://postgres:$$POSTGRES_PASSWORD@postgres:5432/parish_db" \
	  --from-literal=JWT_SECRET="$$JWT_SECRET" \
	  --from-literal=JWT_REFRESH_SECRET="$$JWT_REFRESH_SECRET" \
	  --save-config --dry-run=client -o yaml | kubectl apply -f -
