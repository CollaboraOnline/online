#!/usr/bin/env python

#
# Usage:
# ./tools/add-release.py 25.04.7.8.1 com.collaboraoffice.Office.metainfo.xml
#

import argparse
from datetime import datetime
import sys
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(
                    prog='Add Release',
                    description='Add a release to the appstream file')
parser.add_argument('version', help='Version string to use.')
parser.add_argument('appstream', help='Appstream file to modify.')
parser.add_argument('-d', '--date', help='Date of the release. If missing, now is used.')
parser.add_argument('-c', '--changelog', help='XML file containing the markup for the changelog.')

args = parser.parse_args()

tree = ET.parse(args.appstream)
root = tree.getroot()

releases = root.find('./releases');

if args.date:
    date = args.date
else:
    date = datetime.now().strftime('%Y-%m-%d')

release = ET.Element('release', attrib={
    'version': args.version,
    'date': date,
})
releases.insert(0, release)
if args.changelog:
    changelog = ET.parse(args.changelog)
    release.append(changelog.getroot())

ET.indent(tree, ' ', level=0)
tree.write(args.appstream, xml_declaration=True, encoding='unicode')
