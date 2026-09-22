from database import migrate_database, rollup_and_prune, get_connection

def main():
	migrate_database()

	deleted = rollup_and_prune()
	print(f"[MAINTENANCE] Archived and pruned {deleted} raw telemetry rows")

	connection = get_connection()
	connection.execute("VACUUM")
	connection.close()
	print("[MAINTENANCE] VACUUM complete")

if __name__ == "__main__":
	main()