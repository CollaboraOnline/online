/*
 * Document permission handler
 */
L.Map.include({
	setPermission: function (perm) {
		this._permission = perm;
		if (perm === 'edit') {
			this._socket.sendMessage('requestloksession');
			this.dragging.disable();
		}
		else if (perm === 'view' || perm === 'readonly') {
			this.dragging.enable();
			// For time being, treat view/readonly mode as mode without editlock
			// disable all user interaction, will need to add keyboard too
			//this._docLayer._onUpdateCursor();
			//this._docLayer._clearSelections();
			//this._docLayer._onUpdateTextSelection();
		}
		this.fire('updatepermission', {perm : perm});
	},

	enableSelection: function () {
		if (this._permission === 'edit') {
			return;
		}
		this._socket.sendMessage('requestloksession');
		this.dragging.disable();
	},

	disableSelection: function () {
		if (this._permission === 'edit') {
			return;
		}
		this.dragging.enable();
	},

	isSelectionEnabled: function () {
		return !this.dragging.enabled();
	},

	getPermission: function () {
		return this._permission;
	}
});
