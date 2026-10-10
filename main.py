import asyncio
import io
import itertools
import json
import math
import os
import subprocess
import threading
import time
import urllib.request

import colorthief
import dotenv
import flask
import flask_basicauth
import paste.translogger
import py_yt
import pytubefix
import pytubefix.exceptions
import waitress
import yt_dlp
import yt_dlp.utils


dotenv.load_dotenv()


GENRES = os.getenv("GENRES")
IS_DEV = os.getenv("FLASK_ENV") == "development"
UPDATE_SECONDS = os.getenv("UPDATE_SECONDS")


app = flask.Flask(__name__)
auth_password = os.getenv("AUTH_PASSWORD")
auth_username = os.getenv("AUTH_USERNAME")
albums = {}
queues = {}


def tick_queue(update):
    while True:
        for genre in queues:
            if queues[genre]:
                queues[genre][0]["timestamp"] += update
                if queues[genre][0]["timestamp"] > queues[genre][0]["length"]:
                    queues[genre].pop(0)
        time.sleep(update)


def get_distinct_palette(image_path):

    def get_distance(color1, color2):
        return math.sqrt(sum((c1 - c2) ** 2 for c1, c2 in zip(color1, color2)))

    colors = None
    max_distance = -1
    for combination in itertools.combinations(
            colorthief.ColorThief(image_path).get_palette(
                color_count=10, quality=1), 3):
        combination_min_distance = min(
            get_distance(combination[0], combination[1]),
            get_distance(combination[1], combination[2]),
            get_distance(combination[0], combination[2]))
        if combination_min_distance > max_distance:
            max_distance = combination_min_distance
            colors = combination
    return colors


def generic_genre(genre):
    if flask.request.method == "POST":
        if flask.request.form.get("initial-load") != "true":
            if "song-search" in flask.request.form:
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

                                # noinspection PyTypeChecker
                                length = float(json.loads(subprocess.run([
                                    "ffprobe",
                                    "-v",
                                    "error",
                                    "-show_entries",
                                    "format=duration",
                                    "-of",
                                    "json",
                                    url],
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE,
                                    text=True).stdout)["format"]["duration"])
                                break
                            except KeyError:
                                pass
                        queues[genre].append({
                            "song_name": song_name,
                            "artist_name": artist_name,
                            "url": url,
                            "length": length,
                            "timestamp": 0,
                            "colors": get_distinct_palette(io.BytesIO(
                                urllib.request.urlopen(
                                    song.thumbnail_url).read()))
                        })
                        break
                    except pytubefix.exceptions.BotDetection:
                        pass
                    except pytubefix.exceptions.VideoUnavailable:
                        break
            else:
                try:
                    album_name = flask.request.form["album-search"]
                    artist_name = flask.request.form["artist-search"]

                    # noinspection PyUnusedLocal
                    songs_info = []

                    # noinspection PyTypeChecker
                    album = yt_dlp.YoutubeDL({
                        "extract_flat": True,
                        "skip_download": True,
                        "quiet": True,
                        "no_warnings": True
                    }).extract_info((f"https://youtube.com/playlist?list="
                                     f"{asyncio.run(py_yt.PlaylistsSearch(
                                         f"{album_name} by {artist_name} "
                                         f"Provided to YouTube by",
                                         limit=1).next())
                                         ["result"][0]["id"]}"),
                                    download=False)

                    async def extract_song_info(album_song):
                        song_url = album_song.get("url")
                        if not song_url:
                            return ""
                        for _ in range(5):
                            try:
                                # noinspection PyTypeChecker
                                return ((await asyncio.to_thread(
                                    lambda: yt_dlp.YoutubeDL(
                                        {"format": "bestaudio/best",
                                         "quiet": True}).extract_info(
                                        song_url, download=False)))
                                        .get("url", ""), song_url)
                            except yt_dlp.utils.YoutubeDLError:
                                continue
                        return "", song_url

                    async def gather_song_info():
                        return await asyncio.gather(
                            *[extract_song_info(album_song)
                              for album_song in album["entries"]])

                    gather_song_info_loop = asyncio.new_event_loop()
                    try:
                        songs_info = gather_song_info_loop.run_until_complete(
                            gather_song_info())
                    finally:
                        gather_song_info_loop.close()
                    thumbnails = album.get("thumbnails")

                    # noinspection PyTypeChecker
                    albums[genre][album_name] = {
                        "artist_name": artist_name,
                        "songs": [((song.get("title").lower()
                                    if song.get("title") else
                                    "unavailable"), songs_info[i][0],
                                   songs_info[i][1])
                                  for i, song in enumerate(album["entries"])],
                        "colors": get_distinct_palette(io.BytesIO(
                            urllib.request.urlopen(
                                thumbnails[0]["url"]).read()))
                        if thumbnails else
                        ([202, 158, 230], [35, 38, 52], [35, 38, 52])
                    }
                    album_endpoint_name = f"{genre}_{album_name}"
                    app._got_first_request = False
                    app.add_url_rule(
                        f"/{genre}/{album_name}",
                        endpoint=album_endpoint_name,
                        defaults={"genre": genre,
                                  "album": album_name},
                        methods=["GET", "POST"]
                    )
                    app.view_functions[album_endpoint_name] = generic_album
                    regenerate_endpoint_name = f"{genre}_{album_name}_regenerate"
                    app.add_url_rule(
                        f"/{genre}/{album_name}/regenerate",
                        endpoint=regenerate_endpoint_name,
                        defaults={"genre": genre,
                                  "album": album_name},
                        methods=["POST"]
                    )
                    app.view_functions[regenerate_endpoint_name] = generic_album_regenerate
                    app._got_first_request = True
                except yt_dlp.utils.DownloadError:
                    pass
        return flask.render_template("genre.html",
                                     genre=genre,
                                     albums=albums[genre],
                                     artists=[data["artist_name"] for _, data
                                              in albums[genre].items()],
                                     dev_mode=IS_DEV)
    else:
        return flask.render_template("force-post.html", dev_mode=IS_DEV)


