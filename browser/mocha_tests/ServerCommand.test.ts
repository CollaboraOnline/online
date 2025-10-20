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

/// all tests based on the possible messages from wsd/protocol.txt
describe('ServerCommand', function() {

	const assert = require('assert').strict;
	const mapzoom: MapZoomInterface = {
		_docLayer: {
			options: {
				tileWidthTwips: 256 * 15,
			},
		},
		options: {
			zoom: 10,
		},
	};

	it('downloadas', function() {
		const downloadid = 'SWhzgceoAoUXjc6XxSfKduleBU3pFKPI5jUQFnmRsgRxAPMqOhI8hhY0uWmg6tSp';
		const port = '9980';
		const id = 'export';

		const msg = 'downloadas: downloadid=' + downloadid + ' port=' + port + ' id=' + id;
		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(downloadid, sc.downloadid);
		assert.equal(port, sc.port);
		assert.equal(id, sc.id);
	});

	it('getchildid', function() {
		const id = '23456';
		const msg = 'getchildid: id=' + id;
		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(id, sc.id);
	});

	it('invalidatetiles (specific region)', function() {
		const part = 0;
		const mode = 0;
		const x = 117690;
		const y = 256050;
		const width = 2100;
		const height = 2655;
		const wireId = '268';

		const msg = `invalidatetiles: part=${part} mode=${mode} x=${x} y=${y} width=${width} height=${height} wid=${wireId}`;

		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(part, sc.part);
		assert.equal(mode, sc.mode);
		assert.equal(x, sc.x);
		assert.equal(y, sc.y);
		assert.equal(width, sc.width);
		assert.equal(height, sc.height);
		assert.equal(wireId, sc.wireId);
	});

	it('invalidatetiles (all cached tiles)', function() {
		const part = 0;
		const mode = 0;
		const wireId = '268';

		const msg = `invalidatetiles: EMPTY, ${part}, ${mode}, wid=${wireId}`;

		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(wireId, sc.wireId);
	});

	it('loaded', function() {
		const viewid = '34';
		const views = 39;
		const isfirst = false;

		const msg = `loaded: viewid=${viewid} views=${views} isfirst=${isfirst}`;
		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(viewid, sc.viewid);
	});

	it('pong', function() {
		const rendercount = 546;
		const msg = `pong rendercount=${rendercount}`;

		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(rendercount, sc.rendercount);
	});

	it('tile', function() {
		const nviewid = '1000';
		const part = 0;
		const width = 256;
		const height = 256;
		const tileposx = 122880;
		const tileposy = 215040;
		const tilewidth = 3840;
		const tileheight = 3840;
		const wireId = '423';
		const ver = '128';
		const imgsize = 800;

		const msg = `tile: nviewid=${nviewid} part=${part} width=${width} height=${height} tileposx=${tileposx} tileposy=${tileposy} tilewidth=${tilewidth} tileheight=${tileheight} wid=${wireId} ver=${ver} imgsize=${imgsize}`;

		const sc = new ServerCommand(msg, mapzoom);
		assert.equal(nviewid, sc.nviewid);
		assert.equal(part, sc.part);
		assert.equal(width, sc.width);
		assert.equal(height, sc.height);
		assert.equal(tileposx, sc.x);
		assert.equal(tileposy, sc.y);
		assert.equal(tilewidth, sc.tileWidth);
		assert.equal(tileheight, sc.tileHeight);
		assert.equal(wireId, sc.wireId);
	});
});
