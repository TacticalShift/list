import os
import configparser
import sys
import glob
import subprocess
import shutil
import json
import re
import hashlib

SETTINGS_FILE = "settings.ini"

BROKEN_MISSIONS_DIR = "fix_needed"

OVERVIEW_IMAGE_DIR = "imgs"
OVERVIEW_IMAGE = "overview.jpg"
DEFAULT_OVERVIEW_IMAGE = 'default_overview.jpg'

FIX_NEEDED_TAG = 'FIX NEEDED'

RAW_FILE_EXTENSION = "pbo"
CACHED_FILE_EXTENSION = "json"
IMAGE_FILE_EXTENSION = "jpg"

OUTPUT_LIST_FILE = "MissionsInfo.js"
OUTPUT_FILE_HEADER = "var MissionInfo = "

PLAYER_COUNT_MISSION_NAME_REGEX = re.compile(r'^([a-zA-Z]+)(\d+)')
MISSION_FILE = "mission.sqm"
MISSION_FILE_DATA = {
    "section": 'class ScenarioData'.lower(),
    "title": 'briefingName='.lower(),
    "overview": 'overviewText='.lower(),
    "author": 'author='.lower(),
    "max_players": 'maxPlayers='.lower(),
    "year": 'year='.lower(),
    "month": 'month='.lower(),
    "day": 'day='.lower()
}

BRIEFING_FILE = ("dzn_tSFramework", "Modules", "Briefing", "tSF_briefing.sqf")
BRIEFING_FILE_DATA = {
    "tags": 'TAGS',
    "topic_start": "TOPIC",
    "topic_end": "END"
}
BRIEFING_FILE_EXCLUDE_TOPICS = ('VII. Замечания для GSO:',)



def read_settings():
    """Reads settings file and return dict of values"""
    if not os.path.exists(SETTINGS_FILE):
        print("Failed to find Settings file ('settings.ini')!")
        return None

    settings = configparser.ConfigParser()
    settings.read(SETTINGS_FILE, encoding='utf-8')

    return settings


def check_dirs_exists(src_dir, cache_dir, output_dir, defaults_dir):
    """Checks working directories to exists"""
    result = True
    if not os.path.exists(src_dir) or not os.path.isdir(src_dir):
        result = False
        print('Source directory %s not found!', src_dir)
    if not os.path.exists(cache_dir) or not os.path.isdir(cache_dir):
        result = False
        print('Cache directory %s not found!', cache_dir)
    if not os.path.exists(output_dir) or not os.path.isdir(output_dir):
        result = False
        print('Output directory %s not found!', output_dir)
    if not os.path.exists(defaults_dir) or not os.path.isdir(defaults_dir):
        result = False
        print('Default content directory %s not found!', defaults_dir)


    return result


def list_filenames_in_dir(directory, extension, subdir=''):
    """Lists all filenames of given extension in given dir and subdir"""
    mask = (f"{directory}{os.sep}*.{extension}"
            if subdir == '' else
            f"{directory}{os.sep}{subdir}{os.sep}*.{extension}")

    files = []
    offset = -1 * (1 + len(extension))
    for f in glob.glob(mask):
        files.append(os.path.basename(f)[:offset])

    return files


def get_new_missions(cache_dir, src_dir):
    """Analyzes content of the source and cached dirs, finds filenames that
    are present in Source dir and not in cached dir.
    Also marks files that in Source/fix_needed dir but are in Cached
    as newly broken!"""

    def invalidate_cached_file(cache_dir, filename):
        """Deletes file and related image from cache"""
        print(f"INVALIDATING CACHE FOR FILE {filename}")
        img_filename = os.path.join(cache_dir, OVERVIEW_IMAGE_DIR, filename, IMAGE_FILE_EXTENSION)
        if os.path.exists(img_filename):
            os.remove(img_filename)

        filename = os.path.join(cache_dir, filename, CACHED_FILE_EXTENSION)
        os.remove(filename)


    cached_files = list_filenames_in_dir(cache_dir, CACHED_FILE_EXTENSION)
    cached_broken_files = list_filenames_in_dir(
        cache_dir, CACHED_FILE_EXTENSION, BROKEN_MISSIONS_DIR
    )

    source_files = list_filenames_in_dir(src_dir, RAW_FILE_EXTENSION)
    source_broken_files = list_filenames_in_dir(
        src_dir, RAW_FILE_EXTENSION, BROKEN_MISSIONS_DIR
    )

    new_files = []
    new_broken_files = []

    for src_file in source_files:
        if src_file not in cached_files:
            new_files.append(src_file)
            print(f'New mission! {src_file}')

    for src_broken_file in source_broken_files:
        if src_broken_file not in cached_broken_files:
            new_broken_files.append(src_broken_file)
            print(f'New broken mission! {src_broken_file}')

            if src_broken_file in cached_files:
                invalidate_cached_file(cache_dir, src_broken_file)

    return new_files, new_broken_files


