import datetime
import os
import threading
import time

import dotenv
import flask
import flask_basicauth
import musicbrainzngs
import waitress

import utils

dotenv.load_dotenv()


GENRES = os.getenv("GENRES")
IS_DEV = os.getenv("FLASK_ENV") == "development"
UPDATE_SECONDS = os.getenv("UPDATE_SECONDS")


app = flask.Flask(__name__)
auth_password = os.getenv("AUTH_PASSWORD")
auth_username = os.getenv("AUTH_USERNAME")
album_infos = {}
albums = {}
queues = {}
song_infos = {}


def tick_queue(update):
    global albums

    while True:
        for genre in queues:
            if queues[genre]:
                queues[genre][0]["timestamp"] += update
                if queues[genre][0]["timestamp"] > queues[genre][0]["length"]:
                    queues[genre].pop(0)
        now = datetime.datetime.now()
        if abs((now - datetime.datetime.combine(now.date(), datetime.time(
                0, 0))).total_seconds()) <= 1:
            albums = {key: {} for key in albums}
        time.sleep(update)


@app.route("/")
def index():
    return flask.render_template("index.html",
                                 genres=queues)


@app.route("/validate-album", methods=["POST"])
def validate_album():
    return utils.musicbrainz.validate_album(album_infos)


@app.route("/validate-song", methods=["POST"])
def validate_song():
    return utils.musicbrainz.validate_song(song_infos)


# noinspection PyUnusedLocal
@app.errorhandler(404)
def page_not_found(error):
    return flask.render_template("404.html"), 404


if __name__ == "__main__":
    app.config["BASIC_AUTH_FORCE"] = True
    if not auth_password:
        auth_password = ""
    if not auth_username:
        auth_username = ""
    if not GENRES:
        genres = ""
    if not UPDATE_SECONDS:
        update_seconds = "1"
    app.jinja_env.globals.update(vite_asset=utils.misc.get_vite_asset)

    # noinspection PyTypeChecker
    update_seconds = int(UPDATE_SECONDS)
    if os.getenv("USE_AUTH") == "true":
        app.config["BASIC_AUTH_PASSWORD"] = auth_password
        app.config["BASIC_AUTH_USERNAME"] = auth_username
        flask_basicauth.BasicAuth(app)
    musicbrainzngs.set_useragent("eaux", "1.0", "eaux.servehttp.com")

    # noinspection PyUnresolvedReferences
    utils.generics.generate_genres(
        GENRES.split(","), queues, song_infos, albums, album_infos, app)
    tick_duration_thread = threading.Thread(target=tick_queue,
                                            daemon=True,
                                            args=(update_seconds,))
    tick_duration_thread.start()
    waitress.serve(utils.logger.CustomTransLogger(app),
                   host="0.0.0.0",
                   port=8080,
                   connection_limit=500,
                   threads=50)
