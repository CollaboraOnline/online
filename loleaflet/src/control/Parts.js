/*
 * Document parts switching handler
 */
L.Map.include({
	setPart: function (part) {
		var docLayer = this._docLayer
		if (part === 'prev') {
			if (docLayer._currentPart > 0) {
				docLayer._currentPart -= 1;
			}
		}
		else if (part === 'next') {
			if (docLayer._currentPart < docLayer._parts - 1) {
				docLayer._currentPart += 1;
			}
		}
		else if (typeof(part) === 'number' && part >= 0 && part < docLayer._parts) {
			docLayer._currentPart = part;
		}
		else {
			return;
		}
		this.fire('updateparts', {currentPart : docLayer._currentPart, parts : docLayer._parts});
		docLayer._update();
		docLayer._pruneTiles();
		docLayer._clearSelections();
	}
});
