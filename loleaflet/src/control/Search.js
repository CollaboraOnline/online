L.Map.include({
	search: function (text, backward, all) {
		if (backward === undefined) {
			backward = false;
		}
		if (all === undefined) {
			all = 0;
		}

		var searchCmd = {
			'SearchItem.SearchString': {
				'type': 'string'
			},
			'SearchItem.Backward': {
				'type': 'boolean'
			}
		};

		this.fire('clearselection');
		var viewTopLeftpx = this.project(this.getBounds().getNorthWest());
		var docBoundsTopLeft = this.project(this.options.maxBounds.getNorthWest());
		var topLeft = this.unproject(new L.Point(
				Math.max(viewTopLeftpx.x, docBoundsTopLeft.x),
				Math.max(viewTopLeftpx.y, docBoundsTopLeft.y)));
		var topLeftTwips = this._docLayer._latLngToTwips(topLeft);

		searchCmd['SearchItem.SearchString'].value = text;
		searchCmd['SearchItem.Backward'].value = backward;
		searchCmd['SearchItem.SearchStartPointX'] = {};
		searchCmd['SearchItem.SearchStartPointX'].type = 'long';
		searchCmd['SearchItem.SearchStartPointX'].value = topLeftTwips.x;
		searchCmd['SearchItem.SearchStartPointY'] = {};
		searchCmd['SearchItem.SearchStartPointY'].type = 'long';
		searchCmd['SearchItem.SearchStartPointY'].value = topLeftTwips.y;
		searchCmd['SearchItem.Command'] = {};
		searchCmd['SearchItem.Command'].type = 'long';
		searchCmd['SearchItem.Command'].value = all;
		L.Socket.sendMessage('uno .uno:ExecuteSearch ' + JSON.stringify(searchCmd));
	},

	searchAll: function (text, backward) {
		this.search(text, backward, 1);
	},

	resetSelection: function () {
		L.Socket.sendMessage('resetselection');
	}
});
