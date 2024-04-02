import os
import configparser
import sys
import glob
import subprocess
import shutil
import json
import hashlib

SETTINGS_FILE = "settings.ini"
DEPBO_PROCESS = "ExtractPboDos.exe"

BROKEN_MISSIONS_DIR = "fix_needed"

OVERVIEW_IMAGE_DIR = "imgs"
OVERVIEW_IMAGE = "overview.jpg"
DEFAULT_OVERVIEW_IMAGE = 'emptyoverview.jpg'

FIX_NEEDED_TAG = 'FIX NEEDED'

RAW_FILE_EXTENSION = "pbo"
CACHED_FILE_EXTENSION = "json"
IMAGE_FILE_EXTENSION = "jpg"

OUTPUT_LIST_FILE = "MissionsInfo.js"


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
    """Lists all filenames in given dir and subdir with given extension"""
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

    print('  CACHED MISSIONS:')
    cached_files = list_filenames_in_dir(cache_dir, CACHED_FILE_EXTENSION)
    cached_broken_files = list_filenames_in_dir(
        cache_dir, CACHED_FILE_EXTENSION, BROKEN_MISSIONS_DIR
    )
    print('  SOURCE MISSIONS:')
    source_files = list_filenames_in_dir(src_dir, RAW_FILE_EXTENSION)
    print('  SOURCE BROKEN MISSIONS:')
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
                invalidate_cached_file(src_broken_file)

    return new_files, new_broken_files


def invalidate_cached_file(filename):
    """Looks for given file, reads it's content then deletes file and related overview picture from cache"""
    print(f"INVALIDATING CACHE FOR FILE {filename}")
    # TODO
    pass


def parse_new_missions(src_dir, cache_dir, default_content_dir,
                       filenames, broken=False):
    """Unpacks mission, copy overview image to cache/images,
    read mission data into JSON file and save it in cache directory"""

    def unpack_mission(src_dir, cache_dir):
        raw_mission_file = os.path.join(src_dir, f"{f}.{RAW_FILE_EXTENSION}")
        subprocess.run([
            DEPBO_PROCESS, "-P",
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
            f"{filename}.{OVERVIEW_IMAGE.rsplit('.', maxsplit=1)[-1]}"
        )
        shutil.copyfile(os.path.join(from_dir, OVERVIEW_IMAGE), image_file)
        return image_file

    def read_mission_data(mission_dir, overview_image_path, add_fix_needed_tag):
        """Reads mission data"""
        mission_filename = os.path.basename(mission_dir)
        overview_image_filename = os.path.basename(overview_image_path)
        mission_data = {
            "id": hashlib.md5(mission_filename.encode('utf-8')).hexdigest(),
            "filename": mission_filename,
            "title": "",
            "player_count": 0,
            "terrain": mission_filename.rsplit('.', maxsplit=1)[-1],
            "tags": [],
            "overview": "",
            "overview_img": f"{OVERVIEW_IMAGE_DIR}/{overview_image_filename}",
            "briefing": "",
            "map_shot": ""
        }

        if add_fix_needed_tag:
            mission_data['tags'].append(FIX_NEEDED_TAG)

        # TODO : Read stuff

        return mission_data

    def cache_mission_data(mission_data, cache_dir, broken):
        """Creates cache file with mission data"""
        print("(cache_mission_data) Invoked")
        print(mission_data)
        print(cache_dir)
        base_filename = f"{mission_data['filename']}.{CACHED_FILE_EXTENSION}"
        output_file = os.path.join(cache_dir, base_filename)

        print(output_file)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json.dumps(mission_data, indent=4))

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
        unpacked_dir = unpack_mission(src_dir, cache_dir)
        overview_image_name = copy_overview_picture(unpacked_dir, cache_dir, f)

        print(overview_image_name)

        mission_data = read_mission_data(unpacked_dir, overview_image_name, broken)
        cache_mission_data(mission_data, cache_dir, broken)

        # Delete folder
        print(f"Going to delete directory {unpacked_dir}")
        # shutil.rmtree(unpacked_dir)

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
        with open(filename, 'r') as cached_file:
            file_content = json.load(cached_file)
            totals.append(file_content)

    # Delete output dir content
    img_dir = os.path.join(output_dir, OVERVIEW_IMAGE_DIR)
    if os.path.exists(img_dir):
        shutil.rmtree(img_dir)

    # Compose and write data to single file
    with open(output_filename, 'w') as f:
        f.write('var MissionInfo = ')
        f.write(json.dumps(totals, indent=4))

    # Copy overview images
    shutil.copytree(
        os.path.join(cache_dir, OVERVIEW_IMAGE_DIR),
        os.path.join(output_dir, OVERVIEW_IMAGE_DIR)
    )
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

    if not check_dirs_exists(src_dir, cache_dir, output_dir, default_content_dir):
        return 2

    # Look for new missions and parse 'em
    new_missions, new_broken_missions = get_new_missions(cache_dir, src_dir)
    parse_new_missions(
        src_dir, cache_dir, default_content_dir,
        new_missions
    )
    parse_new_missions(
        src_dir, cache_dir, default_content_dir,
        new_broken_missions, broken=True
    )

    # Compose cached files into a new one
    compose_mission_list(cache_dir, output_dir, default_content_dir)


if __name__ == "__main__":
    sys.exit(main())
