# Injects the invoking user's identity + home so the stack isn't pinned to one
# person. Use `make up` instead of bare `docker compose up`.

export DOCKER_UID := $(shell id -u)
export DOCKER_GID := $(shell id -g)
export WATCH_ROOT ?= $(HOME)

.PHONY: up down logs rebuild ps

up:            ## Build + start the stack as the current user
	docker compose up -d --build

down:          ## Stop the stack
	docker compose down

rebuild:       ## Rebuild just the api after code changes
	docker compose up -d --build api

logs:          ## Follow api logs
	docker compose logs -f api

ps:            ## Show container status
	docker compose ps
