/* -*- js-indent-level: 8 -*- */
/* global app */

L.Map.include({
	search: function (text, backward, replaceString,  command, expand) {
		if (backward === undefined) {
			backward = false;
		}
		if (command === undefined) {
			command = 0;
		}
		if (replaceString === undefined) {
			replaceString = '';
		}
		if (this._docLayer._searchResults && text !== this._docLayer._searchTerm)
		{
			this._docLayer._clearSearchResults();
		}

		var searchCmd = {
			'SearchItem.SearchString': {
				'type': 'string'
			},
			'SearchItem.ReplaceString': {
				'type': 'string'
			},
			'SearchItem.Backward': {
				'type': 'boolean'
			},
			'SearchItem.SearchStartPointX': {
				'type': 'long'
			},
			'SearchItem.SearchStartPointY': {
				'type': 'long'
			},
			'SearchItem.Command': {
				'type': 'long'
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
		searchCmd['SearchItem.ReplaceString'].value = replaceString;
		searchCmd['SearchItem.SearchStartPointX'].value = searchStartPointX;
		searchCmd['SearchItem.SearchStartPointY'].value = searchStartPointY;
		searchCmd['SearchItem.Command'].value = command;
		this._searchRequested = true;
		app.socket.sendMessage('uno .uno:ExecuteSearch ' + JSON.stringify(searchCmd));
	},

	highlightAll: function (text) {
		if (this._docLayer._searchResults && text === this._docLayer._searchTerm) {
			return;
		}
		this.search(text, false, 1);
	},

	resetSelection: function () {
		this._docLayer._clearSearchResults();
		app.socket.sendMessage('resetselection');
	}
});
