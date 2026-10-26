import asyncio
import io
import json
import os
import requests
import subprocess
import urllib.request

import flask
import py_yt
import pytubefix
import pytubefix.exceptions
import yt_dlp

import utils


def handle_album_input(genre, album_infos, albums, app):
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
        album_tracklist = utils.musicbrainz.get_album_tracklist(
            album_infos[album_input][2])
        matches = utils.match_songs.get_matches(
            album_tracklist,
            album,
            asyncio.run(
                utils.song_info.gather_song_info(
                    album, album_input, genre, album_infos, albums)
            )
        )
        thumbnail_exists = requests.head(
            album_infos[album_input][3],
            allow_redirects=True,
            timeout=5).status_code != 404

        # noinspection PyTypeChecker, PyUnresolvedReferences
        albums[genre][album_infos[album_input][0]] = {
            "artist_name": album_infos[album_input][1],
            "songs": [(song.lower(),
                       matches[song][0] if matches[song] else "",
                       matches[song][1] if matches[song] else "")
                      for i, song in enumerate(album_tracklist)],
            "thumbnail": album_infos[album_input][3]
            if thumbnail_exists else utils.misc.search_song(
                album["entries"][0]["title"],
                album_infos[album_input][1],
                0).thumbnail_url,
            "colors": utils.misc.get_distinct_palette(io.BytesIO(
                urllib.request.urlopen(
                    album_infos[album_input][3]).read()))
            if thumbnail_exists else
            ([202, 158, 230], [35, 38, 52], [35, 38, 52])
        }
        utils.generics.add_album_endpoints(
            genre, album_infos[album_input][0], albums, app)
    except yt_dlp.utils.DownloadError:
        pass


def handle_song_input(genre, queues, song_infos, albums):
    song_input = flask.request.form["song-search"]
    validated_info = song_infos[song_input]
    if not validated_info:
        validated_info = (song_input,
                          flask.request.form["artist-search"])

    # noinspection PyInconsistentReturns
    for i in range(5):
        try:
            song = utils.misc.search_song(validated_info[0],
                                          validated_info[1],
                                          0)
            if song is None:
                return flask.render_template(
                    "genre.html",
                    genre=genre,
                    albums=albums[genre],
                    artists=[data["artist_name"] for _, data
                             in albums[genre].items()],
                    max=int(os.getenv("QUEUE_MAX")),
                    dev_mode=os.getenv("FLASK_ENV") == "development")

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
                "song_name": song_infos[song_input.lower()][0],
                "artist_name": song_infos[song_input.lower()][1],
                "url": url,
                "length": length,
                "timestamp": 0,
                "thumbnail": song.thumbnail_url,
                "colors": utils.misc.get_distinct_palette(io.BytesIO(
                    urllib.request.urlopen(
                        song.thumbnail_url).read()))
            })
            break
        except pytubefix.exceptions.BotDetection:
            pass
        except pytubefix.exceptions.VideoUnavailable:
            break
