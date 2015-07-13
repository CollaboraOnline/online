/*
 * Document permission handler
 */
L.Map.include({
	setPermission: function (perm) {
		this._docLayer._permission = perm;
		var className = 'leaflet-editmode';
		if (perm === 'edit') {
			this.dragging.disable();
			L.DomUtil.addClass(this._container, className);
		}
		else if (perm === 'view' || perm === 'readonly') {
			this.dragging.enable();
			// disable all user interaction, will need to add keyboard too
			this._docLayer._onUpdateCursor();
			this._docLayer._clearSelections();
			this._docLayer._onUpdateTextSelection();
			L.DomUtil.removeClass(this._container, className);
		}
		this.fire('updatepermission', {perm : perm});
	},

	enableSelection: function () {
		if (this._docLayer._permission === 'edit') {
			return;
		}
		var className = 'leaflet-editmode';
		this.dragging.disable();
		L.DomUtil.addClass(this._container, className);
	},

	disableSelection: function () {
		if (this._docLayer._permission === 'edit') {
			return;
		}
		var className = 'leaflet-editmode';
		this.dragging.enable();
		L.DomUtil.removeClass(this._container, className);
	}
});

