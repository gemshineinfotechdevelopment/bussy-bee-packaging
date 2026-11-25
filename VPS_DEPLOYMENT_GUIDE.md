# Bussy Bee - Complete VPS Deployment Guide (Ubuntu)

Target Domain / Subdomain: `bussy-bee.gemshine.tech`  
Backend Port: `5035`  
Database: Local MongoDB on VPS (`mongodb://127.0.0.1:27017/bussy_bee`)  
Reverse Proxy: Nginx (Port 80 HTTP / Port 443 HTTPS)  
Process Manager: PM2 (`ecosystem.config.cjs`)  

---

## 🏗️ Architecture Overview

```
                      Internet (Client Browser)
                                 │
                                 ▼ https://bussy-bee.gemshine.tech
                     [ Nginx Reverse Proxy ] (Ports 80 & 443 SSL)
                                 │
            ┌────────────────────┴────────────────────┐
            │                                         │
     Static Frontend                           Backend API
    (/var/www/bussy-bee/dist)            (http://127.0.0.1:5035/api)
                                                      │
                                            ┌──────────┴──────────┐
                                            ▼                     ▼
                                     Local MongoDB           Cloudinary
                                   (127.0.0.1:27017)
                                 Database: bussy_bee
```

---

## 📋 Step 1: VPS Server Setup & Essential Tools

Connect to your VPS terminal:
```bash
ssh root@YOUR_VPS_IP
```

Update packages and install basic system utilities:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget gnupg ufw nginx build-essential
```

### 1.1 Install Node.js (v20 LTS):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Check: v20.x
npm -v
```

### 1.2 Install PM2 (Process Manager):
```bash
sudo npm install -g pm2
```

---

## 🍃 Step 2: Install and Start MongoDB on VPS

### 2.1 Install MongoDB Community Edition (Ubuntu 20.04 / 22.04 / 24.04):

```bash
# Import MongoDB public GPG Key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

# Add MongoDB repository
UBUNTU_CODENAME=$(lsb_release -cs)
[ "$UBUNTU_CODENAME" = "noble" ] && REPO_RELEASE="jammy" || REPO_RELEASE="$UBUNTU_CODENAME"
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${REPO_RELEASE}/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update & Install MongoDB
sudo apt update
sudo apt install -y mongodb-org
```

*(Or simply run the included automated script: `bash deploy/setup-mongodb.sh`)*

### 2.2 Start and Enable MongoDB Service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod
```
MongoDB will now run locally on `127.0.0.1:27017` and restart automatically on system reboot.

### 2.3 Creating the Database (`bussy_bee`):
MongoDB automatically creates the `bussy_bee` database as soon as the first collection and data are inserted.
You can verify or manually interact using `mongosh`:
```bash
mongosh
```
Inside the MongoDB shell:
```javascript
use bussy_bee
db.createCollection("init_check")
show dbs
exit
```

*(Note: When you run `npm --prefix server run seed` in Step 5, it automatically connects to `mongodb://127.0.0.1:27017/bussy_bee` and populates all initial collections, default admin account, and default configurations).*

---

## 📂 Step 3: Clone Project & Prepare Web Directory

```bash
sudo mkdir -p /var/www/bussy-bee
sudo chown -R $USER:$USER /var/www/bussy-bee
cd /var/www/bussy-bee

git clone https://github.com/gemshineinfotechdevelopment/bussy-bee-packaging.git .
```

---

## ⚙️ Step 4: Configure Environment Files

### 4.1 Frontend `.env` (in `/var/www/bussy-bee`):
```bash
nano .env
```
Ensure it contains:
```env
VITE_API_URL=/api
```
*(Save: `Ctrl + O` -> `Enter`, Exit: `Ctrl + X`)*

### 4.2 Backend `server/.env` (in `/var/www/bussy-bee/server`):
```bash
nano server/.env
```
Paste the following:
```env
PORT=5035
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/bussy_bee
CORS_ORIGIN=https://bussy-bee.gemshine.tech,http://bussy-bee.gemshine.tech,http://localhost:5035
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
*(Save: `Ctrl + O` -> `Enter`, Exit: `Ctrl + X`)*

---

## 🔨 Step 5: Install Dependencies, Seed Database & Build Application

From the project root `/var/www/bussy-bee`:
```bash
cd /var/www/bussy-bee

# 1. Install Frontend & Backend Dependencies
npm install
npm --prefix server install

# 2. Seed Default Database Data & Admin Account
npm --prefix server run seed

# 3. Build both React Vite and Backend TypeScript
npm run build:all
```

---

## 🚀 Step 6: Start Backend with PM2

Start the Node.js Express server on port 5035 using PM2 ecosystem:
```bash
cd /var/www/bussy-bee
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```
*(Copy and run the `sudo env PATH=...` command shown on screen by `pm2 startup` if prompted).*

Check PM2 process health:
```bash
pm2 status
pm2 logs bussy-bee-api --lines 20
```

---

## 🌐 Step 7: Configure Nginx & DNS

### 7.1 DNS Record (Hostinger / Cloudflare / GoDaddy / Your Domain Registrar)
Add an **A Record** in your DNS zone for `gemshine.tech`:
- **Type**: `A`
- **Name / Host**: `bussy-bee`
- **Points to / Value**: `YOUR_VPS_IP`
- **TTL**: `Auto` (or `300` / `600`)

### 7.2 Configure Nginx:
```bash
sudo cp /var/www/bussy-bee/nginx/bussy-bee.conf /etc/nginx/sites-available/bussy-bee
sudo ln -sf /etc/nginx/sites-available/bussy-bee /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Step 8: Configure Firewall & Free SSL (HTTPS)

### 8.1 Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 8.2 Install Free SSL Certificate with Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bussy-bee.gemshine.tech
```
Follow the interactive prompt:
1. Enter your email address for renewal notices.
2. Accept the terms of service (`Y`).
3. Choose redirect HTTP to HTTPS (`Yes` / option 2 if asked).

Certbot will automatically install SSL and test auto-renewal.

---

## 🔄 Step 9: Automatic Future Deployments (1 Command)

Whenever you push new code to GitHub, simply SSH into your VPS and run:
```bash
cd /var/www/bussy-bee
bash deploy.sh
```
This single command automatically pulls latest code, installs dependencies, rebuilds frontend & backend, and reloads PM2 with zero downtime!
