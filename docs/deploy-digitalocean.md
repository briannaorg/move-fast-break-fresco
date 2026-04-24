# Deploying Fresco to DigitalOcean

This document covers provisioning a Droplet, hardening it, and wiring up automatic deploys from GitHub.

---

## 1. Provision the Droplet

**Recommended size:** Basic / Regular Intel — **2 vCPU / 2 GB RAM / 60 GB SSD** ($18/mo as of 2026). Fresco is a single Node process backed by SQLite. The 2 GB headroom handles `sharp` image processing without OOM-killing the server.

**Image:** Ubuntu 24.04 LTS (stick to LTS for long-term security patches)

**Region:** Pick the one closest to you / your expected users.

**Options to enable at creation time:**
- SSH key — add your local public key (`~/.ssh/id_ed25519.pub` or equivalent)
- Monitoring (free — gives CPU/memory graphs in the DO console)
- Do **not** enable a password; SSH key only

**Storage volume (recommended):** Attach a separate 20 GB volume for `storage/` (images + DB). This lets you resize or snapshot storage independently of the Droplet and makes the Droplet itself ephemeral.

---

## 2. Initial Server Hardening

SSH in as root to start:

```bash
ssh root@YOUR_DROPLET_IP
```

### 2a. Create a deploy user

```bash
adduser deploy
usermod -aG sudo deploy

# Copy root's authorized keys to the deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2b. Lock down SSH

```bash
nano /etc/ssh/sshd_config
```

Set or confirm:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart sshd
```

Open a second terminal and confirm `ssh deploy@YOUR_DROPLET_IP` works before closing the root session.

### 2c. Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

### 2d. fail2ban

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

Default config jails SSH after 5 failed attempts for 10 minutes — good enough for Fresco.

### 2e. Unattended security upgrades

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
# Choose "Yes" when prompted
```

---

## 3. Mount the Storage Volume

If you created a separate volume (recommended):

```bash
# Find the volume device (usually /dev/sda or /dev/disk/by-id/...)
lsblk

# Format it (first time only — this destroys existing data)
mkfs.ext4 /dev/sda   # replace with your device

# Mount it
mkdir -p /mnt/fresco-storage
mount /dev/sda /mnt/fresco-storage

# Make it mount on reboot — add to /etc/fstab
echo '/dev/sda /mnt/fresco-storage ext4 defaults,nofail 0 2' >> /etc/fstab
```

If you skip the volume and use the Droplet disk directly, the storage path defaults to `storage/` inside the repo. That's fine for getting started.

---

## 4. Install Node.js

```bash
# As the deploy user
su - deploy

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install Node 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

node --version   # should print v20.x.x
```

---

## 5. Install PM2 and Nginx

```bash
# PM2 — process manager
npm install -g pm2

# Nginx — reverse proxy
sudo apt install -y nginx
```

---

## 6. Clone the Repo

```bash
cd /home/deploy
git clone https://github.com/YOUR_ORG/YOUR_REPO.git fresco
cd fresco
```

### Install dependencies and do the first build

```bash
# Server deps
npm ci --prefix server

# Client build (NODE_ENV=production skips devDependencies)
npm ci --prefix client
npm run build        # runs vite build in client/, outputs to client/dist/
```

---

## 7. Environment Variables

Create `/home/deploy/fresco/server/.env` — **never commit this file**:

```dotenv
NODE_ENV=production
PORT=3001

# Path to the storage directory (images + DB)
# Use the mounted volume path if you set one up in step 3
STORAGE_PATH=/mnt/fresco-storage

# Museum API keys — add as you implement adapters
SMITHSONIAN_API_KEY=
RIJKSMUSEUM_API_KEY=
# NYPL_API_TOKEN=        # remove after Aug 1 2026 shutdown
```

`server/index.js` calls `require('dotenv').config()` at startup, so this file is picked up automatically.

---

## 8. PM2 Process Config

Create `/home/deploy/fresco/ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'fresco',
      cwd: '/home/deploy/fresco/server',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
```

Start it and register with the OS init system:

```bash
cd /home/deploy/fresco
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed sudo command to register with systemd
```

Verify:

```bash
pm2 status
pm2 logs fresco --lines 50
```

The server auto-runs `db.migrate.latest()` on startup, so the DB is created and migrations applied on first boot.

---

## 9. Nginx Config

Create `/etc/nginx/sites-available/fresco`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    # Max upload size for images
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Export zips can take a moment to stream — don't time out early
        proxy_read_timeout 120s;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/fresco /etc/nginx/sites-enabled/
sudo nginx -t        # confirm no syntax errors
sudo systemctl reload nginx
```

