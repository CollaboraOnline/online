L.Map.include({
	search: function (text, backward, all) {
		if (backward === undefined) {
			backward = false;
		}
		if (all === undefined) {
			all = 0;
		}

		// check if there is a cached searchAll result for this phrase
		// if there is update index for next/prev iteration
		if (this._docLayer._searchResults && text === this._docLayer._searchTerm) {
			if (backward) {
				if (this._docLayer._searchIndex > 0) {
					this._docLayer._searchIndex--;
				}
				else {
					this._docLayer._searchIndex = this._docLayer._searchResults.length - 1;
				}
			} else {
				if (this._docLayer._searchIndex < this._docLayer._searchResults.length - 1) {
					this._docLayer._searchIndex++;
				}
				else {
					this._docLayer._searchIndex = 0;
				}
			}
			this.setPart(this._docLayer._searchResults[this._docLayer._searchIndex].part);
			return;
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
		this._socket.sendMessage('uno .uno:ExecuteSearch ' + JSON.stringify(searchCmd));
	},

	searchAll: function (text, backward) {
		this.search(text, backward, 1);
	},

	resetSelection: function () {
		this._docLayer._clearSearchResults();
		this._socket.sendMessage('resetselection');
	}
});
