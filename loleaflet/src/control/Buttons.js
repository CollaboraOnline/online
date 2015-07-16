/*
 * Toolbar buttons handler
 */
L.Map.include({
	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			this.socket.send('uno .uno:' + unoState);
		}
	},

	saveAs: function (url, format, options) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}
		this.socket.send('saveas ' +
			'url=' + url + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	}
});
