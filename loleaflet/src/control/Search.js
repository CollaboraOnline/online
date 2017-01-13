L.Map.include({
	search: function (text, backward, all, expand) {
		if (backward === undefined) {
			backward = false;
		}
		if (all === undefined) {
			all = 0;
		}
		if (this._docLayer._searchResults && text !== this._docLayer._searchTerm)
		{
			this._docLayer._clearSearchResults();
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

		var searchStartPointX = topLeftTwips.x;
		var searchStartPointY = topLeftTwips.y;
		if (this._docLayer && this._docLayer._lastSearchResult && expand) {
			var strTwips = this._docLayer._lastSearchResult.twipsRectangles.match(/\d+/g);
			if (strTwips != null) {
				searchStartPointX = strTwips[0];
				searchStartPointY = strTwips[1];
			}
			this.resetSelection();
		}

		searchCmd['SearchItem.SearchString'].value = text;
		searchCmd['SearchItem.Backward'].value = backward;
		searchCmd['SearchItem.SearchStartPointX'] = {};
		searchCmd['SearchItem.SearchStartPointX'].type = 'long';
		searchCmd['SearchItem.SearchStartPointX'].value = searchStartPointX;
		searchCmd['SearchItem.SearchStartPointY'] = {};
		searchCmd['SearchItem.SearchStartPointY'].type = 'long';
		searchCmd['SearchItem.SearchStartPointY'].value = searchStartPointY;
		searchCmd['SearchItem.Command'] = {};
		searchCmd['SearchItem.Command'].type = 'long';
		searchCmd['SearchItem.Command'].value = all;
		this._searchRequested = true;
		this._socket.sendMessage('uno .uno:ExecuteSearch ' + JSON.stringify(searchCmd));
	},

	highlightAll: function (text) {
		if (this._docLayer._searchResults && text === this._docLayer._searchTerm) {
			return;
		}
		this.search(text, false, 1);
	},

	resetSelection: function () {
		this._docLayer._clearSearchResults();
		this._socket.sendMessage('resetselection');
	}
});
