# General setup
NODE = node
CONCURRENTLY = node_modules/.bin/concurrently

CWD = $(shell pwd)
# Remove default Makefile rules

.SUFFIXES:

# SDK Files

SOURCE_SUPPORT_TS_FILES := $(wildcard scripts/*.ts)
COMPILED_SUPPORT_JS_FILES := $(subst .ts,.js,$(SOURCE_SUPPORT_TS_FILES))

EMPTY_SCENES := public/empty-scenes/common

scripts/%.js: $(SOURCE_SUPPORT_TS_FILES) scripts/tsconfig.json
	@node_modules/.bin/tsc --build scripts/tsconfig.json

static/default-profile/contents:
	@node ./static/default-profile/download_all.js

empty-parcels:
	cd public/empty-scenes/common && node generate_all.js
	mkdir -p static/loader/empty-scenes || true
	rm -rf static/loader/empty-scenes/*
	cp $(EMPTY_SCENES)/mappings.json static/loader/empty-scenes/mappings.json
	cp -R $(EMPTY_SCENES)/contents static/loader/empty-scenes/contents

build-essentials: $(COMPILED_SUPPORT_JS_FILES) empty-parcels
	echo 'declare module "env" {}' > node_modules/env.d.ts
	echo 'declare module "dcl" {}' > node_modules/dcl.d.ts
	ESSENTIALS_ONLY=true node ./build.js
	BUNDLES_ONLY=true node ./build.js

# Entry points
static/index.js:
	@node ./build.js

# Release

DIST_ENTRYPOINTS := static/index.js
DIST_STATIC_FILES := static/export.html static/preview.html static/default-profile/contents

build-deploy: $(DIST_ENTRYPOINTS) $(DIST_STATIC_FILES) ## Build all the entrypoints needed for a deployment

build-release: $(DIST_ENTRYPOINTS) $(DIST_STATIC_FILES) $(DIST_PACKAGE_JSON) ## Build all the entrypoints and run the `scripts/prepareDist` script
	@node ./scripts/prepareDist.js

# Testing

TEST_SOURCE_FILES := $(wildcard test/**/*.ts)

test: build-essentials ## Run all the tests
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

npm-link: build-essentials ## Run `npm link` to develop local scenes against this project
	cd static; npm link

# Aesthetics

lint: ## Validate correct formatting and circular dependencies
	@node_modules/.bin/madge packages/entryPoints/index.ts --circular --warning
	@node_modules/.bin/madge packages --orphans --extensions ts --exclude '.+\.d.ts|.+/dist\/.+'
	@node_modules/.bin/eslint . --ext .ts

lint-fix: ## Fix bad formatting on all .ts and .tsx files
	@node_modules/.bin/eslint . --ext .ts --fix

# Development

watch: $(SOME_MAPPINGS) build-essentials static/index.js ## Watch the files required for hacking the explorer
	@NODE_ENV=development ./build.js -watch

fetchSceneContents: scripts/fetchSceneContents.js
	@node ./scripts/fetchSceneContents.js

update-renderer:  ## Update the renderer
	npm install @dcl/unity-renderer@latest

# example: make update-renderer-branch BRANCH=main
update-renderer-branch:
	curl "https://renderer-artifacts.decentraland.org/branch/$(BRANCH)/unity.data?v=1668803795251" --output node_modules/@dcl/unity-renderer/unity.data --fail
	curl "https://renderer-artifacts.decentraland.org/branch/$(BRANCH)/unity.framework.js?v=1668803795251" --output node_modules/@dcl/unity-renderer/unity.framework.js --fail
	curl "https://renderer-artifacts.decentraland.org/branch/$(BRANCH)/unity.loader.js?v=1668803795251" --output node_modules/@dcl/unity-renderer/unity.loader.js --fail
	curl "https://renderer-artifacts.decentraland.org/branch/$(BRANCH)/unity.symbols.json?v=1668803795251" --output node_modules/@dcl/unity-renderer/unity.symbols.json --fail
	curl "https://renderer-artifacts.decentraland.org/branch/$(BRANCH)/unity.wasm?v=1668803795251" --output node_modules/@dcl/unity-renderer/unity.wasm --fail

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
