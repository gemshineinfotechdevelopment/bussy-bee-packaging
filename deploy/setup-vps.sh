#!/usr/bin/env bash
# ==============================================================================
# Script: Complete Initial VPS Setup for Bussy Bee
# Installs: Node.js 20, Nginx, PM2, MongoDB, Git, UFW Firewall
# Port: 5035
# ==============================================================================

set -e

echo "=========================================================="
echo " 🐝 Bussy Bee VPS Initial Server Provisioning..."
echo "=========================================================="

# 1. Update System Packages
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git build-essential ufw nginx

# 2. Install Node.js 20 LTS (NodeSource)
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
  echo "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install PM2 globally
sudo npm install -g pm2
pm2 --version

# 4. Install MongoDB
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/setup-mongodb.sh" ]; then
  bash "$SCRIPT_DIR/setup-mongodb.sh"
fi

# 5. Configure Firewall (UFW)
echo "Configuring UFW Firewall (allowing 80, 443, 5035, OpenSSH)..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5035/tcp
sudo ufw --force enable || true
sudo ufw status

# 6. Setup /var/www/bussy-bee permissions
echo "Setting up application directory permissions..."
sudo mkdir -p /var/www/bussy-bee
sudo chown -R $USER:$USER /var/www/bussy-bee

# 7. Configure Nginx
echo "Configuring Nginx for Port 5035..."
if [ -f "$SCRIPT_DIR/nginx/bussy-bee.conf" ]; then
  sudo cp "$SCRIPT_DIR/nginx/bussy-bee.conf" /etc/nginx/sites-available/bussy-bee
  sudo ln -sf /etc/nginx/sites-available/bussy-bee /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl restart nginx
fi

echo "=========================================================="
echo " ✅ VPS Environment Setup Complete!"
echo " Port 5035 is opened and Nginx is configured."
echo " Next step: clone your repository into /var/www/bussy-bee"
echo " and run 'bash deploy/deploy.sh'"
echo "=========================================================="
