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

describe('ViewLayout', function() {

var jsdom = require('jsdom');
var assert = require('assert').strict;
var _ = function(text: string) { return text; };

function initializeJSDOM() {
    var dom = new jsdom.JSDOM(canvasDomString(), { pretendToBeVisual: true });

    addMockCanvas(dom.window);
    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = dom.window.requestAnimationFrame;
    global.cancelAnimationFrame = dom.window.cancelAnimationFrame;
}

describe('View Layout Tests', function () {
    this.beforeAll(initializeJSDOM);

    it('Check Pan Direction', function () {

        const canvasWidth = 1024;
        const canvasHeight = 768;

        setupCanvasContainer(canvasWidth, canvasHeight);

        const viewLayout = new ViewLayoutBase();

        viewLayout.viewedRectangle = new cool.SimpleRectangle(100, 100, 100, 100);
        let panDirection = viewLayout.getLastPanDirection();

        assert.ok(panDirection[0] === 1 && panDirection[1] === 1);

        viewLayout.viewedRectangle = new cool.SimpleRectangle(50, 50, 100, 100);
        panDirection = viewLayout.getLastPanDirection();
        assert.ok(panDirection[0] === -1 && panDirection[1] === -1);
	});
});

});
