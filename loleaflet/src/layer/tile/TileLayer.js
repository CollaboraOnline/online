/* -*- js-indent-level: 8 -*- */
/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */
/* global $ _ Uint8ClampedArray Uint8Array */
// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

/* global vex $ L _ isAnyVexDialogActive w2ui CPointSet CRectangle CPolyUtil CPolygon Cursor CBounds */
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

// CStyleData is used to obtain CSS property values from style data
// stored in DOM elements in the form of custom CSS properties/variables.
var CStyleData = L.Class.extend({

	initialize: function (styleDataDiv) {
		this._div = styleDataDiv;
	},

	getPropValue: function (name) {
		return getComputedStyle(this._div).getPropertyValue(name);
	},

	getIntPropValue: function(name) { // (String) -> Number
		return parseInt(this.getPropValue(name));
	},

	getFloatPropValue: function(name) { // (String) -> Number
		return parseFloat(this.getPropValue(name));
	}
});

// CSelections is used to add/modify/clear selections (text/cell-area(s))
// on canvas using polygons (CPolygon).
var CSelections = L.Class.extend({

	initialize: function (pointSet, canvasOverlay, dpiScale, selectionsDataDiv, map, isView, viewId) {
		this._pointSet = pointSet ? pointSet : new CPointSet();
		this._overlay = canvasOverlay;
		this._dpiScale = dpiScale;
		this._styleData = new CStyleData(selectionsDataDiv);
		this._map = map;
		this._name = 'selections' + (isView ? '-viewid-' + viewId : '');
		this._isView = isView;
		this._viewId = viewId;
		this._polygon = undefined;
		this._updatePolygon();
	},

	empty: function () {
		return !this._pointSet || this._pointSet.empty();
	},

	clear: function () {
		this.setPointSet(new CPointSet());
	},

	setPointSet: function(pointSet) {
		this._pointSet = pointSet;
		this._updatePolygon();
	},

	contains: function(corePxPoint) {
		if (!this._polygon)
			return false;

		return this._polygon.anyRingBoundContains(corePxPoint);
	},

	getBounds: function() {
		return this._polygon.getBounds();
	},

	_updatePolygon: function() {
		if (!this._polygon) {
			var fillColor = this._isView ?
				L.LOUtil.rgbToHex(this._map.getViewColor(this._viewId)) :
				this._styleData.getPropValue('--fill-color');
			var attributes = {
				name: this._name,
				pointerEvents: 'none',
				fillColor: fillColor,
				fillOpacity: this._styleData.getPropValue('--fill-opacity'),
				opacity: this._styleData.getFloatPropValue('--opacity'),
				weight: Math.round(this._styleData.getIntPropValue('--weight') * this._dpiScale)
			};
			this._polygon = new CPolygon(this._pointSet, attributes);
			this._overlay.initPath(this._polygon);
			return;
		}

		this._polygon.setPointSet(this._pointSet);
	},

	remove: function() {
		if (this._polygon)
			this._overlay.removePath(this._polygon);
	}
});

