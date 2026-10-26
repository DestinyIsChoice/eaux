import os

import flask
import yt_dlp

import utils


def generic_album(genre, album, albums):
    is_dev = os.getenv("FLASK_ENV") == "development"
    if flask.request.method == "POST":
        if album in albums[genre]:
            return flask.render_template(
                "album.html",
                album=album,
                artist=albums[genre]
                [album]["artist_name"],
                genre=genre,
                songs=[song_name for song_name, song_url, youtube_url
                       in albums[genre][album]["songs"]],
                dev_mode=is_dev)
        else:
            return flask.render_template("404.html"), 404
    else:
        return flask.render_template("force-post.html", dev_mode=is_dev)


def generic_album_regenerate(genre, album, albums):

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


def generic_genre(genre, queues, song_infos, albums, album_infos, app):
    is_dev = os.getenv("FLASK_ENV") == "development"
    if flask.request.method == "POST":
        if flask.request.form["initial-load"] != "true":
            if "song-search" in flask.request.form:
                utils.handle_inputs.handle_song_input(
                    genre, queues, song_infos, albums)
            else:
                utils.handle_inputs.handle_album_input(
                    genre, album_infos, albums, app)
        return flask.render_template("genre.html",
                                     genre=genre,
                                     albums=albums[genre],
                                     artists=[data["artist_name"] for _, data
                                              in albums[genre].items()],
                                     max=int(os.getenv("QUEUE_MAX")),
                                     dev_mode=is_dev)
    else:
        return flask.render_template("force-post.html", dev_mode=is_dev)


def generic_genre_albums(genre, albums):
    if albums[genre]:
        return flask.jsonify({"albums": albums[genre]})
    else:
        return flask.jsonify({"albums": []})


def generic_genre_queue(genre, queues):
    if queues[genre]:
        return flask.jsonify({"queue": queues[genre]})
    else:
        return flask.jsonify({"queue": []})


def add_album_endpoints(genre, album, albums, app):
    album_endpoint_name = f"{genre}_{album}"
    app._got_first_request = False
    app.add_url_rule(
        f"/{genre}/{album}",
        endpoint=album_endpoint_name,
        defaults={"genre": genre,
                  "album": album,
                  "albums": albums},
        methods=["GET", "POST"]
    )
    app.view_functions[album_endpoint_name] = utils.generics.generic_album

    regenerate_endpoint_name = f"{genre}_{album}_regenerate"
    app.add_url_rule(
        f"/{genre}/{album}/regenerate",
        endpoint=regenerate_endpoint_name,
        defaults={"genre": genre,
                  "album": album,
                  "albums": albums},
        methods=["POST"]
    )
    app.view_functions[regenerate_endpoint_name] = (utils.generics
                                                    .generic_album_regenerate)
    app._got_first_request = True


def generate_genres(genres_list, queues, song_infos, albums, album_infos, app):
    for genre in genres_list:
        albums[genre] = {}
        queues[genre] = []
        app.add_url_rule(
            f"/{genre}",
            view_func=utils.generics.generic_genre,
            defaults={"genre": genre,
                      "queues": queues,
                      "song_infos": song_infos,
                      "albums": albums,
                      "album_infos": album_infos,
                      "app": app},
            methods=["GET", "POST"]
        )
        app.add_url_rule(
            f"/{genre}/albums",
            view_func=utils.generics.generic_genre_albums,
            defaults={"genre": genre,
                      "albums": albums},
            methods=["GET"]
        )
        app.add_url_rule(
            f"/{genre}/queue",
            view_func=utils.generics.generic_genre_queue,
            defaults={"genre": genre,
                      "queues": queues},
            methods=["GET"]
        )
