/*
 * Toolbar buttons handler
 */
L.Map.include({
	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			L.Socket.sendMessage('uno .uno:' + unoState);
		}
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
	}
});
