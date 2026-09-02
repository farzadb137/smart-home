from flask import Flask

from hub_app.auth import bp as auth_bp
from hub_app.devices import bp as devices_bp
from hub_app.firmware import bp as firmware_bp
from hub_app.provisioning import bp as provisioning_bp
from hub_app.config import flask_settings, load_or_create_secret_key

def create_app():
	app = Flask(__name__, static_folder="static", static_url_path="")
	app.secret_key = load_or_create_secret_key()
	app.config.update(flask_settings())

	app.register_blueprint(auth_bp)
	app.register_blueprint(devices_bp)
	app.register_blueprint(firmware_bp)
	app.register_blueprint(provisioning_bp)

	@app.route("/")
	def dashboard():
		return app.send_static_file("index.html")

	@app.route("/login")
	def login_page():
		return app.send_static_file("login.html")

	@app.route("/add-device")
	def add_device_page():
		return app.send_static_file("add-device.html")

	@app.route("/api/health")
	def health():
		return {"status":"ok"}

	return app