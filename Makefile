# Ledgerly design checks. Dependencies install into node_modules/ and are not committed.
# macOS (Intel and Apple Silicon) and Linux (amd64 and arm64).
# Windows uses the PowerShell scripts in scripts/ instead of make, or the npm scripts.
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

.PHONY: help ready check preflight dev runbook demo-reset

help:
	@echo "make preflight   PASS/WARN/FAIL before the session"
	@echo "make ready       npm install, then run preflight"
	@echo "make check       lint, typecheck, tokens, accessibility"
	@echo "make dev         app at http://127.0.0.1:43175"
	@echo "make runbook     local runbook page on port 43176"
	@echo "make demo-reset  restore the planted demo files"

ready:
	node scripts/workshop.mjs ready

check:
	node scripts/workshop.mjs check

preflight:
	node scripts/workshop.mjs preflight

dev:
	npm run dev

runbook:
	node scripts/runbook.mjs

demo-reset:
	node scripts/workshop.mjs demo-reset
