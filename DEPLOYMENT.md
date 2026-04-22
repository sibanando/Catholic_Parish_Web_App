# Deployment Guide — Catholic Parish Web App

## Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Option 1 — Docker Compose (single server)](#option-1--docker-compose-single-server)
- [Option 2 — Kubernetes](#option-2--kubernetes)
- [Building and Pushing Images](#building-and-pushing-images)
- [TLS / HTTPS](#tls--https)
- [Database Backups](#database-backups)
- [Upgrading](#upgrading)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose plugin | v2.20+ | included with Docker Desktop / `apt install docker-compose-plugin` |
| kubectl | 1.28+ | https://kubernetes.io/docs/tasks/tools/ |
| make | any | `apt install make` / `brew install make` |

---

## Environment Variables

Copy the example file and fill in every value before deploying.

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | PostgreSQL password. Use `openssl rand -hex 32` |
| `JWT_SECRET` | yes | JWT signing secret, min 32 chars |
| `JWT_REFRESH_SECRET` | yes | JWT refresh signing secret, min 32 chars |
| `FRONTEND_URL` | yes | Public URL of the app (e.g. `https://parish.example.com`) |
| `JWT_EXPIRES_IN` | no | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | no | Refresh token TTL (default: `7d`) |
| `APP_PORT` | no | Host port for Docker Compose (default: `80`) |
| `DATABASE_SSL` | no | Set `true` only for cloud-managed DBs (RDS, Azure DB for PostgreSQL). Leave `false` (default) for the bundled postgres container — it has no SSL configured. |
| `REGISTRY` | no | Container registry prefix (default: `parish-app`) |
| `IMAGE_TAG` | no | Image tag to build/pull (default: `latest`) |

Generate secure secrets:

```bash
openssl rand -hex 32   # run twice — once for JWT_SECRET, once for JWT_REFRESH_SECRET
openssl rand -hex 24   # for POSTGRES_PASSWORD
```

---

## Option 1 — Docker Compose (single server)

Best for: a single VM/VPS (EC2, DigitalOcean Droplet, Azure VM, etc.).

### Quick start

```bash
cp .env.example .env
# edit .env with your values

./start.sh          # production build + start
```

> **Warning — dev overlay and production images are incompatible.**
> `docker-compose.dev.yml` overrides `command` to run `npm run dev` (which requires
> `ts-node-dev`) and mounts your local source tree. The production image does not have
> devDependencies installed. Always use the production compose alone for a real server:
> ```bash
> docker compose -f docker-compose.yml up --build -d
> ```

### Manual commands

```bash
# Start (production only)
docker compose -f docker-compose.yml up --build -d

# View logs
docker compose -f docker-compose.yml logs -f

# Stop
docker compose -f docker-compose.yml down

# Stop and delete all data (destructive — removes postgres volume)
docker compose -f docker-compose.yml down -v
```

### Resource limits

The compose file enforces per-service limits:

| Service | Memory limit | CPU limit |
|---|---|---|
| postgres | 512 MB | 0.5 cores |
| backend | 768 MB | 0.75 cores |
| frontend | 128 MB | 0.2 cores |

Adjust in `docker-compose.yml` under each service's `deploy.resources` block.

### Verify

```bash
curl http://localhost/health        # → {"status":"ok","timestamp":"..."}
curl http://localhost/api/auth      # → 404 route not found (expected — no body)
```

### Azure VM checklist

If deploying to an Azure Virtual Machine, port 80 (and 443 for HTTPS) must be opened in the **Network Security Group (NSG)**:

1. Azure Portal → your VM → **Networking**
2. **Add inbound port rule** — TCP, port `80`, priority `100`, Allow
3. If system nginx is pre-installed and occupies port 80, disable it first:
   ```bash
   sudo systemctl stop nginx && sudo systemctl disable nginx
   ```

---

## Option 2 — Kubernetes

Best for: cloud-managed clusters (EKS, GKE, AKS) or self-hosted k8s.

### Architecture

```
Internet
   │
   ▼
[Ingress] ──/api/──► [backend Service :4000] ──► [backend Pods ×2]
   │                                                      │
   └──────/──────► [frontend Service :80]  ──► [frontend Pods ×2]
                                                          │
                                               [postgres Service :5432]
                                                          │
                                                  [postgres StatefulSet]
                                                          │
                                                  [PersistentVolumeClaim 10Gi]
```

### Step 1 — Build and push images

You must push to a registry that your cluster can pull from.

```bash
# Docker Hub
make push REGISTRY=docker.io/your-org IMAGE_TAG=1.0.0

# AWS ECR
aws ecr get-login-password | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
make push REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com IMAGE_TAG=1.0.0

# Google GCR
gcloud auth configure-docker
make push REGISTRY=gcr.io/your-project IMAGE_TAG=1.0.0

# Azure ACR
az acr login --name yourregistry
make push REGISTRY=yourregistry.azurecr.io IMAGE_TAG=1.0.0
```

### Step 2 — Update image references

Edit `k8s/backend/deployment.yaml` and `k8s/frontend/deployment.yaml`, replacing:

```yaml
image: parish-app/backend:latest
```

with your actual registry image:

```yaml
image: docker.io/your-org/parish-backend:1.0.0
```

### Step 3 — Configure domain and secrets

**3a. Set your domain** in two places:

```bash
# k8s/ingress.yaml
sed -i 's/your-domain.com/parish.example.com/g' k8s/ingress.yaml

# k8s/configmap.yaml
sed -i 's/https:\/\/your-domain.com/https:\/\/parish.example.com/g' k8s/configmap.yaml
```

**3b. Create secrets** from environment variables (never commit real secrets to git):

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 24)
export JWT_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)

make secrets-k8s
```

Or apply `k8s/secret.yaml` after replacing the placeholder values manually.

### Step 4 — Install the nginx Ingress controller (if not already present)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=120s
```

### Step 5 — Deploy

```bash
make deploy-k8s
```

This applies manifests in the correct dependency order and waits for each rollout to succeed before continuing.

### Verify

```bash
make status-k8s                     # kubectl get all -n parish

# Get the Ingress external IP/hostname
kubectl get ingress parish-ingress -n parish

# Point your DNS A record to that IP, then:
curl https://parish.example.com/health
```

### Namespace

All resources live in the `parish` namespace. To inspect:

```bash
kubectl get pods -n parish
kubectl logs -n parish deployment/backend
kubectl exec -it -n parish deployment/backend -- /bin/sh
```

### Storage class

The postgres PVC uses the cluster's default storage class. To pin it:

```bash
# k8s/postgres/pvc.yaml — uncomment and set storageClassName:
#   AWS EKS:   gp3
#   GKE:       standard-rwo
#   Azure AKS: managed-premium
```

---

## Building and Pushing Images

The `Makefile` handles tagging:

```bash
# Build only (local)
make build REGISTRY=your-org

# Build + push
make push REGISTRY=your-org IMAGE_TAG=1.2.3

# Override both
make push REGISTRY=gcr.io/my-project IMAGE_TAG=$(git rev-parse --short HEAD)
```

Images produced:

- `{REGISTRY}/parish-backend:{IMAGE_TAG}`
- `{REGISTRY}/parish-frontend:{IMAGE_TAG}`

---

## TLS / HTTPS

### Docker Compose — with Caddy (recommended for single server)

Replace the `frontend` service ports with Caddy as a reverse proxy:

```yaml
# docker-compose.yml addition
caddy:
  image: caddy:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
```

`Caddyfile`:
```
parish.example.com {
  reverse_proxy frontend:80
}
```

### Kubernetes — with cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

# Create a ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
EOF
```

Then uncomment the TLS and cert-manager blocks in `k8s/ingress.yaml`.

---

## Database Backups

### Docker Compose

```bash
# Dump
docker exec parish-postgres pg_dump -U postgres parish_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260101.sql.gz | docker exec -i parish-postgres psql -U postgres parish_db
```

### Kubernetes

```bash
# Dump
kubectl exec -n parish statefulset/postgres -- \
  pg_dump -U postgres parish_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260101.sql.gz | \
  kubectl exec -i -n parish statefulset/postgres -- psql -U postgres parish_db
```

Schedule automated backups with a Kubernetes CronJob or your cloud provider's managed DB snapshots.

---

## Upgrading

### Docker Compose

```bash
git pull
docker compose up -d --build     # rebuilds images and restarts changed services
```

### Kubernetes

```bash
# Build and push new version
make push REGISTRY=your-org IMAGE_TAG=1.2.3

# Update deployment images (triggers rolling update, zero downtime)
kubectl set image deployment/backend  backend=your-org/parish-backend:1.2.3  -n parish
kubectl set image deployment/frontend frontend=your-org/parish-frontend:1.2.3 -n parish

# Watch rollout
kubectl rollout status deployment/backend  -n parish
kubectl rollout status deployment/frontend -n parish

# Roll back if needed
kubectl rollout undo deployment/backend -n parish
```

---

## Troubleshooting

### Login returns "Internal server error" — SSL connection error

Symptom in backend logs: `Error: The server does not support SSL connections`

The production pool config used to force SSL whenever `NODE_ENV=production`. The bundled postgres container has no SSL. Fix: ensure your `.env` contains:

```env
DATABASE_SSL=false
```

Only set `DATABASE_SSL=true` when connecting to an external managed database (AWS RDS, Azure Database for PostgreSQL) that requires SSL.

### Port 80 already in use (frontend container fails to start)

Symptom: `failed to bind host port 0.0.0.0:80/tcp: address already in use`

A system-level nginx process is occupying port 80. Stop and disable it:

```bash
sudo lsof -i :80          # confirm it's nginx
sudo systemctl stop nginx && sudo systemctl disable nginx
docker compose -f docker-compose.yml up -d   # restart frontend container
```

Alternatively, run the app on a different port:

```bash
APP_PORT=8080 docker compose -f docker-compose.yml up -d
```

### Backend crashes with "ts-node-dev: not found"

You are running the dev overlay against the production image. Use production compose only:

```bash
docker compose -f docker-compose.yml up --build -d
```

The dev overlay (`docker-compose.dev.yml`) is only for local development where source files are mounted and devDependencies are installed.

### Backend won't start (database connection refused)

The backend waits for postgres via the healthcheck `depends_on` in compose. In k8s, the StatefulSet readiness probe gates the backend Deployment rollout. If it still fails:

```bash
# Docker Compose
docker compose logs postgres
docker compose logs backend

# k8s
kubectl describe pod -n parish -l app=postgres
kubectl logs -n parish statefulset/postgres
```

### PDF generation fails (Puppeteer / Chromium)

The backend runs as non-root (uid 1000) and Puppeteer is already configured with `--no-sandbox --disable-setuid-sandbox`. If Chromium fails in k8s:

```bash
kubectl logs -n parish deployment/backend | grep -i chromium
```

Ensure the pod's `securityContext` does not set `readOnlyRootFilesystem: true` without also mounting an emptyDir at `/tmp`.

### Nginx returns 502 Bad Gateway

The frontend nginx proxies `/api/` to the backend using the `BACKEND_HOST` env var. Verify it is set:

```bash
# Docker Compose
docker exec parish-frontend env | grep BACKEND_HOST    # should be: backend

# k8s
kubectl exec -n parish deployment/frontend -- env | grep BACKEND_HOST  # should be: backend
kubectl exec -n parish deployment/frontend -- cat /etc/nginx/conf.d/default.conf
```

### Check all running pods

```bash
# Docker Compose
docker compose ps

# k8s
make status-k8s
```
