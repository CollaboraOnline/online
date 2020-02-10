/* -*- js-indent-level: 8 -*- */
/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */
/* global $ _ Uint8ClampedArray Uint8Array */
// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

/*eslint no-extend-native:0*/
if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}

function hex2string(inData)
{
	var hexified = [];
	var data = new Uint8Array(inData);
	for (var i = 0; i < data.length; i++) {
		var hex = data[i].toString(16);
		var paddedHex = ('00' + hex).slice(-2);
		hexified.push(paddedHex);
	}
	return hexified.join('');
}

L.Compatibility = {
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
		detectRetina: true,
		crossOrigin: false,
		previewInvalidationTimeout: 1000,
		marginX: 10,
		marginY: 10
	},

	initialize: function (url, options) {

		this._url = url;

		options = L.setOptions(this, options);

		this._tileWidthPx = options.tileSize;
		this._tileHeightPx = options.tileSize;

		// detecting retina displays, adjusting tileWidthPx, tileHeightPx and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
			this._tileWidthPx *= 2;
			this._tileHeightPx *= 2;
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
		// Do we have focus - ie. should we render a cursor
		this._isFocused = true;
		// Last cursor position for invalidation
		this.lastCursorPos = this._visibleCursor.getNorthWest();
		// Are we zooming currently ? - if so, no cursor.
		this._isZooming = false;
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._isCursorVisible = true;
		// Original rectangle graphic selection in twips
		this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Rotation angle of selected graphic object
		this._graphicSelectionAngle = 0;
		// Original rectangle of cell cursor in twips
		this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle for cell cursor
		this._cellCursor =  L.LatLngBounds.createDefault();
		this._prevCellCursor = L.LatLngBounds.createDefault();
		this._cellCursorOnPgUp = null;
		this._cellCursorOnPgDn = null;

		// Position and size of the selection start (as if there would be a cursor caret there).

		// View cursors with viewId to 'cursor info' mapping
		// Eg: 1: {rectangle: 'x, y, w, h', visible: false}
		this._viewCursors = {};

		// View cell cursors with viewId to 'cursor info' mapping.
		this._cellViewCursors = {};

		// View selection of other views
		this._viewSelections = {};

		// Graphic view selection rectangles
		this._graphicViewMarkers = {};

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

		this._dropDownButton = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-drop-down-marker',
				iconSize: null
			}),
			interactive: false
		});

		this._emptyTilesCount = 0;
		this._msgQueue = [];
		this._toolbarCommandValues = {};
		this._previewInvalidations = [];

		this._followThis = -1;
		this._editorId = -1;
		this._followUser = false;
		this._followEditor = false;
	},

	onAdd: function (map) {
		this._initContainer();
		this._getToolbarCommandsValues();
		this._selections = new L.LayerGroup();
		if (this.options.permission !== 'readonly') {
			map.addLayer(this._selections);
		}

		// This layergroup contains all the layers corresponding to other's view
		this._viewLayerGroup = new L.LayerGroup();
		if (this.options.permission !== 'readonly') {
			map.addLayer(this._viewLayerGroup);
		}

		this._debug = map.options.debug;
		if (this._debug) {
			this._debugInit();
		}

		this._searchResultsLayer = new L.LayerGroup();
		map.addLayer(this._searchResultsLayer);

		this._levels = {};
		this._tiles = {};
		this._tileCache = {};
		this._map._socket.sendMessage('commandvalues command=.uno:LanguageStatus');
		this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
		var that = this;
		$.contextMenu({
			selector: '.loleaflet-annotation-menu',
			trigger: 'none',
			className: 'loleaflet-font',
			items: {
				modify: {
					name: _('Modify'),
					callback: function (key, options) {
						that.onAnnotationModify.call(that, options.$trigger.get(0).annotation);
					}
				},
				reply: (this._docType !== 'text' && this._docType !== 'presentation') ? undefined : {
					name: _('Reply'),
					callback: function (key, options) {
						that.onAnnotationReply.call(that, options.$trigger.get(0).annotation);
					}
				},
				remove: {
					name: _('Remove'),
					callback: function (key, options) {
						that.onAnnotationRemove.call(that, options.$trigger.get(0).annotation._data.id);
					}
				}
			},
			events: {
				show: function (options) {
					options.$trigger.get(0).annotation._contextMenu = true;
				},
				hide: function (options) {
					options.$trigger.get(0).annotation._contextMenu = false;
				}
			}
		});
		$.contextMenu({
			selector: '.loleaflet-annotation-menu-redline',
			trigger: 'none',
			className: 'loleaflet-font',
			items: {
				modify: {
					name: _('Comment'),
					callback: function (key, options) {
						that.onAnnotationModify.call(that, options.$trigger.get(0).annotation);
					}
				}
			},
			events: {
				show: function (options) {
					options.$trigger.get(0).annotation._contextMenu = true;
				},
				hide: function (options) {
					options.$trigger.get(0).annotation._contextMenu = false;
				}
			}
		});
		this._map._socket.sendMessage('commandvalues command=.uno:AcceptTrackedChanges');

		map._fadeAnimated = false;
		this._viewReset();
		map.on('drag resize zoomend', this._updateScrollOffset, this);

		map.on('copy', this._onCopy, this);
		map.on('cut', this._onCut, this);
		map.on('paste', this._onPaste, this);
		map.on('dragover', this._onDragOver, this);
		map.on('drop', this._onDrop, this);

		map.on('zoomstart', this._onZoomStart, this);
		map.on('zoomend', this._onZoomEnd, this);
		if (this._docType === 'spreadsheet') {
			map.on('zoomend', this._onCellCursorShift, this);
		}
		map.on('zoomend', L.bind(this.eachView, this, this._viewCursors, this._onUpdateViewCursor, this, false));
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
			if (e.perm !== 'edit') {
				this._clearSelections();
			}
		}, this);

		for (var key in this._selectionHandles) {
			this._selectionHandles[key].on('drag dragend', this._onSelectionHandleDrag, this);
		}

		map.setPermission(this.options.permission);

		map.fire('statusindicator', {statusType: 'loleafletloaded'});
	},

	clearAnnotations: function() {
		console.debug('Implemented in child  classes');
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

	registerExportFormat: function(label, format) {
		if (!this._exportFormats) {
			this._exportFormats = [];
		}

		var duplicate = false;
		for (var i = 0; i < this._exportFormats.length; i++) {
			if (this._exportFormats[i].label == label && this._exportFormats[i].format == format) {
				duplicate = true;
				break;
			}
		}

		if (duplicate == false) {
			this._exportFormats.push({label: label, format: format});
		}
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
		else if (textMsg.startsWith('shapeselectioncontent:')) {
			this._onShapeSelectionContent(textMsg);
		}
		else if (textMsg.startsWith('graphicselection:')) {
			this._onGraphicSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('cellcursor:')) {
			this._onCellCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('celladdress:')) {
			this._onCellAddressMsg(textMsg);
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
		else if (textMsg.startsWith('invalidatetiles:')) {
			var payload = textMsg.substring('invalidatetiles:'.length + 1);
			if (!payload.startsWith('EMPTY')) {
				this._onInvalidateTilesMsg(textMsg);
			}
			else {
				var msg = 'invalidatetiles: ';
				if (this._docType === 'text') {
					msg += 'part=0 ';
				} else {
					var partNumber = parseInt(payload.substring('EMPTY'.length + 1));
					msg += 'part=' + (isNaN(partNumber) ? this._selectedPart : partNumber) + ' ';
				}
				msg += 'x=0 y=0 ';
				msg += 'width=' + this._docWidthTwips + ' ';
				msg += 'height=' + this._docHeightTwips;
				this._onInvalidateTilesMsg(msg);
			}
		}
		else if (textMsg.startsWith('mousepointer:')) {
			this._onMousePointerMsg(textMsg);
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
		else if (textMsg.startsWith('status:') || textMsg.startsWith('statusupdate:')) {
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
		else if (textMsg.startsWith('windowpaint:')) {
			this._onDialogPaintMsg(textMsg, img);
		}
		else if (textMsg.startsWith('window:')) {
			this._onDialogMsg(textMsg);
		}
		else if (textMsg.startsWith('unocommandresult:')) {
			this._onUnoCommandResultMsg(textMsg);
		}
		else if (textMsg.startsWith('rulerupdate:')) {
			this._onRulerUpdate(textMsg);
		}
		else if (textMsg.startsWith('contextmenu:')) {
			this._onContextMenuMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidateviewcursor:')) {
			this._onInvalidateViewCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('viewcursorvisible:')) {
			this._onViewCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('cellviewcursor:')) {
			this._onCellViewCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('viewinfo:')) {
			this._onViewInfoMsg(textMsg);
		}
		else if (textMsg.startsWith('textviewselection:')) {
			this._onTextViewSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('graphicviewselection:')) {
			this._onGraphicViewSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('editor:')) {
			this._updateEditor(textMsg);
		}
		else if (textMsg.startsWith('validitylistbutton:')) {
			this._onValidityListButtonMsg(textMsg);
		}
		else if (textMsg.startsWith('signaturestatus:')) {
			var signstatus = textMsg.substring('signaturestatus:'.length + 1);
			this._map.onChangeSignStatus(signstatus);
		}
		else if (textMsg.startsWith('signeddocumentuploadstatus:')) {
			var status = textMsg.substring('signeddocumentuploadstatus:'.length + 1);
			this._map.onVereignUploadStatus(status);
		}
		else if (textMsg.startsWith('removesession')) {
			var viewId = parseInt(textMsg.substring('removesession'.length + 1));
			if (this._map._docLayer._viewId === viewId) {
				this._map.fire('postMessage', {msgId: 'close', args: {EverModified: this._map._everModified, Deprecated: true}});
				this._map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: this._map._everModified}});
				this._map.remove();
			}
		}
	},

	toggleTileDebugModeImpl: function() {
		this._debug = !this._debug;
		if (!this._debug) {
			this._map.removeLayer(this._debugInfo);
			this._map.removeLayer(this._debugInfo2);
			$('.leaflet-control-layers-expanded').css('display', 'none');
		} else {
			if (this._debugInfo) {
				this._map.addLayer(this._debugInfo);
				this._map.addLayer(this._debugInfo2);
				$('.leaflet-control-layers-expanded').css('display', 'block');
			}
			this._debugInit();
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		var jsonIdx = textMsg.indexOf('{');
		if (jsonIdx === -1) {
			return;
		}
		var obj = JSON.parse(textMsg.substring(jsonIdx));
		if (obj.commandName === '.uno:DocumentRepair') {
			this._onDocumentRepair(obj);
		}
		else if (obj.commandName === '.uno:CellCursor') {
			this._onCellCursorMsg(obj.commandValues);
		}
		else if (this._map.unoToolbarCommands.indexOf(obj.commandName) !== -1) {
			this._toolbarCommandValues[obj.commandName] = obj.commandValues;
			this._map.fire('updatetoolbarcommandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
		else {
			this._map.fire('commandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
	},

	_onCellAddressMsg: function (textMsg) {
		var address = textMsg.substring(13);
		this._map.fire('celladdress', {address: address});
	},

	_onCellFormulaMsg: function (textMsg) {
		var formula = textMsg.substring(13);
		if (!this._map['wopi'].DisableCopy) {
			this._selectionTextContent = formula;
		}
		this._map.fire('cellformula', {formula: formula});
	},

	_onCursorVisibleMsg: function(textMsg) {
		var command = textMsg.match('cursorvisible: true');
		this._isCursorVisible = command ? true : false;
		this._onUpdateCursor();
	},

	_onDownloadAsMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		var parser = document.createElement('a');
		parser.href = this._map.options.server;

		var wopiSrc = '';
		if (this._map.options.wopiSrc != '') {
			wopiSrc = '?WOPISrc=' + this._map.options.wopiSrc;
		}
		var url = this._map.options.webserver + this._map.options.serviceRoot + '/' + this._map.options.urlPrefix + '/' +
		    encodeURIComponent(this._map.options.doc) + '/' + command.jail + '/' + command.dir + '/' + command.name + wopiSrc;

		this._map.hideBusy();
		if (command.id === 'print') {
			if (L.Browser.gecko || L.Browser.edge || this._map.options.print === false) {
				// the print dialog doesn't work well on firefox
				// due to a pdf.js issue - https://github.com/mozilla/pdf.js/issues/5397
				// open the pdf file in a new tab so that that user can print it directly in the browser's
				// pdf viewer
				var param = wopiSrc !== '' ? '&' : '?';
				param += 'attachment=0';
				window.open(url + param, '_blank');
			}
			else {
				this._map.fire('filedownloadready', {url: url});
			}
		}
		else if (command.id === 'slideshow') {
			this._map.fire('slidedownloadready', {url: url});
		}
		else if (command.id === 'export') {
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

	_isGraphicAngleDivisibleBy90: function() {
		return (this._graphicSelectionAngle % 9000 === 0);
	},

	_onShapeSelectionContent: function (textMsg) {
		textMsg = textMsg.substring('shapeselectioncontent:'.length + 1);
		if (this._graphicMarker) {
			this._graphicMarker.removeEmbeddedSVG();
			this._graphicMarker.addEmbeddedSVG(textMsg);
		}
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
			this._graphicSelectionAngle = (strTwips.length === 5) ? parseInt(strTwips[4]) : 0;
			// Workaround for tdf#123874. For some reason the handling of the
			// shapeselectioncontent messages that we get back causes the WebKit process
			// to crash on iOS.
			if (!window.ThisIsTheiOSApp) {
				this._map._socket.sendMessage('rendershapeselection mimetype=image/svg+xml');
			}
		}

		this._onUpdateGraphicSelection();
	},

	_onGraphicViewSelectionMsg: function (textMsg) {
		textMsg = textMsg.substring('graphicviewselection:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.selection.match(/\d+/g);
		this._graphicViewMarkers[viewId] = this._graphicViewMarkers[viewId] || {};
		this._graphicViewMarkers[viewId].part = parseInt(obj.part);
		if (strTwips != null) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._graphicViewMarkers[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._graphicViewMarkers[viewId].bounds = L.LatLngBounds.createDefault();
		}

		this._onUpdateGraphicViewSelection(viewId);
	},

	_onCellCursorMsg: function (textMsg) {
		if (!this._cellCursor) {
			this._cellCursor = L.LatLngBounds.createDefault();
		}
		if (!this._prevCellCursor) {
			this._prevCellCursor = L.LatLngBounds.createDefault();
		}
		if (!this._cellCursorXY) {
			this._cellCursorXY = new L.Point(-1, -1);
		}
		if (!this._prevCellCursorXY) {
			this._prevCellCursorXY = new L.Point(-1, -1);
		}

		if (textMsg.match('EMPTY')) {
			this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._cellCursor = L.LatLngBounds.createDefault();
			this._cellCursorXY = new L.Point(-1, -1);
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
			this._cellCursorXY = new L.Point(parseInt(strTwips[4]), parseInt(strTwips[5]));
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

		var onPgUpDn = false;
		if (!this._isEmptyRectangle(this._cellCursor) && !this._prevCellCursor.equals(this._cellCursor)) {
			if ((this._cellCursorOnPgUp && this._cellCursorOnPgUp.equals(this._prevCellCursor)) ||
				(this._cellCursorOnPgDn && this._cellCursorOnPgDn.equals(this._prevCellCursor))) {
				onPgUpDn = true;
			}
			this._prevCellCursor = new L.LatLngBounds(this._cellCursor.getSouthWest(), this._cellCursor.getNorthEast());
		}

		this._onUpdateCellCursor(horizontalDirection, verticalDirection, onPgUpDn);
	},

	_onDocumentRepair: function (textMsg) {
		if (!this._docRepair) {
			this._docRepair = L.control.documentRepair();
		}

		if (!this._docRepair.isVisible()) {
			this._docRepair.addTo(this._map);
			this._docRepair.fillActions(textMsg);
			this._map.enable(false);
			this._docRepair.show();
		}
	},

	_onSpecialChar: function(fontList, selectedIndex) {
		if (!this._specialChar) {
			this._specialChar = L.control.characterMap();
		}
		if (!this._specialChar.isVisible()) {
			this._specialChar.addTo(this._map);
			this._specialChar.fillFontNames(fontList, selectedIndex);
			this._map.enable(false);
			this._specialChar.show();
		}
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
		var docLayer = this._map._docLayer;
		textMsg = textMsg.substring('invalidatecursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var modifierViewId = parseInt(obj.viewId);
		var strTwips = obj.rectangle.match(/\d+/g);
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);
		this._visibleCursor = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		var cursorPos = this._visibleCursor.getNorthWest();
		if ((docLayer._followEditor || docLayer._followUser) && this._map.lastActionByUser) {
			this._map._setFollowing(false, null);
		}
		this._map.lastActionByUser = false;
		if (!this._map._isFocused && this._map._permission === 'edit') {
			// Regain cursor if we had been out of focus and now have input.
			this._map.fire('editorgotfocus');
		}

		//first time document open, set last cursor position
		if (this.lastCursorPos.lat === 0 && this.lastCursorPos.lng === 0)
			this.lastCursorPos = cursorPos;
		
		var updateCursor = false;
		if ((this.lastCursorPos.lat !== cursorPos.lat) || (this.lastCursorPos.lng !== cursorPos.lng)) {
			updateCursor = true;
			this.lastCursorPos = cursorPos;
		}

		this._onUpdateCursor(updateCursor && (modifierViewId === this._viewId));
	},

	_updateEditor: function(textMsg) {
		textMsg = textMsg.substring('editor:'.length + 1);
		var editorId = parseInt(textMsg);
		var docLayer = this._map._docLayer;

		docLayer._editorId = editorId;

		if (docLayer._followEditor) {
			docLayer._followThis = editorId;
		}

		if (this._map._viewInfo[editorId])
			this._map.fire('updateEditorName', {username: this._map._viewInfo[editorId].username})
	},

	_onInvalidateViewCursorMsg: function (textMsg) {
		textMsg = textMsg.substring('invalidateviewcursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);
		var docLayer = this._map._docLayer;

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.rectangle.match(/\d+/g);
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);

		this._viewCursors[viewId] = this._viewCursors[viewId] || {};
		this._viewCursors[viewId].bounds = new L.LatLngBounds(
			this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
			this._twipsToLatLng(bottomRightTwips, this._map.getZoom())),
		this._viewCursors[viewId].part = parseInt(obj.part);

		// FIXME. Server not sending view visible cursor
		if (typeof this._viewCursors[viewId].visible === 'undefined') {
			this._viewCursors[viewId].visible = true;
		}

		this._onUpdateViewCursor(viewId);

		if (docLayer._followThis === viewId && (docLayer._followEditor || docLayer._followUser)) {
			if (this._map.getDocType() === 'text' || this._map.getDocType() === 'presentation') {
				this.goToViewCursor(viewId);
			}
			else if (this._map.getDocType() === 'spreadsheet') {
				this.goToCellViewCursor(viewId);
			}
		}
	},

	_onCellViewCursorMsg: function (textMsg) {
		textMsg = textMsg.substring('cellviewcursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours
		if (viewId === this._viewId) {
			return;
		}

		this._cellViewCursors[viewId] = this._cellViewCursors[viewId] || {};
		if (!this._cellViewCursors[viewId].bounds) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
		}
		if (obj.rectangle.match('EMPTY')) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
		}
		else {
			var strTwips = obj.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellViewCursors[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		this._cellViewCursors[viewId].part = parseInt(obj.part);
		this._onUpdateCellViewCursor(viewId);
	},

	_onUpdateCellViewCursor: function (viewId) {
		if (!this._cellViewCursors[viewId] || !this._cellViewCursors[viewId].bounds)
			return;

		var cellViewCursorMarker = this._cellViewCursors[viewId].marker;
		var viewPart = this._cellViewCursors[viewId].part;

		if (!this._isEmptyRectangle(this._cellViewCursors[viewId].bounds) && this._selectedPart === viewPart) {
			if (!cellViewCursorMarker) {
				var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				cellViewCursorMarker = L.rectangle(this._cellViewCursors[viewId].bounds, {fill: false, color: backgroundColor, weight: 2});
				this._cellViewCursors[viewId].marker = cellViewCursorMarker;
				cellViewCursorMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
			}
			else {
				cellViewCursorMarker.setBounds(this._cellViewCursors[viewId].bounds);
			}
			this._viewLayerGroup.addLayer(cellViewCursorMarker);
		}
		else if (cellViewCursorMarker) {
			this._viewLayerGroup.removeLayer(cellViewCursorMarker);
		}
	},

	goToCellViewCursor: function(viewId) {
		if (this._cellViewCursors[viewId] && !this._isEmptyRectangle(this._cellViewCursors[viewId].bounds)) {
			if (!this._map.getBounds().contains(this._cellViewCursors[viewId].bounds)) {
				var mapBounds = this._map.getBounds();
				var scrollX = 0;
				var scrollY = 0;
				var spacingX = Math.abs(this._cellViewCursors[viewId].bounds.getEast() - this._cellViewCursors[viewId].bounds.getWest()) / 4.0;
				var spacingY = Math.abs(this._cellViewCursors[viewId].bounds.getSouth() - this._cellViewCursors[viewId].bounds.getNorth()) / 4.0;
				if (this._cellViewCursors[viewId].bounds.getWest() < mapBounds.getWest()) {
					scrollX = this._cellViewCursors[viewId].bounds.getWest() - mapBounds.getWest() - spacingX;
				} else if (this._cellViewCursors[viewId].bounds.getEast() > mapBounds.getEast()) {
					scrollX = this._cellViewCursors[viewId].bounds.getEast() - mapBounds.getEast() + spacingX;
				}

				if (this._cellViewCursors[viewId].bounds.getNorth() > mapBounds.getNorth()) {
					scrollY = this._cellViewCursors[viewId].bounds.getNorth() - mapBounds.getNorth() + spacingY;
				} else if (this._cellViewCursors[viewId].bounds.getSouth() < mapBounds.getSouth()) {
					scrollY = this._cellViewCursors[viewId].bounds.getSouth() - mapBounds.getSouth() - spacingY;
				}

				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lat += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}

			var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
			this._cellViewCursors[viewId].marker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
		}
	},

	_onViewCursorVisibleMsg: function(textMsg) {
		textMsg = textMsg.substring('viewcursorvisible:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = (obj.visible === 'true');
		}

		this._onUpdateViewCursor(viewId);
	},

	_addView: function(viewInfo) {
		if (viewInfo.color === 0 && this._map.getDocType() !== 'text') {
			viewInfo.color = L.LOUtil.getViewIdColor(viewInfo.id);
		}

		this._map.addView(viewInfo);

		//TODO: We can initialize color and other properties here.
		if (typeof this._viewCursors[viewInfo.id] !== 'undefined') {
			this._viewCursors[viewInfo.id] = {};
		}

		this._onUpdateViewCursor(viewInfo.id);
	},

	_removeView: function(viewId) {
		// Remove selection, if any.
		if (this._viewSelections[viewId] && this._viewSelections[viewId].selection) {
			this._viewLayerGroup.removeLayer(this._viewSelections[viewId].selection);
		}

		// Remove the view and update (to refresh as needed).
		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = false;
			this._onUpdateViewCursor(viewId);
			delete this._viewCursors[viewId];
		}

		this._map.removeView(viewId);
	},

	removeAllViews: function() {
		for (var viewInfoIdx in this._map._viewInfo) {
			this._removeView(parseInt(viewInfoIdx));
		}
	},

	_onViewInfoMsg: function(textMsg) {
		textMsg = textMsg.substring('viewinfo: '.length);
		var viewInfo = JSON.parse(textMsg);
		this._map.fire('viewinfo', viewInfo);

		// A new view
		var viewIds = [];
		for (var viewInfoIdx in viewInfo) {
			if (!(parseInt(viewInfo[viewInfoIdx].id) in this._map._viewInfo)) {
				this._addView(viewInfo[viewInfoIdx]);
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

	_onRenderFontMsg: function (textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);
		this._map.fire('renderfont', {
			font: command.font,
			char: command.char,
			img: img
		});
	},

	_onSearchNotFoundMsg: function (textMsg) {
		this._clearSearchResults();
		this._searchRequested = false;
		var originalPhrase = textMsg.substring(16);
		this._map.fire('search', {originalPhrase: originalPhrase, count: 0});
	},

	_onSearchResultSelection: function (textMsg) {
		this._searchRequested = false;
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
		} else if (count === 1) {
			this._lastSearchResult = results[0];
		}
		this._searchTerm = originalPhrase;
		this._map.fire('search', {originalPhrase: originalPhrase, count: count, highlightAll: highlightAll, results: results});
	},

	_clearSearchResults: function() {
		this._lastSearchResult = null;
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
				var selection = new L.Polygon(polygons, {
					pointerEvents: 'none',
					fillColor: _fillColor,
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25});
				this._searchResultsLayer.addLayer(selection);
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
		// console.log('_onUnoCommandResultMsg: "' + textMsg + '"');
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
		this._map.fire('commandresult', {commandName: commandName, success: success, result: obj.result});

		if (this._map.CallPythonScriptSource != null) {
			this._map.CallPythonScriptSource.postMessage(JSON.stringify({'MessageId': 'CallPythonScript-Result',
										     'SendTime': Date.now(),
										     'Values': obj
										    }),
								     '*');
			this._map.CallPythonScriptSource = null;
		}
	},

	_onRulerUpdate: function (textMsg) {
		textMsg = textMsg.substring(13);
		var obj = JSON.parse(textMsg);

		this._map.fire('rulerupdate', obj);
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
			for (var i = 0; i < strTwips.length; i += 4) {
				var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
				var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
				var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
				var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
				var bottomRightTwips = topLeftTwips.add(offset);
				rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
			}

			var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
			var selection = new L.Polygon(polygons, {
				pointerEvents: 'none',
				fillColor: '#43ACE8',
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25});
			this._selections.addLayer(selection);
			if (this._selectionContentRequest) {
				clearTimeout(this._selectionContentRequest);
			}
			this._selectionContentRequest = setTimeout(L.bind(function () {
				this._map._socket.sendMessage('gettextselection mimetype=text/plain;charset=utf-8');}, this), 100);
		}
		this._onUpdateTextSelection();
	},

	_onTextViewSelectionMsg: function (textMsg) {
		textMsg = textMsg.substring('textviewselection:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);
		var viewPart = parseInt(obj.part);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.selection.match(/\d+/g);
		this._viewSelections[viewId] = this._viewSelections[viewId] || {};
		if (strTwips != null) {
			var rectangles = [];
			for (var i = 0; i < strTwips.length; i += 4) {
				var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
				var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
				var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
				var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
				var bottomRightTwips = topLeftTwips.add(offset);
				rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
			}

			this._viewSelections[viewId].part = viewPart;
			this._viewSelections[viewId].polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
		} else {
			this._viewSelections[viewId].polygons = null;
		}

		this._onUpdateTextViewSelection(viewId);
	},

	_onTextSelectionContentMsg: function (textMsg) {
		this._selectionTextContent = textMsg.substr(22);
	},

	_updateScrollOnCellSelection: function (oldSelection, newSelection) {
		if (this._map._docLayer._docType === 'spreadsheet' && oldSelection) {
			var mapBounds = this._map.getBounds();
			if (!mapBounds.contains(newSelection) && !newSelection.equals(oldSelection)) {
				var spacingX = Math.abs(this._cellCursor.getEast() - this._cellCursor.getWest()) / 4.0;
				var spacingY = Math.abs((this._cellCursor.getSouth() - this._cellCursor.getNorth())) / 2.0;

				var scrollX = 0, scrollY = 0;
				if (newSelection.getEast() > mapBounds.getEast() && newSelection.getEast() > oldSelection.getEast())
					scrollX = newSelection.getEast() - mapBounds.getEast() + spacingX;
				else if (newSelection.getWest() < mapBounds.getWest() && newSelection.getWest() < oldSelection.getWest())
					scrollX = newSelection.getWest() - mapBounds.getWest() - spacingX;
				if (newSelection.getNorth() > mapBounds.getNorth() && newSelection.getNorth() > oldSelection.getNorth())
					scrollY = newSelection.getNorth() - mapBounds.getNorth() + spacingY;
				else if (newSelection.getSouth() < mapBounds.getSouth() && newSelection.getSouth() < oldSelection.getSouth())
					scrollY = newSelection.getSouth() - mapBounds.getSouth() - spacingY;
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
		}
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map._permission === 'edit') {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);

			var oldSelection = this._textSelectionEnd;
			this._textSelectionEnd = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));

			this._updateScrollOnCellSelection(oldSelection, this._textSelectionEnd);
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
			var oldSelection = this._textSelectionStart;
			this._textSelectionStart = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));

			this._updateScrollOnCellSelection(oldSelection, this._textSelectionStart);
		}
		else {
			this._textSelectionStart = null;
		}
	},

	_onDialogPaintMsg: function(textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);

		this._map.fire('windowpaint', {
			id: command.id,
			img: img,
			width: command.width,
			height: command.height,
			rectangle: command.rectangle
		});
	},

	_onDialogMsg: function(textMsg) {
		textMsg = textMsg.substring('window: '.length);
		var dialogMsg = JSON.parse(textMsg);
		// e.type refers to signal type
		dialogMsg.winType = dialogMsg.type;
		this._map.fire('window', dialogMsg);
	},

	_onTileMsg: function (textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);
		var coords = this._twipsToCoords(command);
		coords.z = command.zoom;
		coords.part = command.part;
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];
		if (this._debug && tile) {
			if (tile._debugLoadCount) {
				tile._debugLoadCount++;
				this._debugLoadCount++;
			} else {
				tile._debugLoadCount = 1;
				tile._debugInvalidateCount = 1;
			}
			if (!tile._debugPopup) {
				var tileBound = this._keyToBounds(key);
				tile._debugPopup = L.popup({className: 'debug', offset: new L.Point(0, 0), autoPan: false, closeButton: false, closeOnClick: false})
						.setLatLng(new L.LatLng(tileBound.getSouth(), tileBound.getWest() + (tileBound.getEast() - tileBound.getWest())/5));
				this._debugInfo.addLayer(tile._debugPopup);
				if (this._debugTiles[key]) {
					this._debugInfo.removeLayer(this._debugTiles[key]);
				}
				tile._debugTile = L.rectangle(tileBound, {color: 'blue', weight: 1, fillOpacity: 0, pointerEvents: 'none'});
				this._debugTiles[key] = tile._debugTile;
				tile._debugTime = this._debugGetTimeArray();
				this._debugInfo.addLayer(tile._debugTile);
			}
			if (tile._debugTime.date === 0)  {
				tile._debugPopup.setContent('requested: ' + this._tiles[key]._debugInvalidateCount + '<br>received: ' + this._tiles[key]._debugLoadCount);
			} else {
				tile._debugPopup.setContent('requested: ' + this._tiles[key]._debugInvalidateCount + '<br>received: ' + this._tiles[key]._debugLoadCount +
						'<br>' + this._debugSetTimes(tile._debugTime, +new Date() - tile._debugTime.date).replace(/, /g, '<br>'));
			}
			if (tile._debugTile) {
				tile._debugTile.setStyle({fillOpacity: (command.renderid === 'cached') ? 0.1 : 0, fillColor: 'yellow' });
			}
			this._debugShowTileData();
		}
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
		else if (tile && typeof(img) == 'object') {
			// 'Uint8Array' delta
			var canvas = document.createElement('canvas');
			canvas.width = window.tileSize;
			canvas.height = window.tileSize;
			var ctx = canvas.getContext('2d');

			var oldImg = new Image();
			oldImg.src = tile.el.src;
			ctx.drawImage(oldImg, 0, 0);

			// FIXME; can we operate directly on the image ?
			var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			var oldData = new Uint8ClampedArray(imgData.data);

			var delta = img;
			var pixSize = canvas.width * canvas.height * 4;
			var offset = 0;

			console.log('Applying a delta of length ' + delta.length + ' pix size: ' + pixSize + '\nhex: ' + hex2string(delta));

			// Green-tinge the old-Data ...
//			for (var i = 0; i < pixSize; ++i)
//			{
//				oldData[i*4 + 1] = 128;
//			}

			// wipe to grey.
//			for (var i = 0; i < pixSize * 4; ++i)
//			{
//				imgData.data[i] = 128;
//			}

			// Apply delta.
			for (var i = 1; i < delta.length;)
			{
				switch (delta[i])
				{
				case 99: // 'c': // copy row
					var count = delta[i+1];
					var srcRow = delta[i+2];
					var destRow = delta[i+3];
					i+= 4;
					console.log('copy ' + count + ' row(s) ' + srcRow + ' to ' + destRow);
					for (var cnt = 0; cnt < count; ++cnt)
					{
						var src = (srcRow + cnt) * canvas.width * 4;
						var dest = (destRow + cnt) * canvas.width * 4;
						for (var j = 0; j < canvas.width * 4; ++j)
						{
							imgData.data[dest + j] = oldData[src + j];
						}
					}
					break;
				case 100: // 'd': // new run
					destRow = delta[i+1];
					var destCol = delta[i+2];
					var span = delta[i+3];
					offset = destRow * canvas.width * 4 + destCol * 4;
					i += 4;
					console.log('apply new span of size ' + span + ' at pos ' + destCol + ', ' + destRow + ' into delta at byte: ' + offset);
					span *= 4;
					imgData.data[offset + 1] = 256; // debug - greener start
					while (span-- > 0) {
						imgData.data[offset++] = delta[i++];
					}
					imgData.data[offset - 2] = 256; // debug - blue terminator
					break;
				default:
					console.log('ERROR: Unknown code ' + delta[i] +
						    ' at offset ' + i);
					i = delta.length;
					break;
				}
			}

			ctx.putImageData(imgData, 0, 0);
			tile.el.src = canvas.toDataURL('image/png');

			console.log('set new image');
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
		L.Log.log(textMsg, L.INCOMING, key);

		// Send acknowledgment, that the tile message arrived
		var tileID = command.part + ':' + command.x + ':' + command.y + ':' + command.tileWidth + ':' + command.tileHeight + ':' + command.nviewid;
		this._map._socket.sendMessage('tileprocessed tile=' + tileID);
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

	_clearSelections: function (calledFromSetPartHandler) {
		// hide the cursor if not editable
		this._onUpdateCursor(calledFromSetPartHandler);
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

	containsSelection: function (latlng) {
		var ret = false;
		var selections = this._selections.getLayers();
		for (var sel in selections) {
			if (selections[sel].getBounds().contains(latlng)) {
				ret = true;
				break;
			}
		}
		return ret;
	},

	_postMouseEvent: function(type, x, y, count, buttons, modifier) {

		this._sendClientZoom();

		this._sendClientVisibleArea();

		this._map._socket.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count +
				' buttons=' + buttons + ' modifier=' + modifier);


		if (type === 'buttondown') {
			this._clearSearchResults();
		}
	},

	_postKeyboardEvent: function(type, charcode, keycode) {
		// console.log('==> _postKeyboardEvent type=' + type + ' charcode=' + charcode + ' keycode=' + keycode);
		if (this._docType === 'spreadsheet' && this._prevCellCursor && type === 'input') {
			if (keycode === 1030) { // PgUp
				if (this._cellCursorOnPgUp) {
					return;
				}
				this._cellCursorOnPgUp = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
			else if (keycode === 1031) { // PgDn
				if (this._cellCursorOnPgDn) {
					return;
				}
				this._cellCursorOnPgDn = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
		}

		this._sendClientZoom();

		this._sendClientVisibleArea();

		this._map._socket.sendMessage('key type=' + type +
				' char=' + charcode + ' key=' + keycode);
	},

	// if winId=0, then event is posted on the document
	_postCompositionEvent: function(winId, type, text) {
		// console.log('==> _postCompositionEvent type=' + type + ' text="' + text + '"');
		this._map._socket.sendMessage('textinput id=' + winId + ' type=' + type + ' text=' + encodeURIComponent(text));
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

	_onZoomStart: function () {
		this._isZooming = true;
	},


	_onZoomEnd: function () {
		this._isZooming = false;
		this._onUpdateCursor(null, true);
		this.updateAllViewCursors();
	},

	_updateCursorPos: function () {
		var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._visibleCursor.getSouthWest()),
			this._map.latLngToLayerPoint(this._visibleCursor.getNorthEast()));
		var cursorPos = this._visibleCursor.getNorthWest();

		if (!this._cursorMarker) {
			this._cursorMarker = L.cursor(cursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())), {blink: true});
		}
		else {
			this._cursorMarker.setLatLng(cursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())));
		}

		this._map._clipboardContainer.showCursor();
		if (this._map._isFocused && !L.Browser.mobile) {
			// On mobile, this is causing some key input to get lost.
			this._map.focus();
		}
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (scroll, zoom) {
		var cursorPos = this._visibleCursor.getNorthWest();
		var docLayer = this._map._docLayer;

		if ((!zoom && scroll !== false) && !this._map.getBounds().contains(this._visibleCursor) && this._isCursorVisible) {
			var center = this._map.project(cursorPos);
			center = center.subtract(this._map.getSize().divideBy(2));
			center.x = Math.round(center.x < 0 ? 0 : center.x);
			center.y = Math.round(center.y < 0 ? 0 : center.y);
			if (!zoom && !(this._selectionHandles.start && this._selectionHandles.start.isDragged) &&
			    !(this._selectionHandles.end && this._selectionHandles.end.isDragged) &&
			    !(docLayer._followEditor || docLayer._followUser)) {
				this._map.fire('scrollto', {x: center.x, y: center.y, calledFromInvalidateCursorMsg: scroll !== undefined});
			}
		}

		this._updateCursorAndOverlay();

		this.eachView(this._viewCursors, function (item) {
			var viewCursorMarker = item.marker;
			if (viewCursorMarker) {
				viewCursorMarker.setOpacity(this.isCursorVisible() && this._cursorMarker.getLatLng().equals(viewCursorMarker.getLatLng()) ? 0 : 1);
			}
		}, this, true);
	},

	// enable or disable blinking cursor and  the cursor overlay depending on
	// the state of the document (if the falgs are set)
	_updateCursorAndOverlay: function (/*update*/) {
		if (this._map._permission === 'edit'
		&& this._isCursorVisible        // only when LOK has told us it is ok
		&& this._isFocused              // not when document is not focused
		&& !this._isZooming             // not when zooming
//		&& !this.isGraphicVisible()     // not when sizing / positioning graphics
		&& !this._isEmptyRectangle(this._visibleCursor)) {
			this._updateCursorPos();
		}
		else {
			this._map._clipboardContainer.hideCursor();
		}
	},

	// Update colored non-blinking view cursor
	_onUpdateViewCursor: function (viewId) {
		if (typeof this._viewCursors[viewId] !== 'object' ||
		    typeof this._viewCursors[viewId].bounds !== 'object') {
			return;
		}

		var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._viewCursors[viewId].bounds.getSouthWest()),
		                         this._map.latLngToLayerPoint(this._viewCursors[viewId].bounds.getNorthEast()));
		var viewCursorPos = this._viewCursors[viewId].bounds.getNorthWest();
		var viewCursorMarker = this._viewCursors[viewId].marker;
		var viewCursorVisible = this._viewCursors[viewId].visible;
		var viewPart = this._viewCursors[viewId].part;

		if (!this._map.isViewReadOnly(viewId) &&
		    viewCursorVisible &&
		    !this._isZooming &&
		    !this._isEmptyRectangle(this._viewCursors[viewId].bounds) &&
		    (this._docType === 'text' || this._selectedPart === viewPart)) {
			if (!viewCursorMarker) {
				var viewCursorOptions = {
					color: L.LOUtil.rgbToHex(this._map.getViewColor(viewId)),
					blink: false,
					header: true, // we want a 'hat' to our view cursors (which will contain view user names)
					headerTimeout: 3000, // hide after some interval
					zIndex: viewId,
					headerName: this._map.getViewName(viewId)
				};
				viewCursorMarker = L.cursor(viewCursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())), viewCursorOptions);
				this._viewCursors[viewId].marker = viewCursorMarker;
			}
			else {
				viewCursorMarker.setLatLng(viewCursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())));
			}
			viewCursorMarker.setOpacity(this.isCursorVisible() && this._cursorMarker.getLatLng().equals(viewCursorMarker.getLatLng()) ? 0 : 1);
			this._viewLayerGroup.addLayer(viewCursorMarker);
		}
		else if (viewCursorMarker) {
			this._viewLayerGroup.removeLayer(viewCursorMarker);
		}

		this._viewCursors[viewId].marker.showCursorHeader();
	},

	updateAllViewCursors : function() {
		for (var key in this._viewCursors) {
			this._onUpdateViewCursor(key);
		}
	},

	isCursorVisible: function() {
		return this._map.hasLayer(this._cursorMarker);
	},

	isGraphicVisible: function() {
		return this._graphicMarker && this._map.hasLayer(this._graphicMarker);
	},

	goToViewCursor: function(viewId) {
		if (viewId === this._viewId) {
			this._onUpdateCursor();
			return;
		}

		if (this._viewCursors[viewId] && this._viewCursors[viewId].visible && !this._isEmptyRectangle(this._viewCursors[viewId].bounds)) {
			if (!this._map.getBounds().contains(this._viewCursors[viewId].bounds)) {
				var viewCursorPos = this._viewCursors[viewId].bounds.getNorthWest();
				var center = this._map.project(viewCursorPos);
				center = center.subtract(this._map.getSize().divideBy(2));
				center.x = Math.round(center.x < 0 ? 0 : center.x);
				center.y = Math.round(center.y < 0 ? 0 : center.y);

				this._map.fire('scrollto', {x: center.x, y: center.y, calledFromInvalidateCursorMsg: true});
			}

			this._viewCursors[viewId].marker.showCursorHeader();
		}
	},

	_onUpdateTextViewSelection: function (viewId) {
		viewId = parseInt(viewId);
		var viewPolygons = this._viewSelections[viewId].polygons;
		var viewSelection = this._viewSelections[viewId].selection;
		var viewPart = this._viewSelections[viewId].part;

		if (viewPolygons &&
		    (this._docType === 'text' || this._selectedPart === viewPart)) {

			// Reset previous selections
			if (viewSelection) {
				this._viewLayerGroup.removeLayer(viewSelection);
			}

			viewSelection = new L.Polygon(viewPolygons, {
				pointerEvents: 'none',
				fillColor: L.LOUtil.rgbToHex(this._map.getViewColor(viewId)),
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
			this._viewSelections[viewId].selection = viewSelection;
			this._viewLayerGroup.addLayer(viewSelection);
		}
		else if (viewSelection) {
			this._viewLayerGroup.removeLayer(viewSelection);
		}
	},

	_onUpdateGraphicViewSelection: function (viewId) {
		var viewBounds = this._graphicViewMarkers[viewId].bounds;
		var viewMarker = this._graphicViewMarkers[viewId].marker;
		var viewPart = this._graphicViewMarkers[viewId].part;

		if (!this._isEmptyRectangle(viewBounds) &&
		   (this._docType === 'text' || this._selectedPart === viewPart)) {
			if (!viewMarker) {
				var color = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				viewMarker = L.rectangle(viewBounds, {
					pointerEvents: 'auto',
					fill: false,
					color: color
				});
				// Disable autoPan, so the graphic view selection doesn't make the view jump to the popup.
				viewMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: color, color: 'white', closeButton: false});
				this._graphicViewMarkers[viewId].marker = viewMarker;
			}
			else {
				viewMarker.setBounds(viewBounds);
			}
			this._viewLayerGroup.addLayer(viewMarker);
		}
		else if (viewMarker) {
			this._viewLayerGroup.removeLayer(viewMarker);
		}
	},

	eachView: function (views, method, context, item) {
		for (var key in views) {
			method.call(context, item ? views[key] : key);
		}
	},

	// Update dragged graphics selection
	_onGraphicMove: function (e) {
		if (!e.pos) { return; }
		var aPos = this._latLngToTwips(e.pos);
		if (e.type === 'graphicmovestart') {
			this._graphicMarker.isDragged = true;
			this._graphicMarker._startPos = aPos;
		}
		else if (e.type === 'graphicmoveend') {
			var deltaPos = aPos.subtract(this._graphicMarker._startPos);
			if (deltaPos.x === 0 && deltaPos.y === 0) {
				this._graphicMarker.isDragged = false;
				return;
			}

			var newPos = this._graphicSelectionTwips.min.add(deltaPos);
			var size = this._graphicSelectionTwips.getSize();

			// try to keep shape inside document
			if (newPos.x + size.x > this._docWidthTwips)
				newPos.x = this._docWidthTwips - size.x;
			if (newPos.x < 0)
				newPos.x = 0;

			if (newPos.y + size.y > this._docHeightTwips)
				newPos.y = this._docHeightTwips - size.y;
			if (newPos.y < 0)
				newPos.y = 0;

			var param = {
				TransformPosX: {
					type: 'long',
					value: newPos.x
				},
				TransformPosY: {
					type: 'long',
					value: newPos.y
				}
			};
			this._map.sendUnoCommand('.uno:TransformDialog ', param);
			this._graphicMarker.isDragged = false;
		}
	},

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if (!e.pos) { return; }

		var aPos = this._latLngToTwips(e.pos);
		var selMin = this._graphicSelectionTwips.min;
		var selMax = this._graphicSelectionTwips.max;

		if (e.type === 'scalestart') {
			this._graphicMarker.isDragged = true;
			if (selMax.x - selMin.x < 2)
				this._graphicMarker.dragHorizDir = 0; // overlapping handles
			else if (Math.abs(selMin.x - aPos.x) < 2)
				this._graphicMarker.dragHorizDir = -1; // left handle
			else if (Math.abs(selMax.x - aPos.x) < 2)
				this._graphicMarker.dragHorizDir = 1; // right handle
			if (selMax.y - selMin.y < 2)
				this._graphicMarker.dragVertDir = 0; // overlapping handles
			else if (Math.abs(selMin.y - aPos.y) < 2)
				this._graphicMarker.dragVertDir = -1; // up handle
			else if (Math.abs(selMax.y - aPos.y) < 2)
				this._graphicMarker.dragVertDir = 1; // down handle
		}
		else if (e.type === 'scaleend') {
			var oldSize = selMax.subtract(selMin);
			var newSize = oldSize.clone();
			var newPos = selMin.clone();
			var center = this._graphicSelectionTwips.getCenter();
			var horizDir = this._graphicMarker.dragHorizDir;
			var vertDir = this._graphicMarker.dragVertDir;

			var computePosAndSize = function (coord) {
				var direction = (coord === 'x') ? horizDir : vertDir;
				var delta;
				if (direction === 0) {
					newSize[coord] = Math.abs(aPos[coord] - center[coord]);
					newPos[coord] = (aPos[coord] > center[coord]) ? center[coord] : center[coord] - newSize[coord];
				}
				else if (direction === -1) { // left/up handle
					delta = selMin[coord] - aPos[coord];
					newSize[coord] = oldSize[coord] + delta;
					newPos[coord] = aPos[coord];
				}
				else if (direction === 1) {  // right/down handle
					delta = aPos[coord] - selMax[coord];
					newSize[coord] = oldSize[coord] + delta;
					newPos[coord] = selMin[coord];
				}
			};

			computePosAndSize('x');
			computePosAndSize('y');

			// do we need to perform uniform scaling ?
			if (!this._isGraphicAngleDivisibleBy90()) {
				var delta = 0;
				if (horizDir !== undefined && vertDir === undefined) {
					newSize.y = Math.round(oldSize.y * (newSize.x / oldSize.x));
					delta = newSize.y - oldSize.y;
					newPos.y = Math.round(selMin.y - delta / 2);
				}
				else if (horizDir === undefined && vertDir !== undefined) {
					newSize.x = Math.round(oldSize.x * (newSize.y / oldSize.y));
					delta = newSize.x - oldSize.x;
					newPos.x = Math.round(selMin.x - delta / 2);
				}
			}

			// try to keep shape inside document
			if (newPos.x + newSize.x > this._docWidthTwips)
				newPos.x = this._docWidthTwips - newSize.x;
			if (newPos.x < 0)
				newPos.x = 0;

			if (newPos.y + newSize.y > this._docHeightTwips)
				newPos.y = this._docHeightTwips - newSize.y;
			if (newPos.y < 0)
				newPos.y = 0;

			// fill params for uno command
			var param = {
				TransformPosX: {
					type: 'long',
					value: newPos.x
				},
				TransformPosY: {
					type: 'long',
					value: newPos.y
				},
				TransformWidth: {
					type: 'long',
					value: newSize.x
				},
				TransformHeight: {
					type: 'long',
					value: newSize.y
				}
			};

			this._map.sendUnoCommand('.uno:TransformDialog ', param);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.dragHorizDir = undefined;
			this._graphicMarker.dragVertDir = undefined;
		}
	},

	_onGraphicRotate: function (e) {
		if (e.type === 'rotatestart') {
			this._graphicMarker.isDragged = true;
		}
		else if (e.type === 'rotateend') {
			var center = this._graphicSelectionTwips.getCenter();
			var param = {
				TransformRotationDeltaAngle: {
					type: 'long',
					value: (((e.rotation * 18000) / Math.PI))
				},
				TransformRotationX: {
					type: 'long',
					value: center.x
				},
				TransformRotationY: {
					type: 'long',
					value: center.y
				}
			};
			this._map.sendUnoCommand('.uno:TransformDialog ', param);
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

			// Dragging the selection handles vertically more than one line on a touch
			// device is more or less impossible without this hack.
			if (!(typeof e.originalEvent.type === 'string' && e.originalEvent.type === 'touchmove')) {
				// If the map has been scrolled, but the cursor hasn't been updated yet, then
				// the current mouse position differs.
				if (!expectedPos.equals(cursorPos)) {
					var correction = expectedPos.subtract(cursorPos);

					e.target.dragging._draggable._startPoint = e.target.dragging._draggable._startPoint.add(correction);
					e.target.dragging._draggable._startPos = e.target.dragging._draggable._startPos.add(correction);
					e.target.dragging._draggable._newPos = e.target.dragging._draggable._newPos.add(correction);

					e.target.dragging._draggable._updatePosition();
				}
			}
			var containerPos = new L.Point(expectedPos.x - this._map._container.getBoundingClientRect().left,
				expectedPos.y - this._map._container.getBoundingClientRect().top);

			containerPos = containerPos.add(e.target.dragging._draggable.startOffset);
			this._map.fire('handleautoscroll', {pos: containerPos, map: this._map});
		}
		if (e.type === 'dragend') {
			e.target.isDragged = false;
			this._map.focus();
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
				this._graphicMarker.removeEventParent(this._map);
				this._graphicMarker.off('scalestart scaleend', this._onGraphicEdit, this);
				this._graphicMarker.off('rotatestart rotateend', this._onGraphicRotate, this);
				this._graphicMarker.dragging.disable();
				this._graphicMarker.transform.disable();
				this._map.removeLayer(this._graphicMarker);
			}

			if (this._map._permission !== 'edit') {
				return;
			}

			this._graphicMarker = L.svgGroup(this._graphicSelection, {
				draggable: true,
				transform: true,
				stroke: false,
				fillOpacity: 0,
				fill: true
			});

			if (!this._graphicMarker) {
				this._map.fire('error', {msg: 'Graphic marker initialization', cmd: 'marker', kind: 'failed', id: 1});
				return;
			}

			this._graphicMarker.on('graphicmovestart graphicmoveend', this._onGraphicMove, this);
			this._graphicMarker.on('scalestart scaleend', this._onGraphicEdit, this);
			this._graphicMarker.on('rotatestart rotateend', this._onGraphicRotate, this);
			this._map.addLayer(this._graphicMarker);
			this._graphicMarker.dragging.enable();
			this._graphicMarker.transform.enable({uniformScaling: !this._isGraphicAngleDivisibleBy90()});
		}
		else if (this._graphicMarker) {
			this._graphicMarker.off('graphicmovestart graphicmoveend', this._onGraphicMove, this);
			this._graphicMarker.off('scalestart scaleend', this._onGraphicEdit, this);
			this._graphicMarker.off('rotatestart rotateend', this._onGraphicRotate, this);
			this._graphicMarker.dragging.disable();
			this._graphicMarker.transform.disable();
			this._map.removeLayer(this._graphicMarker);
			this._graphicMarker.isDragged = false;
		}
		this._updateCursorAndOverlay();
	},

	_onUpdateCellCursor: function (horizontalDirection, verticalDirection, onPgUpDn) {
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			var mapBounds = this._map.getBounds();
			if (!mapBounds.contains(this._cellCursor) && !this._cellCursorXY.equals(this._prevCellCursorXY)) {
				var scrollX = 0, scrollY = 0;
				if (onPgUpDn) {
					var mapHalfHeight = (mapBounds.getNorth() - mapBounds.getSouth()) / 2;
					var cellCursorOnPgUpDn = (this._cellCursorOnPgUp) ? this._cellCursorOnPgUp : this._cellCursorOnPgDn;

					scrollY = this._cellCursor.getNorth() - cellCursorOnPgUpDn.getNorth();
					if (this._cellCursor.getNorth() > mapBounds.getNorth() + scrollY) {
						scrollY = (this._cellCursor.getNorth() - mapBounds.getNorth()) + mapHalfHeight;
					} else if (this._cellCursor.getSouth() < mapBounds.getSouth() + scrollY) {
						scrollY = (this._cellCursor.getNorth() - mapBounds.getNorth()) + mapHalfHeight;
					}
				}
				else if (horizontalDirection !== 0 || verticalDirection != 0) {
					var spacingX = Math.abs(this._cellCursor.getEast() - this._cellCursor.getWest()) / 4.0;
					var spacingY = Math.abs((this._cellCursor.getSouth() - this._cellCursor.getNorth())) / 4.0;

					if (this._cellCursor.getWest() < mapBounds.getWest()) {
						scrollX = this._cellCursor.getWest() - mapBounds.getWest() - spacingX;
					} else if (this._cellCursor.getEast() > mapBounds.getEast()) {
						scrollX = this._cellCursor.getEast() - mapBounds.getEast() + spacingX;
					}
					if (this._cellCursor.getNorth() > mapBounds.getNorth()) {
						scrollY = this._cellCursor.getNorth() - mapBounds.getNorth() + spacingY;
					} else if (this._cellCursor.getSouth() < mapBounds.getSouth()) {
						scrollY = this._cellCursor.getSouth() - mapBounds.getSouth() - spacingY;
					}
				}
				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y, calledFromInvalidateCursorMsg: true});
				}
				this._prevCellCursorXY = this._cellCursorXY;
			}

			if (onPgUpDn) {
				this._cellCursorOnPgUp = null;
				this._cellCursorOnPgDn = null;
			}

			if (this._cellCursorMarker) {
				this._map.removeLayer(this._cellCursorMarker);
				this._map.removeLayer(this._dropDownButton);
			}
			this._cellCursorMarker = L.rectangle(this._cellCursor, {
				pointerEvents: 'none',
				fill: false,
				color: '#000000',
				weight: 2});
			if (!this._cellCursorMarker) {
				this._map.fire('error', {msg: 'Cell Cursor marker initialization', cmd: 'cellCursor', kind: 'failed', id: 1});
				return;
			}
			this._map.addLayer(this._cellCursorMarker);

			this._addDropDownMarker();
		}
		else if (this._cellCursorMarker) {
			this._map.removeLayer(this._cellCursorMarker);
		}
		this._removeDropDownMarker();
	},

	_onValidityListButtonMsg: function(textMsg) {
		var strXY = textMsg.match(/\d+/g);
		var validatedCell = new L.Point(parseInt(strXY[0]), parseInt(strXY[1]));
		var show = parseInt(strXY[2]) === 1;
		if (show) {
			if (this._validatedCellXY && !this._validatedCellXY.equals(validatedCell)) {
				this._validatedCellXY = null;
				this._removeDropDownMarker();
			}
			this._validatedCellXY = validatedCell;
			this._addDropDownMarker();
		}
		else if (this._validatedCellXY && this._validatedCellXY.equals(validatedCell)) {
			this._validatedCellXY = null;
			this._removeDropDownMarker();
		}
	},

	_addDropDownMarker: function () {
		if (this._validatedCellXY && this._cellCursorXY && this._validatedCellXY.equals(this._cellCursorXY)) {
			var pos = this._cellCursor.getNorthEast();
			var cellCursorHeightPx = this._twipsToPixels(this._cellCursorTwips.getSize()).y;
			var dropDownMarker = this._getDropDownMarker(cellCursorHeightPx);
			dropDownMarker.setLatLng(pos);
			this._map.addLayer(dropDownMarker);
		}
	},

	_removeDropDownMarker: function () {
		if (!this._validatedCellXY && this._dropDownButton)
			this._map.removeLayer(this._dropDownButton);
	},

	_getDropDownMarker: function (height) {
		if (height) {
			var maxHeight = 27; // it matches the max height of the same control in core
			var topMargin = 0;
			if (height > maxHeight) {
				topMargin = height - maxHeight;
				height = maxHeight;
			}
			var icon =  L.divIcon({
				className: 'spreadsheet-drop-down-marker',
				iconSize: [undefined, height],
				iconAnchor: [0, -topMargin]
			});
			this._dropDownButton.setIcon(icon);
		}
		return this._dropDownButton;
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
		if (this._map._clipboardContainer.getValue() !== '') {
			L.Compatibility.clipboardSet(e, this._map._clipboardContainer.getValue());
			this._map._clipboardContainer.setValue('');
		} else if (this._selectionTextContent) {
			L.Compatibility.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
		}

		this._map._socket.sendMessage('uno .uno:Copy');
	},

	_onCut: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (this._map._clipboardContainer.getValue() !== '') {
			L.Compatibility.clipboardSet(e, this._map._clipboardContainer.getValue());
			this._map._clipboardContainer.setValue('');
		} else if (this._selectionTextContent) {
			L.Compatibility.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
		}

		this._map._socket.sendMessage('uno .uno:Cut');
	},

	_onPaste: function (e) {
		e = e.originalEvent;
		e.preventDefault();

		if (e.clipboardData) { // Standard
			this._dataTransferToDocument(e.clipboardData, /* preferInternal = */ true);
		}
		else if (window.clipboardData) { // IE 11
			this._dataTransferToDocument(window.clipboardData, /* preferInternal = */ true);
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

		this._dataTransferToDocument(e.dataTransfer, /* preferInternal = */ false);
	},

	_dataTransferToDocument: function (dataTransfer, preferInternal) {
		// for the paste, we might prefer the internal LOK's copy/paste
		if (preferInternal === true) {
			var pasteString = dataTransfer.getData('text/plain');
			if (!pasteString) {
				pasteString = dataTransfer.getData('Text'); // IE 11
			}

			if (pasteString && pasteString === this._selectionTextHash) {
				this._map._socket.sendMessage('uno .uno:Paste');
				return;
			}
		}

		var types = dataTransfer.types;

		// first try to transfer images
		// TODO if we have both Files and a normal mimetype, should we handle
		// both, or prefer one or the other?
		for (var t = 0; t < types.length; ++t) {
			if (types[t] === 'Files') {
				var files = dataTransfer.files;
				for (var f = 0; f < files.length; ++f) {
					var file = files[f];
					if (file.type.match(/image.*/)) {
						var reader = new FileReader();
						reader.onload = this._onFileLoadFunc(file);
						reader.readAsArrayBuffer(file);
					}
				}
			}
		}

		// now try various mime types
		var mimeTypes;
		if (this._docType === 'spreadsheet') {
			// FIXME apparently we cannot paste the text/html or text/rtf as
			// produced by LibreOffice in Calc from some reason
			mimeTypes = [
				['text/plain', 'text/plain;charset=utf-8'],
				['Text', 'text/plain;charset=utf-8']
			];
		} else if (navigator.platform.startsWith('Mac')) {
			// Safari provides RTF clipboard content which doesn't contain the
			// images.  We do not know where the content comes from, so let's
			// always prefer HTML over RTF on Mac.
			mimeTypes = [
				['text/html', 'text/html'],
				['text/rtf', 'text/rtf'],
				['text/plain', 'text/plain;charset=utf-8'],
				['Text', 'text/plain;charset=utf-8']
			];
		} else {
			mimeTypes = [
				['text/rtf', 'text/rtf'],
				['text/html', 'text/html'],
				['text/plain', 'text/plain;charset=utf-8'],
				['Text', 'text/plain;charset=utf-8']
			];
		}

		for (var i = 0; i < mimeTypes.length; ++i) {
			for (t = 0; t < types.length; ++t) {
				if (mimeTypes[i][0] === types[t]) {
					var blob = new Blob(['paste mimetype=' + mimeTypes[i][1] + '\n', dataTransfer.getData(types[t])]);
					this._map._socket.sendMessage(blob);
					return;
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
		if (isNaN(this._docWidthTwips)) { return; }
		var oldSize = e ? e.oldSize : this._map.getSize();
		var newSize = e ? e.newSize : this._map.getSize();
		if (newSize.x - oldSize.x === 0) { return; }

		var widthTwips = newSize.x * this._map.options.tileWidthTwips / this._tileSize;
		var ratio = widthTwips / this._docWidthTwips;

		maxZoom = maxZoom ? maxZoom : this._map.options.zoom;
		// 'fit width zoom' has no use in spreadsheets, ignore it there
		if (this._docType !== 'spreadsheet') {
			var crsScale = this._map.options.crs.scale(1);
			var zoom = 10 + Math.floor(Math.log(ratio) / Math.log(crsScale));

			zoom = Math.min(maxZoom, Math.max(1, zoom));
			if (this._docWidthTwips * this._map.getZoomScale(zoom, 10) < widthTwips) {
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

	// Cells can change position during changes of zoom level in calc
	// hence we need to request an updated cell cursor position for this level.
	_onCellCursorShift: function (force) {
		if (this._cellCursorMarker || force) {
			this._map._socket.sendMessage('commandvalues command=.uno:CellCursor'
			                     + '?outputHeight=' + this._tileWidthPx
			                     + '&outputWidth=' + this._tileHeightPx
			                     + '&tileHeight=' + this._tileWidthTwips
			                     + '&tileWidth=' + this._tileHeightTwips);
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
						if (preview.invalid || (this._partPageRectanglesTwips.length > preview.index &&
								invalidBounds.intersects(this._partPageRectanglesTwips[preview.index]))) {
							toInvalidate[key] = true;
						}
					}
					else if (preview.index >= 0) {
						// we have a preview for a part
						if (preview.invalid || preview.index === this._selectedPart ||
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
						if (preview.invalid || (preview.part === this._selectedPart ||
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
						this._map.getPreview(preview.id, preview.index, preview.maxWidth, preview.maxHeight, {autoUpdate: true, broadcast: true});
					}
					else {
						this._map.getCustomPreview(preview.id, preview.part, preview.width, preview.height, preview.tilePosX,
								preview.tilePosY, preview.tileWidth, preview.tileHeight, {autoUpdate: true});
					}
				}
			}
		}
		this._previewInvalidations = [];
	},

	_debugGetTimeArray: function() {
		return {count: 0, ms: 0, best: Number.MAX_SAFE_INTEGER, worst: 0, date: 0};
	},

	_debugShowTileData: function() {
		this._debugData['loadCount'].setPrefix('Total of requested tiles: ' +
				this._debugInvalidateCount + ', received: ' + this._debugLoadCount +
				', cancelled: ' + this._debugCancelledTiles);
	},

	_debugInit: function() {
		this._debugTiles = {};
		this._debugInvalidBounds = {};
		this._debugInvalidBoundsMessage = {};
		this._debugTimeout();
		this._debugId = 0;
		this._debugCancelledTiles = 0;
		this._debugLoadCount = 0;
		this._debugInvalidateCount = 0;
		this._debugRenderCount = 0;
		if (!this._debugData) {
			this._debugData = {};
			this._debugDataNames = ['tileCombine', 'fromKeyInputToInvalidate', 'ping', 'loadCount'];
			for (var i = 0; i < this._debugDataNames.length; i++) {
				this._debugData[this._debugDataNames[i]] = L.control.attribution({prefix: '', position: 'bottomleft'}).addTo(this._map);
			}
			this._debugInfo = new L.LayerGroup();
			this._debugInfo2 = new L.LayerGroup();
			this._debugAlwaysActive = new L.LayerGroup();
			this._debugTyper = new L.LayerGroup();
			this._map.addLayer(this._debugInfo);
			this._map.addLayer(this._debugInfo2);
			var overlayMaps = {
				'Tile overlays': this._debugInfo,
				'Screen overlays': this._debugInfo2,
				'Always active': this._debugAlwaysActive,
				'Typing': this._debugTyper
			};
			L.control.layers({}, overlayMaps, {collapsed: false}).addTo(this._map);

			this._map.on('layeradd', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					this._map._debugAlwaysActive = true;
				} else if (e.layer === this._debugTyper) {
					this._debugTypeTimeout();
				} else if (e.layer === this._debugInfo2) {
					for (var i = 0; i < this._debugDataNames.length; i++) {
						this._debugData[this._debugDataNames[i]].addTo(this._map);
					}
				}
			}, this);
			this._map.on('layerremove', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					this._map._debugAlwaysActive = false;
				} else if (e.layer === this._debugTyper) {
					clearTimeout(this._debugTypeTimeoutId);
				} else if (e.layer === this._debugInfo2) {
					for (var i in this._debugData) {
						this._debugData[i].remove();
					}
				}
			}, this);
		}
		this._debugTimePING = this._debugGetTimeArray();
		this._debugPINGQueue = [];
		this._debugTimeKeypress = this._debugGetTimeArray();
		this._debugKeypressQueue = [];
		this._debugLorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
		this._debugLorem += ' ' + this._debugLorem + '\n';
		this._debugLoremPos = 0;
	},

	_debugSetTimes: function(times, value) {
		if (value < times.best) {
			times.best = value;
		}
		if (value > times.worst) {
			times.worst = value;
		}
		times.ms += value;
		times.count++;
		return 'best: ' + times.best + ' ms, avg: ' + Math.round(times.ms/times.count) + ' ms, worst: ' + times.worst + ' ms, last: ' + value + ' ms';
	},

	_debugAddInvalidationRectangle: function(topLeftTwips, bottomRightTwips, command) {
		var now = +new Date();

		var invalidBoundCoords = new L.LatLngBounds(this._twipsToLatLng(topLeftTwips, this._tileZoom),
				this._twipsToLatLng(bottomRightTwips, this._tileZoom));
		var rect = L.rectangle(invalidBoundCoords, {color: 'red', weight: 1, opacity: 1, fillOpacity: 0.4, pointerEvents: 'none'});
		this._debugInvalidBounds[this._debugId] = rect;
		this._debugInvalidBoundsMessage[this._debugId] = command;
		this._debugId++;
		this._debugInfo.addLayer(rect);

		var oldestKeypress = this._debugKeypressQueue.shift();
		if (oldestKeypress) {
			var timeText = this._debugSetTimes(this._debugTimeKeypress, now - oldestKeypress);
			this._debugData['fromKeyInputToInvalidate'].setPrefix('Elapsed time between key input and next invalidate: ' + timeText);
		}

		// query server ping time after invalidation messages
		// pings will be paired with the pong messages
		this._debugPINGQueue.push(+new Date());
		this._map._socket.sendMessage('ping');
	},

	_debugAddInvalidationData: function(tile) {
		if (tile._debugTile) {
			tile._debugTile.setStyle({fillOpacity: 0.5, fillColor: 'blue'});
			tile._debugTime.date = +new Date();
			tile._debugTile.date = +new Date();
			tile._debugInvalidateCount++;
			this._debugInvalidateCount++;
		}
	},

	_debugAddInvalidationMessage: function(message) {
		this._debugInvalidBoundsMessage[this._debugId - 1] = message;
		var messages = '';
		for (var i = this._debugId - 1; i > this._debugId - 6; i--) {
			if (i >= 0 && this._debugInvalidBoundsMessage[i]) {
				messages += '' + i + ': ' + this._debugInvalidBoundsMessage[i] + ' <br>';
			}
		}
		this._debugData['tileCombine'].setPrefix(messages);
		this._debugShowTileData();
	},

	_debugTimeout: function() {
		if (this._debug) {
			for (var key in this._debugInvalidBounds) {
				var rect = this._debugInvalidBounds[key];
				var opac = rect.options.fillOpacity;
				if (opac <= 0.04) {
					if (key < this._debugId - 5) {
						this._debugInfo.removeLayer(rect);
						delete this._debugInvalidBounds[key];
						delete this._debugInvalidBoundsMessage[key];
					} else {
						rect.setStyle({fillOpacity: 0, opacity: 1 - (this._debugId - key) / 7});
					}
				} else {
					rect.setStyle({fillOpacity: opac - 0.04});
				}
			}
			for (key in this._debugTiles) {
				rect = this._debugTiles[key];
				var col = rect.options.fillColor;
				opac = rect.options.fillOpacity;
				if (col === 'blue' && opac >= 0.04 && rect.date + 1000 < +new Date()) {
					rect.setStyle({fillOpacity: opac - 0.04});
				}
			}
			this._debugTimeoutId = setTimeout(L.bind(this._debugTimeout, this), 50);
		}
	},

	_debugTypeTimeout: function() {
		var letter = this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length);
		this._debugKeypressQueue.push(+new Date());
		if (letter === '\n'.charCodeAt(0)) {
			this._postKeyboardEvent('input', 0, 1280);
		} else {
			this._postKeyboardEvent('input', this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length), 0);
		}
		this._debugLoremPos++;
		this._debugTypeTimeoutId = setTimeout(L.bind(this._debugTypeTimeout, this), 50);
	}

});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
