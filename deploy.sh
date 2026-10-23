#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy.sh — One-command deploy for Sluxa Backend (Docker)
#
# Usage:
#   First time:
#     git clone https://github.com/<you>/slusha-webapp.git /opt/sluxa
#     cd /opt/sluxa
#     cp backend/.env.example backend/.env
#     nano backend/.env            # ← fill in your API keys
#     bash deploy.sh
#
#   Updates:
#     cd /opt/sluxa && bash deploy.sh
#
# What it does:
#   1. Pulls latest code from git
#   2. Ensures backend/.env exists
#   3. Tears down old containers
#   4. Rebuilds the image from scratch (no cache)
#   5. Starts the container in background (-d)
#   6. Cleans up dangling images
#   7. Shows status and logs
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  Sluxa Backend — Docker Deploy"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. Pull latest code ──────────────────────────────────────────────────
echo ""
echo "[1/6] Pulling latest code from git..."
git pull --ff-only origin main || git pull --ff-only origin master || {
    echo "⚠  git pull failed. Continuing with current code..."
}

# ── 2. Check .env exists ─────────────────────────────────────────────────
echo ""
echo "[2/6] Checking backend/.env..."
if [ ! -f backend/.env ]; then
    echo "❌ backend/.env not found!"
    echo ""
    echo "   Create it from the template:"
    echo "     cp backend/.env.example backend/.env"
    echo "     nano backend/.env"
    echo ""
    echo "   Then re-run: bash deploy.sh"
    exit 1
fi
echo "   ✅ backend/.env found"

# ── 3. Tear down old containers ──────────────────────────────────────────
echo ""
echo "[3/6] Stopping old containers..."
docker compose down --remove-orphans --rmi local 2>/dev/null || true

# ── 4. Rebuild from scratch ──────────────────────────────────────────────
echo ""
echo "[4/6] Building fresh image (no cache)..."
docker builder prune -af 2>/dev/null || true
docker compose build --pull --no-cache sluxa-backend

# ── 5. Start in background ──────────────────────────────────────────────
echo ""
echo "[5/6] Starting sluxa-backend in background..."
docker compose up -d --force-recreate sluxa-backend

# ── 6. Cleanup ───────────────────────────────────────────────────────────
echo ""
echo "[6/6] Cleaning up dangling images..."
docker builder prune -af 2>/dev/null || true
docker image prune -f 2>/dev/null || true

# ── Done! ────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "── Container Status ──"
docker compose ps
echo ""

echo "── Recent Logs (last 60 lines) ──"
docker compose logs --tail=60 sluxa-backend
echo ""

echo "── Quick Links ──"
echo "   Health check:  curl http://localhost:8000/health"
echo "   API root:      curl http://localhost:8000/"
echo ""
echo "── Useful Commands ──"
echo "   View live logs:     docker compose logs -f sluxa-backend"
echo "   Restart:            docker compose restart sluxa-backend"
echo "   Stop:               docker compose down"
echo "   Enter container:    docker compose exec sluxa-backend bash"
