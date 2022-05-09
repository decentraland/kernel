protoc --plugin=../../../../../node_modules/ts-protoc-gen/bin/protoc-gen-ts --js_out="import_style=commonjs,binary:." --ts_out="." comms.proto
protoc --plugin=../../../../../node_modules/ts-protoc-gen/bin/protoc-gen-ts --js_out="import_style=commonjs,binary:." --ts_out="." ws.proto
protoc --plugin=../../../../../node_modules/ts-protoc-gen/bin/protoc-gen-ts --js_out="import_style=commonjs,binary:." --ts_out="." bff.proto




