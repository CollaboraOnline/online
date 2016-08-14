/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

/*eslint no-extend-native:0*/
if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}

L.Compatibility = {
	clipboardGet: function (event) {
		var text = null;
		if (event.clipboardData) { // Standard
			text = event.clipboardData.getData('text/plain');
		}
		else if (window.clipboardData) { // IE 11
			text = window.clipboardData.getData('Text');
		}
		return text;
	},
	clipboardSet: function (event, text) {
		if (event.clipboardData) { // Standard
			event.clipboardData.setData('text/plain', text);
		}
		else if (window.clipboardData) { // IE 11
			window.clipboardData.setData('Text', text);
		}
	}
};

L.TileLayer = L.GridLayer.extend({

	options: {
		maxZoom: 18,

		subdomains: 'abc',
		errorTileUrl: '',
		zoomOffset: 0,

		maxNativeZoom: null, // Number
		tms: false,
		zoomReverse: false,
		detectRetina: false,
		crossOrigin: false,
		previewInvalidationTimeout: 1000,
		defaultPermission: 'view'
	},

	initialize: function (url, options) {

		this._url = url;

		options = L.setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!L.Browser.android) {
			this.on('tileunload', this._onTileRemove);
		}
		// text, presentation, spreadsheet, etc
		this._docType = options.docType;
		this._documentInfo = '';
		// Position and size of the visible cursor.
		this._visibleCursor = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Cursor overlay is visible or hidden (for blinking).
		this._isCursorOverlayVisible = false;
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._isCursorVisible = true;
		// Original rectangle graphic selection in twips
		this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Original rectangle of cell cursor in twips
		this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle for cell cursor
		this._cellCursor =  L.LatLngBounds.createDefault();
		this._prevCellCursor = L.LatLngBounds.createDefault();
		// Position and size of the selection start (as if there would be a cursor caret there).

		this._lastValidPart = -1;
		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
		// Selection handle marker
		this._selectionHandles = {};
		['start', 'end'].forEach(L.bind(function (handle) {
			this._selectionHandles[handle] = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'leaflet-selection-marker-' + handle,
					iconSize: null
				}),
				draggable: true
			});
		}, this));

		this._emptyTilesCount = 0;
		this._msgQueue = [];
		this._toolbarCommandValues = {};
		this._previewInvalidations = [];
		this._partPageRectanglesTwips = [];
		this._partPageRectanglesPixels = [];
		this._clientZoom = 'tilepixelwidth=' + this.options.tileSize + ' ' +
			'tilepixelheight=' + this.options.tileSize + ' ' +
			'tiletwipwidth=' + this.options.tileWidthTwips + ' ' +
			'tiletwipheight=' + this.options.tileHeightTwips;

		// Mark visible area as dirty by default.
		this._invalidateClientVisibleArea();
	},

	onAdd: function (map) {
		this._initContainer();
		this._getToolbarCommandsValues();
		this._selections = new L.LayerGroup();
		map.addLayer(this._selections);

		this._searchResultsLayer = new L.LayerGroup();
		map.addLayer(this._searchResultsLayer);

		this._levels = {};
		this._tiles = {};
		this._tileCache = {};

		map._fadeAnimated = false;
		this._viewReset();
		map.on('drag resize zoomend', this._updateScrollOffset, this);

		map.on('copy', this._onCopy, this);
		map.on('cut', this._onCut, this);
		map.on('paste', this._onPaste, this);
		map.on('dragover', this._onDragOver, this);
		map.on('drop', this._onDrop, this);

		map.on('zoomend', this._onUpdateCursor, this);
		map.on('zoomend', this._onUpdatePartPageRectangles, this);
		if (this._docType === 'spreadsheet') {
			map.on('zoomend', this._onCellCursorShift, this);
		}
		map.on('zoomend', this._updateClientZoom, this);
		map.on('resize zoomend', this._invalidateClientVisibleArea, this);
		map.on('dragstart', this._onDragStart, this);
		map.on('requestloksession', this._onRequestLOKSession, this);
		map.on('error', this._mapOnError, this);
		if (map.options.autoFitWidth !== false) {
			map.on('resize', this._fitWidthZoom, this);
		}
		// Retrieve the initial cell cursor position (as LOK only sends us an
		// updated cell cursor when the selected cell is changed and not the initial
		// cell).
		map.on('statusindicator',
			function (e) {
				if (e.statusType === 'alltilesloaded' && this._docType === 'spreadsheet') {
					this._onCellCursorShift(true);
				}
			},
		this);

		map.on('updatepermission', function(e) {
			// {En,Dis}able selection handles
			for (var key in this._selectionHandles) {
				this._selectionHandles[key].setDraggable(e.perm === 'edit');
			}

			// we want graphic selection handles to appear
			// when in editmode, and dissappear when in view mode
			if (e.perm !== 'edit') {
				this._graphicSelection = null;
			}
			this._onUpdateGraphicSelection();
		}, this);

		for (var key in this._selectionHandles) {
			this._selectionHandles[key].on('drag dragend', this._onSelectionHandleDrag, this);
		}
		this._textArea = map._textArea;
		this._textArea.focus();

		map.setPermission(this.options.permission);

		map.fire('statusindicator', {statusType: 'loleafletloaded'});
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			moveend: this._move
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			events.move = L.Util.throttle(this._move, this.options.updateInterval, this);
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	createTile: function (coords, done) {
		var tile = document.createElement('img');

		tile.onload = L.bind(this._tileOnLoad, this, done, tile);
		tile.onerror = L.bind(this._tileOnError, this, done, tile);

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';
		this._emptyTilesCount += 1;
		return tile;
	},

	_getToolbarCommandsValues: function() {
		for (var i = 0; i < this._map.unoToolbarCommands.length; i++) {
			var command = this._map.unoToolbarCommands[i];
			this._map._socket.sendMessage('commandvalues command=' + command);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('commandvalues:')) {
			this._onCommandValuesMsg(textMsg);
		}
		else if (textMsg.startsWith('cursorvisible:')) {
			this._onCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('downloadas:')) {
			this._onDownloadAsMsg(textMsg);
		}
		else if (textMsg.startsWith('error:')) {
			this._onErrorMsg(textMsg);
		}
		else if (textMsg.startsWith('getchildid:')) {
			this._onGetChildIdMsg(textMsg);
		}
		else if (textMsg.startsWith('graphicselection:')) {
			this._onGraphicSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('cellcursor:')) {
			this._onCellCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('cellformula:')) {
			this._onCellFormulaMsg(textMsg);
		}
		else if (textMsg.startsWith('hyperlinkclicked:')) {
			this._onHyperlinkClickedMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatecursor:')) {
			this._onInvalidateCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatetiles:') && !textMsg.match('EMPTY')) {
			this._onInvalidateTilesMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatetiles:') && textMsg.match('EMPTY')) {
			var msg = 'invalidatetiles: ';
			if (this._docType === 'text') {
				msg += 'part=0 ';
			} else {
				msg += 'part=' + this._selectedPart + ' ';
			}
			msg += 'x=0 y=0 ';
			msg += 'width=' + this._docWidthTwips + ' ';
			msg += 'height=' + this._docHeightTwips;
			this._onInvalidateTilesMsg(msg);
		}
		else if (textMsg.startsWith('mousepointer:')) {
			this._onMousePointerMsg(textMsg);
		}
		else if (textMsg.startsWith('partpagerectangles:')) {
			this._onPartPageRectanglesMsg(textMsg);
		}
		else if (textMsg.startsWith('renderfont:')) {
			this._onRenderFontMsg(textMsg, img);
		}
		else if (textMsg.startsWith('searchnotfound:')) {
			this._onSearchNotFoundMsg(textMsg);
		}
		else if (textMsg.startsWith('searchresultselection:')) {
			this._onSearchResultSelection(textMsg);
		}
		else if (textMsg.startsWith('setpart:')) {
			this._onSetPartMsg(textMsg);
		}
		else if (textMsg.startsWith('statechanged:')) {
			this._onStateChangedMsg(textMsg);
		}
		else if (textMsg.startsWith('status:')) {
			this._onStatusMsg(textMsg);
		}
		else if (textMsg.startsWith('textselection:')) {
			this._onTextSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectioncontent:')) {
			this._onTextSelectionContentMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionend:')) {
			this._onTextSelectionEndMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionstart:')) {
			this._onTextSelectionStartMsg(textMsg);
		}
		else if (textMsg.startsWith('tile:')) {
			this._onTileMsg(textMsg, img);
		}
		else if (textMsg.startsWith('unocommandresult:')) {
			this._onUnoCommandResultMsg(textMsg);
		}
		else if (textMsg.startsWith('editlock:')) {
			this._onEditLock(textMsg);
		}
		else if (textMsg.startsWith('contextmenu:')) {
			this._onContextMenuMsg(textMsg);
		}
		else if (textMsg.startsWith('viewinfo:')) {
			this._onViewInfoMsg(textMsg);
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		if (obj.commandName === '.uno:CellCursor') {
			this._onCellCursorMsg(obj.commandValues);
		} else if (this._map.unoToolbarCommands.indexOf(obj.commandName) !== -1) {
			this._toolbarCommandValues[obj.commandName] = obj.commandValues;
			this._map.fire('updatetoolbarcommandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
	},

	_onCellFormulaMsg: function (textMsg) {
		var formula = textMsg.substring(13);
		this._selectionTextContent = formula;
		this._map.fire('cellformula', {formula: formula});
	},

	_onCursorVisibleMsg: function(textMsg) {
		var command = textMsg.match('cursorvisible: true');
		this._isCursorVisible = command ? true : false;
		this._isCursorOverlayVisible = true;
		this._onUpdateCursor();
	},

	_onDownloadAsMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		var parser = document.createElement('a');
		parser.href = this._map.options.server;
		var url = this._map.options.webserver + '/' + this._map.options.urlPrefix + '/' +
		    encodeURIComponent(this._map.options.doc) + '/' + command.jail + '/' + command.dir + '/' + command.name;

		this._map.hideBusy();
		if (command.id === 'print') {
			var isFirefox = typeof InstallTrigger !== 'undefined' || navigator.userAgent.search('Firefox') >= 0;
			if (isFirefox || this._map.options.print === false) {
				// the print dialog doesn't work well on firefox
				this._map.fire('print', {url: url});
			}
			else {
				this._map.fire('filedownloadready', {url: url, name: name, id: command.id});
			}
		}
		else if (command.id === 'slideshow') {
			this._map.fire('slidedownloadready', {url: url});
		}
		else {
			this._map._fileDownloader.src = url;
		}
	},

	_onErrorMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);

		// let's provide some convenience error codes for the UI
		var errorId = 1; // internal error
		if (command.errorCmd === 'load') {
			errorId = 2; // document cannot be loaded
		}
		else if (command.errorCmd === 'save' || command.errorCmd === 'saveas') {
			errorId = 5; // document cannot be saved
		}

		var errorCode = -1;
		if (command.errorCode !== undefined) {
			errorCode = command.errorCode;
		}

		this._map.fire('error', {cmd: command.errorCmd, kind: command.errorKind, id: errorId, code: errorCode});
	},

	_onGetChildIdMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		this._map.fire('childid', {id: command.id});
	},

	_onGraphicSelectionMsg: function (textMsg) {
		if (textMsg.match('EMPTY')) {
			this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		}
		else {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._graphicSelectionTwips = new L.Bounds(topLeftTwips, bottomRightTwips);
			this._graphicSelection = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		this._onUpdateGraphicSelection();
	},

	_onCellCursorMsg: function (textMsg) {
		if (!this._cellCursor) {
			this._cellCursor = L.LatLngBounds.createDefault();
		}
		if (!this._prevCellCursor) {
			this._prevCellCursor = L.LatLngBounds.createDefault();
		}
		if (textMsg.match('EMPTY')) {
			this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._cellCursor = L.LatLngBounds.createDefault();
		}
		else {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellCursorTwips = new L.Bounds(topLeftTwips, bottomRightTwips);
			this._cellCursor = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		var horizontalDirection = 0;
		var verticalDirection = 0;
		var sign = function(x) {
			return x > 0 ? 1 : x < 0 ? -1 : x;
		};
		if (!this._isEmptyRectangle(this._prevCellCursor) && !this._isEmptyRectangle(this._cellCursor)) {
			horizontalDirection = sign(this._cellCursor.getWest() - this._prevCellCursor.getWest());
			verticalDirection = sign(this._cellCursor.getNorth() - this._prevCellCursor.getNorth());
		}

		if (!this._isEmptyRectangle(this._cellCursor) && !this._prevCellCursor.equals(this._cellCursor)) {
			this._prevCellCursor = new L.LatLngBounds(this._cellCursor.getSouthWest(), this._cellCursor.getNorthEast());
		}

		this._onUpdateCellCursor(horizontalDirection, verticalDirection);
	},

	_onMousePointerMsg: function (textMsg) {
		textMsg = textMsg.substring(14); // "mousepointer: "
		textMsg = L.Cursor.getCustomCursor(textMsg) || textMsg;
		if (this._map._container.style.cursor !== textMsg) {
			this._map._container.style.cursor = textMsg;
		}
	},

	_onHyperlinkClickedMsg: function (textMsg) {
		var link = textMsg.substring(18);
		this._map.fire('hyperlinkclicked', {url: link});
	},

	_onInvalidateCursorMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);
		this._visibleCursor = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		this._visibleCursorOnLostFocus = this._visibleCursor;
		this._isCursorOverlayVisible = true;
		this._onUpdateCursor();
	},

	_addView: function(viewId, username) {
		this._map.addView(viewId, username);
	},

	_removeView: function(viewId) {
		this._map.removeView(viewId);
	},

	_onViewInfoMsg: function(textMsg) {
		textMsg = textMsg.substring('viewinfo: '.length);
		var viewInfo = JSON.parse(textMsg);

		// A new view
		var viewIds = [];
		for (var viewInfoIdx in viewInfo) {
			if (!(parseInt(viewInfo[viewInfoIdx].id) in this._map._viewInfo)) {
				this._addView(viewInfo[viewInfoIdx].id, viewInfo[viewInfoIdx].username);
			}
			viewIds.push(viewInfo[viewInfoIdx].id);
		}

		// Check if any view is deleted
		for (viewInfoIdx in this._map._viewInfo) {
			if (viewIds.indexOf(parseInt(viewInfoIdx)) === -1) {
				this._removeView(parseInt(viewInfoIdx));
			}
		}
	},

	_onPartPageRectanglesMsg: function (textMsg) {
		textMsg = textMsg.substring(19);
		var pages = textMsg.split(';');
		this._partPageRectanglesTwips = [];
		this._partPageRectanglesPixels = [];
		for (var i = 0; i < pages.length; i++) {
			var strTwips = pages[i].match(/\d+/g);
			if (!strTwips) {
				// probably not a text file
				return;
			}
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var pageBoundsTwips = new L.Bounds(topLeftTwips, bottomRightTwips);
			this._partPageRectanglesTwips.push(pageBoundsTwips);
			var pageBoundsPixels = new L.Bounds(
					this._twipsToPixels(topLeftTwips),
					this._twipsToPixels(bottomRightTwips));
			this._partPageRectanglesPixels.push(pageBoundsPixels);
		}
		this._map.fire('partpagerectangles', {
			pixelRectangles: this._partPageRectanglesPixels,
			twipsRectangles: this._partPageRectanglesTwips
		});
		this._onCurrentPageUpdate();
	},

	_onRenderFontMsg: function (textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);
		this._map.fire('renderfont', {
			font: command.font,
			img: img
		});
	},

	_onSearchNotFoundMsg: function (textMsg) {
		this._clearSearchResults();
		var originalPhrase = textMsg.substring(16);
		this._map.fire('search', {originalPhrase: originalPhrase, count: 0});
	},

	_onSearchResultSelection: function (textMsg) {
		textMsg = textMsg.substring(23);
		var obj = JSON.parse(textMsg);
		var originalPhrase = obj.searchString;
		var count = obj.searchResultSelection.length;
		var highlightAll = obj.highlightAll;
		var results = [];
		for (var i = 0; i < obj.searchResultSelection.length; i++) {
			results.push({
				part: parseInt(obj.searchResultSelection[i].part),
				rectangles: this._twipsRectanglesToPixelBounds(obj.searchResultSelection[i].rectangles),
				twipsRectangles: obj.searchResultSelection[i].rectangles
			});
		}
		// do not cache search results if there is only one result.
		// this way regular searches works fine
		if (count > 1)
		{
			this._clearSearchResults();
			this._searchResults = results;
			this._map.setPart(results[0].part); // go to first result.
		}
		this._searchTerm = originalPhrase;
		this._map.fire('search', {originalPhrase: originalPhrase, count: count, highlightAll: highlightAll, results: results});
	},

	_clearSearchResults: function() {
		this._searchResults = null;
		this._searchTerm = null;
		this._searchResultsLayer.clearLayers();
	},

	_drawSearchResults: function() {
		if (!this._searchResults) {
			return;
		}
		this._searchResultsLayer.clearLayers();
		for (var k = 0; k < this._searchResults.length; k++)
		{
			var result = this._searchResults[k];
			if (result.part === this._selectedPart)
			{
				var _fillColor = '#CCCCCC';
				var strTwips = result.twipsRectangles.match(/\d+/g);
				var rectangles = [];
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
					var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
					var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
					var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
					var bottomRightTwips = topLeftTwips.add(offset);
					rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
				}
				var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
				for (var j = 0; j < polygons.length; j++) {
					var selection = new L.Polygon(polygons[j], {
						pointerEvents: 'none',
						fillColor: _fillColor,
						fillOpacity: 0.25,
						weight: 2,
						opacity: 0.25});
					this._searchResultsLayer.addLayer(selection);
				}
			}
		}
	},

	_onStateChangedMsg: function (textMsg) {
		textMsg = textMsg.substr(14);
		var index = textMsg.indexOf('=');
		var commandName = index !== -1 ? textMsg.substr(0, index) : '';
		var state = index !== -1 ? textMsg.substr(index + 1) : '';

		this._map.fire('commandstatechanged', {commandName : commandName, state : state});
	},

	_onUnoCommandResultMsg: function (textMsg) {
		textMsg = textMsg.substring(18);
		var obj = JSON.parse(textMsg);
		var commandName = obj.commandName;
		if (obj.success === 'true') {
			var success = true;
		}
		else if (obj.success === 'false') {
			success = false;
		}

		this._map.hideBusy();
		// TODO when implemented in the LOK, add also obj.result
		this._map.fire('commandresult', {commandName: commandName, success: success});

	},

	_onContextMenuMsg: function (textMsg) {
		textMsg = textMsg.substring(13);
		var obj = JSON.parse(textMsg);

		this._map.fire('locontextmenu', obj);
	},

	_onTextSelectionMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		this._selections.clearLayers();
		if (strTwips != null) {
			var rectangles = [];
			var selectionCenter = new L.Point(0, 0);
			for (var i = 0; i < strTwips.length; i += 4) {
				var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
				var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
				var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
				var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
				var bottomRightTwips = topLeftTwips.add(offset);
				rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
				selectionCenter = selectionCenter.add(topLeftTwips);
				selectionCenter = selectionCenter.add(offset.divideBy(2));
			}

			var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
			for (i = 0; i < polygons.length; i++) {
				var selection = new L.Polygon(polygons[i], {
					pointerEvents: 'none',
					fillColor: '#43ACE8',
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25});
				this._selections.addLayer(selection);
			}
			if (this._selectionContentRequest) {
				clearTimeout(this._selectionContentRequest);
			}
			this._selectionContentRequest = setTimeout(L.bind(function () {
				this._map._socket.sendMessage('gettextselection mimetype=text/plain;charset=utf-8');}, this), 100);
		}
		this._onUpdateTextSelection();
	},

	_onTextSelectionContentMsg: function (textMsg) {
		this._selectionTextContent = textMsg.substr(22);
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map._permission === 'edit') {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._textSelectionEnd = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._textSelectionEnd = null;
		}
	},

	_onTextSelectionStartMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map._permission === 'edit') {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._textSelectionStart = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._textSelectionStart = null;
		}

	},

	_onTileMsg: function (textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);
		var coords = this._twipsToCoords(command);
		coords.z = command.zoom;
		coords.part = command.part;
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];
		if (command.id !== undefined) {
			this._map.fire('tilepreview', {
				tile: img,
				id: command.id,
				width: command.width,
				height: command.height,
				part: command.part,
				docType: this._docType
			});
		}
		else if (tile) {
			if (this._tiles[key]._invalidCount > 0) {
				this._tiles[key]._invalidCount -= 1;
			}
			if (!tile.loaded) {
				this._emptyTilesCount -= 1;
				if (this._emptyTilesCount === 0) {
					this._map.fire('statusindicator', {statusType: 'alltilesloaded'});
				}
			}
			tile.el.src = img;
		}
		else if (command.preFetch === 'true') {
			this._tileCache[key] = img;
		}
		L.Log.log(textMsg, L.INCOMING, key);
	},

	_tileOnLoad: function (done, tile) {
		done(null, tile);
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_mapOnError: function (e) {
		if (e.msg && this._map._permission === 'edit') {
			this._map.setPermission('view');
		}
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_clearSelections: function () {
		// hide the cursor
		this._isCursorOverlayVisible = false;
		this._onUpdateCursor();
		// hide the text selection
		this._selections.clearLayers();
		// hide the selection handles
		this._onUpdateTextSelection();
		// hide the graphic selection
		this._graphicSelection = null;
		this._onUpdateGraphicSelection();
		this._cellCursor = null;
		this._onUpdateCellCursor();
	},

	_postMouseEvent: function(type, x, y, count, buttons, modifier) {
		if (this._clientZoom) {
			// the zoom level has changed
			this._map._socket.sendMessage('clientzoom ' + this._clientZoom);
			this._clientZoom = null;
		}
		this._map._socket.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count +
				' buttons=' + buttons + ' modifier=' + modifier);

		if (type === 'buttondown') {
			this._clearSearchResults();
		}
	},

	_postKeyboardEvent: function(type, charcode, keycode) {
		if (this._clientZoom) {
			// the zoom level has changed
			this._map._socket.sendMessage('clientzoom ' + this._clientZoom);
			this._clientZoom = null;
		}
		if (this._clientVisibleArea) {
			// Visible area is dirty, update it on the server.
			var visibleArea = this._map._container.getBoundingClientRect();
			var pos = this._pixelsToTwips(new L.Point(visibleArea.left, visibleArea.top));
			var size = this._pixelsToTwips(new L.Point(visibleArea.width, visibleArea.height));
			var payload = 'clientvisiblearea x=' + Math.round(pos.x) + ' y=' + Math.round(pos.y) +
				' width=' + Math.round(size.x) + ' height=' + Math.round(size.y);
			this._map._socket.sendMessage(payload);
			this._clientVisibleArea = false;
		}
		this._map._socket.sendMessage('key type=' + type +
				' char=' + charcode + ' key=' + keycode);
	},

	_postSelectGraphicEvent: function(type, x, y) {
		this._map._socket.sendMessage('selectgraphic type=' + type +
				' x=' + x + ' y=' + y);
	},

	_postSelectTextEvent: function(type, x, y) {
		this._map._socket.sendMessage('selecttext type=' + type +
				' x=' + x + ' y=' + y);
	},

	// Is rRectangle empty?
	_isEmptyRectangle: function (bounds) {
		if (!bounds) {
			return true;
		}
		return bounds.getSouthWest().equals(new L.LatLng(0, 0)) && bounds.getNorthEast().equals(new L.LatLng(0, 0));
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (e) {
		var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._visibleCursor.getSouthWest()),
						 this._map.latLngToLayerPoint(this._visibleCursor.getNorthEast()));
		var cursorPos = this._visibleCursor.getNorthWest();

		if (!e && !this._map.getBounds().contains(this._visibleCursor) && this._isCursorVisible) {
			var center = this._map.project(cursorPos);
			center = center.subtract(this._map.getSize().divideBy(2));
			center.x = Math.round(center.x < 0 ? 0 : center.x);
			center.y = Math.round(center.y < 0 ? 0 : center.y);

			if (!(this._selectionHandles.start && this._selectionHandles.start.isDragged) &&
			    !(this._selectionHandles.end && this._selectionHandles.end.isDragged)) {
				this._map.fire('scrollto', {x: center.x, y: center.y});
			}
		}

		if (this._map._permission === 'edit' && this._isCursorVisible && this._isCursorOverlayVisible
				&& !this._isEmptyRectangle(this._visibleCursor)) {
			if (this._cursorMarker) {
				this._map.removeLayer(this._cursorMarker);
			}

			this._cursorMarker = L.cursor(cursorPos);
			this._map.addLayer(this._cursorMarker);
			this._cursorMarker.setSize(pixBounds.getSize().multiplyBy(
						this._map.getZoomScale(this._map.getZoom())));
		}
		else if (this._cursorMarker) {
			this._map.removeLayer(this._cursorMarker);
			this._isCursorOverlayVisible = false;
		}
	},

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if (!e.handle) { return; }

		var aPos = this._latLngToTwips(e.handle.getLatLng());
		if (e.type === 'editstart') {
			this._graphicMarker.isDragged = true;
			this._postSelectGraphicEvent('start',
						Math.min(aPos.x, this._graphicSelectionTwips.max.x - 1),
						Math.min(aPos.y, this._graphicSelectionTwips.max.y - 1));
		}
		else if (e.type === 'editend') {
			this._postSelectGraphicEvent('end', aPos.x, aPos.y);
			this._graphicMarker.isDragged = false;
		}
	},

	// Update dragged text selection.
	_onSelectionHandleDrag: function (e) {
		if (e.type === 'drag') {
			e.target.isDragged = true;

			// This is rather hacky, but it seems to be the only way to make the
			// marker follow the mouse cursor if the document is autoscrolled under
			// us. (This can happen when we're changing the selection if the cursor
			// moves somewhere that is considered off screen.)

			// Onscreen position of the cursor, i.e. relative to the browser window
			var boundingrect = e.target._icon.getBoundingClientRect();
			var cursorPos = L.point(boundingrect.left, boundingrect.top);

			var expectedPos = L.point(e.originalEvent.pageX, e.originalEvent.pageY).subtract(e.target.dragging._draggable.startOffset);

			// If the map has been scrolled, but the cursor hasn't been updated yet, then
			// the current mouse position differs.
			if (!expectedPos.equals(cursorPos)) {
				var correction = expectedPos.subtract(cursorPos);

				e.target.dragging._draggable._startPoint = e.target.dragging._draggable._startPoint.add(correction);
				e.target.dragging._draggable._startPos = e.target.dragging._draggable._startPos.add(correction);
				e.target.dragging._draggable._newPos = e.target.dragging._draggable._newPos.add(correction);

				e.target.dragging._draggable._updatePosition();
			}

			var containerPos = new L.Point(expectedPos.x - this._map._container.getBoundingClientRect().left,
				expectedPos.y - this._map._container.getBoundingClientRect().top);

			containerPos = containerPos.add(e.target.dragging._draggable.startOffset);
			this._map.fire('handleautoscroll', {pos: containerPos, map: this._map});
		}
		if (e.type === 'dragend') {
			e.target.isDragged = false;
			this._textArea.focus();
			this._map.fire('scrollvelocity', {vx: 0, vy: 0});
		}

		var aPos = this._latLngToTwips(e.target.getLatLng());

		if (this._selectionHandles.start === e.target) {
			this._postSelectTextEvent('start', aPos.x, aPos.y);
		}
		else if (this._selectionHandles.end === e.target) {
			this._postSelectTextEvent('end', aPos.x, aPos.y);
		}
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (this._graphicSelection && !this._isEmptyRectangle(this._graphicSelection)) {
			if (this._graphicMarker) {
				this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
				this._map.removeLayer(this._graphicMarker);
			}

			if (this._map._permission !== 'edit') {
				return;
			}

			this._graphicMarker = L.rectangle(this._graphicSelection, {fill: false});
			this._visibleCursor = this._visibleCursorOnLostFocus = this._graphicMarker;
			if (!this._graphicMarker) {
				this._map.fire('error', {msg: 'Graphic marker initialization', cmd: 'marker', kind: 'failed', id: 1});
				return;
			}

			this._graphicMarker.editing.enable();
			this._graphicMarker.on('editstart editend', this._onGraphicEdit, this);
			this._map.addLayer(this._graphicMarker);
		}
		else if (this._graphicMarker) {
			this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
			this._map.removeLayer(this._graphicMarker);
			this._graphicMarker.isDragged = false;
		}
	},

	_onUpdateCellCursor: function (horizontalDirection, verticalDirection) {
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			var mapBounds = this._map.getBounds();
			if (!mapBounds.contains(this._cellCursor)) {
				var spacingX = Math.abs((this._cellCursor.getEast() - this._cellCursor.getWest())) / 4.0;
				var spacingY = Math.abs((this._cellCursor.getSouth() - this._cellCursor.getNorth())) / 4.0;
				var scrollX = 0, scrollY = 0;
				if (horizontalDirection === -1 && this._cellCursor.getWest() < mapBounds.getWest()) {
					scrollX = this._cellCursor.getWest() - mapBounds.getWest() - spacingX;
				} else if (horizontalDirection === 1 && this._cellCursor.getEast() > mapBounds.getEast()) {
					scrollX = this._cellCursor.getEast() - mapBounds.getEast() + spacingX;
				}
				if (verticalDirection === 1 && this._cellCursor.getNorth() > mapBounds.getNorth()) {
					scrollY = this._cellCursor.getNorth() - mapBounds.getNorth() + spacingY;
				} else if (verticalDirection === -1 && this._cellCursor.getSouth() < mapBounds.getSouth()) {
					scrollY = this._cellCursor.getSouth() - mapBounds.getSouth() - spacingY;
				}

				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}

			if (this._cellCursorMarker) {
				this._map.removeLayer(this._cellCursorMarker);
			}
			this._cellCursorMarker = L.rectangle(this._cellCursor, {fill: false, color: '#000000', weight: 2});
			if (!this._cellCursorMarker) {
				this._map.fire('error', {msg: 'Cell Cursor marker initialization', cmd: 'cellCursor', kind: 'failed', id: 1});
				return;
			}
			this._map.addLayer(this._cellCursorMarker);
		}
		else if (this._cellCursorMarker) {
			this._map.removeLayer(this._cellCursorMarker);
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		var startMarker, endMarker;
		for (var key in this._selectionHandles) {
			if (key === 'start') {
				startMarker = this._selectionHandles[key];
			}
			else if (key === 'end') {
				endMarker = this._selectionHandles[key];
			}
		}

		if (this._selections.getLayers().length !== 0 || startMarker.isDragged || endMarker.isDragged) {
			if (!startMarker || !endMarker ||
					this._isEmptyRectangle(this._textSelectionStart) ||
					this._isEmptyRectangle(this._textSelectionEnd)) {
				return;
			}

			var startPos = this._map.project(this._textSelectionStart.getSouthWest());
			var endPos = this._map.project(this._textSelectionEnd.getSouthWest());
			var startMarkerPos = this._map.project(startMarker.getLatLng());
			if (startMarkerPos.distanceTo(endPos) < startMarkerPos.distanceTo(startPos) && startMarker._icon && endMarker._icon) {
				// if the start marker is actually closer to the end of the selection
				// reverse icons and markers
				L.DomUtil.removeClass(startMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.removeClass(endMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.addClass(startMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.addClass(endMarker._icon, 'leaflet-selection-marker-start');
				var tmp = startMarker;
				startMarker = endMarker;
				endMarker = tmp;
			}
			else if (startMarker._icon && endMarker._icon) {
				// normal markers and normal icons
				L.DomUtil.removeClass(startMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.removeClass(endMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.addClass(startMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.addClass(endMarker._icon, 'leaflet-selection-marker-end');
			}

			if (!startMarker.isDragged) {
				var pos = this._map.project(this._textSelectionStart.getSouthWest());
				pos = pos.subtract(new L.Point(0, 2));
				pos = this._map.unproject(pos);
				startMarker.setLatLng(pos);
				this._map.addLayer(startMarker);
			}

			if (!endMarker.isDragged) {
				pos = this._map.project(this._textSelectionEnd.getSouthEast());
				pos = pos.subtract(new L.Point(0, 2));
				pos = this._map.unproject(pos);
				endMarker.setLatLng(pos);
				this._map.addLayer(endMarker);
			}
		}
		else {
			this._textSelectionStart = null;
			this._textSelectionEnd = null;
			for (key in this._selectionHandles) {
				this._map.removeLayer(this._selectionHandles[key]);
				this._selectionHandles[key].isDragged = false;
			}
		}
	},

	_onCopy: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (this._selectionTextContent) {
			L.Compatibility.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
			this._map._socket.sendMessage('uno .uno:Copy');
		}
	},

	_onCut: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (this._selectionTextContent) {
			L.Compatibility.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
			this._map._socket.sendMessage('uno .uno:Cut');
		}
	},

	_onPaste: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		var pasteString = L.Compatibility.clipboardGet(e);
		if (pasteString) {
			if (pasteString === this._selectionTextHash) {
				// content of the clipboard did not change, we can do rich
				// paste
				this._map._socket.sendMessage('uno .uno:Paste');
			}
			else {
				this._map._socket.sendMessage('paste mimetype=text/plain;charset=utf-8\n' + pasteString);
			}
		}
	},

	_onDragOver: function (e) {
		e = e.originalEvent;
		e.preventDefault();
	},

	_onDrop: function (e) {
		// Move the cursor, so that the insert position is as close to the drop coordinates as possible.
		var latlng = e.latlng;
		var docLayer = this._map._docLayer;
		var mousePos = docLayer._latLngToTwips(latlng);
		var count = 1;
		var buttons = 1;
		var modifier = this._map.keyboard.modifier;
		this._postMouseEvent('buttondown', mousePos.x, mousePos.y, count, buttons, modifier);
		this._postMouseEvent('buttonup', mousePos.x, mousePos.y, count, buttons, modifier);

		e = e.originalEvent;
		e.preventDefault();

		// handle content
		var types = e.dataTransfer.types;
		var hasHTML = false;
		for (var t = 0; !hasHTML && t < types.length; t++) {
			if (types[t] === 'text/html') {
				hasHTML = true;
			}
		}

		var handled = false;
		for (t = 0; !handled && t < types.length; t++) {
			var type = types[t];
			if (type === 'text/html') {
				this._map._socket.sendMessage('paste mimetype=text/html\n' + e.dataTransfer.getData(type));
				handled = true;
			}
			else if (type === 'text/plain' && !hasHTML) {
				this._map._socket.sendMessage('paste mimetype=text/plain;charset=utf-8\n' + e.dataTransfer.getData(type));
				handled = true;
			}
			else if (type === 'Files') {
				var files = e.dataTransfer.files;
				for (var i = 0; i < files.length; ++i) {
					var file = files[i];
					if (file.type.match(/image.*/)) {
						var reader = new FileReader();
						reader.onload = this._onFileLoadFunc(file);
						reader.readAsArrayBuffer(file);
						handled = true;
					}
				}
			}
		}
	},

	_onFileLoadFunc: function(file) {
		var socket = this._map._socket;
		return function(e) {
			var blob = new Blob(['paste mimetype=' + file.type + '\n', e.target.result]);
			socket.sendMessage(blob);
		};
	},

	_onDragStart: function () {
		this._map.on('moveend', this._updateScrollOffset, this);
	},

	_onRequestLOKSession: function () {
		this._map._socket.sendMessage('requestloksession');
	},

	_fitWidthZoom: function (e, maxZoom) {
		var size = e ? e.newSize : this._map.getSize();
		var widthTwips = size.x * this._map.options.tileWidthTwips / this._tileSize;
		maxZoom = maxZoom ? maxZoom : this._map.options.zoom;

		// 'fit width zoom' has no use in spreadsheets, ignore it there
		if (this._docType !== 'spreadsheet') {
			var crsScale = this._map.options.crs.scale(1);
			if (this._docWidthTwips > 0)
			{
				var ratio = widthTwips / this._docWidthTwips;
				var zoom = this._map.options.zoom + Math.floor(Math.log(ratio) / Math.log(crsScale));

				zoom = Math.max(1, zoom);
				zoom = Math.min(maxZoom, zoom);
				this._map.setZoom(zoom, {animate: false});
			}
		}
	},

	_onCurrentPageUpdate: function () {
		var mapCenter = this._map.project(this._map.getCenter());
		if (!this._partPageRectanglesPixels || !(this._currentPage >= 0) || this._currentPage >= this._partPageRectanglesPixels.length ||
				this._partPageRectanglesPixels[this._currentPage].contains(mapCenter)) {
			// page number has not changed
			return;
		}
		for (var i = 0; i < this._partPageRectanglesPixels.length; i++) {
			if (this._partPageRectanglesPixels[i].contains(mapCenter)) {
				this._currentPage = i;
				this._map.fire('pagenumberchanged', {
					currentPage: this._currentPage,
					pages: this._pages,
					docType: this._docType
				});
				return;
			}
		}
	},

	_onUpdatePartPageRectangles: function () {
		if (this._partPageRectanglesPixels.length > 0) {
			this._partPageRectanglesPixels = [];
			for (var i = 0; i < this._partPageRectanglesTwips.length; i++) {
				var pageBounds = new L.Bounds(
						this._twipsToPixels(this._partPageRectanglesTwips[i].min),
						this._twipsToPixels(this._partPageRectanglesTwips[i].max));
				this._partPageRectanglesPixels.push(pageBounds);
			}
			this._map.fire('partpagerectangles', {
				pixelRectangles: this._partPageRectanglesPixels,
				twipsRectangles: this._partPageRectanglesTwips
			});
		}
	},

	// Cells can change position during changes of zoom level in calc
	// hence we need to request an updated cell cursor position for this level.
	_onCellCursorShift: function (force) {
		if (this._cellCursorMarker || force) {
			this._map._socket.sendMessage('commandvalues command=.uno:CellCursor'
			                     + '?outputHeight=' + this._tileSize
			                     + '&outputWidth=' + this._tileSize
			                     + '&tileHeight=' + this._tileWidthTwips
			                     + '&tileWidth=' + this._tileHeightTwips);
		}
	},

	_onEditLock: function (textMsg) {
		// if we have explicitly set this as readonly,
		// then never listen server for editlock
		if (this._map._permission === 'readonly') {
			return;
		}

		var perm = parseInt(textMsg.split(' ')[1]) === 1 ? 'edit' : 'view';
		if (perm !== this._map._permission) {
			this._map.setPermission(perm);
		}
	},

	_invalidatePreviews: function () {
		if (this._map._docPreviews && this._previewInvalidations.length > 0) {
			var toInvalidate = {};
			for (var i = 0; i < this._previewInvalidations.length; i++) {
				var invalidBounds = this._previewInvalidations[i];
				for (var key in this._map._docPreviews) {
					// find preview tiles that need to be updated and add them in a set
					var preview = this._map._docPreviews[key];
					if (preview.index >= 0 && this._docType === 'text') {
						// we have a preview for a page
						if (this._partPageRectanglesTwips.length > preview.index &&
								invalidBounds.intersects(this._partPageRectanglesTwips[preview.index])) {
							toInvalidate[key] = true;
						}
					}
					else if (preview.index >= 0) {
						// we have a preview for a part
						if (preview.index === this._selectedPart ||
								(preview.index === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}
					}
					else {
						// we have a custom preview
						var bounds = new L.Bounds(
								new L.Point(preview.tilePosX, preview.tilePosY),
								new L.Point(preview.tilePosX + preview.tileWidth, preview.tilePosY + preview.tileHeight));
						if ((preview.part === this._selectedPart ||
								(preview.part === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) &&
								invalidBounds.intersects(bounds)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}

					}
				}

			}

			for (key in toInvalidate) {
				// update invalid preview tiles
				preview = this._map._docPreviews[key];
				if (preview.autoUpdate) {
					if (preview.index >= 0) {
						this._map.getPreview(preview.id, preview.index, preview.maxWidth, preview.maxHeight, {autoUpdate: true});
					}
					else {
						this._map.getCustomPreview(preview.id, preview.part, preview.width, preview.height, preview.tilePosX,
								preview.tilePosY, preview.tileWidth, preview.tileHeight, {autoUpdate: true});
					}
				}
				else {
					this._map.fire('invalidatepreview', {id: preview.id});
				}
			}
		}
		this._previewInvalidations = [];
	},

	_updateClientZoom: function () {
		this._clientZoom = 'tilepixelwidth=' + this._tileSize + ' ' +
			'tilepixelheight=' + this._tileSize + ' ' +
			'tiletwipwidth=' + this._tileWidthTwips + ' ' +
			'tiletwipheight=' + this._tileHeightTwips;
	},

	_invalidateClientVisibleArea: function() {
		this._clientVisibleArea = true;
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
