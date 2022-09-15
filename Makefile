# General setup
PROTOBUF_VERSION = 3.20.1
ifeq ($(shell uname),Darwin)
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-osx-x86_64.zip
else
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-x86_64.zip
endif

NODE = node
COMPILER = $(NODE) --max-old-space-size=4096 node_modules/.bin/decentraland-compiler
CONCURRENTLY = node_modules/.bin/concurrently
BFF_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/bff/*.proto)
COMMS_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/kernel/comms/v3/*.proto)
COMMSRFC4_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/kernel/comms/*.proto)

SCENE_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/kernel/apis/*.proto)
RENDERER_PROTO_FILES := $(wildcard node_modules/@dcl/protocol/renderer-protocol/*.proto)
PBS_TS = $(SCENE_PROTO_FILES:node_modules/@dcl/protocol/kernel/apis/%.proto=packages/shared/apis/proto/%.gen.ts)
PBRENDERER_TS = $(RENDERER_PROTO_FILES:node_modules/@dcl/protocol/renderer-protocol/%.proto=packages/renderer-protocol/proto/%.gen.ts)
BFF_TS = $(BFF_PROTO_FILES:node_modules/@dcl/protocol/bff/%.proto=packages/shared/comms/v3/proto/bff/%.gen.ts)
COMMS_TS = $(COMMS_PROTO_FILES:node_modules/@dcl/protocol/kernel/comms/v3/%.proto=packages/shared/comms/v3/proto/%.gen.ts)
COMMSRFC4_TS = $(COMMSRFC4_PROTO_FILES:node_modules/@dcl/protocol/kernel/comms/%.proto=packages/shared/comms/%.gen.ts)


CWD = $(shell pwd)
PROTOC = node_modules/.bin/protobuf/bin/protoc

# Remove default Makefile rules

.SUFFIXES:

# SDK Files

SOURCE_SUPPORT_TS_FILES := $(wildcard scripts/*.ts)
COMPILED_SUPPORT_JS_FILES := $(subst .ts,.js,$(SOURCE_SUPPORT_TS_FILES))

SCENE_SYSTEM_SOURCES := $(wildcard static/systems/**/*.ts)
SCENE_SYSTEM := static/systems/scene.system.js
DECENTRALAND_LOADER := static/loader/worker.js
GIF_PROCESSOR := static/gif-processor/worker.js
INTERNAL_SCENES := static/systems/decentraland-ui.scene.js
VOICE_CHAT_CODEC_WORKER := static/voice-chat-codec/worker.js static/voice-chat-codec/audioWorkletProcessors.js

EMPTY_SCENES := public/empty-scenes/common

scripts/%.js: $(SOURCE_SUPPORT_TS_FILES) scripts/tsconfig.json
	@node_modules/.bin/tsc --build scripts/tsconfig.json

static/loader/worker.js: packages/decentraland-loader/**/*.ts
	@$(COMPILER) targets/engine/loader.json

