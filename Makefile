.PHONY: start-bot logs-bot

start-bot:
	env $(cat .env | xargs) pnpm tsx src/runner.ts | tee logs/mainnet_arb.log

logs-bot:
	tail -f logs/mainnet_arb.log
