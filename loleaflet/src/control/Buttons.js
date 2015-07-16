/*
 * Toolbar buttons handler
 */
L.Map.include({
	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			this._docLayer.sendMessage('uno .uno:' + unoState);
		}
	},

	saveAs: function (url, format, options) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}
		this._docLayer.sendMessage('saveas ' +
			'url=' + url + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	}
});