def generic_album(genre, album):
    if flask.request.method == "POST":
        return flask.render_template("album.html",
                                     album=album,
                                     artist=albums[genre]
                                     [album]["artist_name"],
                                     genre=genre,
                                     songs=[song_name for
                                            song_name, song_url, youtube_url
                                            in albums[genre][album]["songs"]],
                                     dev_mode=IS_DEV)
    else:
        return flask.render_template("force-post.html", dev_mode=IS_DEV)


def generic_album_regenerate(genre, album):

    print(albums[genre][album]["songs"]
        [flask.request.get_json().get("song_index")][2])
    # noinspection PyTypeChecker
    new_url = yt_dlp.YoutubeDL({
        "format": "bestaudio/best",
        "quiet": True}
    ).extract_info(
        albums[genre][album]["songs"]
        [flask.request.get_json().get("song_index")][2],
                   download=False).get("url")
    song_info = list(albums[genre][album]["songs"]
    [flask.request.get_json().get("song_index")])
    song_info[1] = new_url
    (albums[genre][album]["songs"]
    [flask.request.get_json().get("song_index")]) = song_info
    return flask.jsonify({"url": [new_url]})


def generic_genre_albums(genre):
    if albums[genre]:
        return flask.jsonify({"albums": albums[genre]})
    else:
        return flask.jsonify({"albums": []})


def generic_genre_queue(genre):
    if queues[genre]:
        return flask.jsonify({"queue": queues[genre]})
    else:
        return flask.jsonify({"queue": []})


def generate_genres(genres_list):
    for genre in genres_list:
        albums[genre] = {}
        queues[genre] = []
        app.add_url_rule(
            f"/{genre}",
            view_func=generic_genre,
            defaults={"genre": genre},
            methods=["GET", "POST"]
        )
        app.add_url_rule(
            f"/{genre}/albums",
            view_func=generic_genre_albums,
            defaults={"genre": genre},
            methods=["GET"]
        )
        app.add_url_rule(
            f"/{genre}/queue",
            view_func=generic_genre_queue,
            defaults={"genre": genre},
            methods=["GET"]
        )


def get_vite_asset(entry_name):
    try:
        with open("static/dist/.vite/manifest.json", "r") as f:
            manifest = json.load(f)
            return manifest.get(entry_name, {}).get("file", entry_name)
    except (FileNotFoundError, json.JSONDecodeError):
        return entry_name


@app.route("/")
def index():
    return flask.render_template("index.html",
                                 genres=queues)


# noinspection PyUnusedLocal
@app.errorhandler(404)
def page_not_found(e):
    return flask.render_template("404.html"), 404


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
    if not GENRES:
        genres = ""
    if not UPDATE_SECONDS:
        update_seconds = "1"
    app.jinja_env.globals.update(vite_asset=get_vite_asset)

    # noinspection PyTypeChecker
    update_seconds = int(UPDATE_SECONDS)
    app.config["BASIC_AUTH_PASSWORD"] = auth_password
    app.config["BASIC_AUTH_USERNAME"] = auth_username
    flask_basicauth.BasicAuth(app)

    # noinspection PyUnresolvedReferences
    generate_genres(GENRES.split(","))
    tick_duration_thread = threading.Thread(target=tick_queue,
                                            daemon=True,
                                            args=(update_seconds,))
    tick_duration_thread.start()
    waitress.serve(CustomTransLogger(app),
                   host="0.0.0.0",
                   port=80,
                   connection_limit=500,
                   threads=50)
