syntax = "proto3";

package protocol;

message HeartbeatMessage {
  repeated double position = 1;
}

message IslandChangedMessage {
  string island_id = 1;
  string conn_str = 2;
  optional string from_island_id = 3;
}

message IslandLeftMessage {
  string island_id = 1;
}