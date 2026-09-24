import io
import os
import subprocess
import urllib.request

import colorthief
import dotenv
import flask
import flask_basicauth
import json
import paste.translogger
import pytubefix
import pytubefix.exceptions
import threading
import time
import waitress
import yt_dlp


dotenv.load_dotenv()


app = flask.Flask(__name__)
auth_password = os.getenv("AUTH_PASSWORD")
auth_username = os.getenv("AUTH_USERNAME")
genres = os.getenv("GENRES")
queues = {}
update_seconds = os.getenv("UPDATE_SECONDS")


def tick_duration(update):
    while True:
        for genre in queues:
            if queues[genre]:
                queues[genre][0]["timestamp"] += update
                if queues[genre][0]["timestamp"] > queues[genre][0]["length"]:
                    queues[genre].pop(0)
        time.sleep(update)


def generic_genre(genre):
    if flask.request.method == "POST":
        if flask.request.form.get("initial-load") != "true":
            for i in range(5):
                try:
                    song_name = flask.request.form["song-search"]
                    artist_name = flask.request.form["artist-search"]
                    song_search = pytubefix.Search(
                        f"""
                        {song_name} by {artist_name} "Provided to YouTube"
                        """)
                    if not song_search.results:
                        song_search = pytubefix.Search(
                            f"{song_name} by {artist_name}")
                    song = song_search.results[0]

                    # noinspection PyTypeChecker
                    url = (yt_dlp.YoutubeDL({
                        "format": "bestaudio/best",
                        "quiet": True}
                    ).extract_info(song.watch_url, download=False)
                           .get("url"))
                    while True:
                        try:
                            length = float(json.loads(subprocess.run(
                                f"ffprobe "
                                f"-v error "
                                f"-show_entries "
                                f"format=duration "
                                f"-of json {url}",
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                                text=True).stdout)["format"]["duration"])
                            break
                        except KeyError:
                            pass
                    colors = [f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
                              for rgb in colorthief.ColorThief(io.BytesIO(
                                urllib.request.urlopen(song.thumbnail_url)
                                .read())).get_palette(
                            color_count=2, quality=1)]
                    queues[genre].append({
                        "song_name": song_name,
                        "artist_name": artist_name,
                        "url": url,
                        "length": length,
                        "timestamp": 0,
                        "colors": colors
                    })
                    break
                except pytubefix.exceptions.BotDetection:
                    pass
                except pytubefix.exceptions.VideoUnavailable:
                    break
        return flask.render_template("genre.html", genre=genre)
    else:
        return flask.render_template("force-post.html")


def generic_genre_queue(genre):
    if queues[genre]:
        return flask.jsonify({"queue": queues[genre]})
    else:
        return flask.jsonify({"queue": []})


def generate_genres(genres_list):
    for genre in genres_list:
        queues[genre] = []
        app.add_url_rule(
            f"/{genre}",
            view_func=generic_genre,
            defaults={"genre": genre},
            methods=["GET", "POST"]
        )
        app.add_url_rule(
            f"/queue/{genre}",
            view_func=generic_genre_queue,
            defaults={"genre": genre},
            methods=["GET"]
        )


@app.route("/")
def index():
    return flask.render_template("index.html",
                                 genres_list="".join([
                                     f"""
                                     <a
                                         href="/{genre}"
                                         class="genre-button"
                                     >
                                         {genre}
                                     </a>
                                     """
                                     for genre in queues])
                                 )


class CustomTransLogger:
    def __init__(self, _app, setup_console_handler=True):
        self.logger_app = paste.translogger.TransLogger(
            _app, setup_console_handler=setup_console_handler)

    def __call__(self, environ, start_response):
        if environ.get("REQUEST_METHOD") == "GET":
            return self.logger_app.application(environ, start_response)
        return self.logger_app(environ, start_response)


if __name__ == "__main__":
    app.config["BASIC_AUTH_FORCE"] = True
    if not auth_password:
        auth_password = ""
    if not auth_username:
        auth_username = ""
    if not genres:
        genres = ""
    if not update_seconds:
        update_seconds = "1"
    update_seconds = int(update_seconds)
    app.config["BASIC_AUTH_PASSWORD"] = auth_password
    app.config["BASIC_AUTH_USERNAME"] = auth_username
    flask_basicauth.BasicAuth(app)
    generate_genres(genres.split(","))
    tick_duration_thread = threading.Thread(target=tick_duration,
                                            daemon=True,
                                            args=(update_seconds,))
    tick_duration_thread.start()
    waitress.serve(CustomTransLogger(app),
                   host="0.0.0.0",
                   port=80,
                   connection_limit=500,
                   threads=50)
