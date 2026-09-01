.DEFAULT_GOAL := help

.PHONY: help start stop restart build status logs

help:
	@echo eFightersArena commands:
	@echo   make start    Migrate, seed, and start Next.js in the background
	@echo   make stop     Stop the background Next.js process
	@echo   make restart  Restart the Next.js development server
	@echo   make build    Create the production build
	@echo   make status   Show local service status
	@echo   make logs     Follow the Next.js development log

start:
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 start

stop:
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 stop

restart:
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 restart

build:
	@npm.cmd run build

status:
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 status

logs:
	@powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 logs
