import itertools
import json
import math

import colorthief
import pytubefix


def get_distinct_palette(image_path):
    colors = None
    max_distance = -1
    for combination in itertools.combinations(
            colorthief.ColorThief(image_path).get_palette(
                color_count=10, quality=1), 3):
        combination_min_distance = min(
            math.sqrt(sum((c1 - c2) ** 2 for c1, c2
                          in zip(combination[0], combination[1]))),
            math.sqrt(sum((c1 - c2) ** 2 for c1, c2
                          in zip(combination[1], combination[2]))),
            math.sqrt(sum((c1 - c2) ** 2 for c1, c2
                          in zip(combination[0], combination[2]))))
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
    try:
        return song_search.results[result_index]
    except IndexError:
        try:
            return song_search.results[0]
        except IndexError:
            return None


def get_vite_asset(entry_name):
    try:
        with open("static/dist/.vite/manifest.json", "r") as f:
            manifest = json.load(f)
            return manifest.get(entry_name, {}).get("file", entry_name)
    except (FileNotFoundError, json.JSONDecodeError):
        return entry_name
