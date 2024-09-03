#!/usr/bin/env python3
# -*- tab-width: 4; indent-tabs-mode: nil; py-indent-offset: 4 -*-
#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

import os
import sys
import shutil

def usageAndExit():
    message = """usage: {program} template_path dest_path

Expands and fully populates sample files to better exercise
and test Collabora Online.
"""
    print(message.format(program=sys.argv[0]))
    exit(1)

# FIXME: should generate and insert into an fods template
# lots of calc content for testing scaling without lots of
# data in git.
def generateCalc(srcDir, destDir, base, extn):
    sys.stdout.write('Skip calc generation')
#    f = open(srcDir + '/' + base + '.' + extn, 'r', encoding='utf-8')
#    f.close()

def copyFile(srcDir, destDir, base, extn):
    sys.stdout.write('Copy ' + base + ' to ' + destDir)
    shutil.copy2(srcDir + '/' + base + '.' + extn,
                 destDir + '/' + base + '-edit.' + extn);

if __name__ == "__main__":
    if len(sys.argv) < 2:
        usageAndExit()

    src = sys.argv[1];
    dest = sys.argv[2];

    for file in os.listdir(src):
        bits = file.rsplit('.', 1)
        base = bits[0]
        extn = bits[1]

        if base.endswith('-edit'):
            continue # srcdir=builddir

        if file.endswith('calc.fods'):
            generateCalc(src, dest, base, extn)
        else:
            copyFile(src, dest, base, extn)

# vim: set shiftwidth=4 softtabstop=4 expandtab:
