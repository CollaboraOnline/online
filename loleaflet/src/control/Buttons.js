/*
 * Toolbar buttons handler
 */
L.Map.include({
	toggleState: function (unoState) {
		this.socket.send('uno .uno:' + unoState);
	}
});
