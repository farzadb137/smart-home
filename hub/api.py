from hub_app import create_app

app = create_app()

if __name__ == "__main__":
	app.run(
		host="0.0.0.0",
		port=5000,
		ssl_context=(
			"/home/farzad/iot/certs/api.crt",
			"/home/farzad/iot/certs/api.key"
		)
	)