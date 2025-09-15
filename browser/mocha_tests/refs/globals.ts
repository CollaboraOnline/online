/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var L: any = {
    LOUtil: {},
};

var app: any = {
    CSections: { Scroll: { name : 'scroll' } },
    roundedDpiScale : 1,
    canvasSize: null,
    definitions: {},
    dpiScale: 1,
    twipsToPixels: 15,
    pixelsToTwips: 1 / 15,
    sectionContainer: {}
};
