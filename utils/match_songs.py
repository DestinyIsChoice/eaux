import difflib
import re


def clean_title(text):
    if text is not None:
        text = text.lower()
        text = text.replace("″", "\"").replace("‐", "-")
        text = re.sub(r"\[official audio]|\[audio]"
                      r"|\(official audio\)", "", text)
        return text.strip()
    else:
        return ""


def get_matches(album_tracklist, album, songs_info):
    matches = {song: None for song in album_tracklist}
    used_videos = set()
    for song in album_tracklist:
        song_clean = clean_title(song)
        best_video_info = None
        best_video_id = None
        best_score = 0
        for youtube_video in album["entries"]:
            video_id = (youtube_video.get("id")
                        or youtube_video["title"])
            if video_id in used_videos:
                continue
            video_title_clean = clean_title(
                youtube_video["title"])
            if (song_clean in video_title_clean
                    or video_title_clean in song_clean):
                score = 1.0 + (len(song_clean) / 1000.0)
            else:
                score = (difflib.SequenceMatcher(
                    None, song_clean, video_title_clean)
                         .ratio())
            if score > best_score:
                best_score = score
                best_video_id = video_id
                for item in songs_info:
                    if item[0] == youtube_video:
                        best_video_info = item[1:]
                        break
        if best_score >= 0.4 and best_video_info:
            matches[song] = best_video_info
            used_videos.add(best_video_id)
    return matches
