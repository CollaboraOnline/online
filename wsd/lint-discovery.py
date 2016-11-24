#!/usr/bin/env python
#
# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.
#
# Makes sure that discovery.xml in online.git is in sync with
# filter/source/config/fragments/ in core.git.

from __future__ import print_function
import os
import sys
import xml.sax


# Parses an online.git discovery.xml.
class DiscoveryHandler(xml.sax.handler.ContentHandler):
    def __init__(self):
        # List of app <-> action types.
        self.appActions = []
        self.inApp = False
        self.app = None
        self.inAction = False
        self.action = None

    def startElement(self, name, attrs):
        if name == "app":
            self.inApp = True
            for k, v in list(attrs.items()):
                if k == "name":
                    self.app = v
        elif name == "action":
            self.inAction = True
            for k, v in list(attrs.items()):
                if k == "name":
                    self.action = v

    def endElement(self, name):
        if name == "app":
            self.inApp = False
            if self.app and self.action:
                self.appActions.append([self.app, self.action])
                self.app = None
                self.action = None
        elif name == "action":
            self.inAction = False


# Parses core.git filter/source/config/fragments/types/*.xcu.
class FilterTypeHandler(xml.sax.handler.ContentHandler):
    def __init__(self):
        self.name = None
        self.inMediaType = False
        self.inExtensions = False
        self.content = []
        self.mediaType = None
        self.extensions = None

    def startElement(self, name, attrs):
        if name == "node":
            for k, v in list(attrs.items()):
                if k == "oor:name":
                    self.name = v
        elif name == "prop":
            for k, v in list(attrs.items()):
                if k == "oor:name" and v == "MediaType":
                    self.inMediaType = True
                elif k == "oor:name" and v == "Extensions":
                    self.inExtensions = True

    def endElement(self, name):
        if name == "prop" and self.inMediaType:
            self.inMediaType = False
            self.mediaType = "".join(self.content).strip()
            self.content = []
        elif name == "prop" and self.inExtensions:
            self.inExtensions = False
            self.extensions = "".join(self.content).strip()
            self.content = []

    def characters(self, content):
        if self.inMediaType or self.inExtensions:
            self.content.append(content)


# Parses core.git filter/source/config/fragments/filters/*.xcu.
class FilterFragmentHandler(xml.sax.handler.ContentHandler):
    def __init__(self):
        self.inType = False
        self.typeName = None
        self.inFlags = False
        self.flags = None
        self.content = []

    def startElement(self, name, attrs):
        if name == "prop":
            for k, v in list(attrs.items()):
                if k == "oor:name" and v == "Type":
                    self.inType = True
                elif k == "oor:name" and v == "Flags":
                    self.inFlags = True

    def endElement(self, name):
        if name == "prop" and self.inType:
            self.inType = False
            self.typeName = "".join(self.content).strip()
            self.content = []
        elif name == "prop" and self.inFlags:
            self.inFlags = False
            encodedFlags = "".join(self.content).strip().encode("utf-8")
            self.flags = encodedFlags.split(" ")
            self.content = []

    def characters(self, content):
        if self.inType or self.inFlags:
            self.content.append(content)


