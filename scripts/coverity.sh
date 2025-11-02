#!/bin/sh
#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# invocation for coverity to collect c/c++ and javascript
coverity capture --dir cov-int --language c-family --language javascript --file-include-regex "browser/(src|admin|welcome)" -- make -j `nproc`
