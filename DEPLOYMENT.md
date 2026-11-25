# 🚀 Bussy Bee Packaging - VPS Deployment Guide

This guide walks you through deploying the complete **Bussy Bee Packaging** full-stack application (React Frontend + Node.js Express Backend + Local MongoDB + Nginx Reverse Proxy + PM2) on an Ubuntu VPS.

---

## 📋 Architecture & Port Configuration

| Component | Technology | VPS Internal Port | Public URL / Port |
| :--- | :--- | :--- | :--- |
| **Web Server / Reverse Proxy** | Nginx | `5035` | **`http://<your-domain-or-vps-ip>:5035`** |
| **Frontend UI (Static)** | React + Vite (`dist/`) | Static `/var/www/bussy-bee/dist` | Served by Nginx directly |
| **Backend API Server** | Node.js + Express (PM2) | `5004` (Internal) | Proxied by Nginx via `/api/` |
| **Database** | MongoDB Community | `27017` (Local only) | `mongodb://127.0.0.1:27017/bussy_bee` |

> [!NOTE]
> **Zero CORS & Zero Port Mismatch**: Nginx listens on **Port 5035**. When a user visits `http://bussy-bee:5035`, Nginx serves the frontend. When the frontend sends requests to `/api/*`, Nginx transparently forwards them to the PM2 backend on `http://127.0.0.1:5004`. Everything operates under the single port `5035`.

---

## ⚡ Quick 3-Step Automated Deployment

### Step 1: Connect to your VPS
```bash
ssh root@YOUR_VPS_IP
```

---

### Step 2: Run VPS Environment Initializer
If you are on a fresh VPS, run the automated provisioning script to install **Node.js 20 LTS**, **MongoDB**, **Nginx**, **PM2**, and configure **UFW firewall**:

```bash
# 1. Create target folder and navigate
mkdir -p /var/www/bussy-bee
cd /var/www/bussy-bee

# 2. Clone your repository
git clone https://github.com/gemshineinfotechdevelopment/bussy-bee-packaging.git .

# 3. Make scripts executable and run VPS setup
chmod +x deploy/*.sh
bash deploy/setup-vps.sh
```

---

### Step 3: Run the Deploy Script
```bash
bash deploy/deploy.sh
```

The script will automatically:
1. Copy `server/.env.production` with MongoDB configured to `mongodb://127.0.0.1:27017/bussy_bee`.
2. Install all frontend and backend dependencies.
3. Build the React frontend into `dist/` and compile the backend TypeScript into `server/dist/`.
4. Launch the Node.js backend under PM2 (`bussy-bee-api`).
5. Reload Nginx to serve the app on port `5035`.

---

## 🌐 Accessing the Application

Open your browser and navigate to:
```
http://YOUR_VPS_IP:5035
```
Or with your domain:
```
http://bussy-bee:5035
```

### 🔑 Default Logins (Auto-Seeded into Local MongoDB):

- **Super Admin Panel:**
  - Username: `superadmin`
  - Password: `superadmin123`
- **Admin Panel:**
  - Username: `admin`
  - Password: `admin123`

*(You can change usernames and passwords anytime in the Super Admin **Settings** tab).*

---

## 🛠️ Manual Step-by-Step Guide (If Preferred)

<details>
<summary><b>Click to expand manual setup instructions</b></summary>

### 1. Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 2. Install MongoDB on Ubuntu
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update -y
sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod
```

### 3. Configure Firewall for Port 5035
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5035/tcp
sudo ufw enable
```

### 4. Build the Project
```bash
cd /var/www/bussy-bee
npm install --legacy-peer-deps
npm --prefix server install
npm run build:all
```

### 5. Start Backend with PM2
```bash
cp server/.env.production server/.env
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### 6. Configure Nginx
```bash
sudo cp deploy/nginx/bussy-bee.conf /etc/nginx/sites-available/bussy-bee
sudo ln -sf /etc/nginx/sites-available/bussy-bee /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

</details>

---

## 🔄 Routine Deployment (When You Push Code Changes)

Whenever you push new code to GitHub, simply run this one command on your VPS:

```bash
cd /var/www/bussy-bee
git pull origin main
npm run deploy
```

---

## 🔍 Useful Management Commands

### PM2 (Backend Management)
```bash
pm2 status                       # View running status of backend
pm2 logs bussy-bee-api          # View live backend logs & error logs
pm2 restart bussy-bee-api       # Restart backend
pm2 stop bussy-bee-api          # Stop backend
```

### MongoDB (Database Management)
```bash
sudo systemctl status mongod    # Check MongoDB status
mongosh                         # Open MongoDB interactive shell
# In mongosh:
# > use bussy_bee
# > show collections
```

### Nginx (Web Server)
```bash
sudo nginx -t                   # Test Nginx syntax
sudo systemctl reload nginx     # Reload Nginx without downtime
sudo systemctl status nginx     # Check Nginx status
sudo tail -f /var/log/nginx/bussy-bee-error.log   # View error logs
```
