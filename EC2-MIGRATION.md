# EC2 Migration Guide — Catholic Parish Web App

Migrate the full-stack app (React + Express + PostgreSQL) to a single AWS EC2 instance.

---

## Architecture

```
Internet → EC2 Instance
           ├── Nginx (reverse proxy, port 80/443)
           │   ├── /api/* → Express backend (port 4000)
           │   └── /*     → React static files (Vite build)
           └── PostgreSQL (port 5432, localhost only)
```

---

## Phase 1 — Provision EC2 Instance

1. **Launch EC2 instance** (AWS Console → EC2 → Launch Instance)
   - AMI: **Ubuntu 22.04 LTS**
   - Instance type: `t3.small` (2 vCPU, 2 GB RAM)
   - Storage: 20 GB gp3
   - Key pair: create/download a `.pem` file

2. **Configure Security Group** — inbound rules:

   | Port | Protocol | Source      | Purpose        |
   |------|----------|-------------|----------------|
   | 22   | TCP      | Your IP     | SSH            |
   | 80   | TCP      | 0.0.0.0/0   | HTTP           |
   | 443  | TCP      | 0.0.0.0/0   | HTTPS          |

   > Do **not** expose ports 4000 or 5432 publicly.

3. **Allocate an Elastic IP** and associate it with the instance.

---

## Phase 2 — Server Setup

SSH into the instance:
```bash
ssh -i your-key.pem ubuntu@<elastic-ip>
```

Install dependencies:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2 (Node.js process manager)
sudo npm install -g pm2
```

---

## Phase 3 — PostgreSQL Setup

```bash
sudo -u postgres psql
```

Inside psql:
```sql
CREATE USER parish_user WITH PASSWORD 'strong-password-here';
CREATE DATABASE parish_db OWNER parish_user;
GRANT ALL PRIVILEGES ON DATABASE parish_db TO parish_user;
\q
```

Apply the schema:
```bash
sudo -u postgres psql -d parish_db -f /home/ubuntu/parish/backend/src/db/schema.sql
```

PostgreSQL remains bound to `localhost` by default — no external access needed.

---

## Phase 4 — Deploy the Backend

### Upload code

**Option A — SCP (direct upload):**
```bash
scp -i your-key.pem -r "backend" ubuntu@<elastic-ip>:/home/ubuntu/parish/backend
```

**Option B — Git (recommended):**
```bash
# On the server after pushing to GitHub:
git clone https://github.com/your-repo/parish-app.git /home/ubuntu/parish
```

### Build

```bash
cd /home/ubuntu/parish/backend
npm install
npm run build   # compiles TypeScript → dist/
```

### Environment file

Create `/home/ubuntu/parish/backend/.env`:
```env
NODE_ENV=production
PORT=4000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=parish_db
DB_USER=parish_user
DB_PASSWORD=strong-password-here

JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=another-long-random-secret
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=http://<your-domain-or-elastic-ip>
```

### Start with PM2

```bash
pm2 start dist/index.js --name parish-backend
pm2 save
pm2 startup   # run the printed command to enable auto-start on reboot
```

---

## Phase 5 — Build and Deploy the Frontend

### Update the API base URL

In `frontend/src/api/client.ts`, ensure the base URL reads from an env variable:
```typescript
const BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

### Create `frontend/.env.production`
```env
VITE_API_URL=/api
```

### Build locally

```bash
cd frontend
npm run build   # outputs to frontend/dist/
```

### Upload to server

```bash
scp -i your-key.pem -r frontend/dist ubuntu@<elastic-ip>:/home/ubuntu/parish/frontend-dist
```

---

## Phase 6 — Configure Nginx

Create `/etc/nginx/sites-available/parish`:
```nginx
server {
    listen 80;
    server_name <your-elastic-ip-or-domain>;

    # Serve React frontend
    root /home/ubuntu/parish/frontend-dist;
    index index.html;

    # Proxy API requests to Express backend
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # React Router — serve index.html for all unknown routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/parish /etc/nginx/sites-enabled/
sudo nginx -t        # test config syntax
sudo systemctl reload nginx
```

App is now accessible at `http://<elastic-ip>`.

---

## Phase 7 — HTTPS with Let's Encrypt (Optional but Recommended)

Requires a domain name pointing to your Elastic IP.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews certificates every 90 days.

---

## Phase 8 — Automated Daily Backups

```bash
mkdir -p /home/ubuntu/backups
crontab -e
```

Add this line:
```
0 2 * * * pg_dump -U parish_user parish_db > /home/ubuntu/backups/parish_$(date +\%Y\%m\%d).sql
```

Backups run at 2:00 AM daily.

---

## Checklist

- [ ] EC2 instance launched (Ubuntu 22.04, t3.small)
- [ ] Security group configured (ports 22, 80, 443 only)
- [ ] Elastic IP allocated and associated
- [ ] Node.js 20, PostgreSQL 14, Nginx, PM2 installed
- [ ] Database user and `parish_db` created
- [ ] Schema applied (`schema.sql`)
- [ ] Backend `.env` configured with production values
- [ ] Backend built and running via PM2
- [ ] PM2 set to auto-start on reboot
- [ ] Frontend built with `VITE_API_URL=/api`
- [ ] Frontend `dist/` uploaded to server
- [ ] Nginx configured and reloaded
- [ ] App accessible at `http://<elastic-ip>`
- [ ] (Optional) Domain pointed to Elastic IP
- [ ] (Optional) HTTPS configured via Certbot
- [ ] (Optional) Daily database backup cron set up

---

## Starting Services

Use `start.sh` (included in the project root) to start all services:

```bash
chmod +x start.sh   # only needed once
./start.sh
```

Or manually:
```bash
sudo systemctl start postgresql
pm2 start dist/index.js --name parish-backend
sudo systemctl start nginx
```

---

## Stopping Services

Use `stop.sh` (included in the project root) to stop all services:

```bash
chmod +x stop.sh   # only needed once
./stop.sh
```

Or manually:
```bash
pm2 stop parish-backend
sudo systemctl stop nginx
sudo systemctl stop postgresql
```

---

*Last updated: 2026-03-17*
