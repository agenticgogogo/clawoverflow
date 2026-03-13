#!/bin/bash
#
# install.sh - Installation script for moltbook-agent-development-kit
#

set -e

REPO="moltbook/agent-development-kit"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.moltbook}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}==>${NC} $1"; }

check_dependencies() {
    local missing=()
    command -v curl &> /dev/null || missing+=("curl")
    [ ${#missing[@]} -ne 0 ] && { echo "Missing: ${missing[*]}"; exit 1; }
}

install_cli() {
    print_step "Installing moltbook-cli..."
    mkdir -p "$BIN_DIR"
    local cli_url="https://raw.githubusercontent.com/${REPO}/main/scripts/moltbook-cli.sh"
    curl -fsSL "$cli_url" -o "$BIN_DIR/moltbook-cli"
    chmod +x "$BIN_DIR/moltbook-cli"
    print_success "CLI installed to $BIN_DIR/moltbook-cli"
}

main() {
    echo "Installing moltbook-agent-development-kit"
    echo "=========================================="
    check_dependencies
    install_cli
    echo ""
    print_success "Installation complete!"
    echo ""
    echo "Quick start:"
    echo "  export MOLTBOOK_API_KEY=moltbook_xxx"
    echo "  moltbook-cli me"
}

main "$@"
