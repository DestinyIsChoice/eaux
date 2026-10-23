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
import musicbrainzngs
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
album_infos = {}
albums = {}
queues = {}
song_infos = {}


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


def search_song(song, artist, result_index):
    song_search = pytubefix.Search(
        f"""
        {song} by {artist} "Provided to YouTube"
        """)
    if not song_search.results:
        song_search = pytubefix.Search(
            f"{song} by {artist}")
    if song_search.results[result_index]:
        return song_search.results[result_index]
    else:
        return song_search.results[0]


def get_album(album_name, artist_name):
    try:
        release = musicbrainzngs.search_releases(
            query=f"artist:\"{artist_name}\" "
                  f"AND release:\"{album_name}\"",
            limit=5)['release-list'][0]
        return (release.get("title", "unknown"),
                ", ".join([credit.get("artist", {}).get("name", artist_name)
                           for credit in release.get("artist-credit", [{}])]),
                release["id"])
    except (musicbrainzngs.MusicBrainzError, IndexError):
        return None


def get_album_tracklist(release_id):
    try:
        return [
            track.get("recording", {}).get("title", "unknown")
            for medium in
            musicbrainzngs.get_release_by_id(
                release_id, includes=["recordings"])
            .get("release", {})["medium-list"]
            for track in medium.get("track-list", [])
        ]
    except musicbrainzngs.MusicBrainzError:
        return None


def get_song(song_name, artist_name):
    try:
        result = musicbrainzngs.search_recordings(
            query=f"artist:\"{artist_name}\" AND recording:\"{song_name}\"",
            limit=5)
        return (result['recording-list'][0].get("title", "unknown"),
                ", ".join([credit.get("artist", {}).get("name", artist_name)
                           for credit in result["recording-list"][0]
                          .get("artist-credit", [{}])]))
    except (musicbrainzngs.MusicBrainzError, IndexError):
        return None