def parse_new_missions(src_dir, cache_dir,
                       filenames, unpbo_app, broken=False):
    """Unpacks mission, copy overview image to cache/images,
    read mission data into JSON file and save it in cache directory"""

    def unpack_mission(src_dir, cache_dir, unpbo_app):
        raw_mission_file = os.path.join(src_dir, f"{f}.{RAW_FILE_EXTENSION}")
        subprocess.run([
            unpbo_app[0], unpbo_app[1], unpbo_app[2],
            raw_mission_file,
            cache_dir
        ], check=False)

        return os.path.join(cache_dir, f)

    def copy_overview_picture(from_dir, to_dir, filename):
        to_dir = os.path.join(to_dir, OVERVIEW_IMAGE_DIR)
        if not os.path.exists(to_dir):
            os.mkdir(to_dir)

        image_file = os.path.join(
            to_dir,
            f"{filename}.{IMAGE_FILE_EXTENSION}"
        )

        target_img = os.path.join(from_dir, OVERVIEW_IMAGE)
        if not os.path.exists(target_img):
            return os.path.join(to_dir, DEFAULT_OVERVIEW_IMAGE)

        shutil.copyfile(target_img, image_file)
        return image_file

    def read_mission_data(mission_dir, overview_image_path, add_fix_needed_tag):
        """Reads mission data"""
        mission_filename = os.path.basename(mission_dir)
        player_count_regex = PLAYER_COUNT_MISSION_NAME_REGEX.search(mission_filename)

        player_count = 0
        if player_count_regex:
            player_count = int(player_count_regex.group(2))

        overview_image_filename = os.path.basename(overview_image_path)
        mission_data = {
            "id": hashlib.md5(mission_filename.encode('utf-8')).hexdigest(),
            "filename": mission_filename,
            "title": "",
            "author": "Unknown",
            "player_count": player_count,
            "terrain": mission_filename.rsplit('.', maxsplit=1)[-1],
            "tags": [],
            "overview": "",
            "overview_img": f"{OVERVIEW_IMAGE_DIR}/{overview_image_filename}",
            "briefing": "",
            "map_shot": "",
            "mission_date": "Unknown"
        }

        if add_fix_needed_tag:
            mission_data['tags'].append(FIX_NEEDED_TAG)

        # Read mission info
        parse_mission_sqm(
            os.path.join(mission_dir, MISSION_FILE),
            mission_data
        )

        parse_briefing_file(
            os.path.join(mission_dir, *BRIEFING_FILE),
            mission_data
        )

        return mission_data

    def parse_mission_sqm(path_to_missionsqm, mission_data):
        """Parses mission.sqm file and gather data from it"""
        # player_count_max_players = 0
        player_count_mission_name = 0
        year = ''
        month = ''
        day = ''
        with open(path_to_missionsqm, 'r', encoding='utf-8') as sqm:
            scenario_data_found = False
            for line in sqm.readlines():
                line_to_test = line.strip().lower()
                if not scenario_data_found:
                    scenario_data_found = line_to_test == MISSION_FILE_DATA['section']
                    continue

                if "=" not in line:
                    continue

                line_value = line.rsplit("=", maxsplit=1)[1].strip().strip(';"')
                if line_to_test.startswith(MISSION_FILE_DATA['title']):
                    mission_data['title'] = line_value
                    mission_name_regex = PLAYER_COUNT_MISSION_NAME_REGEX.search(line_value)
                    if mission_name_regex:
                        player_count_mission_name = int(mission_name_regex.group(2))
                    continue

                if line_to_test.startswith(MISSION_FILE_DATA['author']):
                    mission_data['author'] = line_value
                    continue

                if line_to_test.startswith(MISSION_FILE_DATA['overview']):
                    mission_data['overview'] = line_value
                    continue

                # if line_to_test.startswith(MISSION_FILE_DATA['max_players']):
                #    player_count_max_players = int(line_value)
                #    continue

                if line_to_test.startswith(MISSION_FILE_DATA['year']):
                    year = line_value
                    continue

                if line_to_test.startswith(MISSION_FILE_DATA['month']):
                    month = line_value
                    continue

                if line_to_test.startswith(MISSION_FILE_DATA['day']):
                    day = line_value
                    continue

        if year:
            if not month or not day:
                mission_data['mission_date'] = f'{year}'
            else:
                if len(month) == 1:
                    month = f'0{month}'
                if len(day) == 1:
                    day = f'0{day}'
                mission_data['mission_date'] = f'{year}-{month}-{day}'

        # If number of players from mission name is in valid range and
        # greater than maxPlayers - use it
        player_count_filename = mission_data['player_count']
        if (player_count_mission_name != player_count_filename and
                0 < player_count_mission_name < 100):
            mission_data['player_count'] = player_count_mission_name

        return

    def parse_briefing_file(path_to_briefing, mission_data):
        briefing_lines = []
        if not os.path.exists(path_to_briefing):
            mission_data['briefing'] = '<no data>'
            return

        with open(path_to_briefing, 'r', encoding='utf-8') as briefing:
            topic_started = False
            for line in briefing.readlines():
                if line.startswith(BRIEFING_FILE_DATA['tags']):
                    tags = line[len(BRIEFING_FILE_DATA['tags']):].strip(";()[]\n").split(",")
                    for tag in tags:
                        mission_data['tags'].append(tag.strip('"'))
                    continue

                if line.startswith(BRIEFING_FILE_DATA['topic_start']):
                    topic_name = line[len(BRIEFING_FILE_DATA['topic_start']):].strip('(")\n')
                    if topic_name in BRIEFING_FILE_EXCLUDE_TOPICS:
                        continue

                    topic_started = True
                    briefing_lines.append(f'<br/><br/>{topic_name}<br/>')
                    continue

                if line.startswith(BRIEFING_FILE_DATA['topic_end']):
                    topic_started = False
                    continue

                if topic_started:
                    line = line.strip().replace('""', "'").strip('"')
                    briefing_lines.append(line)

        if not briefing_lines:
            return
        mission_data['briefing'] = ''.join(briefing_lines)

    def cache_mission_data(mission_data, cache_dir, broken):
        """Creates cache file with mission data"""
        base_filename = f"{mission_data['filename']}.{CACHED_FILE_EXTENSION}"
        output_file = os.path.join(cache_dir, base_filename)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json.dumps(mission_data, indent=4, ensure_ascii=False))

        # For broken mission - make an empty flag file to mark broken missions
        if broken:
            flag_file_dir = os.path.join(cache_dir, BROKEN_MISSIONS_DIR)
            output_file = os.path.join(flag_file_dir, base_filename)
            if not os.path.exists(flag_file_dir):
                os.mkdir(flag_file_dir)
            open(output_file, 'a').close()

        return None

    src_dir = os.path.join(src_dir, BROKEN_MISSIONS_DIR if broken else '')
    cache_dir = os.path.join(cache_dir)

    for f in filenames:
        unpacked_dir = unpack_mission(src_dir, cache_dir, unpbo_app)
        overview_image_name = copy_overview_picture(unpacked_dir, cache_dir, f)

        mission_data = read_mission_data(unpacked_dir, overview_image_name, broken)
        cache_mission_data(mission_data, cache_dir, broken)

        # Delete folder
        print(f"Going to delete directory {unpacked_dir}")
        shutil.rmtree(unpacked_dir)


