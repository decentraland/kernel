# General setup
NODE = node
COMPILER = $(NODE) --max-old-space-size=4096 node_modules/.bin/decentraland-compiler
CONCURRENTLY = node_modules/.bin/concurrently

CWD = $(shell pwd)
# Remove default Makefile rules

.SUFFIXES:

# SDK Files

SOURCE_SUPPORT_TS_FILES := $(wildcard scripts/*.ts)
COMPILED_SUPPORT_JS_FILES := $(subst .ts,.js,$(SOURCE_SUPPORT_TS_FILES))

GIF_PROCESSOR := static/gif-processor/worker.js
INTERNAL_SCENES := static/systems/decentraland-ui.scene.js
VOICE_CHAT_CODEC_WORKER := static/voice-chat-codec/worker.js static/voice-chat-codec/audioWorkletProcessors.js

EMPTY_SCENES := public/empty-scenes/common

scripts/%.js: $(SOURCE_SUPPORT_TS_FILES) scripts/tsconfig.json
	@node_modules/.bin/tsc --build scripts/tsconfig.json

static/gif-processor/worker.js: packages/gif-processor/*.ts
	@$(COMPILER) targets/engine/gif-processor.json

static/voice-chat-codec/worker.js: packages/voice-chat-codec/*.ts
	@$(COMPILER) targets/engine/voice-chat-codec.json

static/default-profile/contents:
	@node ./static/default-profile/download_all.js

static/systems/decentraland-ui.scene.js: packages/ui/tsconfig.json packages/ui/decentraland-ui.scene.ts
	@$(COMPILER) targets/engine/internal-scenes.json

empty-parcels:
	cd public/empty-scenes/common && node generate_all.js
	mkdir -p static/loader/empty-scenes || true
	rm -rf static/loader/empty-scenes/*
	cp $(EMPTY_SCENES)/mappings.json static/loader/empty-scenes/mappings.json
	cp -R $(EMPTY_SCENES)/contents static/loader/empty-scenes/contents

build-essentials: $(COMPILED_SUPPORT_JS_FILES) $(INTERNAL_SCENES) $(GIF_PROCESSOR) $(VOICE_CHAT_CODEC_WORKER) empty-parcels

# Entry points
static/%.js: build-essentials packages/entryPoints/%.ts
	@$(COMPILER) $(word 2,$^)

# Release

DIST_ENTRYPOINTS := static/index.js
DIST_STATIC_FILES := static/export.html static/preview.html static/default-profile/contents

build-deploy: $(DIST_ENTRYPOINTS) $(DIST_STATIC_FILES) $(INTERNAL_SCENES) ## Build all the entrypoints needed for a deployment

build-release: $(DIST_ENTRYPOINTS) $(DIST_STATIC_FILES) $(DIST_PACKAGE_JSON) ## Build all the entrypoints and run the `scripts/prepareDist` script
	@node ./scripts/prepareDist.js

# Testing

TEST_SOURCE_FILES := $(wildcard test/**/*.ts)

test/out/index.js: build-essentials $(TEST_SOURCE_FILES)
	@$(COMPILER) ./targets/test.json

test: build-essentials test/out/index.js ## Run all the tests
	@node scripts/runTestServer.js

test-docker: ## Run all the tests using a docker container
	@docker run \
		-it \
		--rm \
		--name node \
		-v "$(PWD):/usr/src/app" \
		-w /usr/src/app \
		-e SINGLE_RUN=true \
		-p 8080:8080 \
		circleci/node:10-browsers \
			make test

test-ci: # Run the tests (for use in the continuous integration environment)
	@SINGLE_RUN=true NODE_ENV=production $(MAKE) test
	@node_modules/.bin/nyc report --temp-directory ./test/tmp --reporter=html --reporter=lcov --reporter=text

npm-link: build-essentials ## Run `npm link` to develop local scenes against this project
	cd static; npm link

watch-builder: build-essentials ## Watch the files required for hacking with the builder
	@$(CONCURRENTLY) \
		-n "internal-scenes,server" \
			"$(COMPILER) targets/engine/internal-scenes.json --watch" \
			"node ./scripts/runTestServer.js --keep-open"

watch-cli: build-essentials ## Watch the files required for building the CLI
	@$(CONCURRENTLY) \
		-n "internal-scenes,kernel,server" \
			"$(COMPILER) targets/engine/internal-scenes.json --watch" \
			"$(COMPILER) targets/entryPoints/index.json --watch" \
			"node ./scripts/runTestServer.js --keep-open"

# Aesthetics

lint: ## Validate correct formatting and circular dependencies
	@node_modules/.bin/madge packages/entryPoints/index.ts --circular --warning
	@node_modules/.bin/madge packages --orphans --extensions ts --exclude '.+\.d.ts|.+/dist\/.+'
	@node_modules/.bin/eslint . --ext .ts

lint-fix: ## Fix bad formatting on all .ts and .tsx files
	@node_modules/.bin/eslint . --ext .ts --fix

# Development

watch: $(SOME_MAPPINGS) build-essentials static/index.js ## Watch the files required for hacking the explorer
	@NODE_ENV=development $(CONCURRENTLY) \
		-n "internal-scenes,basic-scenes,kernel,test,gif-worker,server" \
			"$(COMPILER) targets/engine/internal-scenes.json --watch" \
			"$(COMPILER) targets/scenes/basic-scenes.json --watch" \
			"$(COMPILER) targets/entryPoints/index.json --watch" \
			"$(COMPILER) targets/test.json --watch" \
			"$(COMPILER) targets/engine/gif-processor.json --watch" \
			"node ./scripts/runTestServer.js --keep-open"

fetchSceneContents: scripts/fetchSceneContents.js
	@node ./scripts/fetchSceneContents.js

clean: ## Clean all generated files
	@$(COMPILER) targets/clean.json

update-renderer:  ## Update the renderer
	npm install @dcl/unity-renderer@latest

madge: scripts/deps.js
	@node scripts/deps.js
	dot packages/ui/decentraland-ui.scene.ts.dot -T pdf -O
	dot packages/entryPoints/index.ts.dot -T pdf -O
	dot packages/gif-processor/worker.ts.dot -T pdf -O
	dot packages/voice-chat-codec/audioWorkletProcessors.ts.dot -T pdf -O
	dot packages/voice-chat-codec/worker.ts.dot -T pdf -O

# Makefile

.PHONY: help docs clean watch watch-builder watch-cli lint lint-fix test-ci test-docker update build-essentials build-deploy build-release update-renderer madge
.DEFAULT_GOAL := help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo "\nYou probably want to run 'make watch' to build all the test scenes and run the local comms server."
