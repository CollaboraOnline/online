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

/// <reference path="../../src/global.d.ts" />
/// <reference path="../../src/control/jsdialog/Definitions.Types.ts" />
/// <reference path="../../src/app/iface/Clipboard.Interface.ts" />
/// <reference path="../../src/app/iface/Control.Interface.ts" />
/// <reference path="../../src/app/iface/DocLayer.Interface.ts" />
/// <reference path="../../src/app/iface/Map.Interface.ts" />
/// <reference path="../../src/app/iface/MapZoom.Interface.ts" />
/// <reference path="../../src/app/iface/SocketTypes.Interface.ts" />
/// <reference path="../../src/app/iface/TraceEvents.Interface.ts" />
/// <reference path="../../src/app/iface/Welcome.Interface.ts" />

(globalThis as any).app = {
    CSections: { Scroll: { name : 'scroll' } },
    roundedDpiScale : 1,
    canvasSize: null,
    definitions: {},
    dpiScale: 1,
    twipsToPixels: 15,
    pixelsToTwips: 1 / 15,
    sectionContainer: {},
	console: globalThis.console,
	socket: {},
};

globalThis.window = (function() {
	const jsdom = require('jsdom');
	const dom = new jsdom.JSDOM('<html><body><div id="document-container"></div></body></html>', { pretendToBeVisual: true });
	return dom.window;
})();

globalThis.document = globalThis.window.document;

(globalThis.window as any).prefs = {
	canPersist: false,
};

(globalThis.window as any).app = (globalThis as any).app;

(globalThis as any).L = {
	Browser: {
		any3d: true,
		cypressTest: false,
		mac: false,
		win: false,
		lang: 'en',
	},
	LOUtil: {},
	Map: {
		include(input: any) {},
		mergeOptions(input: any) {},
		addInitHook(i1: any, i2: any, i3: any) {},
	},
	Handler: {
		extend(input: any) {},
	},

	Control: class _Control {
	},

	control: {},
};

(globalThis.window as any).L = (globalThis as any).L;

globalThis._ = (input: string) => input;
(globalThis.ResizeObserver as any) = class _ResizeObserver {
	constructor(firer: () => void) {
	}
	observe(container: HTMLElement) {
	}
};
 globalThis.JSDialog = {};

(globalThis as any).DOMPurify = require('dompurify');
(globalThis as any).glMatrix = require('gl-matrix');

String.locale = 'en';
globalThis._UNO = function(i1: string, i2: string) {
	return i2;
};
globalThis.SlideShow = {};
(globalThis.window as any).getBorderStyleUNOCommand = () => {};

var nodeassert = require('assert').strict;
var jsdom = require('jsdom');