def generic_genre(genre):
    if flask.request.method == "POST":
        if flask.request.form["initial-load"] != "true":
            if "song-search" in flask.request.form:
                song_input = flask.request.form["song-search"]
                validated_info = song_infos.get(song_input)
                if not validated_info:
                    validated_info = (song_input,
                                      flask.request.form["artist-search"])

                for i in range(5):
                    try:
                        song = search_song(validated_info[0],
                                           validated_info[1],
                                           0)

                        # noinspection PyTypeChecker, PyUnresolvedReferences
                        url = (yt_dlp.YoutubeDL({
                            "format": "bestaudio/best",
                            "quiet": True}
                        ).extract_info(song.watch_url, download=False)["url"])
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

                        # noinspection PyUnresolvedReferences
                        queues[genre].append({
                            "song_name": song_infos[song_input][0],
                            "artist_name": song_infos[song_input][1],
                            "url": url,
                            "length": length,
                            "timestamp": 0,
                            "thumbnail": song.thumbnail_url,
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
                    album_input = flask.request.form["album-search"]
                    if (album_input not in album_infos
                            or album_infos[album_input] is None):
                        return flask.render_template("genre.html",
                                                     genre=genre,
                                                     albums=albums[genre])
                    album = yt_dlp.YoutubeDL({
                        "extract_flat": True,
                        "skip_download": True,
                        "quiet": True,
                        "no_warnings": True
                    }).extract_info((f"https://youtube.com/playlist?list="
                                     f"{asyncio.run(py_yt.PlaylistsSearch(
                                         f"{album_infos[album_input][0]} "
                                         f"by {album_infos[album_input][1]} "
                                         f"Provided to YouTube by",
                                         limit=1).next())
                                         ["result"][0]["id"]}"),
                                    download=False)

                    async def extract_song_info(album_song):
                        song_url = album_song["url"]
                        streaming_url = ""
                        if not song_url:
                            return "", ""
                        try:
                            streaming_url = (await asyncio.to_thread(
                                lambda: yt_dlp.YoutubeDL(
                                    {"format": "bestaudio/best",
                                     "quiet": True}).extract_info(
                                    song_url, download=False))).get("url", "")
                        except yt_dlp.utils.YoutubeDLError:
                            if not album_song["title"]:
                                return "", song_url
                            for search_index in range(5):
                                try:
                                    song_url = search_song(
                                        album_song["title"],
                                        album_infos[album_input][1],
                                        search_index).watch_url
                                    streaming_url = ((await asyncio.to_thread(
                                        lambda: yt_dlp.YoutubeDL(
                                            {"format": "bestaudio/best",
                                             "quiet": True})
                                        .extract_info(song_url,
                                                      download=False)))
                                                     .get("url", ""))
                                    break
                                except yt_dlp.utils.YoutubeDLError:
                                    if search_index == 4:
                                        streaming_url = ""
                        return streaming_url, song_url

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

                    # noinspection PyTypeChecker, PyUnresolvedReferences
                    albums[genre][album_infos[album_input][0]] = {
                        "artist_name": album_infos[album_input][1],
                        "songs": [(get_album_tracklist(
                            album_infos[album_input][2])[i],
                                   songs_info[i][0],
                                   songs_info[i][1])
                                  for i, song in enumerate(album["entries"])],
                        "thumbnail": search_song(album["entries"][0]["title"],
                                                 album_infos[album_input][1],
                                                 0)
                        .thumbnail_url,
                        "colors": get_distinct_palette(io.BytesIO(
                            urllib.request.urlopen(
                                album["thumbnails"][0]["url"]).read()))
                        if album["thumbnails"] else
                        ([202, 158, 230], [35, 38, 52], [35, 38, 52])
                    }
                    album_endpoint_name = (f"{genre}_"
                                           f"{album_infos[album_input][0]}")
                    app._got_first_request = False
                    app.add_url_rule(
                        f"/{genre}/{album_infos[album_input][0]}",
                        endpoint=album_endpoint_name,
                        defaults={"genre": genre,
                                  "album": album_infos[album_input][0]},
                        methods=["GET", "POST"]
                    )
                    app.view_functions[album_endpoint_name] = generic_album
                    regenerate_endpoint_name = f"{genre}_{album_infos[
                        album_input][0]}_regenerate"
                    app.add_url_rule(
                        f"/{genre}/{album_infos[album_input][0]}/regenerate",
                        endpoint=regenerate_endpoint_name,
                        defaults={"genre": genre,
                                  "album": album_infos[album_input][0]},
                        methods=["POST"]
                    )
                    app.view_functions[
                        regenerate_endpoint_name] = generic_album_regenerate
                    app._got_first_request = True
                except yt_dlp.utils.DownloadError:
                    pass
        return flask.render_template("genre.html",
                                     genre=genre,
                                     albums=albums[genre],
                                     artists=[data["artist_name"] for _, data
                                              in albums[genre].items()],
                                     max=int(os.getenv("QUEUE_MAX")),
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

    # noinspection PyTypeChecker
    new_url = yt_dlp.YoutubeDL({
        "format": "bestaudio/best",
        "quiet": True}
    ).extract_info(
        albums[genre][album]["songs"]
        [flask.request.get_json()["song_index"]][2],
        download=False)["url"]
    song_info = list(albums[genre][album]["songs"]
                     [flask.request.get_json()["song_index"]])
    song_info[1] = new_url
    (albums[genre][album]["songs"]
     [flask.request.get_json()["song_index"]]) = song_info
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


@app.route("/validate-album", methods=["POST"])
def validate_album():
    album_infos[flask.request.json["album"]] = get_album(
        flask.request.json["album"], flask.request.json["artist"])
    return flask.jsonify(
        {"album": album_infos[flask.request.json["album"]]})


@app.route("/validate-song", methods=["POST"])
def validate_song():
    song_infos[flask.request.json["song"]] = get_song(
        flask.request.json["song"], flask.request.json["artist"])
    return flask.jsonify(
        {"song": song_infos[flask.request.json["song"]]})


# noinspection PyUnusedLocal
@app.errorhandler(404)
def page_not_found(error):
    return flask.render_template("404.html"), 404


class CustomTransLogger:
    def __init__(self, _app, setup_console_handler=True):
        self.logger_app = paste.translogger.TransLogger(
            _app, setup_console_handler=setup_console_handler)

    def __call__(self, environ, start_response):
        if environ["REQUEST_METHOD"] == "GET":
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
    if os.getenv("USE_AUTH") == "true":
        app.config["BASIC_AUTH_PASSWORD"] = auth_password
        app.config["BASIC_AUTH_USERNAME"] = auth_username
        flask_basicauth.BasicAuth(app)
    musicbrainzngs.set_useragent("eaux", "1.0", "eaux.servehttp.com")

    # noinspection PyUnresolvedReferences
    generate_genres(GENRES.split(","))
    tick_duration_thread = threading.Thread(target=tick_queue,
                                            daemon=True,
                                            args=(update_seconds,))
    tick_duration_thread.start()
    waitress.serve(CustomTransLogger(app),
                   host="0.0.0.0",
                   port=8080,
                   connection_limit=500,
                   threads=50)
