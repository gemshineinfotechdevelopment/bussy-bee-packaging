#!/usr/bin/env bash
# ==============================================================================
# Script: Setup MongoDB Community Edition on Ubuntu VPS (20.04 / 22.04 / 24.04)
# Database Name: bussy_bee
# ==============================================================================

set -e

echo "=========================================================="
echo " 🍃 Installing & Configuring MongoDB on Ubuntu VPS..."
echo "=========================================================="

# 1. Update and install prerequisites
sudo apt-get update -y
sudo apt-get install -y gnupg curl lsb-release

# 2. Import MongoDB public GPG Key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

# 3. Add MongoDB repository for Ubuntu
UBUNTU_CODENAME=$(lsb_release -cs)
echo "Detected Ubuntu release: $UBUNTU_CODENAME"

# Fallback for Ubuntu 24.04 (noble) if 7.0 repo uses jammy
if [ "$UBUNTU_CODENAME" = "noble" ]; then
  REPO_RELEASE="jammy"
else
  REPO_RELEASE="$UBUNTU_CODENAME"
fi

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${REPO_RELEASE}/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 4. Install MongoDB packages
sudo apt-get update -y
sudo apt-get install -y mongodb-org

# 5. Start and Enable MongoDB service on system boot
sudo systemctl daemon-reload
sudo systemctl enable mongod
sudo systemctl restart mongod

# 6. Verify MongoDB status
echo "Checking MongoDB status..."
if sudo systemctl is-active --quiet mongod; then
  echo "✅ MongoDB service is RUNNING!"
else
  echo "❌ MongoDB failed to start. Running: sudo systemctl status mongod"
  sudo systemctl status mongod --no-pager
fi

# 7. Test connection with mongosh
if command -v mongosh &> /dev/null; then
  echo "Testing MongoDB connection with mongosh..."
  mongosh --eval "db.adminCommand('ping')" || true
fi

echo "=========================================================="
echo " 🎉 MongoDB Setup Complete!"
echo " Connection string: mongodb://127.0.0.1:27017/bussy_bee"
echo "=========================================================="
