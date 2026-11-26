#pragma once
/* Generated from protocol/mqtt-topics.yaml - do not edit */

/* schema: schemas/telemetry.schema.json */
#define TOPIC_TELEMETRY "home/devices/%s/telemetry"
#define TOPIC_TELEMETRY_QOS 1
#define TOPIC_TELEMETRY_RETAINED 0

/* schema: schemas/status.schema.json */
#define TOPIC_STATUS "home/devices/%s/status"
#define TOPIC_STATUS_QOS 1
#define TOPIC_STATUS_RETAINED 1

/* schema: schemas/response.schema.json */
#define TOPIC_RESPONSE "home/devices/%s/response"
#define TOPIC_RESPONSE_QOS 1
#define TOPIC_RESPONSE_RETAINED 0

/* schema: schemas/command.schema.json */
#define TOPIC_COMMAND "home/devices/%s/command"
#define TOPIC_COMMAND_QOS 1
#define TOPIC_COMMAND_RETAINED 0

/* schema: schemas/telemetry.schema.json */
#define TOPIC_CHILD_TELEMETRY "home/devices/%s/children/%s/telemetry"
#define TOPIC_CHILD_TELEMETRY_QOS 1
#define TOPIC_CHILD_TELEMETRY_RETAINED 0

/* schema: schemas/status.schema.json */
#define TOPIC_CHILD_STATUS "home/devices/%s/children/%s/status"
#define TOPIC_CHILD_STATUS_QOS 1
#define TOPIC_CHILD_STATUS_RETAINED 1

/* schema: schemas/command.schema.json */
#define TOPIC_CHILD_COMMAND "home/devices/%s/children/%s/command"
#define TOPIC_CHILD_COMMAND_QOS 1
#define TOPIC_CHILD_COMMAND_RETAINED 0

/* schema: schemas/response.schema.json */
#define TOPIC_CHILD_RESPONSE "home/devices/%s/children/%s/response"
#define TOPIC_CHILD_RESPONSE_QOS 1
#define TOPIC_CHILD_RESPONSE_RETAINED 0

/* schema: schemas/time-sync.schema.json */
#define TOPIC_TIME "home/time"
#define TOPIC_TIME_QOS 1
#define TOPIC_TIME_RETAINED 1
