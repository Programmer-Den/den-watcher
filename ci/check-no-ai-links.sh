#!/usr/bin/env bash
# check-no-ai-links.sh - fail when a tracked file links to an AI site.
#
# AGENTS.md ("No AI Links") keeps links to AI products, their docs and agent
# sessions out of code, code comments and documentation. This looks in every
# text file git tracks in DIR (default: this checkout) for the addresses of
# those sites and their subdomains, with or without https://.
#
# Run: bash ci/check-no-ai-links.sh [DIR]
set -euo pipefail

DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$DIR"

# Dots are escaped, so this file does not match its own list.
sites='claude\.(ai|com)|anthropic\.com|openai\.com|chatgpt\.com|(gemini|bard|aistudio)\.google\.com'
sites+='|copilot\.microsoft\.com|github\.com/(features/)?copilot|docs\.github\.com/[^[:space:]]*copilot'
sites+='|perplexity\.ai|mistral\.ai|x\.ai|grok\.com|deepseek\.com|poe\.com|character\.ai'
sites+='|copilot\.github\.com|ai\.google\.dev|meta\.ai|cursor\.com|huggingface\.co'
# Start of the line or a character that cannot be part of a host name or an
# e-mail address, then any subdomains, so look-alikes such as notclaude.ai and
# addresses such as a Co-Authored-By trailer's do not count.
pattern="(^|[^a-z0-9.@-])([a-z0-9-]+\.)*($sites)([^a-z0-9-]|$)"

if hits=$(git grep -nIiE -e "$pattern"); then
  while IFS= read -r hit; do printf '[FAIL] %s\n' "$hit" >&2; done <<< "$hits"
  echo 'Found links to AI sites; AGENTS.md ("No AI Links") keeps them out of the repository.' >&2
  exit 1
fi
echo '[PASS] No links to AI sites in tracked files.'
