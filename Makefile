# Basemarket Makefile
# Quick commands for development and deployment

.PHONY: help up down logs build clean dev registry creation resolution frontend trading

# Default target
help:
	@echo "Basemarket - Available Commands"
	@echo "=============================="
	@echo ""
	@echo "Docker Commands:"
	@echo "  make up           - Start all services"
	@echo "  make up-registry  - Start only registry"
	@echo "  make up-trading   - Start registry + trading"
	@echo "  make up-agents    - Start creation + resolution agents"
	@echo "  make down         - Stop all services"
	@echo "  make logs         - Follow all logs"
	@echo "  make logs-trading - Follow trading floor logs"
	@echo "  make logs-create  - Follow creation agent logs"
	@echo "  make logs-resolve - Follow resolution agent logs"
	@echo "  make build        - Build all Docker images"
	@echo "  make clean        - Remove containers and volumes"
	@echo ""
	@echo "Local Development (pnpm shortcuts):"
	@echo "  pnpm registry     - Start registry server"
	@echo "  pnpm trading      - Start trading floor API"
	@echo "  pnpm frontend     - Start Next.js frontend"
	@echo "  pnpm generate     - Run market creation loop"
	@echo "  pnpm resolve      - Run market resolution loop"
	@echo "  pnpm trade:demo   - Run trading demo"
	@echo "  pnpm trade:live   - Run live trading (with registry)"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make status       - Show running containers"
	@echo "  make shell-reg    - Shell into registry container"
	@echo "  make init-admin   - Create admin user in registry"

# =============================================================================
# Docker Commands
# =============================================================================

up:
	docker-compose up -d

up-registry:
	docker-compose up -d registry

up-agents:
	docker-compose up -d creation resolution

up-trading:
	docker-compose up -d registry trading

up-frontend:
	docker-compose up -d registry trading frontend

down:
	docker-compose down

logs:
	docker-compose logs -f

logs-create:
	docker-compose logs -f creation

logs-resolve:
	docker-compose logs -f resolution

logs-registry:
	docker-compose logs -f registry

logs-trading:
	docker-compose logs -f trading

logs-frontend:
	docker-compose logs -f frontend

build:
	docker-compose build

clean:
	docker-compose down -v --remove-orphans
	docker system prune -f

# Fresh start - reset database only, keep images
reset:
	docker-compose down
	docker volume rm -f sigarena_registry-data
	docker-compose up -d
	@echo "✅ Fresh start! Database reset, all services running."

# =============================================================================
# Development Commands
# =============================================================================

dev:
	docker-compose -f docker-compose.dev.yml up -d

dev-registry:
	docker-compose -f docker-compose.dev.yml up -d registry

dev-down:
	docker-compose -f docker-compose.dev.yml down

# =============================================================================
# Utility Commands
# =============================================================================

status:
	docker-compose ps

shell-reg:
	docker-compose exec registry sh

shell-resolve:
	docker-compose exec resolution sh

# Initialize admin user (run after registry is up)
init-admin:
	@echo "Creating admin user..."
	@curl -s -X POST http://localhost:3100/users/register \
		-H "Content-Type: application/json" \
		-d '{"name":"Admin"}' | jq .
	@echo "\nSave the token above! Use it to create agent accounts."

# Create agent account (requires admin token)
create-agent:
	@read -p "Enter admin token: " token; \
	curl -s -X POST http://localhost:3100/users \
		-H "Authorization: Bearer $$token" \
		-H "Content-Type: application/json" \
		-d '{"name":"Agent","role":"agent"}' | jq .
	@echo "\nSet AGENT_TOKEN in .env to the token above."

# =============================================================================
# Local Development (without Docker)
# =============================================================================

# Default timezone for all services
export TZ=America/Los_Angeles

local-install:
	pnpm install

local-build:
	pnpm -r build

local-registry:
	TZ=America/Los_Angeles pnpm registry

local-create:
	TZ=America/Los_Angeles pnpm generate

local-resolve:
	TZ=America/Los_Angeles pnpm resolve

local-trading:
	TZ=America/Los_Angeles pnpm trading

local-test:
	pnpm -r test
