import os
from hub_app import create_app

app = create_app()

if __name__ == "__main__":
	app.run(
		host="0.0.0.0",
		port=5000,
		ssl_context=(
			os.environ.get("API_CERT_PATH", "/etc/smart-hub/certs/api.crt"),
			os.environ.get("API_KEY_PATH", "/etc/smart-hub/certs/api.key")
		)
	)