def compose_mission_list(cache_dir, output_dir, default_content_dir):
    """Reads all files in cache dir and collect data into one structure.
    Then exports data to single file."""
    cached_files = list_filenames_in_dir(cache_dir, CACHED_FILE_EXTENSION)
    output_filename = os.path.join(output_dir, OUTPUT_LIST_FILE)
    totals = []

    if not cached_files:
        return

    # Read cached data
    print("Read and compose")
    print(cached_files)
    for filename in cached_files:
        print("Reading file:")
        print(filename)
        filename = os.path.join(cache_dir, f'{filename}.{CACHED_FILE_EXTENSION}')
        with open(filename, 'r', encoding='utf-8') as cached_file:
            file_content = json.load(cached_file)
            totals.append(file_content)

    # Delete output dir content
    img_dir = os.path.join(output_dir, OVERVIEW_IMAGE_DIR)
    if os.path.exists(img_dir):
        shutil.rmtree(img_dir)

    # Compose and write data to single file
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(OUTPUT_FILE_HEADER)
        f.write(json.dumps(totals, indent=4, ensure_ascii=False))

    # Copy overview images
    shutil.copytree(
        os.path.join(cache_dir, OVERVIEW_IMAGE_DIR),
        os.path.join(output_dir, OVERVIEW_IMAGE_DIR)
    )
    # Copy default image to use for missions w/o overview image
    shutil.copy(
        os.path.join(default_content_dir, DEFAULT_OVERVIEW_IMAGE),
        os.path.join(img_dir, DEFAULT_OVERVIEW_IMAGE)
    )


def main():
    settings = read_settings()
    if settings is None:
        return 2

    cache_dir = settings['General']['cache_dir']
    src_dir = settings['General']['source_dir']
    output_dir = settings['General']['output_dir']
    default_content_dir = settings['General']['default_content_dir']
    unpbo_app = (
        settings['UnpboApp']['unpbo'],
        settings['UnpboApp'].get('unpbo_args1', ''),
        settings['UnpboApp'].get('unpbo_args2', ''),
        settings['UnpboApp'].get('unpbo_args3', '')
     )

    if not check_dirs_exists(
        src_dir, cache_dir, output_dir, default_content_dir
    ):
        return 2

    # Look for new missions and parse 'em
    new_missions, new_broken_missions = get_new_missions(cache_dir, src_dir)
    parse_new_missions(
        src_dir, cache_dir,
        new_missions, unpbo_app
    )
    parse_new_missions(
        src_dir, cache_dir,
        new_broken_missions, unpbo_app, broken=True
    )

    # Compose cached files into a new one
    compose_mission_list(cache_dir, output_dir, default_content_dir)


if __name__ == "__main__":
    sys.exit(main())
