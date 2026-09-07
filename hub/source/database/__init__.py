"""SQLite database access for the IoT hub."""

from .connection import get_connection
from .devices import (
	get_device_with_parent,
	get_or_create_device,
	mark_offline_devices,
	update_device_status
)
from .rooms import (
	assign_device_to_room,
	create_room,
	delete_room,
	get_room,
	list_rooms,
	update_room
)
from .readings import (
	get_device_history,
	get_latest_readings,
	get_latest_readings_by_hardware_ids,
	rollup_and_prune,
	save_reading
)
from .activity import add_activity, list_activity
from .automations import (create_automation, delete_automation, get_automation, list_automations, mark_triggered, update_automation)
from .schema import CURRENT_SCHEMA_VERSION, init_database, migrate_database
from .users import (
	count_enabled_administrators,
	create_initial_admin,
	create_user,
	delete_user,
	get_user,
	get_user_by_id,
	has_administrator,
	is_setup_complete,
	list_users,
	set_setup_complete,
	set_user_password,
	update_user,
	user_count
)

__all__ = [
	"CURRENT_SCHEMA_VERSION",
	"get_connection",
	"get_device_history",
	"get_device_with_parent",
	"get_latest_readings",
	"get_latest_readings_by_hardware_ids",
	"get_or_create_device",
	"get_user",
	"get_user_by_id",
	"list_users",
	"user_count",
	"has_administrator",
	"is_setup_complete",
	"set_setup_complete",
	"create_initial_admin",
	"create_user",
	"delete_user",
	"count_enabled_administrators",
	"init_database",
	"mark_offline_devices",
	"migrate_database",
	"rollup_and_prune",
	"save_reading",
	"set_user_password",
	"update_device_status",
	"assign_device_to_room",
	"create_room",
	"delete_room",
	"get_room",
	"list_rooms",
	"update_room",
	"add_activity",
	"list_activity",
	"create_automation",
	"delete_automation",
	"get_automation",
	"list_automations",
	"mark_triggered",
	"update_automation"
]