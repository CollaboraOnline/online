L.Map.include({
	getStyles: function () {
		return this._docLayer._docStyles;
	},

	setStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		var msg = 'uno .uno:StyleApply {' +
				'"Style":{"type":"string", "value": "' + style + '"},' +
				'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
				'}';
		L.Socket.sendMessage(msg);
	}
});
