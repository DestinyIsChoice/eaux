import asyncio
import os

import flask
import yt_dlp

import utils


async def extract_song_info(album_song, album_input, genre, album_infos, albums):
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
                youtube_song = utils.misc.search_song(
                    album_song["title"],
                    album_infos[album_input][1],
                    search_index)
                if youtube_song is None:
                    return flask.render_template(
                        "genre.html",
                        genre=genre,
                        albums=albums[genre],
                        artists=[data["artist_name"]
                                 for _, data in
                                 albums[genre].items()],
                        max=int(os.getenv("QUEUE_MAX")),
                        dev_mode=os.getenv("FLASK_ENV") == "development")
                song_url = youtube_song.watch_url
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
    return album_song, streaming_url, song_url


async def gather_song_info(album, album_input, genre, album_infos, albums):
    return await asyncio.gather(
        *[extract_song_info(album_song, album_input, genre, album_infos, albums)
          for album_song in album["entries"]])