static/gif-processor/worker.js: packages/gif-processor/*.ts
	@$(COMPILER) targets/engine/gif-processor.json

static/voice-chat-codec/worker.js: packages/voice-chat-codec/*.ts
	@$(COMPILER) targets/engine/voice-chat-codec.json

static/default-profile/contents:
	@node ./static/default-profile/download_all.js

static/systems/scene.system.js: $(SCENE_SYSTEM_SOURCES) packages/scene-system/scene.system.ts
	@$(COMPILER) targets/engine/scene-system.json

static/systems/decentraland-ui.scene.js: $(SCENE_SYSTEM) packages/ui/tsconfig.json packages/ui/decentraland-ui.scene.ts
	@$(COMPILER) targets/engine/internal-scenes.json

empty-parcels:
	cd public/empty-scenes/common && node generate_all.js
	mkdir -p static/loader/empty-scenes || true
	rm -rf static/loader/empty-scenes/*
	cp $(EMPTY_SCENES)/mappings.json static/loader/empty-scenes/mappings.json
	cp -R $(EMPTY_SCENES)/contents static/loader/empty-scenes/contents

build-essentials: ${BFF_TS} ${COMMS_TS} ${COMMSRFC4_TS} ${PBRENDERER_TS} ${PBS_TS} $(COMPILED_SUPPORT_JS_FILES) $(SCENE_SYSTEM) $(INTERNAL_SCENES) $(DECENTRALAND_LOADER) $(GIF_PROCESSOR) $(VOICE_CHAT_CODEC_WORKER) empty-parcels

# Entry points
static/%.js: build-essentials packages/entryPoints/%.ts
	@$(COMPILER) $(word 2,$^)

# Release

DIST_ENTRYPOINTS := static/index.js
DIST_STATIC_FILES := static/export.html static/preview.html static/default-profile/contents

build-deploy: $(DIST_ENTRYPOINTS) $(DIST_STATIC_FILES) $(SCENE_SYSTEM) $(INTERNAL_SCENES) ## Build all the entrypoints needed for a deployment

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
		-n "scene-system,internal-scenes,loader,server" \
			"$(COMPILER) targets/engine/scene-system.json --watch" \
			"$(COMPILER) targets/engine/internal-scenes.json --watch" \
			"$(COMPILER) targets/engine/loader.json --watch" \
			"node ./scripts/runTestServer.js --keep-open"

watch-cli: build-essentials ## Watch the files required for building the CLI
	@$(CONCURRENTLY) \
		-n "scene-system,internal-scenes,loader,kernel,server" \
			"$(COMPILER) targets/engine/scene-system.json --watch" \
			"$(COMPILER) targets/engine/internal-scenes.json --watch" \
			"$(COMPILER) targets/engine/loader.json --watch" \
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
		-n "scene-system,internal-scenes,loader,basic-scenes,kernel,test,simulator,server" \
			"$(COMPILER) targets/engine/scene-system.json --watch" \
			"$(COMPILER) targets/engine/internal-scenes.json --watch" \
			"$(COMPILER) targets/engine/loader.json --watch" \
			"$(COMPILER) targets/scenes/basic-scenes.json --watch" \
			"$(COMPILER) targets/entryPoints/index.json --watch" \
			"$(COMPILER) targets/test.json --watch" \
			"$(COMPILER) targets/engine/gif-processor.json --watch" \
			"node ./scripts/runPathSimulator.js" \
			"node ./scripts/runTestServer.js --keep-open"

fetchSceneContents: scripts/fetchSceneContents.js
	@node ./scripts/fetchSceneContents.js

clean: ## Clean all generated files
	@$(COMPILER) targets/clean.json

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

packages/shared/comms/%.gen.ts: node_modules/@dcl/protocol/kernel/comms/%.proto node_modules/.bin/protobuf/bin/protoc
	${PROTOC}  \
			--plugin=./node_modules/.bin/protoc-gen-ts_proto \
		  --ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions \
			--ts_proto_opt=fileSuffix=.gen \
			--ts_proto_out="$(PWD)/packages/shared/comms" \
      -I="$(PWD)/node_modules/@dcl/protocol/bff" \
      -I="$(PWD)/node_modules/protobufjs" \
			-I="$(PWD)/node_modules/@dcl/protocol/kernel/comms" \
			"$(PWD)/node_modules/@dcl/protocol/kernel/comms/$*.proto"

packages/shared/comms/v3/proto/bff/%.gen.ts: node_modules/@dcl/protocol/bff/%.proto node_modules/.bin/protobuf/bin/protoc
	${PROTOC}  \
			--plugin=./node_modules/.bin/protoc-gen-ts_proto \
		  --ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions \
			--ts_proto_opt=fileSuffix=.gen \
			--ts_proto_out="$(PWD)/packages/shared/comms/v3/proto/bff" \
      -I="$(PWD)/node_modules/@dcl/protocol/bff" \
      -I="$(PWD)/node_modules/protobufjs" \
			"$(PWD)/node_modules/@dcl/protocol/bff/$*.proto"

packages/shared/comms/v3/proto/%.gen.ts: node_modules/@dcl/protocol/kernel/comms/v3/%.proto node_modules/.bin/protobuf/bin/protoc
	${PROTOC}  \
			--plugin=./node_modules/.bin/protoc-gen-ts_proto \
			--ts_proto_opt=esModuleInterop=true,oneof=unions\
			--ts_proto_opt=fileSuffix=.gen \
			--ts_proto_out="$(PWD)/packages/shared/comms/v3/proto" -I="$(PWD)/node_modules/@dcl/protocol/kernel/comms/v3" \
			"$(PWD)/node_modules/@dcl/protocol/kernel/comms/v3/$*.proto"

compile_apis: ${BFF_TS} ${COMMS_TS} ${PBS_TS}

compile_renderer_protocol: ${PBRENDERER_TS}
