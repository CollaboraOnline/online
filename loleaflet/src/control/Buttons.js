/*
 * Toolbar buttons handler
 */
L.Map.include({
	toggleCommandState: function (unoState) {
		if (this._docLayer._permission === 'edit') {
			this.socket.send('uno .uno:' + unoState);
		}
	}
});
