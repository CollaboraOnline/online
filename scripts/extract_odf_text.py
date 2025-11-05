#!/usr/bin/env python3
"""
Extract all text starting with "_" from an ODF file and generate a .po file.
"""

import zipfile
import xml.etree.ElementTree as ET
from typing import List
from datetime import datetime


def extract_underscore_text(odf_file_path: str) -> List[str]:
    """
    Extract all text starting with '_' from an ODF file.

    Args:
        odf_file_path: Path to the ODF file

    Returns:
        List of text strings that start with '_'
    """
    texts = []

    try:
        with zipfile.ZipFile(odf_file_path, "r") as zip_ref:
            if "content.xml" not in zip_ref.namelist():
                print("Error: content.xml not found in ODF file")
                return texts

            content_xml = zip_ref.read("content.xml")
            root = ET.fromstring(content_xml)

            namespaces = {
                "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
            }

            # Find all text:span elements
            for span in root.findall(".//text:span", namespaces):
                if span.text and span.text.startswith("_") and span.text not in texts:
                    texts.append(span.text)

            # Also check text:p (paragraphs) and text:h (headings)
            for element in root.findall(".//text:p", namespaces):
                if element.text and element.text.startswith("_") and element.text not in texts:
                    texts.append(element.text)

            for element in root.findall(".//text:h", namespaces):
                if element.text and element.text.startswith("_") and element.text not in texts:
                    texts.append(element.text)

    except FileNotFoundError:
        print(f"Error: File '{odf_file_path}' not found")
    except zipfile.BadZipFile:
        print(f"Error: '{odf_file_path}' is not a valid ZIP/ODF file")
    except ET.ParseError as e:
        print(f"Error parsing XML: {e}")

    return texts


def create_po_file(
    texts: List[str],
    output_file: str,
    source_location: str,
    project_name: str = "PACKAGE VERSION",
) -> None:
    """
    Create a .po file matching the project format.

    Args:
        texts: List of text strings to translate
        output_file: Path to output .po file
        source_location: Source location string
        project_name: Project name for the POT file header
    """
    po_content = []

    now = datetime.now()
    pot_creation_date = now.strftime("%Y-%m-%d %H:%M+0000")

    header = f"""# SOME DESCRIPTIVE TITLE.
# Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER
# This file is distributed under the same license as the PACKAGE package.
# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.
#
msgid ""
msgstr ""
"Project-Id-Version: {project_name}\\n"
"Report-Msgid-Bugs-To: \\n"
"POT-Creation-Date: {pot_creation_date}\\n"
"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n"
"Language-Team: LANGUAGE <LL@li.org>\\n"
"Language: \\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"

"""
    po_content.append(header)

    # Add extracted texts as translation entries
    for i, text in enumerate(texts, 1):
        # Remove leading underscore for msgid
        msgid_text = text.lstrip("_")

        location = f"{source_location}:{i}"

        entry = f"""#: {location}
msgid "{msgid_text}"
msgstr ""

"""
        po_content.append(entry)

    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.writelines(po_content)
        print(f"POT file created: {output_file}")
        print(f"Total entries: {len(texts)}")
    except IOError as e:
        print(f"Error writing POT file: {e}")


if __name__ == "__main__":
    import sys

    odp_path = (
        sys.argv[1] if len(sys.argv) > 1 else "browser/welcome/welcome-slideshow.odp"
    )
    po_path = (
        sys.argv[2]
        if len(sys.argv) > 2
        else "browser/po/templates/welcome-slideshow.pot"
    )
    source_loc = (
        sys.argv[3] if len(sys.argv) > 3 else "browser/welcome/welcome-slideshow.odp"
    )

    print(f"Extracting text starting with '_' from: {odp_path}\n")
    texts = extract_underscore_text(odp_path)

    if texts:
        print(f"Found {len(texts)} text(s) starting with '_':")
        for i, text in enumerate(texts, 1):
            print(f"  {i}. {text}")

        print("\nCreating POT file...")
        create_po_file(texts, po_path, source_loc)
    else:
        print("No text starting with '_' found.")
