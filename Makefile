# Thin wrappers around the npm scripts. Run `make` to list them.

.DEFAULT_GOAL := help
.PHONY: help install dev build lint test check vault open deploy release

help: ## List the available commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Rebuild main.js on every change
	npm run dev

build: ## Typecheck, lint and bundle (the gate before calling a change done)
	npm run build

lint: ## Run ESLint with the official Obsidian rules
	npm run lint

test: ## Run the unit tests
	npm test

check: build test ## Build and test

vault: ## Build, then regenerate test-vault/ to open in Obsidian
	npm run setup-vault

open: ## Open test-vault/ in Obsidian (registers it the first time; needs Obsidian closed once)
	node scripts/open-vault.mjs

deploy: ## Build and copy into a vault: make deploy VAULT="/path/to/Vault"
	@test -n "$(VAULT)" || { echo 'Usage: make deploy VAULT="/path/to/Vault"'; exit 1; }
	npm run deploy -- --vault "$(VAULT)"

release: ## Open a release PR from an up-to-date main: make release BUMP=patch|minor|major
	@test -n "$(BUMP)" || { echo 'Usage: make release BUMP=patch|minor|major'; exit 1; }
	npm run release -- $(BUMP)
