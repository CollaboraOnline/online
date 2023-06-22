/* -*- js-indent-level: 8 -*- */
/*
 * L.Log contains methods for logging the activity
 */

L.Log = {
	log: function (msg, direction, tileCoords, time) {
		if (!time) {
			time = Date.now();
		}
		if (!this._logs) {
			this._logs = [];
		}
		// Limit memory usage of log by only keeping the latest entries
		var maxEntries = 100;
		while (this._logs.length > maxEntries)
			this._logs.shift();
		// Limit memory usage of log by limiting length of message
		var maxMsgLen = 128;
		if (msg.length > maxMsgLen)
			msg = msg.substring(0, maxMsgLen);
		msg = msg.replace(/(\r\n|\n|\r)/gm, ' ');
		this._logs.push({msg : msg, direction : direction,
			coords : tileCoords, time : time});
		//window.app.console.log(time + '-' + direction + ': ' + msg);
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
					this._logs[i].msg + '.' + this._logs[i].coords;
			data += '\n';
		}
		return data;
	},

	print: function () {
		// window.app.console.log(this._getEntries());
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
