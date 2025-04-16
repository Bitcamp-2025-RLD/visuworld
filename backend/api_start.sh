#!/bin/bash
set -e  # Exit immediately on error

echo "🔧 Installing Rust toolchain (required for tiktoken)..."
# Minimal packages needed for building Rust-based Python wheels
apt-get update && apt-get install -y \
    curl \
    build-essential

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
# Add Rust to current shell session
source "$HOME/.cargo/env"

echo "⬆️ Upgrading pip in case a prebuilt wheel becomes available..."
pip install --upgrade pip

echo "📦 Installing requirements (including tiktoken)..."
pip install -r requirements.txt

echo "🚀 Starting app with uvicorn..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
