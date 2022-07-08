# General setup
PROTOBUF_VERSION = 3.20.1
ifeq ($(shell uname),Darwin)
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-osx-x86_64.zip
else
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-x86_64.zip
endif

NODE = node
CONCURRENTLY = node_modules/.bin/concurrently
SCENE_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/kernel/apis/*.proto)
RENDERER_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/renderer-protocol/*.proto)
PBS_TS = $(SCENE_PROTO_FILES:node_modules/@dcl/protocol/kernel/apis/%.proto=packages/shared/apis/proto/%.gen.ts)
PBRENDERER_TS = $(RENDERER_PROTO_FILES:node_modules/@dcl/protocol/renderer-protocol/%.proto=packages/renderer-protocol/proto/%.gen.ts)
CWD = $(shell pwd)
PROTOC = node_modules/.bin/protobuf/bin/protoc

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

build-essentials: ${PBRENDERER_TS} packages/shared/proto/engineinterface.gen.ts ${PBS_TS} $(COMPILED_SUPPORT_JS_FILES) empty-parcels
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

test/out/index.js: build-essentials $(TEST_SOURCE_FILES)

test: build-essentials test/out/index.js  ## Run all the tests
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

# Aesthetics

lint: ## Validate correct formatting and circular dependencies
	@node_modules/.bin/madge packages/entryPoints/index.ts --circular --warning
	@node_modules/.bin/madge packages --orphans --extensions ts --exclude '.+\.d.ts|.+/dist\/.+'
	@node_modules/.bin/eslint . --ext .ts

lint-fix: ## Fix bad formatting on all .ts and .tsx files
	@node_modules/.bin/eslint . --ext .ts --fix

# Development

watch-tests:
	cd test; ./build.js -watch

watch: $(SOME_MAPPINGS) build-essentials static/index.js ## Watch the files required for hacking the explorer
	@NODE_ENV=development ./build.js -watch

fetchSceneContents: scripts/fetchSceneContents.js
	@node ./scripts/fetchSceneContents.js

clean: ## Clean all generated files

update-renderer:  ## Update the renderer
	npm install @dcl/unity-renderer@latest

madge: scripts/deps.js
	@node scripts/deps.js
	dot packages/scene-system/scene.system.ts.dot -T pdf -O
	dot packages/ui/decentraland-ui.scene.ts.dot -T pdf -O
	dot packages/entryPoints/index.ts.dot -T pdf -O
	dot packages/decentraland-loader/lifecycle/worker.ts.dot -T pdf -O
	dot packages/gif-processor/worker.ts.dot -T pdf -O
	dot packages/voice-chat-codec/audioWorkletProcessors.ts.dot -T pdf -O
	dot packages/voice-chat-codec/worker.ts.dot -T pdf -O

# Makefile

.PHONY: help docs clean watch watch-builder watch-cli lint lint-fix test-ci test-docker update build-essentials build-deploy build-release update-renderer madge
.DEFAULT_GOAL := help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo "\nYou probably want to run 'make watch' to build all the test scenes and run the local comms server."

node_modules/.bin/protobuf/bin/protoc:
	curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v$(PROTOBUF_VERSION)/$(PROTOBUF_ZIP)
	unzip -o $(PROTOBUF_ZIP) -d node_modules/.bin/protobuf
	rm $(PROTOBUF_ZIP)
	chmod +x node_modules/.bin/protobuf/bin/protoc

packages/shared/proto/engineinterface.gen.ts: packages/shared/proto/engineinterface.proto node_modules/.bin/protobuf/bin/protoc
	${PROTOC}  \
			--plugin=./node_modules/.bin/protoc-gen-ts_proto \
			--ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions \
			--ts_proto_opt=fileSuffix=.gen \
			--ts_proto_out="$(PWD)/packages/shared/proto" \
			-I="$(PWD)/packages/shared/proto" \
			"$(PWD)/packages/shared/proto/engineinterface.proto";

packages/shared/apis/proto/%.gen.ts: node_modules/@dcl/protocol/kernel/apis/%.proto node_modules/.bin/protobuf/bin/protoc
	${PROTOC}  \
			--plugin=./node_modules/.bin/protoc-gen-ts_proto \
			--ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions \
			--ts_proto_opt=fileSuffix=.gen \
			--ts_proto_out="$(PWD)/packages/shared/apis/proto" \
			-I="$(PWD)/packages/shared/apis/proto" \
			-I="$(PWD)/node_modules/@dcl/protocol/kernel/apis" \
			"$(PWD)/node_modules/@dcl/protocol/kernel/apis/$*.proto";

packages/renderer-protocol/proto/%.gen.ts: node_modules/@dcl/protocol/renderer-protocol/%.proto node_modules/.bin/protobuf/bin/protoc
	${PROTOC}  \
			--plugin=./node_modules/.bin/protoc-gen-ts_proto \
			--ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions \
			--ts_proto_opt=fileSuffix=.gen \
			--ts_proto_out="$(PWD)/packages/renderer-protocol/proto" \
			-I="$(PWD)/packages/renderer-protocol/proto" \
			-I="$(PWD)/node_modules/@dcl/protocol/renderer-protocol/" \
			"$(PWD)/node_modules/@dcl/protocol/renderer-protocol/$*.proto";

compile_apis: ${PBS_TS}

compile_renderer_protocol: ${PBRENDERER_TS}