# Builds a MIME type -> filter flag dictionary.
def getFilterFlags(filterDir):
    # Build a MIME type -> type name dictionary.
    filterNames = {}
    typeFragments = os.path.join(filterDir, "types")
    for typeFragment in os.listdir(typeFragments):
        if not typeFragment.endswith(".xcu"):
            continue

        parser = xml.sax.make_parser()
        filterTypeHandler = FilterTypeHandler()
        parser.setContentHandler(filterTypeHandler)
        parser.parse(os.path.join(typeFragments, typeFragment))
        # Did we find a MIME type?
        if filterTypeHandler.mediaType:
            v = (filterTypeHandler.name, filterTypeHandler.extensions)
            filterNames[filterTypeHandler.mediaType] = v

    # core.git doesn't declares this, but probably this is the intention.
    filterNames["application/x-dif-document"] = ("calc_DIF", "dif")
    filterNames["application/x-dbase"] = ("calc_dBase", "dbf")

    # Build a 'type name' -> 'filter flag list' dictionary.
    typeNameFlags = {}
    filterFragments = os.path.join(filterDir, "filters")
    for filterFragment in os.listdir(filterFragments):
        if not filterFragment.endswith(".xcu"):
            continue

        parser = xml.sax.make_parser()
        handler = FilterFragmentHandler()
        parser.setContentHandler(handler)
        parser.parse(os.path.join(filterFragments, filterFragment))
        typeNameFlags[handler.typeName] = handler.flags

    # Now build the combined MIME type -> filter flags one.
    filterFlags = {}
    for i in filterNames.keys():
        typeName, extensions = filterNames[i]
        if typeName in typeNameFlags.keys():
            filterFlags[i] = (typeNameFlags[typeName], extensions)

    return filterFlags

# How it's described in discovery.xml -> how core.git knows it.
mimeTypeAliases = {
    'application/coreldraw': 'application/vnd.corel-draw',
    'application/vnd.visio2013': 'application/vnd.visio',
}

# We know that these can be edited.
mimeTypeWhiteList = {
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.text',
    'application/msword',
}


def main():
    discoveryXml = "discovery.xml"
    repoGuess = os.path.join(os.environ["HOME"], "git/libreoffice/master")
    filterDir = os.path.join(repoGuess, "filter/source/config/fragments")
    if len(sys.argv) >= 3:
        discoveryXml = sys.argv[1]
        filterDir = sys.arv[2]

    # Parse discovery.xml, which describes what online.git exposes at the
    # moment.
    parser = xml.sax.make_parser()
    discoveryHandler = DiscoveryHandler()
    parser.setContentHandler(discoveryHandler)
    parser.parse(discoveryXml)

    # Parse core.git filter definitions to build a MIME type <-> filter flag
    # dictionary.
    filterFlags = getFilterFlags(filterDir)

    # Now look up the filter flags in core.git for the MIME type.
    for i in discoveryHandler.appActions:
        mimeType = i[0]
        discoveryAction = i[1]
        if mimeType in mimeTypeWhiteList:
            continue
        if mimeType in mimeTypeAliases.keys():
            mimeType = mimeTypeAliases[mimeType]
        if mimeType in filterFlags.keys():
            flags, extensions = filterFlags[mimeType]
            if "IMPORT" in flags and "EXPORT" in flags:
                coreAction = "edit"
            else:
                coreAction = "view"

            if discoveryAction != coreAction:
                # Inconsistency found.
                print("warning: action for '" + mimeType + "' " +
                      "is '" + discoveryAction + "', " +
                      "but it should be '" + coreAction + "'")

    # Now see if there are any new types in the core.git filter config which
    # are missing.
    discoveryMimeTypes = [i[0] for i in discoveryHandler.appActions]
    proposed = []
    for filterMimeType in filterFlags.keys():
        if filterMimeType not in discoveryMimeTypes:
            flags, extensions = filterFlags[filterMimeType]
            if "IMPORT" in flags and "EXPORT" in flags:
                action = "edit"
            else:
                action = "view"
            print("warning: mime type '" + filterMimeType + "' is known, " +
                  "but not advertised in discovery.xml " +
                  "(extension would be '" + extensions + "', and " +
                  "action would be '"+action+"')")
            proposed.append((filterMimeType, extensions, action))

    # Produce a copy&paste-able XML output for the proposed changes.
    for proposal in proposed:
        print('        <app name="' + proposal[0] + '">')
        print('            <action name="' + proposal[2] + '" ' +
              'ext="' + proposal[1] + '"/>')
        print('        </app>')

if __name__ == "__main__":
    main()

# vim:set shiftwidth=4 softtabstop=4 expandtab:
