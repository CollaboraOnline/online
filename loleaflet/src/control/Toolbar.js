/*
 * Toolbar handler
 */
L.Map.include({

	// a mapping of uno commands to more readable toolbar items
	unoToolbarCommands: {
		'uno.StyleApply': 'styles'
	},

	getStyles: function () {
		return this._docLayer._docStyles;
	},

	saveAs: function (url, format, options) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}
		L.Socket.sendMessage('saveas ' +
			'url=' + url + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	setStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		if (this._docLayer._permission === 'edit') {
			var msg = 'uno .uno:StyleApply {' +
					'"Style":{"type":"string", "value": "' + style + '"},' +
					'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
					'}';
			L.Socket.sendMessage(msg);
		}
	},

	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			L.Socket.sendMessage('uno .uno:' + unoState);
		}
	}
});