// CReferences is used to store and manage the CPath's of all
// references in the current sheet.
var CReferences = L.Class.extend({

	initialize: function (canvasOverlay) {

		this._overlay = canvasOverlay;
		this._marks = [];
	},

	// mark should be a CPath.
	addMark: function (mark) {
		this._overlay.initPath(mark);
		this._marks.push(mark);
	},

	// mark should be a CPath.
	hasMark: function (mark) {
		for (var i = 0; i < this._marks.length; ++i) {
			if (mark.getBounds().equals(this._marks[i].getBounds()))
				return true;
		}

		return false;
	},

	clear: function () {
		for (var i = 0; i < this._marks.length; ++i)
			this._overlay.removePath(this._marks[i]);
		this._marks = [];
	}

});

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

	_pngCache: [],

	initialize: function (url, options) {

		this._url = url;

		options = L.setOptions(this, options);

		this._tileWidthPx = options.tileSize;
		this._tileHeightPx = options.tileSize;

		// Conversion factor between the pixel view of tiled rendering
		// and CSS pixels. NB. similar but not the same as
		// L.Util.dpiScaleFactor()
		this._tilePixelScale = 1;

		// detecting retina displays, adjusting tileWidthPx, tileHeightPx and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
			this._tilePixelScale = 2;
			this._tileWidthPx *= this._tilePixelScale;
			this._tileHeightPx *= this._tilePixelScale;
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
		// Last cursor position for invalidation
		this.lastCursorPos = null;
		// Are we zooming currently ? - if so, no cursor.
		this._isZooming = false;
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
			interactive: true
		});

		this._cellResizeMarkerStart = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._cellResizeMarkerEnd = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._referenceMarkerStart = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._referenceMarkerEnd = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._cellAutofillMarker = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-autofill-marker',
				iconSize: window.mode.isDesktop() ? [8, 8] : [16, 16]
			}),
			draggable: true
		});

		this._initializeTableOverlay();

		this._emptyTilesCount = 0;
		this._msgQueue = [];
		this._toolbarCommandValues = {};
		this._previewInvalidations = [];

		this._followThis = -1;
		this._editorId = -1;
		this._followUser = false;
		this._followEditor = false;
		this._selectedTextContent = '';
	},

	onAdd: function (map) {
		this._initContainer();
		this._getToolbarCommandsValues();
		this._selections = new CSelections(undefined, this._canvasOverlay,
			this._painter._dpiScale, this._selectionsDataDiv, this._map, false);
		this._references = new CReferences(this._canvasOverlay);
		this._referencesAll = [];

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
		L.installContextMenu({
			selector: '.loleaflet-annotation-menu',
			trigger: 'none',
			className: 'loleaflet-font',
			build: function($trigger) {
				return {
					items: {
						modify: {
							name: _('Modify'),
							callback: function (key, options) {
								that.onAnnotationModify.call(that, options.$trigger.get(0).annotation);
							}
						},
						reply: (that._docType !== 'text' && that._docType !== 'presentation') ? undefined : {
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
						},
						removeThread: that._docType !== 'text' || $trigger.get(0).isRoot === true ? undefined : {
							name: _('Remove Thread'),
							callback: function (key, options) {
								that.onAnnotationRemoveThread.call(that, options.$trigger.get(0).annotation._data.id);
							}
						},
						resolve: that._docType !== 'text' ? undefined : {
							name: $trigger.get(0).annotation._data.resolved === 'false' ? _('Resolve') : _('Unresolve'),
							callback: function (key, options) {
								that.onAnnotationResolve.call(that, options.$trigger.get(0).annotation);
							}
						},
						resolveThread: that._docType !== 'text' || $trigger.get(0).isRoot === true ? undefined : {
							name: that.isThreadResolved($trigger.get(0).annotation) ? _('Unresolve Thread') : _('Resolve Thread'),
							callback: function (key, options) {
								that.onAnnotationResolveThread.call(that, options.$trigger.get(0).annotation);
							}
						}
					},
				};
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
		L.installContextMenu({
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
			// always true since autoFitWidth is never set
			map.on('resize', this._fitWidthZoom, this);
		}
		// Retrieve the initial cell cursor position (as LOK only sends us an
		// updated cell cursor when the selected cell is changed and not the initial
		// cell).
		map.on('statusindicator',
			function (e) {
				if (e.statusType === 'alltilesloaded' && this._docType === 'spreadsheet') {
					if (!isAnyVexDialogActive())
						this._onCellCursorShift(true);
				}
				if (e.statusType === 'alltilesloaded' && this._map.shouldWelcome()) {
					this._map.showWelcomeDialog();
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

		this._cellResizeMarkerStart.on('dragstart drag dragend', this._onCellResizeMarkerDrag, this);
		this._cellResizeMarkerEnd.on('dragstart drag dragend', this._onCellResizeMarkerDrag, this);
		this._referenceMarkerStart.on('dragstart drag dragend', this._onReferenceMarkerDrag, this);
		this._referenceMarkerEnd.on('dragstart drag dragend', this._onReferenceMarkerDrag, this);
		this._cellAutofillMarker.on('dragstart drag dragend', this._onCellResizeMarkerDrag, this);
		this._dropDownButton.on('click', this._onDropDownButtonClick, this);
		// The 'tap' events are not broadcasted by L.Map.TouchGesture, A specialized 'dropdownmarkertapped' event is
		// generated just for the validity-dropdown-icon.
		map.on('dropdownmarkertapped', this._onDropDownButtonClick, this);

		map.setPermission(this.options.permission);

		map.fire('statusindicator', {statusType: 'loleafletloaded'});
	},

	// Returns true iff the document type is Writer.
	isWriter: function() {
		return this._docType === 'text';
	},

	// Returns true iff the document type is Calc.
	isCalc: function() {
		return this._docType === 'spreadsheet';
	},

	// Returns true iff the document type is Impress.
	isImpress: function() {
		return this._docType === 'presentation';
	},

	_createNewMouseEvent: function (type, inputEvent) {
		var event = inputEvent;
		if (inputEvent.type == 'touchstart' || inputEvent.type == 'touchmove') {
			event = inputEvent.touches[0];
		}
		else if (inputEvent.type == 'touchend') {
			event = inputEvent.changedTouches[0];
		}
		var newEvent = document.createEvent('MouseEvents');
		newEvent.initMouseEvent(
			type, true, true, window, 1,
			event.screenX, event.screenY,
			event.clientX, event.clientY,
			false, false, false, false, 0, null
		);
		return newEvent;
	},

	newAnnotationVex: function(comment, addCommentFn, isMod, displayContent) {
		var that = this;

		var commentData = null;
		var content = '';
		if (comment.author) {
			// New comment - full data
			commentData = comment;
		} else {
			// Modification
			commentData = comment._data;
			if (displayContent === undefined)
				content = commentData.text;
			else
				content = displayContent;
		}

		var dialog = vex.dialog.open({
			message: '',
			input: [
				'<textarea name="comment" class="loleaflet-annotation-textarea" style="max-width: 400px" required>' + content + '</textarea>'
			].join(''),
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('Save') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			],
			callback: function (data) {
				if (data) {
					var annotation = null;
					if (isMod) {
						annotation = comment;
					} else {
						annotation = L.annotation(L.latLng(0, 0), comment, {noMenu: true}).addTo(that._map);
						that._draft = annotation;
					}

					annotation._data.text = data.comment;
					comment.text = data.comment;

					// FIXME: Unify annotation code in all modules...
					addCommentFn.call(that, {annotation: annotation}, comment);
					if (!isMod)
						that._map.removeLayer(annotation);
				}
			}
		});

		var tagTd = 'td',
		empty = '',
		tagDiv = 'div';
		this._author = L.DomUtil.create('table', 'loleaflet-annotation-table');
		var tbody = L.DomUtil.create('tbody', empty, this._author);
		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'loleaflet-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);
		imgAuthor.setAttribute('src', L.LOUtil.getImageURL('user.svg'));
		imgAuthor.setAttribute('width', 32);
		imgAuthor.setAttribute('height', 32);
		this._authorAvatarImg = imgAuthor;
		this._contentAuthor = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-author', tdAuthor);
		this._contentDate = L.DomUtil.create(tagDiv, 'loleaflet-annotation-date', tdAuthor);

		$(this._nodeModifyText).text(commentData.text);
		$(this._contentAuthor).text(commentData.author);
		$(this._authorAvatarImg).attr('src', commentData.avatar);
		var user = this._map.getViewId(commentData.author);
		if (user >= 0) {
			var color = L.LOUtil.rgbToHex(this._map.getViewColor(user));
			$(this._authorAvatarImg).css('border-color', color);
		}

		if (commentData.dateTime) {
			var d = new Date(commentData.dateTime.replace(/,.*/, 'Z'));
			var dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
			$(this._contentDate).text(isNaN(d.getTime()) ? comment.dateTime: d.toLocaleDateString(String.locale, dateOptions));
		}

		dialog.contentEl.insertBefore(this._author, dialog.contentEl.childNodes[0]);

		$(dialog.contentEl).find('textarea').focus();
	},

	clearAnnotations: function() {
		console.debug('Implemented in child  classes');
	},

	layoutAnnotations: function () {
		console.debug('Implemented in child  classes');
	},

	unselectAnnotations: function () {
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
		this._saveMessageForReplay(textMsg);
		// 'tile:' is the most common message type; keep this the first.
		if (textMsg.startsWith('tile:')) {
			this._onTileMsg(textMsg, img);
		}
		else if (textMsg.startsWith('commandvalues:')) {
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
		else if (textMsg.startsWith('referencemarks:')) {
			this._onReferencesMsg(textMsg);
		}
		else if (textMsg.startsWith('referenceclear:')) {
			this._clearReferences();
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
				if (this.isWriter()) {
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
			if (this._map._clip)
				this._map._clip.setTextSelectionHTML(textMsg.substr(22));
			else
				// hack for ios and android to get selected text into hyperlink insertion dialog
				this._selectedTextContent = textMsg.substr(22);
		}
		else if (textMsg.startsWith('clipboardchanged')) {
			var jMessage = textMsg.substr(17);
			jMessage = JSON.parse(jMessage);

			if (jMessage.mimeType === 'text/plain') {
				this._map._clip.setTextSelectionHTML(jMessage.content);
				this._map._clip._execCopyCutPaste('copy');
			}
		}
		else if (textMsg.startsWith('textselectionend:')) {
			this._onTextSelectionEndMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionstart:')) {
			this._onTextSelectionStartMsg(textMsg);
		}
		else if (textMsg.startsWith('cellselectionarea:')) {
			this._onCellSelectionAreaMsg(textMsg);
		}
		else if (textMsg.startsWith('cellautofillarea:')) {
			this._onCellAutoFillAreaMsg(textMsg);
		}
		else if (textMsg.startsWith('complexselection:')) {
			if (this._map._clip)
				this._map._clip.onComplexSelection(textMsg.substr('complexselection:'.length));
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
		else if (textMsg.startsWith('tableselected:')) {
			this._onTableSelectedMsg(textMsg);
		}
		else if (textMsg.startsWith('editor:')) {
			this._updateEditor(textMsg);
		}
		else if (textMsg.startsWith('validitylistbutton:')) {
			this._onValidityListButtonMsg(textMsg);
		}
		else if (textMsg.startsWith('validityinputhelp:')) {
			this._onValidityInputHelpMsg(textMsg);
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
				if (!this._map._disableDefaultAction['UI_Close']) {
					this._map.remove();
				}
			}
		}
		else if (textMsg.startsWith('calcfunctionlist:')) {
			this._onCalcFunctionListMsg(textMsg.substring('calcfunctionlist:'.length + 1));
		}
		else if (textMsg.startsWith('tabstoplistupdate:')) {
			this._onTabStopListUpdate(textMsg);
		}
		else if (textMsg.startsWith('context:')) {
			var message = textMsg.substring('context:'.length + 1);
			message = message.split(' ');
			if (message.length > 1) {
				this._map.context = {context: message[1]};
				this._map.fire('contextchange', {context: message[1]});
			}
		}
		else if (textMsg.startsWith('formfieldbutton:')) {
			this._onFormFieldButtonMsg(textMsg);
		}
	},

	_onTabStopListUpdate: function (textMsg) {
		textMsg = textMsg.substring('tabstoplistupdate:'.length + 1);
		var json = JSON.parse(textMsg);
		this._map.fire('tabstoplistupdate', json);
	},

	toggleTileDebugModeImpl: function() {
		this._debug = !this._debug;
		if (!this._debug) {
			this._map.removeLayer(this._debugInfo);
			this._map.removeLayer(this._debugInfo2);
			$('.leaflet-control-layers-expanded').css('display', 'none');

			if (this._map._docLayer._docType === 'spreadsheet') {
				var section = this._map._docLayer._painter._sectionContainer.getSectionWithName('calc grid');
				if (section) {
					section.setDrawingOrder(L.CSections.CalcGrid.drawingOrder);
					section.sectionProperties.strokeStyle = '#c0c0c0';
				}
				this._map._docLayer._painter._sectionContainer.removeSection('splits');
				this._map._docLayer._painter._sectionContainer.reNewAllSections(true /* redraw */);
			}
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
		// When the user moves the focus to a different cell, a 'cellformula'
		// message is received from loolwsd, *then* a 'celladdress' message.
		var address = textMsg.substring(13);
		if (this._map._clip && !this._map['wopi'].DisableCopy) {
			this._map._clip.setTextSelectionText(this._lastFormula);
		}
		this._map.fire('celladdress', {address: address});
	},

	_onCellFormulaMsg: function (textMsg) {
		// When a 'cellformula' message from loolwsd is received,
		// store the text contents of the cell, but don't push
		// them to the clipboard container (yet).
		// This is done because loolwsd will send several 'cellformula'
		// messages during text composition, and resetting the contents
		// of the clipboard container mid-composition will easily break it.
		var formula = textMsg.substring(13);
		this._lastFormula = formula;
		this._map.fire('cellformula', {formula: formula});
	},

	_onCalcFunctionListMsg: function (textMsg) {
		var funcData = JSON.parse(textMsg);
		this._closeMobileWizard();

		var data = {
			id: 'funclist',
			type: '',
			text: _('Functions'),
			enabled: true,
			children: []
		};

		if (funcData.categories)
			this._onCalcFunctionListWithCategories(funcData, data);
		else
			this._onCalcFunctionList(funcData, data);

		if (funcData.wholeList)
			this._map._functionWizardData = data;

		this._openMobileWizard(data);
	},

	_onCalcFunctionList: function (funcList, data) {
		var entries = data.children;
		for (var idx = 0; idx < funcList.length; ++idx) {
			var func =  funcList[idx];
			var name = func.signature.split('(')[0];
			var entry = {
				id: '',
				type: 'calcfuncpanel',
				text: name,
				functionName: name,
				index: func.index,
				enabled: true,
				children: []
			};
			entries.push(entry);
			entries[entries.length-1].children[0] = {
				id: '',
				type: 'fixedtext',
				text: '<div class="func-info-sig">' + func.signature + '</div>' + '<div class="func-info-desc">' + func.description + '</div>',
				enabled: true,
				style: 'func-info'
			};
		}
	},

	_onCalcFunctionListWithCategories: function (funcData, data) {
		var categoryList = funcData.categories;
		var categoryEntries = data.children;
		for (var idx = 0; idx < categoryList.length; ++idx) {
			var category = categoryList[idx];
			var categoryEntry = {
				id: '',
				type: 'panel',
				text: category.name,
				index: idx,
				enabled: true,
				children: []
			};
			categoryEntries.push(categoryEntry);
		}

		var funcList = funcData.functions;
		for (idx = 0; idx < funcList.length; ++idx) {
			var func =  funcList[idx];
			var name = func.signature.split('(')[0];
			var funcEntry = {
				id: '',
				type: 'calcfuncpanel',
				text: name,
				functionName: name,
				index: func.index,
				category: func.category,
				enabled: true,
				children: []
			};
			var funcEntries = categoryEntries[func.category].children;
			funcEntries.push(funcEntry);

			funcEntries[funcEntries.length-1].children[0] = {
				id: '',
				type: 'fixedtext',
				text: '<div class="func-info-sig">' + func.signature + '</div>' + '<div class="func-info-desc">' + func.description + '</div>',
				enabled: true,
				style: 'func-info'
			};
		}
	},

	_onCursorVisibleMsg: function(textMsg) {
		var command = textMsg.match('cursorvisible: true');
		this._map._isCursorVisible = command ? true : false;
		this._removeSelection();
		this._onUpdateCursor();
	},

	_setCursorVisible: function() {
		this._map._isCursorVisible = true;
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
			encodeURIComponent(this._map.options.doc) + '/download/' + command.downloadid + wopiSrc;

		this._map.hideBusy();
		if (this._map['wopi'].DownloadAsPostMessage) {
			this._map.fire('postMessage', {msgId: 'Download_As', args: {Type: command.id, URL: url}});
		}
		else if (command.id === 'print') {
			if (L.Browser.gecko || L.Browser.edge || L.Browser.ie || this._map.options.print === false || L.Browser.cypressTest) {
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
			// Don't do a real download during testing
			if (!L.Browser.cypressTest)
				this._map._fileDownloader.src = url;
			else
				this._map._fileDownloader.setAttribute('data-src', url);
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
			var extraInfo = this._graphicSelection.extraInfo;
			if (extraInfo.id) {
				this._map._cacheSVG[extraInfo.id] = textMsg;
			}
			this._graphicMarker.removeEmbeddedSVG();
			this._graphicMarker.addEmbeddedSVG(textMsg);
		}
	},

	_resetSelectionRanges: function() {
		this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
	},

	_openMobileWizard: function(data) {
		this._map.fire('mobilewizard', data);
	},

	_closeMobileWizard: function() {
		this._map.fire('closemobilewizard');
	},

	_onGraphicSelectionMsg: function (textMsg) {
		if (this._map.hyperlinkPopup !== null) {
			this._closeURLPopUp();
		}
		if (textMsg.match('EMPTY')) {
			this._resetSelectionRanges();
		}
		else if (textMsg.match('INPLACE EXIT')) {
			this._map.removeObjectFocusDarkOverlay();
		}
		else if (textMsg.match('INPLACE')) {
			if (!this._map.hasObjectFocusDarkOverlay()) {
				var xTwips = this._map._docLayer._latLngToTwips(this._graphicSelection.getNorthWest()).x;
				var yTwips = this._map._docLayer._latLngToTwips(this._graphicSelection.getNorthWest()).y;
				var wTwips = this._map._docLayer._latLngToTwips(this._graphicSelection.getSouthEast()).x - xTwips;
				var hTwips = this._map._docLayer._latLngToTwips(this._graphicSelection.getSouthEast()).y - yTwips;

				this._map.addObjectFocusDarkOverlay(xTwips, yTwips, wTwips, hTwips);

				this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
				this._onUpdateGraphicSelection();
			}
		}
		else {
			textMsg = '[' + textMsg.substr('graphicselection:'.length) + ']';
			var msgData = JSON.parse(textMsg);
			var topLeftTwips = new L.Point(msgData[0], msgData[1]);
			var offset = new L.Point(msgData[2], msgData[3]);
			var bottomRightTwips = topLeftTwips.add(offset);
			this._graphicSelectionTwips = this._getGraphicSelectionRectangle(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._graphicSelection = new L.LatLngBounds(
				this._twipsToLatLng(this._graphicSelectionTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(this._graphicSelectionTwips.getBottomRight(), this._map.getZoom()));

			this._graphicSelectionAngle = (msgData.length > 4) ? msgData[4] : 0;

			this._graphicSelection.extraInfo = {};
			if (msgData.length > 5) {
				this._graphicSelection.extraInfo = msgData[5];
				var dragInfo = this._graphicSelection.extraInfo.dragInfo;
				if (dragInfo && dragInfo.dragMethod === 'PieSegmentDragging') {
					dragInfo.initialOffset /= 100.0;
					var dragDir = dragInfo.dragDirection;
					dragInfo.dragDirection = this._twipsToPixels(new L.Point(dragDir[0], dragDir[1]));
					dragDir = dragInfo.dragDirection;
					dragInfo.range2 = dragDir.x * dragDir.x + dragDir.y * dragDir.y;
				}
			}

			// defaults
			var extraInfo = this._graphicSelection.extraInfo;
			if (extraInfo.isDraggable === undefined)
				extraInfo.isDraggable = true;
			if (extraInfo.isResizable === undefined)
				extraInfo.isResizable = true;
			if (extraInfo.isRotatable === undefined)
				extraInfo.isRotatable = true;

			// Workaround for tdf#123874. For some reason the handling of the
			// shapeselectioncontent messages that we get back causes the WebKit process
			// to crash on iOS.
			if (!window.ThisIsTheiOSApp && this._graphicSelection.extraInfo.isDraggable && !this._graphicSelection.extraInfo.svg) {
				this._map._socket.sendMessage('rendershapeselection mimetype=image/svg+xml');
			}
		}

		// Graphics are by default complex selections, unless Core tells us otherwise.
		if (this._map._clip)
			this._map._clip.onComplexSelection('');
		if (this._selectionContentRequest) {
			clearTimeout(this._selectionContentRequest);
		}
		this._selectionContentRequest = setTimeout(L.bind(function () {
			this._map._socket.sendMessage('gettextselection mimetype=text/html');}, this), 100);

		this._onUpdateGraphicSelection();
	},

	_onGraphicViewSelectionMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('graphicviewselection:'.length + 1));
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
			var boundRectTwips = this._getGraphicSelectionRectangle(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._graphicViewMarkers[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(boundRectTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(boundRectTwips.getBottomRight(), this._map.getZoom()));
		}
		else {
			this._graphicViewMarkers[viewId].bounds = L.LatLngBounds.createDefault();
		}

		this._onUpdateGraphicViewSelection(viewId);

		if (this.isCalc()) {
			this._saveMessageForReplay(textMsg, viewId);
		}
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

		if (textMsg.match('EMPTY') || !this._map.isPermissionEdit()) {
			this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._cellCursor = L.LatLngBounds.createDefault();
			this._cellCursorXY = new L.Point(-1, -1);
		}
		else {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellCursorTwips = this._convertToTileTwipsSheetArea(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._cellCursor = new L.LatLngBounds(
				this._twipsToLatLng(this._cellCursorTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(this._cellCursorTwips.getBottomRight(), this._map.getZoom()));
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
		else if (!this._isEmptyRectangle(this._cellCursor)) {
			// This is needed for jumping view to cursor position on tab switch
			horizontalDirection = sign(this._cellCursor.getWest());
			verticalDirection = sign(this._cellCursor.getNorth());
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

		// Remove input help if there is any:
		this._removeInputHelpMarker();
	},

	_removeInputHelpMarker: function() {
		if (this._inputHelpPopUp) {
			this._map.removeLayer(this._inputHelpPopUp);
			this._inputHelpPopUp = null;
		}
	},

	_onDocumentRepair: function (textMsg) {
		if (!this._docRepair) {
			this._docRepair = L.control.documentRepair();
		}

		if (!this._docRepair.isVisible()) {
			this._docRepair.addTo(this._map);
			this._docRepair.fillActions(textMsg);
			this._docRepair.show();
		}
	},

	_onMousePointerMsg: function (textMsg) {
		textMsg = textMsg.substring(14); // "mousepointer: "
		textMsg = Cursor.getCustomCursor(textMsg) || textMsg;
		if (this._map._container.style.cursor !== textMsg) {
			this._map._container.style.cursor = textMsg;
		}
	},

	_showURLPopUp: function(position, url) {
		// # for internal links
		if (!url.startsWith('#')) {
			var link = L.DomUtil.createWithId('a', 'hyperlink-pop-up');
			link.innerText = url;
			this._map.hyperlinkPopup = new L.Popup({className: 'hyperlink-popup', closeButton: false, closeOnClick: false, autoPan: false})
				.setContent(link.outerHTML)
				.setLatLng(position)
				.openOn(this._map);
			var offsetDiffTop = $('.hyperlink-popup').offset().top - $('#map').offset().top;
			var offsetDiffLeft = $('.hyperlink-popup').offset().left - $('#map').offset().left;
			if (offsetDiffTop < 10) this._movePopUpBelow();
			if (offsetDiffLeft < 10) this._movePopUpRight();
			var map_ = this._map;
			var element = document.getElementById('hyperlink-pop-up');
			element.style.cursor = 'pointer';
			element.onclick = element.ontouchend = function() {
				map_.fire('warn', {url: url, map: map_, cmd: 'openlink'});
			};
		}
	},

	_movePopUpBelow: function() {
		var popUp = $('.hyperlink-popup').first();
		var bottom = parseInt(popUp.css('bottom')) - popUp.height();

		popUp.css({
			'bottom': bottom ? bottom + 'px': '',
			'display': 'flex',
			'flex-direction': 'column-reverse'
		});
		$('.leaflet-popup-tip-container').first().css('transform', 'rotate(180deg)');
	},

	_movePopUpRight: function() {
		$('.leaflet-popup-content-wrapper').first().css({
			'position': 'relative',
			'left': (this._map.hyperlinkPopup._containerWidth / 2)
		});
		$('.leaflet-popup-tip-container').first().css({
			'left': '25px'
		});
	},

	_closeURLPopUp: function() {
		this._map.closePopup(this._map.hyperlinkPopup);
		this._map.hyperlinkPopup = null;
	},

	_onInvalidateCursorMsg: function (textMsg) {
		textMsg = textMsg.substring('invalidatecursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var recCursor = this._getEditCursorRectangle(obj);
		if (recCursor === undefined) {
			return;
		}
		var modifierViewId = parseInt(obj.viewId);
		if (modifierViewId != this._viewId)
			return;

		this._cursorAtMispelledWord = obj.mispelledWord ? Boolean(parseInt(obj.mispelledWord)).valueOf() : false;
		this._visibleCursor = new L.LatLngBounds(
			this._twipsToLatLng(recCursor.getTopLeft(), this._map.getZoom()),
			this._twipsToLatLng(recCursor.getBottomRight(), this._map.getZoom()));
		this._cursorCorePixels = CBounds.fromCompat(this._twipsToCorePixelsBounds(recCursor));

		var cursorPos = this._visibleCursor.getNorthWest();
		var docLayer = this._map._docLayer;
		if ((docLayer._followEditor || docLayer._followUser) && this._map.lastActionByUser) {
			this._map._setFollowing(false, null);
		}
		this._map.lastActionByUser = false;

		this._map.hyperlinkUnderCursor = obj.hyperlink;
		this._closeURLPopUp();
		if (obj.hyperlink && obj.hyperlink.link) {
			this._showURLPopUp(cursorPos, obj.hyperlink.link);
		}

		if (!this._map.editorHasFocus() && this._map._isCursorVisible && (modifierViewId === this._viewId) && (this._map.isPermissionEdit())) {
			// Regain cursor if we had been out of focus and now have input.
			// Unless the focus is in the Calc Formula-Bar, don't steal the focus.
			if (!this._map.calcInputBarHasFocus())
				this._map.fire('editorgotfocus');
		}

		//first time document open, set last cursor position
		if (!this.lastCursorPos)
			this.lastCursorPos = recCursor.getTopLeft();

		var updateCursor = false;
		if (!this.lastCursorPos.equals(recCursor.getTopLeft())) {
			updateCursor = true;
			this.lastCursorPos = recCursor.getTopLeft();
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
			this._map.fire('updateEditorName', {username: this._map._viewInfo[editorId].username});
	},

	_onInvalidateViewCursorMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('invalidateviewcursor:'.length + 1));
		var viewId = parseInt(obj.viewId);
		var docLayer = this._map._docLayer;

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var rectangle = this._getEditCursorRectangle(obj);
		if (rectangle === undefined) {
			return;
		}

		this._viewCursors[viewId] = this._viewCursors[viewId] || {};
		this._viewCursors[viewId].bounds = new L.LatLngBounds(
			this._twipsToLatLng(rectangle.getTopLeft(), this._map.getZoom()),
			this._twipsToLatLng(rectangle.getBottomRight(), this._map.getZoom())),
		this._viewCursors[viewId].corepxBounds = CBounds.fromCompat(this._twipsToCorePixelsBounds(rectangle));
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

		this._saveMessageForReplay(textMsg, viewId);
	},

	_onCellViewCursorMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('cellviewcursor:'.length + 1));
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours
		if (viewId === this._viewId) {
			return;
		}

		this._cellViewCursors[viewId] = this._cellViewCursors[viewId] || {};
		if (!this._cellViewCursors[viewId].bounds) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
			this._cellViewCursors[viewId].corePixelBounds = new L.Bounds();
		}
		if (obj.rectangle.match('EMPTY')) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
			this._cellViewCursors[viewId].corePixelBounds = new L.Bounds();
		}
		else {
			var strTwips = obj.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var boundsTwips = this._convertToTileTwipsSheetArea(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._cellViewCursors[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(boundsTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(boundsTwips.getBottomRight(), this._map.getZoom()));
			var corePixelBounds = this._twipsToCorePixelsBounds(boundsTwips);
			corePixelBounds.round();
			this._cellViewCursors[viewId].corePixelBounds = corePixelBounds;
		}

		this._cellViewCursors[viewId].part = parseInt(obj.part);
		this._onUpdateCellViewCursor(viewId);

		if (this.isCalc()) {
			this._saveMessageForReplay(textMsg, viewId);
		}
	},

	_onUpdateCellViewCursor: function (viewId) {
		if (!this._cellViewCursors[viewId] || !this._cellViewCursors[viewId].bounds)
			return;

		var cellViewCursorMarker = this._cellViewCursors[viewId].marker;
		var viewPart = this._cellViewCursors[viewId].part;

		if (!this._isEmptyRectangle(this._cellViewCursors[viewId].bounds) && this._selectedPart === viewPart && this._map.hasInfoForView(viewId)) {
			if (!cellViewCursorMarker) {
				var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				cellViewCursorMarker = new CRectangle(this._cellViewCursors[viewId].corePixelBounds, {
					fill: false,
					color: backgroundColor,
					weight: 2,
					toCompatUnits: function (corePx) {
						return this._map.unproject(L.point(corePx)
							.divideBy(this._painter._dpiScale));
					}.bind(this)
				});
				this._cellViewCursors[viewId].marker = cellViewCursorMarker;
				cellViewCursorMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
				this._canvasOverlay.initPath(cellViewCursorMarker);
			}
			else {
				cellViewCursorMarker.setBounds(this._cellViewCursors[viewId].corePixelBounds);
			}
		}
		else if (cellViewCursorMarker) {
			this._canvasOverlay.removePath(cellViewCursorMarker);
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
			this._viewSelections[viewId].selection.remove();
			this._viewSelections[viewId].selection = undefined;
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

		// Sending postMessage about View_Added / View_Removed is
		// deprecated, going forward we prefer sending the entire information.
		this._map.fire('updateviewslist');
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
		if (this._searchTerm) {
			this._selections.clear();
		}
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

		var isPureJSON = textMsg.indexOf('=') === -1 && textMsg.indexOf('{') !== -1;
		if (isPureJSON) {
			var json = JSON.parse(textMsg);
			if (json.commandName && json.state) {
				this._map.fire('commandstatechanged', json);
			}
		} else {
			var index = textMsg.indexOf('=');
			var commandName = index !== -1 ? textMsg.substr(0, index) : '';
			var state = index !== -1 ? textMsg.substr(index + 1) : '';
			this._map.fire('commandstatechanged', {commandName : commandName, state : state});
		}
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

		var rectArray = this._getTextSelectionRectangles(textMsg);

		if (rectArray.length) {

			var rectangles = rectArray.map(function (rect) {
				return rect.getPointArray();
			});

			var docLayer = this;
			var pointSet = CPolyUtil.rectanglesToPointSet(rectangles,
				function (twipsPoint) {
					var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
					corePxPt.round();
					return corePxPt;
				});
			this._selections.setPointSet(pointSet);
			this._map.removeLayer(this._map._textInput._cursorHandler); // User selected a text, we remove the carret marker.
			if (this._selectionContentRequest) {
				clearTimeout(this._selectionContentRequest);
			}
			this._selectionContentRequest = setTimeout(L.bind(function () {
				this._map._socket.sendMessage('gettextselection mimetype=text/html');}, this), 100);
		}
		else {
			this._selections.clear();
		}

		this._onUpdateTextSelection();
	},

	_onTextViewSelectionMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('textviewselection:'.length + 1));
		var viewId = parseInt(obj.viewId);
		var viewPart = parseInt(obj.part);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var rectArray = this._getTextSelectionRectangles(obj.selection);
		this._viewSelections[viewId] = this._viewSelections[viewId] || {};

		if (rectArray.length) {

			var rectangles = rectArray.map(function (rect) {
				return rect.getPointArray();
			});

			this._viewSelections[viewId].part = viewPart;
			var docLayer = this;
			this._viewSelections[viewId].pointSet = CPolyUtil.rectanglesToPointSet(rectangles,
				function (twipsPoint) {
					var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
					corePxPt.round();
					return corePxPt;
				});
		} else {
			this._viewSelections[viewId].pointSet = new CPointSet();
		}

		this._onUpdateTextViewSelection(viewId);

		this._saveMessageForReplay(textMsg, viewId);
	},

	_updateReferenceMarks: function() {
		this._clearReferences();

		if (!this._referencesAll)
			return;

		for (var i = 0; i < this._referencesAll.length; i++) {
			// Avoid doubled marks, add only marks for current sheet
			if (!this._references.hasMark(this._referencesAll[i].mark)
				&& this._selectedPart === this._referencesAll[i].part) {
				this._references.addMark(this._referencesAll[i].mark);
			}
			if (!window.mode.isDesktop()) {
				if (!this._referenceMarkerStart.isDragged) {
					this._map.addLayer(this._referenceMarkerStart);
					var sizeStart = this._referenceMarkerStart._icon.getBoundingClientRect();
					var posStart = this._referencesAll[i].mark.getBounds().getTopLeft().divideBy(this._painter.getDpiScale());
					posStart = posStart.subtract(new L.Point(sizeStart.width / 2, sizeStart.height / 2));
					posStart = this._map.unproject(posStart);
					this._referenceMarkerStart.setLatLng(posStart);
				}

				if (!this._referenceMarkerEnd.isDragged) {
					this._map.addLayer(this._referenceMarkerEnd);
					var sizeEnd = this._referenceMarkerEnd._icon.getBoundingClientRect();
					var posEnd = this._referencesAll[i].mark.getBounds().getBottomRight().divideBy(this._painter.getDpiScale());
					posEnd = posEnd.subtract(new L.Point(sizeEnd.width / 2, sizeEnd.height / 2));
					posEnd = this._map.unproject(posEnd);
					this._referenceMarkerEnd.setLatLng(posEnd);
				}
			}
		}
	},

	_onReferencesMsg: function (textMsg) {
		textMsg = textMsg.substr(textMsg.indexOf(' ') + 1);
		var marks = JSON.parse(textMsg);
		marks = marks.marks;
		var references = [];
		this._referencesAll = [];

		for (var mark = 0; mark < marks.length; mark++) {
			var strTwips = marks[mark].rectangle.match(/\d+/g);
			var strColor = marks[mark].color;
			var part = parseInt(marks[mark].part);

			if (strTwips != null) {
				var rectangles = [];
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
					var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
					var boundsTwips = this._convertToTileTwipsSheetArea(
						new L.Bounds(topLeftTwips, topLeftTwips.add(offset)));
					rectangles.push([boundsTwips.getBottomLeft(), boundsTwips.getBottomRight(),
						boundsTwips.getTopLeft(), boundsTwips.getTopRight()]);
				}

				var docLayer = this;
				var pointSet = CPolyUtil.rectanglesToPointSet(rectangles, function (twipsPoint) {
					var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
					corePxPt.round();
					return corePxPt;
				});
				var reference = new CPolygon(pointSet, {
					pointerEvents: 'none',
					fillColor: '#' + strColor,
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25});

				references.push({mark: reference, part: part});
			}
		}

		for (i = 0; i < references.length; i++) {
			this._referencesAll.push(references[i]);
		}

		this._updateReferenceMarks();
	},

	_updateScrollOnCellSelection: function (oldSelection, newSelection) {
		if (this.isCalc() && oldSelection) {
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
					if (!this._map.wholeColumnSelected && !this._map.wholeRowSelected)
						this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}
		}
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var rectangles = this._getTextSelectionRectangles(textMsg);

		if (rectangles.length && this._map.isPermissionEdit()) {
			var topLeftTwips = rectangles[0].getTopLeft();
			var bottomRightTwips = rectangles[0].getBottomRight();
			var oldSelection = this._textSelectionEnd;
			this._textSelectionEnd = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));

			this._updateScrollOnCellSelection(oldSelection, this._textSelectionEnd);
			this._updateMarkers();
		}
		else {
			this._textSelectionEnd = null;
		}
	},

	_onTextSelectionStartMsg: function (textMsg) {
		var rectangles = this._getTextSelectionRectangles(textMsg);

		if (rectangles.length && this._map.isPermissionEdit()) {
			var topLeftTwips = rectangles[0].getTopLeft();
			var bottomRightTwips = rectangles[0].getBottomRight();
			var oldSelection = this._textSelectionStart;
			//FIXME: The selection is really not two points, as they can be
			//FIXME: on top of each other, but on separate lines. We should
			//FIXME: capture the whole area in _onTextSelectionMsg.
			this._textSelectionStart = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));

			this._updateScrollOnCellSelection(oldSelection, this._textSelectionStart);
		}
		else {
			this._textSelectionStart = null;
		}
	},

	_onCellSelectionAreaMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map.isPermissionEdit()) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var boundsTwips = this._convertToTileTwipsSheetArea(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			var oldSelection = this._cellSelectionArea;
			this._cellSelectionArea = new L.LatLngBounds(
				this._twipsToLatLng(boundsTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(boundsTwips.getBottomRight(), this._map.getZoom()));

			if (this._cellCursor === null) {
				this._cellCursor = L.LatLngBounds.createDefault();
			}
			this._updateScrollOnCellSelection(oldSelection, this._cellSelectionArea);
		} else {
			this._cellSelectionArea = null;
		}
	},

	_onCellAutoFillAreaMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map.isPermissionEdit()) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellAutoFillArea = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		} else {
			this._cellAutoFillArea = null;
		}
	},

	_onDialogPaintMsg: function(textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);

		// this._map._socket.sendMessage('DEBUG _onDialogPaintMsg: hash=' + command.hash + ' img=' + typeof(img) + (typeof(img) == 'string' ? (' (length:' + img.length + ':"' + img.substring(0, 30) + (img.length > 30 ? '...' : '') + '")') : '') + ', cache size ' + this._pngCache.length);
		if (command.nopng) {
			var found = false;
			for (var i = 0; i < this._pngCache.length; i++) {
				if (this._pngCache[i].hash == command.hash) {
					found = true;
					// this._map._socket.sendMessage('DEBUG - Found in cache');
					img = this._pngCache[i].img;
					// Remove item (and add it below at the start of the array)
					this._pngCache.splice(i, 1);
					break;
				}
			}
			if (!found) {
				var message = 'windowpaint: message assumed PNG for hash ' + command.hash
				    + ' is cached here in the client but not found';
				if (L.Browser.cypressTest)
					throw new Error(message);
				this._map._socket.sendMessage('ERROR ' + message);
				// Not sure what to do. Ask the server to re-send the windowpaint: message but this time including the PNG?
			}
		} else {
			// Sanity check: If we get a PNG it should be for a hash that we don't have cached
			for (i = 0; i < this._pngCache.length; i++) {
				if (this._pngCache[i].hash == command.hash) {
					message = 'windowpaint: message included PNG for hash ' + command.hash
					    + ' even if it was already cached here in the client';
					if (L.Browser.cypressTest)
						throw new Error(message);
					this._map._socket.sendMessage('ERROR ' + message);
					// Remove the extra copy, code below will add it at the start of the array
					this._pngCache.splice(i, 1);
					break;
				}
			}
		}

		// If cache is max size, drop the last element
		if (this._pngCache.length == this._map._socket.TunnelledDialogImageCacheSize) {
			// this._map._socket.sendMessage('DEBUG - Dropping last cache element');
			this._pngCache.pop();
		}

		// Add element to cache
		this._pngCache.unshift({hash: command.hash, img:img});

		// this._map._socket.sendMessage('DEBUG - Cache size now ' + this._pngCache.length);

		this._map.fire('windowpaint', {
			id: command.id,
			img: img,
			width: command.width,
			height: command.height,
			rectangle: command.rectangle,
			hash: command.hash
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
			// for (var i = 0; i < pixSize; ++i)
			// {
			// oldData[i*4 + 1] = 128;
			// }

			// wipe to grey.
			// for (var i = 0; i < pixSize * 4; ++i)
			// {
			// imgData.data[i] = 128;
			// }

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
		// cache the following parts tiles
		// this will help avoiding the tear effect when switching to the next part
		if (this._selectedPart !== coords.part && !this._tileCache[key]) {
			this._tileCache[key] = img;
		}
		L.Log.log(textMsg, 'INCOMING', key);

		// Send acknowledgment, that the tile message arrived
		var tileID = command.part + ':' + command.x + ':' + command.y + ':' + command.tileWidth + ':' + command.tileHeight + ':' + command.nviewid;
		this._map._socket.sendMessage('tileprocessed tile=' + tileID);
	},

	_tileOnLoad: function (done, tile) {
		done(null, tile);
		if (window.ThisIsTheiOSApp) {
			window.webkit.messageHandlers.lool.postMessage('REMOVE ' + tile.src, '*');
		}
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_mapOnError: function (e) {
		if (e.msg && this._map.isPermissionEdit()) {
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
		this._selections.clear();
		// hide the selection handles
		this._onUpdateTextSelection();
		// hide the graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		this._onUpdateGraphicSelection();
		this._cellCursor = null;
		this._cellCursorXY = null;
		this._prevCellCursor = null;
		this._prevCellCursorXY = null;
		this._onUpdateCellCursor();
		if (this._map._clip)
			this._map._clip.clearSelection();
		else
			this._selectedTextContent = '';
	},

	containsSelection: function (latlng) {
		var corepxPoint = this._map.project(latlng);
		return this._selections.contains(corepxPoint);
	},

	_clearReferences: function () {
		this._references.clear();

		if (!this._referenceMarkerStart.isDragged)
			this._map.removeLayer(this._referenceMarkerStart);
		if (!this._referenceMarkerEnd.isDragged)
			this._map.removeLayer(this._referenceMarkerEnd);
	},

	_postMouseEvent: function(type, x, y, count, buttons, modifier) {

		if (this._map.calcInputBarHasFocus() && type === 'move') {
			// When the Formula-bar has the focus, sending
			// mouse move with the document coordinates
			// hides the cursor (lost focus?). This is clearly
			// a bug in Core, but we need to work around it
			// until fixed. Just don't send mouse move.
			return;
		}

		this._sendClientZoom();

		this._sendClientVisibleArea();

		this._map._socket.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count +
				' buttons=' + buttons + ' modifier=' + modifier);


		if (type === 'buttondown') {
			this._clearSearchResults();
		}
	},

	// Given a character code and a UNO keycode, send a "key" message to loolwsd.
	//
	// "type" is either "input" for key presses (akin to the DOM "keypress"
	// / "beforeinput" events) and "up" for key releases (akin to the DOM
	// "keyup" event).
	//
	// PageUp/PageDown and select column & row are handled as special cases for spreadsheets - in
	// addition of sending messages to loolwsd, they move the cell cursor around.
	postKeyboardEvent: function(type, charCode, unoKeyCode) {
		var winId = this._map.getWinId();
		if (
			this.isCalc() &&
			this._prevCellCursor &&
			type === 'input' &&
			winId === 0
		) {
			if (unoKeyCode === 1030) { // PgUp
				if (this._cellCursorOnPgUp) {
					return;
				}
				this._cellCursorOnPgUp = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
			else if (unoKeyCode === 1031) { // PgDn
				if (this._cellCursorOnPgDn) {
					return;
				}
				this._cellCursorOnPgDn = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
			else if (unoKeyCode === 9476) { // Select whole column.
				this._map.wholeColumnSelected = true;
			}
			else if (unoKeyCode === 5380) { // Select whole row.
				this._map.wholeRowSelected = true;
			}
		}

		this._sendClientZoom();

		this._sendClientVisibleArea();

		if (winId === 0) {
			this._map._socket.sendMessage(
				'key' +
				' type=' + type +
				' char=' + charCode +
				' key=' + unoKeyCode +
				'\n'
			);
		} else {
			this._map._socket.sendMessage(
				'windowkey id=' + winId +
				' type=' + type +
				' char=' + charCode +
				' key=' + unoKeyCode +
				'\n'
			);
		}
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
		if (!this.isCalc())
			this._replayPrintTwipsMsgs();
		this._onUpdateCursor(null, true);
		this.updateAllViewCursors();
	},

	_updateCursorPos: function () {
		var cursorPos = this._cursorCorePixels.getTopLeft();
		var cursorSize = this._cursorCorePixels.getSize();

		if (!this._cursorMarker) {
			this._cursorMarker = new Cursor(cursorPos, cursorSize, this._map, {
				blink: true,
				dpiScale: this._painter.getDpiScale()
			});
		} else {
			this._cursorMarker.setPositionSize(cursorPos, cursorSize);
		}
	},

	_allowViewJump: function() {
		return (!this._map._clip || this._map._clip._selectionType !== 'complex') &&
		!this._referenceMarkerStart.isDragged && !this._referenceMarkerEnd.isDragged;
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (scroll, zoom) {

		if (!this._visibleCursor ||
			this._referenceMarkerStart.isDragged ||
			this._referenceMarkerEnd.isDragged) {
			return;
		}

		var cursorPos = this._visibleCursor.getNorthWest();
		var docLayer = this._map._docLayer;

		if (!zoom
		&& scroll !== false
		&& this._map._isCursorVisible
		&& this._allowViewJump()) {

			var paneRectsInLatLng = this.getPaneLatLngRectangles();

			if (!this._visibleCursor.isInAny(paneRectsInLatLng)) {
				var center = this._map.project(cursorPos);
				center = center.subtract(this._map.getSize().divideBy(2));
				center.x = Math.round(center.x < 0 ? 0 : center.x);
				center.y = Math.round(center.y < 0 ? 0 : center.y);

				if (!(this._selectionHandles.start && this._selectionHandles.start.isDragged) &&
				    !(this._selectionHandles.end && this._selectionHandles.end.isDragged) &&
				    !(docLayer._followEditor || docLayer._followUser) &&
				    !this._map.calcInputBarHasFocus()) {
					this._map.fire('scrollto', {x: center.x, y: center.y, calledFromInvalidateCursorMsg: scroll !== undefined});
				}
			}
		}

		this._updateCursorAndOverlay();

		this.eachView(this._viewCursors, function (item) {
			var viewCursorMarker = item.marker;
			if (viewCursorMarker) {
				viewCursorMarker.setOpacity(this.isCursorVisible() && this._cursorMarker.getPosition().equals(viewCursorMarker.getPosition()) ? 0 : 1);
			}
		}, this, true);
	},

	// enable or disable blinking cursor and  the cursor overlay depending on
	// the state of the document (if the falgs are set)
	_updateCursorAndOverlay: function (/*update*/) {
		if (this._map.isPermissionEdit()
		&& this._map._isCursorVisible   // only when LOK has told us it is ok
		&& this._map.editorHasFocus()   // not when document is not focused
		&& !this._map.isSearching()  	// not when searching within the doc
		&& !this._isZooming             // not when zooming
		&& !this._isEmptyRectangle(this._visibleCursor)) {

			this._updateCursorPos();

			this._map._textInput.showCursor();

			// Don't show the keyboard when the Wizard is visible.
			if (!window.mobileWizard && !window.pageMobileWizard && !window.insertionMobileWizard) {
				// If the user is editing, show the keyboard, but don't change
				// anything if nothing is changed.

				// We will focus map if no comment is being edited (writer only for now).
				if (this._docType === 'text') {
					if (!this._annotations._selected || !this._annotations._selected.isEdit())
						this._map.focus(true);
				}
				else
					this._map.focus(true);
			}
		} else {
			this._map._textInput.hideCursor();
			// Maintain input if a dialog or search-box has the focus.
			if (this._map.editorHasFocus() && !this._map.isSearching())
				this._map.focus(false);
		}
	},

	// Update colored non-blinking view cursor
	_onUpdateViewCursor: function (viewId) {
		if (typeof this._viewCursors[viewId] !== 'object' ||
		    typeof this._viewCursors[viewId].bounds !== 'object') {
			return;
		}

		var pixBounds = this._viewCursors[viewId].corepxBounds;
		var viewCursorPos = pixBounds.getTopLeft();
		var viewCursorMarker = this._viewCursors[viewId].marker;
		var viewCursorVisible = this._viewCursors[viewId].visible;
		var viewPart = this._viewCursors[viewId].part;

		if (!this._map.isViewReadOnly(viewId) &&
		    viewCursorVisible &&
		    !this._isZooming &&
		    !this._isEmptyRectangle(this._viewCursors[viewId].bounds) &&
		    (this.isWriter() || this._selectedPart === viewPart)) {
			if (!viewCursorMarker) {
				var viewCursorOptions = {
					color: L.LOUtil.rgbToHex(this._map.getViewColor(viewId)),
					blink: false,
					header: true, // we want a 'hat' to our view cursors (which will contain view user names)
					headerTimeout: 3000, // hide after some interval
					zIndex: viewId,
					headerName: this._map.getViewName(viewId),
					dpiScale: this._painter.getDpiScale()
				};
				viewCursorMarker = new Cursor(viewCursorPos, pixBounds.getSize(), this._map, viewCursorOptions);
				this._viewCursors[viewId].marker = viewCursorMarker;
			}
			else {
				viewCursorMarker.setPositionSize(viewCursorPos, pixBounds.getSize());
			}
			viewCursorMarker.setOpacity(this.isCursorVisible() && this._cursorMarker.getPosition().equals(viewCursorMarker.getPosition()) ? 0 : 1);
			if (!viewCursorMarker.isVisible())
				viewCursorMarker.add();
		}
		else if (viewCursorMarker.isVisible()) {
			viewCursorMarker.remove();
		}

		if (this._viewCursors[viewId].marker && this._viewCursors[viewId].marker.isVisible())
			this._viewCursors[viewId].marker.showCursorHeader();
	},

	updateAllViewCursors : function() {
		for (var key in this._viewCursors) {
			this._onUpdateViewCursor(key);
		}
	},

	isCursorVisible: function() {
		return this._cursorMarker ? this._cursorMarker.isVisible() : false;
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
		var viewPointSet = this._viewSelections[viewId].pointSet;
		var viewSelection = this._viewSelections[viewId].selection;
		var viewPart = this._viewSelections[viewId].part;

		if (viewPointSet &&
		    (this.isWriter() || this._selectedPart === viewPart)) {

			if (viewSelection) {
				// change previous selections
				viewSelection.setPointSet(viewPointSet);
			} else {
				viewSelection = new CSelections(viewPointSet, this._canvasOverlay,
					this._painter._dpiScale, this._selectionsDataDiv, this._map, true, viewId);
				this._viewSelections[viewId].selection = viewSelection;
			}
		}
		else if (viewSelection) {
			viewSelection.clear();
		}
	},

	_onUpdateGraphicViewSelection: function (viewId) {
		var viewBounds = this._graphicViewMarkers[viewId].bounds;
		var viewMarker = this._graphicViewMarkers[viewId].marker;
		var viewPart = this._graphicViewMarkers[viewId].part;

		if (!this._isEmptyRectangle(viewBounds) &&
		   (this.isWriter() || this._selectedPart === viewPart)) {
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
			this._graphicMarker.setVisible(true);
			this._graphicMarker._startPos = aPos;
		}
		else if (e.type === 'graphicmoveend' && this._graphicMarker._startPos) {
			var deltaPos = aPos.subtract(this._graphicMarker._startPos);
			if (deltaPos.x === 0 && deltaPos.y === 0) {
				this._graphicMarker.isDragged = false;
				this._graphicMarker.setVisible(false);
				return;
			}

			var param;
			var dragConstraint = this._graphicSelection.extraInfo.dragInfo;
			if (dragConstraint) {
				if (dragConstraint.dragMethod === 'PieSegmentDragging') {

					deltaPos = this._twipsToPixels(deltaPos);
					var dx = deltaPos.x;
					var dy = deltaPos.y;

					var initialOffset = dragConstraint.initialOffset;
					var dragDirection = dragConstraint.dragDirection;
					var additionalOffset = (dx * dragDirection.x + dy * dragDirection.y) / dragConstraint.range2;
					if (additionalOffset < -initialOffset)
						additionalOffset = -initialOffset;
					else if (additionalOffset > (1.0 - initialOffset))
						additionalOffset = 1.0 - initialOffset;

					var offset = Math.round((initialOffset + additionalOffset) * 100);

					// hijacking the uno:TransformDialog msg for sending the new offset value
					// for the pie segment dragging method;
					// indeed there isn't any uno msg dispatching on the core side, but a chart controller dispatching
					param = {
						Action: {
							type: 'string',
							value: 'PieSegmentDragging'
						},
						Offset: {
							type: 'long',
							value: offset
						}
					};
				}
			}
			else {
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

				if (this.isCalc() && this.options.printTwipsMsgsEnabled) {
					newPos = this.sheetGeometry.getPrintTwipsPointFromTile(newPos);
				}

				param = {
					TransformPosX: {
						type: 'long',
						value: newPos.x
					},
					TransformPosY: {
						type: 'long',
						value: newPos.y
					}
				};
			}
			this._map.sendUnoCommand('.uno:TransformDialog ', param);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
		}
	},

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if (!e.pos) { return; }
		if (!e.handleId) { return; }

		var aPos = this._latLngToTwips(e.pos);
		var selMin = this._graphicSelectionTwips.min;
		var selMax = this._graphicSelectionTwips.max;
		var handleId = e.handleId;

		if (e.type === 'scalestart') {
			this._graphicMarker.isDragged = true;
			this._graphicMarker.setVisible(true);
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
			// fill params for uno command
			var param = {
				HandleNum: {
					type: 'long',
					value: handleId
				},
				NewPosX: {
					type: 'long',
					value: aPos.x
				},
				NewPosY: {
					type: 'long',
					value: aPos.y
				}
			};

			this._map.sendUnoCommand('.uno:MoveShapeHandle', param);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
			this._graphicMarker.dragHorizDir = undefined;
			this._graphicMarker.dragVertDir = undefined;
		}
	},

	_onGraphicRotate: function (e) {
		if (e.type === 'rotatestart') {
			this._graphicMarker.isDragged = true;
			this._graphicMarker.setVisible(true);
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
			this._graphicMarker.setVisible(false);
		}
	},

	// Update dragged text selection.
	_onSelectionHandleDrag: function (e) {
		if (e.type === 'drag') {
			window.IgnorePanning = true;
			e.target.isDragged = true;

			if (!e.originalEvent.pageX && !e.originalEvent.pageY) {
				return;
			}

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
			window.IgnorePanning = undefined;
			e.target.isDragged = false;
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

	// Update dragged text selection.
	_onCellResizeMarkerDrag: function (e) {
		var buttonType = null;
		if (e.type === 'dragstart') {
			e.target.isDragged = true;

			// handle scrolling
			if (this._cellAutofillMarker === e.target) {
				var autoFillPosition = this._latLngToTwips(this._cellAutoFillArea.getCenter());
				this._postMouseEvent('buttondown', autoFillPosition.x, autoFillPosition.y, 1, 1, 0);
				buttonType = 'move';
			}
		}
		else if (e.type === 'drag') {
			var event = e.originalEvent;
			if (e.originalEvent.touches && e.originalEvent.touches.length > 0) {
				event = e.originalEvent.touches[0];
			}
			if (!event.pageX && !event.pageY) {
				return;
			}

			// handle scrolling

			// This is rather hacky, but it seems to be the only way to make the
			// marker follow the mouse cursor if the document is autoscrolled under
			// us. (This can happen when we're changing the selection if the cursor
			// moves somewhere that is considered off screen.)

			// Onscreen position of the cursor, i.e. relative to the browser window
			var boundingrect = e.target._icon.getBoundingClientRect();
			var cursorPos = L.point(boundingrect.left, boundingrect.top);
			var expectedPos = L.point(event.pageX, event.pageY).subtract(e.target.dragging._draggable.startOffset);

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

			// cell auto marker
			if (this._cellAutofillMarker === e.target) {
				buttonType = 'move';
			}
		} else if (e.type === 'dragend') {
			e.target.isDragged = false;

			// handle scrolling
			this._map.focus();
			this._map.fire('scrollvelocity', {vx: 0, vy: 0});

			// cell auto marker
			if (this._cellAutofillMarker === e.target) {
				buttonType = 'buttonup';
			}
		}

		// modify the mouse position - move to center of the marker
		var aMousePosition = e.target.getLatLng();
		aMousePosition = this._map.project(aMousePosition);
		var size;
		if (this._cellResizeMarkerStart === e.target) {
			size = this._cellResizeMarkerStart._icon.getBoundingClientRect();
		}
		else if (this._cellResizeMarkerEnd === e.target) {
			size = this._cellResizeMarkerEnd._icon.getBoundingClientRect();
		}
		else if (this._cellAutofillMarker === e.target) {
			size = this._cellAutofillMarker._icon.getBoundingClientRect();
		}
		aMousePosition = aMousePosition.add(new L.Point(size.width / 2, size.height / 2));
		aMousePosition = this._map.unproject(aMousePosition);
		aMousePosition = this._latLngToTwips(aMousePosition);

		if (this._cellResizeMarkerStart === e.target) {
			this._postSelectTextEvent('start', aMousePosition.x, aMousePosition.y);
			if (e.type === 'dragend') {
				this._onUpdateCellResizeMarkers();
				window.IgnorePanning = undefined;
			}
		}
		else if (this._cellResizeMarkerEnd === e.target) {
			this._postSelectTextEvent('end', aMousePosition.x, aMousePosition.y);
			if (e.type === 'dragend') {
				this._onUpdateCellResizeMarkers();
				window.IgnorePanning = undefined;
			}
		}
		else if (this._cellAutofillMarker === e.target) {
			this._postMouseEvent(buttonType, aMousePosition.x, aMousePosition.y, 1, 1, 0);
		}
	},

	_onReferenceMarkerDrag: function(e) {
		if (e.type === 'dragstart') {
			e.target.isDragged = true;
			window.IgnorePanning = true;
		}
		else if (e.type === 'drag') {
			var startPos = this._map.project(this._referenceMarkerStart.getLatLng());
			var startSize = this._referenceMarkerStart._icon.getBoundingClientRect();
			startPos = startPos.add(new L.Point(startSize.width, startSize.height));
			var start = this.sheetGeometry.getCellFromPos(this._latLngToTwips(this._map.unproject(startPos)), 'tiletwips');

			var endPos = this._map.project(this._referenceMarkerEnd.getLatLng());
			var endSize = this._referenceMarkerEnd._icon.getBoundingClientRect();
			endPos = endPos.subtract(new L.Point(endSize.width / 2, endSize.height / 2));
			var end = this.sheetGeometry.getCellFromPos(this._latLngToTwips(this._map.unproject(endPos)), 'tiletwips');

			this._sendReferenceRangeCommand(start.x, start.y, end.x, end.y);
		}
		else if (e.type === 'dragend') {
			e.target.isDragged = false;
			window.IgnorePanning = undefined;
			this._updateReferenceMarks();
		}
	},

	_sendReferenceRangeCommand: function(startCol, startRow, endCol, endRow) {
		this._map.sendUnoCommand(
			'.uno:CurrentFormulaRange?StartCol=' + startCol +
			'&StartRow=' + startRow +
			'&EndCol=' + endCol +
			'&EndRow=' + endRow +
			'&Table=' + this._map._docLayer._selectedPart
		);
	},

	_onDropDownButtonClick: function () {
		if (this._validatedCellXY && this._cellCursorXY && this._validatedCellXY.equals(this._cellCursorXY)) {
			this._map.sendUnoCommand('.uno:DataSelect');
		}
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (this._graphicSelection && !this._isEmptyRectangle(this._graphicSelection)) {
			// Hide the keyboard on graphic selection, unless cursor is visible.
			this._map.focus(this.isCursorVisible());

			if (this._graphicMarker) {
				this._graphicMarker.removeEventParent(this._map);
				this._graphicMarker.off('scalestart scaleend', this._onGraphicEdit, this);
				this._graphicMarker.off('rotatestart rotateend', this._onGraphicRotate, this);
				if (this._graphicMarker.dragging)
					this._graphicMarker.dragging.disable();
				this._graphicMarker.transform.disable();
				this._map.removeLayer(this._graphicMarker);
			}

			if (!this._map.isPermissionEdit()) {
				return;
			}

			var extraInfo = this._graphicSelection.extraInfo;
			this._graphicMarker = L.svgGroup(this._graphicSelection, {
				draggable: extraInfo.isDraggable,
				dragConstraint: extraInfo.dragInfo,
				svg: this._map._cacheSVG[extraInfo.id],
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
			if (extraInfo.isDraggable)
				this._graphicMarker.dragging.enable();
			this._graphicMarker.transform.enable({
				scaling: extraInfo.isResizable,
				rotation: extraInfo.isRotatable && !this.hasTableSelection(),
				uniformScaling: !this._isGraphicAngleDivisibleBy90(),
				handles: (extraInfo.handles) ? extraInfo.handles.kinds || [] : [],
				shapeType: extraInfo.type,
				scaleSouthAndEastOnly: this.hasTableSelection()});
			if (extraInfo.dragInfo && extraInfo.dragInfo.svg) {
				this._graphicMarker.removeEmbeddedSVG();
				this._graphicMarker.addEmbeddedSVG(extraInfo.dragInfo.svg);
			}
		}
		else if (this._graphicMarker) {
			this._graphicMarker.off('graphicmovestart graphicmoveend', this._onGraphicMove, this);
			this._graphicMarker.off('scalestart scaleend', this._onGraphicEdit, this);
			this._graphicMarker.off('rotatestart rotateend', this._onGraphicRotate, this);
			if (this._graphicMarker.dragging)
				this._graphicMarker.dragging.disable();
			this._graphicMarker.transform.disable();
			this._map.removeLayer(this._graphicMarker);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
		}
		this._updateCursorAndOverlay();
	},

	_onUpdateCellCursor: function (horizontalDirection, verticalDirection, onPgUpDn) {
		this._onUpdateCellResizeMarkers();
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			if (this._map.dialog._calcInputBar && !this._cellCursorXY.equals(this._prevCellCursorXY)) {
				var inputBarId = this._map.dialog._calcInputBar.id;
				this._map.dialog._updateTextSelection(inputBarId);
			}
			var mapBounds = this._map.getBounds();
			if (!this._cellCursorXY.equals(this._prevCellCursorXY) &&
			    !this._map.calcInputBarHasFocus()) {
				var scroll = this._calculateScrollForNewCellCursor();
				console.assert(scroll instanceof L.LatLng, '_calculateScrollForNewCellCursor returned wrong type');
				if (scroll.lng !== 0 || scroll.lat !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scroll.lng;
					newCenter.lat += scroll.lat;
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

			var corePxBounds = this._twipsToCorePixelsBounds(this._cellCursorTwips);
			corePxBounds.round();
			if (this._cellCursorMarker) {
				this._cellCursorMarker.setBounds(corePxBounds);
				this._map.removeLayer(this._dropDownButton);
			}
			else {
				var cursorStyle = new CStyleData(this._cursorDataDiv);
				this._cellCursorMarker = new CRectangle(
					corePxBounds,
					{
						name: 'cell-cursor',
						pointerEvents: 'none',
						fill: false,
						color: cursorStyle.getPropValue('--stroke-color'),
						weight: Math.round(cursorStyle.getIntPropValue('--weight') *
							(this._painter ? this._painter._dpiScale : 1))
					});
				if (!this._cellCursorMarker) {
					this._map.fire('error', {msg: 'Cell Cursor marker initialization', cmd: 'cellCursor', kind: 'failed', id: 1});
					return;
				}
				this._canvasOverlay.initPath(this._cellCursorMarker);
			}

			this._addDropDownMarker();

			var hasTunneledDialogOpened = this._map.dialog ? this._map.dialog.hasOpenedDialog() : false;
			var hasJSDialogOpened = this._map.jsdialog ? this._map.jsdialog.hasDialogOpened() : false;
			var isEditingAnnotation = this.editedAnnotation &&
				(this._map.hasLayer(this.editedAnnotation) || this._map.hasLayer(this.editedAnnotation.annotation));
			var isAnyInputFocused = $('input:focus').length > 0;
			var dontFocusDocument = hasTunneledDialogOpened || hasJSDialogOpened || isEditingAnnotation || isAnyInputFocused;

			// when the cell cursor is moving, the user is in the document,
			// and the focus should leave the cell input bar
			// exception: when dialog opened don't focus the document
			if (!dontFocusDocument)
				this._map.fire('editorgotfocus');
		}
		else if (this._cellCursorMarker) {
			this._canvasOverlay.removePath(this._cellCursorMarker);
			this._cellCursorMarker = undefined;
		}
		this._removeDropDownMarker();

		//hyperlink pop-up from here
		if (this._lastFormula && this._cellCursorMarker && this._lastFormula.substring(1, 10) == 'HYPERLINK')
		{
			var formula = this._lastFormula;
			var targetURL = formula.substring(11, formula.length - 1).split(',')[0];
			targetURL = targetURL.split('"').join('');
			targetURL = this._map.makeURLFromStr(targetURL);

			this._closeURLPopUp();
			if (targetURL) {
				this._showURLPopUp(this._cellCursor.getNorthEast(), targetURL);
			}

		}
		else if (this._map.hyperlinkPopup)
		{
			this._closeURLPopUp();
		}
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

	_onValidityInputHelpMsg: function(textMsg) {
		var message = textMsg.replace('validityinputhelp: ', '');
		message = JSON.parse(message);

		var icon = L.divIcon({
			html: '<div class="input-help"><h4 id="input-help-title"></h4><p id="input-help-content"></p></div>',
			iconSize: [0, 0],
			iconAnchor: [0, 0]
		});

		this._removeInputHelpMarker();
		var inputHelpMarker = L.marker(this._cellCursor.getNorthEast(), { icon: icon });
		inputHelpMarker.addTo(this._map);
		document.getElementById('input-help-title').innerText = message.title;
		document.getElementById('input-help-content').innerText = message.content;
		this._inputHelpPopUp = inputHelpMarker;
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

	_getDropDownMarker: function (dropDownSize) {
		if (dropDownSize) {
			var icon =  L.divIcon({
				className: 'spreadsheet-drop-down-marker',
				iconSize: [dropDownSize, dropDownSize],
				iconAnchor: [0, 0]
			});
			this._dropDownButton.setIcon(icon);
		}
		return this._dropDownButton;
	},

	_onUpdateCellResizeMarkers: function () {
		var selectionOnDesktop = window.mode.isDesktop()
									&& (this._cellSelectionArea
									|| (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)));

		if (!selectionOnDesktop &&
			(!this._selections.empty() || (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)))) {
			if (this._isEmptyRectangle(this._cellSelectionArea) && this._isEmptyRectangle(this._cellCursor)) {
				return;
			}

			var cellRectangle = this._cellSelectionArea ? this._cellSelectionArea : this._cellCursor;

			if (!this._cellResizeMarkerStart.isDragged) {
				this._map.addLayer(this._cellResizeMarkerStart);
				var posStart = this._map.project(cellRectangle.getNorthWest());
				var sizeStart = this._cellResizeMarkerStart._icon.getBoundingClientRect();
				posStart = posStart.subtract(new L.Point(sizeStart.width / 2, sizeStart.height / 2));
				posStart = this._map.unproject(posStart);
				this._cellResizeMarkerStart.setLatLng(posStart);
			}
			if (!this._cellResizeMarkerEnd.isDragged) {
				this._map.addLayer(this._cellResizeMarkerEnd);
				var posEnd = this._map.project(cellRectangle.getSouthEast());
				var sizeEnd = this._cellResizeMarkerEnd._icon.getBoundingClientRect();
				posEnd = posEnd.subtract(new L.Point(sizeEnd.width / 2, sizeEnd.height / 2));
				posEnd = this._map.unproject(posEnd);
				this._cellResizeMarkerEnd.setLatLng(posEnd);
			}
			if (this._cellAutoFillArea) {
				if (!this._cellAutofillMarker.isDragged) {
					this._map.addLayer(this._cellAutofillMarker);
					var cellAutoFillMarkerPoisition = cellRectangle.getCenter();
					cellAutoFillMarkerPoisition.lat = cellRectangle.getSouth();
					this._cellAutofillMarker.setLatLng(cellAutoFillMarkerPoisition);
				}
				else if (this._cellAutofillMarker) {
					this._map.removeLayer(this._cellAutofillMarker);
				}
			}
		}
		else if (selectionOnDesktop) {
			cellRectangle = this._cellSelectionArea ? this._cellSelectionArea : this._cellCursor;

			if (this._cellAutoFillArea) {
				if (!this._cellAutofillMarker.isDragged) {
					this._map.addLayer(this._cellAutofillMarker);
					cellAutoFillMarkerPoisition = L.latLng(cellRectangle.getSouth(), cellRectangle.getEast());
					this._cellAutofillMarker.setLatLng(cellAutoFillMarkerPoisition);
				}
			}

			this._map.removeLayer(this._cellResizeMarkerStart);
			this._map.removeLayer(this._cellResizeMarkerEnd);
		} else {
			this._map.removeLayer(this._cellResizeMarkerStart);
			this._map.removeLayer(this._cellResizeMarkerEnd);
			this._map.removeLayer(this._cellAutofillMarker);
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		this._onUpdateCellResizeMarkers();

		var startMarker = this._selectionHandles['start'];
		var endMarker = this._selectionHandles['end'];

		if (this._map.editorHasFocus() && (!this._selections.empty() || startMarker.isDragged || endMarker.isDragged)) {
			this._updateMarkers();
		}
		else {
			this._updateMarkers();
			this._removeSelection();
		}
	},

	_removeSelection: function() {
		this._textSelectionStart = null;
		this._textSelectionEnd = null;
		this._selectedTextContent = '';
		for (var key in this._selectionHandles) {
			this._map.removeLayer(this._selectionHandles[key]);
			this._selectionHandles[key].isDragged = false;
		}
		this._selections.clear();
	},

	_updateMarkers: function() {
		if (!this._map._isCursorVisible)
			return;
		var startMarker = this._selectionHandles['start'];
		var endMarker = this._selectionHandles['end'];

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
			pos = this._map.unproject(pos);
			startMarker.setLatLng(pos);
			this._map.addLayer(startMarker);
		}

		if (!endMarker.isDragged) {
			pos = this._map.project(this._textSelectionEnd.getSouthEast());
			pos = this._map.unproject(pos);
			endMarker.setLatLng(pos);
			this._map.addLayer(endMarker);
		}
	},

	hasGraphicSelection: function() {
		return (this._graphicSelection !== null &&
			!this._isEmptyRectangle(this._graphicSelection));
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

		if (this._map._clip) {
			// Always capture the html content separate as we may lose it when we
			// pass the clipboard data to a different context (async calls, f.e.).
			var htmlText = e.dataTransfer.getData('text/html');
			this._map._clip.dataTransferToDocument(e.dataTransfer, /* preferInternal = */ false, htmlText);
		}
	},

	_onDragStart: function () {
		this._map.on('moveend', this._updateScrollOffset, this);
	},

	_onRequestLOKSession: function () {
		this._map._socket.sendMessage('requestloksession');
	},

	// This is really just called on zoomend
	_fitWidthZoom: function (e, maxZoom) {
		if (isNaN(this._docWidthTwips)) { return; }
		var oldSize = e ? e.oldSize : this._map.getSize();
		var newSize = e ? e.newSize : this._map.getSize();

		if (!this.isImpress() && newSize.x - oldSize.x === 0) { return; }

		var widthTwips = newSize.x * this._map.options.tileWidthTwips / this._tileSize;
		var ratio = widthTwips / this._docWidthTwips;

		maxZoom = maxZoom ? maxZoom : this._map.options.zoom;
		// 'fit width zoom' has no use in spreadsheets, ignore it there
		if (!this.isCalc()) {
			var crsScale = this._map.options.crs.scale(1);
			var zoom = 10 + Math.floor(Math.log(ratio) / Math.log(crsScale));

			zoom = Math.min(maxZoom, Math.max(1, zoom));
			if (this._docWidthTwips * this._map.getZoomScale(zoom, 10) < widthTwips) {
				// Not clear why we wanted to zoom in the past.
				// This resets the view & scroll area and does a 'panTo'
				// to keep the cursor in view.
				// But of course, zoom to fit the first time.
				if (this._firstFitDone)
					zoom = this._map._zoom;
				this._firstFitDone = true;
				this._map.setZoom(zoom, {animate: false});
			}
		}
	},

	_onCurrentPageUpdate: function () {
		if (!this._map)
			return;

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
		if ((this._cellCursorMarker && !this.options.sheetGeometryDataEnabled) || force) {
			this._map._socket.sendMessage('commandvalues command=.uno:CellCursor'
			                     + '?outputHeight=' + this._tileWidthPx
			                     + '&outputWidth=' + this._tileHeightPx
			                     + '&tileHeight=' + this._tileWidthTwips
			                     + '&tileWidth=' + this._tileHeightTwips);
		}
	},

	_invalidatePreviews: function () {
		if (this._map && this._map._docPreviews && this._previewInvalidations.length > 0) {
			var toInvalidate = {};
			for (var i = 0; i < this._previewInvalidations.length; i++) {
				var invalidBounds = this._previewInvalidations[i];
				for (var key in this._map._docPreviews) {
					// find preview tiles that need to be updated and add them in a set
					var preview = this._map._docPreviews[key];
					if (preview.index >= 0 && this.isWriter()) {
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
						this._map.getPreview(preview.id, preview.index, preview.maxWidth, preview.maxHeight, {autoUpdate: true});
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

	_onFormFieldButtonMsg: function (textMsg) {
		textMsg = textMsg.substring('formfieldbutton:'.length + 1);
		var json = JSON.parse(textMsg);
		if (json.action === 'show') {
			this._formFieldButton = new L.FormFieldButton(json);
			this._map.addLayer(this._formFieldButton);
		} else if (this._formFieldButton) {
			this._map.removeLayer(this._formFieldButton);
		}
	},

	// converts rectangle in print-twips to tile-twips rectangle of the smallest cell-range that encloses it.
	_convertToTileTwipsSheetArea: function (rectangle) {
		if (!(rectangle instanceof L.Bounds) || !this.options.printTwipsMsgsEnabled || !this.sheetGeometry) {
			return rectangle;
		}

		return this.sheetGeometry.getTileTwipsSheetAreaFromPrint(rectangle);
	},

	_getGraphicSelectionRectangle: function (rectangle) {
		if (!(rectangle instanceof L.Bounds) || !this.options.printTwipsMsgsEnabled || !this.sheetGeometry) {
			return rectangle;
		}

		var rectSize = rectangle.getSize();
		var newTopLeft = this.sheetGeometry.getTileTwipsPointFromPrint(rectangle.getTopLeft());
		return new L.Bounds(newTopLeft, newTopLeft.add(rectSize));
	},

	_convertCalcTileTwips: function (point) {
		if (!this.options.printTwipsMsgsEnabled || !this.sheetGeometry)
			return point;
		var newPoint = new L.Point(parseInt(point.x), parseInt(point.y));
		return this.sheetGeometry.getTileTwipsPointFromPrint(newPoint);
	},

	_getEditCursorRectangle: function (msgObj) {

		if (typeof msgObj !== 'object' || !Object.prototype.hasOwnProperty.call(msgObj,'rectangle')) {
			console.error('invalid edit cursor message');
			return undefined;
		}

		return L.Bounds.parse(msgObj.rectangle);
	},

	_getTextSelectionRectangles: function (textMsg) {

		if (typeof textMsg !== 'string') {
			console.error('invalid text selection message');
			return [];
		}

		return L.Bounds.parseArray(textMsg);
	},

	// Needed for the split-panes feature to determine the active split-pane.
	// Needs to be implemented by the app specific TileLayer.
	getCursorPos: function () {
		console.error('No implementations available for getCursorPos!');
		return new L.Point(0, 0);
	},

	getPaneLatLngRectangles: function () {
		var map = this._map;

		if (!this._splitPanesContext) {
			return [ map.getBounds() ];
		}

		// These paneRects are in core pixels.
		var paneRects = this._splitPanesContext.getPxBoundList();
		console.assert(paneRects.length, 'number of panes cannot be zero!');

		return paneRects.map(function (pxBound) {
			return new L.LatLngBounds(
				map.unproject(pxBound.getTopLeft().divideBy(window.devicePixelRatio)),
				map.unproject(pxBound.getBottomRight().divideBy(window.devicePixelRatio))
			);
		});
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
			this._debugDataNames = ['tileCombine', 'fromKeyInputToInvalidate', 'ping', 'loadCount', 'postMessage'];
			for (var i = 0; i < this._debugDataNames.length; i++) {
				this._debugData[this._debugDataNames[i]] = L.control.attribution({prefix: '', position: 'bottomleft'}).addTo(this._map);
			}
			this._debugInfo = new L.LayerGroup();
			this._debugInfo2 = new L.LayerGroup();
			this._debugAlwaysActive = new L.LayerGroup();
			this._debugShowClipboard = new L.LayerGroup();
			this._tilesDevicePixelGrid = new L.LayerGroup();
			this._debugSidebar = new L.LayerGroup();
			this._debugTyper = new L.LayerGroup();
			this._map.addLayer(this._debugInfo);
			this._map.addLayer(this._debugInfo2);
			var overlayMaps = {
				'Tile overlays': this._debugInfo,
				'Screen overlays': this._debugInfo2,
				'Show Clipboard': this._debugShowClipboard,
				'Always active': this._debugAlwaysActive,
				'Typing': this._debugTyper,
				'Tiles device pixel grid': this._tilesDevicePixelGrid,
				'Sidebar Rerendering': this._debugSidebar,
			};
			L.control.layers({}, overlayMaps, {collapsed: false}).addTo(this._map);

			this._map.on('layeradd', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					this._map._debugAlwaysActive = true;
				} else if (e.layer === this._debugShowClipboard) {
					this._map._textInput.debug(true);
				} else if (e.layer === this._debugTyper) {
					this._debugTypeTimeout();
				} else if (e.layer === this._debugInfo2) {
					for (var i = 0; i < this._debugDataNames.length; i++) {
						this._debugData[this._debugDataNames[i]].addTo(this._map);
					}
				} else if (e.layer === this._tilesDevicePixelGrid) {
					this._map._docLayer._painter._addTilePixelGridSection();
					this._map._docLayer._painter._sectionContainer.reNewAllSections(true);
				} else if (e.layer === this._debugSidebar) {
					this._map._debugSidebar = true;
				}
			}, this);
			this._map.on('layerremove', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					this._map._debugAlwaysActive = false;
				} else if (e.layer === this._debugShowClipboard) {
					this._map._textInput.debug(false);
				} else if (e.layer === this._debugTyper) {
					clearTimeout(this._debugTypeTimeoutId);
				} else if (e.layer === this._debugInfo2) {
					for (var i in this._debugData) {
						this._debugData[i].remove();
					}
				} else if (e.layer === this._tilesDevicePixelGrid) {
					this._map._docLayer._painter._sectionContainer.removeSection('tile pixel grid');
					this._map._docLayer._painter._sectionContainer.reNewAllSections(true);
				} else if (e.layer === this._debugSidebar) {
					this._map._debugSidebar = false;
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

		if (this._map._docLayer._docType === 'spreadsheet') {
			var section = this._map._docLayer._painter._sectionContainer.getSectionWithName('calc grid');
			if (section) {
				section.setDrawingOrder(L.CSections.CalcGrid.drawingOrderDebug);
				section.sectionProperties.strokeStyle = 'blue';
			}
			this._map._docLayer._painter._addSplitsSection();
			this._map._docLayer._painter._sectionContainer.reNewAllSections(true /* redraw */);
		}
	},

	_debugSetPostMessage: function(type,msg) {
		this._debugData['postMessage'].setPrefix(type+': '+ msg);
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
			this.postKeyboardEvent('input', 0, 1280);
		} else {
			this.postKeyboardEvent('input', this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length), 0);
		}
		this._debugLoremPos++;
		this._debugTypeTimeoutId = setTimeout(L.bind(this._debugTypeTimeout, this), 50);
	},

	getCommentWizardStructure: function(menuStructure) {
		if (menuStructure === undefined) {
			menuStructure = {
				id : 'comment',
				type : 'mainmenu',
				enabled : true,
				text : _('Comment'),
				executionType : 'menu',
				data : [],
				children : []
			};
		}

		this._map._docLayer._createCommentStructure(menuStructure);
		return menuStructure;
	},

	_openCommentWizard: function(annotation) {
		this._map.fire('closemobilewizard');
		w2ui['actionbar'].click('comment_wizard');
		// if annotation is provided we can select perticular comment
		if (annotation) {
			$('#comment' + annotation._data.id).click();
		}
	},

	_saveMessageForReplay: function (textMsg, viewId) {
		// We will not get some messages (with coordinates)
		// from core when zoom changes because print-twips coordinates are zoom-invariant. So we need to
		// remember the last version of them and replay, when zoom is changed.
		// In calc we need to replay the messages when sheet-geometry changes too. This is because it is possible for
		// the updated print-twips messages to arrive before the sheet-geometry update message arrives.

		if (!this._printTwipsMessagesForReplay) {
			var ownViewTypes = this.isCalc() ? [
				'cellcursor',
				'referencemarks',
				'cellselectionarea',
				'textselection',
				'invalidatecursor',
				'textselectionstart',
				'textselectionend',
				'graphicselection',
			] : [
				'invalidatecursor',
				'textselection'
			];

			var otherViewTypes = this.isCalc() ? [
				'cellviewcursor',
				'textviewselection',
				'invalidateviewcursor',
				'graphicviewselection',
			] : [
				'textviewselection',
				'invalidateviewcursor'
			];

			this._printTwipsMessagesForReplay = new L.MessageStore(ownViewTypes, otherViewTypes);
		}

		var colonIndex = textMsg.indexOf(':');
		if (colonIndex === -1) {
			return;
		}

		var msgType = textMsg.substring(0, colonIndex);
		this._printTwipsMessagesForReplay.save(msgType, textMsg, viewId);
	},

	_clearMsgReplayStore: function () {
		if (!this._printTwipsMessagesForReplay) {
			return;
		}

		this._printTwipsMessagesForReplay.clear();
	},

	_replayPrintTwipsMsgs: function () {
		if (!this._printTwipsMessagesForReplay) {
			return;
		}

		this._printTwipsMessagesForReplay.forEach(this._onMessage.bind(this));
	},

});


L.MessageStore = L.Class.extend({

	// ownViewTypes : The types of messages related to own view.
	// otherViewTypes: The types of messages related to other views.
	initialize: function (ownViewTypes, otherViewTypes) {

		if (!Array.isArray(ownViewTypes) || !Array.isArray(otherViewTypes)) {
			console.error('Unexpected argument types');
			return;
		}

		var ownMessages = {};
		ownViewTypes.forEach(function (msgType) {
			ownMessages[msgType] = '';
		});
		this._ownMessages = ownMessages;

		var othersMessages = {};
		otherViewTypes.forEach(function (msgType) {
			othersMessages[msgType] = [];
		});
		this._othersMessages = othersMessages;
	},

	clear: function () {
		var msgs = this._ownMessages;
		Object.keys(msgs).forEach(function (msgType) {
			msgs[msgType] = '';
		});

		msgs = this._othersMessages;
		Object.keys(msgs).forEach(function (msgType) {
			msgs[msgType] = [];
		});
	},

	save: function (msgType, textMsg, viewId) {

		var othersMessage = (typeof viewId === 'number');

		if (!othersMessage && Object.prototype.hasOwnProperty.call(this._ownMessages, msgType)) {
			this._ownMessages[msgType] = textMsg;
			return;
		}

		if (othersMessage && Object.prototype.hasOwnProperty.call(this._othersMessages, msgType)) {
			this._othersMessages[msgType][viewId] = textMsg;
		}
	},

	forEach: function (callback) {
		if (typeof callback !== 'function') {
			console.error('Invalid callback type');
			return;
		}

		var ownMessages = this._ownMessages;
		Object.keys(this._ownMessages).forEach(function (msgType) {
			callback(ownMessages[msgType]);
		});

		var othersMessages = this._othersMessages;
		Object.keys(othersMessages).forEach(function (msgType) {
			othersMessages[msgType].forEach(callback);
		});
	}
});