---

## 10. TLS via Let's Encrypt

Point your domain's A record at the Droplet IP first, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com
```

Certbot rewrites the Nginx config to redirect HTTP → HTTPS and installs a cron job for auto-renewal. Confirm auto-renewal works:

```bash
sudo certbot renew --dry-run
```

---

## 11. GitHub Actions Deploy Workflow

### 11a. Add secrets to the GitHub repo

In **Settings → Secrets and variables → Actions**, add:

| Secret name | Value |
|---|---|
| `DEPLOY_HOST` | Your Droplet IP or domain |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Contents of your **private** SSH key (the one whose public key is on the Droplet) |

### 11b. Create the workflow file

Create `.github/workflows/deploy.yml` in your repo:

```yaml
name: Deploy to production

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build client
        run: |
          npm ci --prefix client
          npm run build

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            set -e
            cd /home/deploy/fresco

            # Pull latest code
            git pull origin main

            # Install/update server dependencies
            npm ci --prefix server

            # Migrations run automatically on PM2 restart, but run explicitly
            # here so a failed migration aborts the deploy before reload
            npm run migrate

            # Reload the app (zero-downtime)
            pm2 reload fresco --env production

      - name: Copy built client
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          source: client/dist/
          target: /home/deploy/fresco/client/dist/
          strip_components: 2
```

**What this does on every push to `main`:**
1. Builds the React client in CI (faster than building on the Droplet)
2. SSHs into the Droplet, pulls the latest code, installs server deps, runs migrations
3. SCPs the built `client/dist/` onto the server
4. Reloads PM2 without dropping in-flight requests

> **Note on the build split:** The client build runs in GitHub Actions (where you have all dev deps). Only server deps are installed on the Droplet. This keeps the Droplet lean and makes builds repeatable.

---

## 12. Database Backups

SQLite is a single file at `$STORAGE_PATH/fresco.db`. Back it up daily to DigitalOcean Spaces (S3-compatible).

### Install s3cmd

```bash
sudo apt install -y s3cmd
s3cmd --configure   # enter your DO Spaces key/secret, endpoint: nyc3.digitaloceanspaces.com (or your region)
```

### Create a backup script

`/home/deploy/backup-db.sh`:

```bash
#!/bin/bash
set -e
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_PATH=/mnt/fresco-storage/fresco.db
BACKUP_NAME="fresco-db-${TIMESTAMP}.sqlite3"
SPACES_BUCKET=s3://YOUR_SPACES_BUCKET/backups/

# SQLite .backup is safe to run against a live DB
sqlite3 "$DB_PATH" ".backup /tmp/${BACKUP_NAME}"
s3cmd put "/tmp/${BACKUP_NAME}" "${SPACES_BUCKET}${BACKUP_NAME}"
rm "/tmp/${BACKUP_NAME}"

# Keep only last 30 backups
s3cmd ls "${SPACES_BUCKET}" | sort | head -n -30 | awk '{print $4}' | xargs -r s3cmd del
```

```bash
chmod +x /home/deploy/backup-db.sh
```

### Schedule with cron

```bash
crontab -e
```

Add:

```
0 3 * * * /home/deploy/backup-db.sh >> /home/deploy/backup.log 2>&1
```

Runs at 3 AM daily, keeps 30 days of backups.

---

## 13. Verify the Deployment

```bash
# On the Droplet
pm2 status                   # fresco should be "online"
pm2 logs fresco --lines 20   # no errors
curl -s http://localhost:3001/api/templates | head   # should return JSON

# From your browser
# https://YOUR_DOMAIN.com  — should load the Fresco React app
# https://YOUR_DOMAIN.com/api/templates  — should return JSON
```

---

## Ongoing Deploy Checklist

After this setup, deploying is just:

```
git push origin main
```

GitHub Actions handles the rest. To monitor:
- **PM2 logs:** `pm2 logs fresco`
- **Nginx logs:** `sudo tail -f /var/log/nginx/error.log`
- **DO Monitoring:** CPU/memory graphs in the Droplet dashboard

## Environment variable changes

If you need to update `.env` (e.g. adding a new API key):

```bash
ssh deploy@YOUR_DROPLET_IP
nano /home/deploy/fresco/server/.env
pm2 reload fresco --env production
```

PM2 re-reads the `.env` on reload via `dotenv`.
