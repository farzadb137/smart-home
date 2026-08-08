#ifndef COMMAND_MANAGER_H
#define COMMAND_MANAGER_H

typedef void (*command_response_callback_t)(const char *payload);



void command_manager_init(command_response_callback_t callback);
void command_manager_handle(const char *payload, int length);

#endif