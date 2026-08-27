import getpass
from werkzeug.security import generate_password_hash
from database import migrate_database, set_user_password

def main():
	migrate_database()

	username = input("Username: ").strip()
	password = getpass.getpass("Password: ")
	confirm = getpass.getpass("Confirm password: ")

	if not username:
		print("Username cannot be empty")
		return

	if password != confirm:
		print("Passwords do not match")
		return

	if len(password) < 8:
		print("Password should be at least 8 characters")
		return

	set_user_password(username, generate_password_hash(password))
	print(f"Password set for user '{username}'")

if __name__ == "__main__":
	main()