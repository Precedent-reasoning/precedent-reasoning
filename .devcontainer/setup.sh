#!/usr/bin/env bash
set -e

echo "==> Installing Python dependencies..."
cd /workspace/backend
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Installing Node dependencies..."
cd /workspace/frontend
npm install

echo ""
echo "Setup complete."
echo ""
echo "To start the app, open two terminals:"
echo ""
echo "  Terminal 1 — backend:"
echo "    cd backend && source .venv/bin/activate && uvicorn main:app --reload"
echo ""
echo "  Terminal 2 — frontend:"
echo "    cd frontend && npm run dev"
echo ""
echo "Then open http://localhost:3000"
