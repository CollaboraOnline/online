/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * L.Log contains methods for logging the activity
 */

L.Log = {
	log: function (msg, direction) {
		if (!this._logs)
			this._logs = [];
		var time = Date.now();
		if (!this.startTime)
			this.startTime = time;

		// Limit memory usage of log by only keeping the latest entries
		var maxEntries = 100;
		if (time - this.startTime < 60 * 1000 /* ms */)
			maxEntries = 500; // enough to capture early start.
		while (this._logs.length > maxEntries)
			this._logs.shift();

		// Limit memory usage of log by limiting length of message
		var maxMsgLen = 128;
		if (msg.length > maxMsgLen)
			msg = msg.substring(0, maxMsgLen);
		msg = msg.replace(/(\r\n|\n|\r)/gm, ' ');
		this._logs.push({msg : msg, direction : direction, time : time});
	},

	_getEntries: function () {
		this._logs.sort(function (a, b) {
			if (a.time < b.time) { return -1; }
			if (a.time > b.time) { return 1; }
			return 0;
		});
		var data = '';
		for (var i = 0; i < this._logs.length; i++) {
			data += this._logs[i].time + '.' + this._logs[i].direction + '.' +
				this._logs[i].msg;
			data += '\n';
		}
		return data;
	},

	print: function () {
		window.app.console.log('Queued log messages:');
		window.app.console.log(this._getEntries());
		window.app.console.log('End of queued log messages:');
	},

	save: function () {
		var blob = new Blob([this._getEntries()], {type: 'text/csv'}),
		    e = document.createEvent('MouseEvents'),
		    a = document.createElement('a');

		a.download = Date.now() + '.csv';
		a.href = window.URL.createObjectURL(blob);
		a.dataset.downloadurl =  ['text/csv', a.download, a.href].join(':');
		e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		a.dispatchEvent(e);
	},

	clear: function () {
		this._logs = [];
	}
};
