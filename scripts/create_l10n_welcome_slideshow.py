import zipfile
import xml.etree.ElementTree as ET
from io import BytesIO
import re
import os
import sys
from glob import glob


def parse_po_file(po_file_path):
    """
    Parse a .po file with non-standard format and extract msgid/msgstr pairs
    Handles cases where msgstr is on next line or empty
    Returns dict: {msgid: msgstr}
    """
    translations = {}

    try:
        with open(po_file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        current_msgid = None
        current_msgstr = None
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # Skip comments and empty lines
            if not line or line.startswith("#"):
                i += 1
                continue

            # Parse msgid
            if line.startswith("msgid"):
                # Extract msgid value - handle quoted strings
                match = re.search(r'msgid\s+"(.+?)"', line)
                if match:
                    current_msgid = match.group(1)
                    # Unescape
                    current_msgid = current_msgid.replace("\\n", "\n").replace(
                        '\\"', '"'
                    )
                i += 1
                continue

            # Parse msgstr
            if line.startswith("msgstr"):
                match = re.search(r'msgstr\s+"(.+?)"', line)
                if match:
                    msgstr_value = match.group(1)
                    current_msgstr = msgstr_value.replace("\\n", "\n").replace(
                        '\\"', '"'
                    )
                else:
                    # msgstr is empty
                    current_msgstr = ""

                # Store translation if both msgid and msgstr exist and msgstr is not empty
                if current_msgid and current_msgstr:
                    translations["_" + current_msgid] = current_msgstr

                current_msgid = None
                current_msgstr = None
                i += 1
                continue

            i += 1

        print(
            f"  Found {len(translations)} translations in {os.path.basename(po_file_path)}"
        )
        return translations

    except Exception as e:
        print(f"  Error parsing {po_file_path}: {e}")
        import traceback

        traceback.print_exc()
        return {}


def extract_language_from_filename(filename):
    """
    Extract language code from filename like 'welcome-slideshow-de.po'
    Returns language code like 'de' or 'hu'
    """
    match = re.search(r"welcome-slideshow-(.+?)\.po$", filename)
    if match:
        lang_code = match.group(1)
        return lang_code
    return None


def create_l10n_content_from_po_files(
    po_directory, supported_locales, lang_to_locale_map=None
):
    """
    Read all PO files from directory and create l10n format content

    Args:
        po_directory: Directory containing welcome-slideshow-*.po files
        supported_locales: List of locale codes like ['en-US', 'fr-FR', 'de-DE']
        lang_to_locale_map: Dict mapping language codes to locales

    Returns:
        String in l10n format
    """

    if lang_to_locale_map is None:
        # Default mapping - expand as needed
        lang_to_locale_map = {
            "en": "en-US",
            "de": "de-DE",
            "fr": "fr-FR",
            "hu": "hu-HU",
            "es": "es-ES",
            "it": "it-IT",
            "pt": "pt-BR",
            "ru": "ru-RU",
            "ja": "ja-JP",
            "zh": "zh-CN",
            "nl": "nl-NL",
            "pl": "pl-PL",
            "tr": "tr-TR",
            "ko": "ko-KR",
        }

    # Find all PO files
    po_files = glob(os.path.join(po_directory, "welcome-slideshow-*.po"))

    if not po_files:
        print(f"✗ No PO files found in {po_directory}")
        return None

    print(f"Found {len(po_files)} PO files")

    # Parse all PO files
    locale_translations = {}

    for po_file in sorted(po_files):
        lang_code = extract_language_from_filename(os.path.basename(po_file))

        if not lang_code:
            print(
                f"  Skipping {os.path.basename(po_file)} - couldn't extract language code"
            )
            continue

        locale = lang_to_locale_map.get(lang_code, lang_code)

        if locale in supported_locales:
            print(f"Parsing {os.path.basename(po_file)} for locale {locale}")
            locale_translations[locale] = parse_po_file(po_file)
        else:
            print(
                f"  Skipping {os.path.basename(po_file)} - locale {locale} not in supported list"
            )

    if not locale_translations:
        print("No translations were loaded")
        return None

    # Collect all unique message IDs
    all_msgids = set()
    for translations in locale_translations.values():
        all_msgids.update(translations.keys())

    all_msgids = sorted(list(all_msgids))

    print(f"Found {len(all_msgids)} unique message IDs across all locales")

    # Build l10n content
    l10n_lines = [
        "# supported locales",
        ",".join(supported_locales),
        "",
        "# strings and their translations",
    ]

    for msgid in all_msgids:
        # Skip empty or very long message IDs
        if not msgid or len(msgid) > 500:
            continue

        l10n_lines.append("")
        l10n_lines.append(msgid)

        for locale in supported_locales:
            if locale in locale_translations and msgid in locale_translations[locale]:
                translation = locale_translations[locale][msgid]
                # Ensure no newlines in translation
                translation = translation.replace("\n", " ").replace("\t", " ")
                l10n_lines.append(f"{locale}\t{translation}")

    l10n_content = "\n".join(l10n_lines)
    print(
        f"Generated l10n content: {len(l10n_content)} bytes, {len(all_msgids)} entries"
    )

    return l10n_content


def add_l10n_to_odt(odt_path, l10n_content):
    """Add l10n stream to ODT/ODP file with proper manifest update"""

    if not os.path.exists(odt_path):
        print(f"File not found: {odt_path}")
        return False

    try:
        with zipfile.ZipFile(odt_path, "r") as zip_read:
            # Read current manifest
            try:
                manifest_data = zip_read.read("META-INF/manifest.xml")
            except KeyError:
                print("✗ manifest.xml not found in document")
                return False

            # Parse manifest XML
            ET.register_namespace(
                "manifest", "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
            )
            root = ET.fromstring(manifest_data)

            ns = {"manifest": "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"}

            # Remove existing l10n entry if present
            for entry in root.findall("manifest:file-entry", ns):
                if (
                    entry.get(
                        "{urn:oasis:names:tc:opendocument:xmlns:manifest:1.0}full-path"
                    )
                    == "l10n"
                ):
                    root.remove(entry)
                    print("Removed existing l10n entry from manifest")

            # Add new l10n entry
            new_entry = ET.Element(
                "{urn:oasis:names:tc:opendocument:xmlns:manifest:1.0}file-entry"
            )
            new_entry.set(
                "{urn:oasis:names:tc:opendocument:xmlns:manifest:1.0}full-path", "l10n"
            )
            new_entry.set(
                "{urn:oasis:names:tc:opendocument:xmlns:manifest:1.0}media-type",
                "text/plain",
            )
            root.append(new_entry)
            print("Added l10n entry to manifest")

            new_manifest = ET.tostring(root, encoding="utf-8")

            # Create new ZIP
            temp_data = BytesIO()
            with zipfile.ZipFile(temp_data, "w", zipfile.ZIP_DEFLATED) as zip_write:
                # Copy all existing files except l10n and manifest
                for item in zip_read.infolist():
                    if item.filename not in ["l10n", "META-INF/manifest.xml"]:
                        zip_write.writestr(item, zip_read.read(item.filename))

                # Write updated manifest
                zip_write.writestr("META-INF/manifest.xml", new_manifest)

                # Write l10n stream
                zip_write.writestr("l10n", l10n_content)
                print(f"Added l10n stream: {len(l10n_content)} bytes")

        # Replace original file with updated one
        with open(odt_path, "wb") as f:
            f.write(temp_data.getvalue())

        print(f"Successfully updated {odt_path}")
        return True

    except Exception as e:
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def detect_available_locales(po_directory, lang_to_locale_map):
    """
    Detect available locales from PO files in directory

    Args:
        po_directory: Directory containing welcome-slideshow-*.po files
        lang_to_locale_map: Dict mapping language codes to locales

    Returns:
        List of available locale codes
    """
    po_files = glob(os.path.join(po_directory, "welcome-slideshow-*.po"))

    if not po_files:
        print(f"No PO files found in {po_directory}")
        return []

    available_locales = []

    for po_file in sorted(po_files):
        lang_code = extract_language_from_filename(os.path.basename(po_file))

        if lang_code:
            locale = lang_to_locale_map.get(lang_code, lang_code)
            available_locales.append(locale)
            print(f"  Detected: {os.path.basename(po_file)} → {locale}")

    return sorted(available_locales)


if __name__ == "__main__":
    # Configuration - CHANGE THESE TO YOUR PATHS
    po_directory = sys.argv[1] if len(sys.argv) > 1 else "browser/po/"

    odf_file = (
        sys.argv[2] if len(sys.argv) > 2 else "browser/welcome/welcome-slideshow.odp"
    )

    # Optional: Define custom language-to-locale mapping
    lang_to_locale_map = {
        "en": "en-US",
        "de": "de-DE",
        "hu": "hu-HU",
        "fr": "fr-FR",
        "es": "es-ES",
        "it": "it-IT",
        "pt": "pt-BR",
        "ru": "ru-RU",
        "ja": "ja-JP",
        "zh": "zh-CN",
    }

    # Auto-detect available locales from PO files
    print("Detecting available locales from PO files...")
    supported_locales = detect_available_locales(po_directory, lang_to_locale_map)

    print("=" * 60)
    print("L10n Content Generator from PO Files")
    print("=" * 60)
    print(f"PO Directory: {po_directory}")
    print(f"Supported Locales: {supported_locales}")
    print("=" * 60)
    print()

    l10n_content = create_l10n_content_from_po_files(
        po_directory, supported_locales, lang_to_locale_map
    )

    print(l10n_content)

    print()

    if l10n_content:
        # Add to ODT file
        print(f"Adding l10n to: {odf_file}")
        print()
        add_l10n_to_odt(odf_file, l10n_content)
    else:
        print("Failed to create l10n content")

    print()
    print("=" * 60)
    print("Done!")
    print("=" * 60)
