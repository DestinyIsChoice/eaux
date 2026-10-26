import flask
import musicbrainzngs

import utils


def get_album(album_name, artist_name):
    try:
        release = musicbrainzngs.search_releases(
            query=f"artist:\"{artist_name}\" "
                  f"AND release:\"{album_name}\"",
            limit=5)["release-list"][0]
        return (release.get("title", "unknown"),
                ", ".join([credit.get("artist", {}).get("name", artist_name)
                           for credit in release.get("artist-credit", [{}])]),
                release["id"],
                f"https://coverartarchive.org/release/{release["id"]}/front")
    except (musicbrainzngs.MusicBrainzError, IndexError):
        return None


def get_album_tracklist(release_id):
    try:
        tracklist = []
        for track in musicbrainzngs.get_release_by_id(
            release_id, includes=["recordings", "artist-credits"]
        ).get("release", {})["medium-list"][0].get("track-list", []):
            title = track.get("recording", {}).get("title", "unknown")
            artist_credit = track.get("artist-credit", [])
            if len(artist_credit) > 1:

                # noinspection PyUnresolvedReferences
                feat_string = ", ".join(
                    [credit.get("artist", {}).get("name", "")
                     for credit in artist_credit[1:]
                     if not isinstance(credit, str)]).strip()
                if feat_string:
                    title = f"{title} ft. {feat_string}"
            tracklist.append(title)
        return tracklist
    except musicbrainzngs.MusicBrainzError:
        return None


def get_song(song_name, artist_name):
    try:
        result = musicbrainzngs.search_recordings(
            query=f"artist:\"{artist_name}\" AND recording:\"{song_name}\"",
            limit=5)
        return (result["recording-list"][0].get("title", "unknown"),
                " ".join([artist if isinstance(artist, str)
                          else artist["name"] for artist in
                          result["recording-list"][0]["artist-credit"]]))
    except (musicbrainzngs.MusicBrainzError, IndexError):
        return None


def validate_album(album_infos):
    album_infos[flask.request.json["album"]] = utils.musicbrainz.get_album(
        flask.request.json["album"], flask.request.json["artist"])
    return flask.jsonify(
        {"album": album_infos[flask.request.json["album"]]})


def validate_song(song_infos):
    song_infos[flask.request.json["song"]] = utils.musicbrainz.get_song(
        flask.request.json["song"], flask.request.json["artist"])
    return flask.jsonify(
        {"song": song_infos[flask.request.json["song"]]})
