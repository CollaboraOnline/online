/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Map is the central class of the API - it is used to create a map.
 */

/* global app _ Cursor */

L.Map = L.Evented.extend({

	statics: {
		THIS : undefined
	},

	options: {
		crs: L.CRS.Simple,
		center: [0, 0],
		docParams: {},
		// Default zoom level in which the document will be loaded.
		zoom: 10,
		// These zoom values are on a logarithmic scale. Each step away from the default 10
		// (meaning 1 = 100%) is a multiplication by or division with pow(2,1/4). pow(2,1/4)
		// is approximately 1.2. Thus 4 corresponds to six steps of division by pow(2,1/4) =
		// 35%. 18 corresponds to 8 steps of multiplication by pow(2,1/4) = 400%. The
		// percentages available are then rounded to the nearest five percent.
		minZoom: 1,
		maxZoom: 18,
		maxBounds: L.latLngBounds([0, 0], [-100, 100]),
		fadeAnimation: false, // Not useful for typing.
		trackResize: true,
		markerZoomAnimation: true,
		// defaultZoom:
		// The zoom level at which the tile size in twips equals the default size (3840 x 3840).
		// Unless you know what you are doing, this should not be modified.
		defaultZoom: 10,
		// 15 = 1440 twips-per-inch / 96 dpi.
		// Chosen to match previous hardcoded value of 3840 for
		// the current tile pixel size of 256.
		// Default tile width in twips (how much of the document is covered horizontally in a
		// 256x256 pixels tile). Unless you know what you are doing, this should not be modified;
		// this means twips value for 256 pixels at 96dpi.
		tileWidthTwips: window.tileSize * 15,
		// tileHeightTwips :
		// Default tile height in twips (how much of the document is covered vertically in a
		// 256x256 pixels tile).Unless you know what you are doing, this should not be modified;
		// this means twips value for 256 pixels at 96dpi.
		tileHeightTwips: window.tileSize * 15,
		urlPrefix: 'cool',
		wopiSrc: '',
		cursorURL: L.LOUtil.getURL('cursors'),
		// cursorURL
		// The path (local to the server) where custom cursor files are stored.
	},

	// Control.UIManager instance, set in main.js
	uiManager: null,

	// Control.LokDialog instance, is set in Control.UIManager.js
	dialog: null,

	// Control.JSDialog instance, is set in Control.UIManager.js
	jsdialog: null,

	context: {context: ''},

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = L.setOptions(this, options);

		if (this.options.documentContainer) {
			// have it as DOM object
			this.options.documentContainer = L.DomUtil.get(this.options.documentContainer);
		}

		if (!window.ThisIsAMobileApp)
			this._clip = L.clipboard(this);
		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = L.bind(this._onResize, this);

		// Start with readonly toolbars on desktop
		if (window.mode.isDesktop()) {
			L.DomUtil.addClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
		}

		this._initEvents();
		this._cacheSVG = [];

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(L.latLng(options.center), options.zoom, {reset: true});
		}

		Cursor.imagePath = options.cursorURL;

		/* private members */
		this._handlers = [];
		this._layers = {};
		this._zoomBoundLayers = {};
		this._sizeChanged = true;
		this._bDisableKeyboard = false;
		this._fatal = false;
		this._enabled = true;
		this._debugAlwaysActive = false; // disables the dimming / document inactivity when true
		this._disableDefaultAction = {}; // The events for which the default handler is disabled and only issues postMessage.
		this.showSidebar = false;
		this._previewQueue = [];
		this._previewRequestsOnFly = 0;
		this._timeToEmptyQueue = new Date();
		this._partsDirection = 1; // For pre-fetching the slides in the direction of travel.
		// Focusing:
		//
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._isCursorVisible = true;
		// The ID of the window with focus. 0 for the document.
		this._winId = 0;
		// The object of the dialog, if any (must have .focus callable).
		this._activeDialog = null;
		// True only when searching within the doc, as we need to use winId==0.
		this._isSearching = false;


		this.callInitHooks();

		this.addHandler('keyboard', L.Map.Keyboard);
		this.addHandler('dragging', L.Map.Drag);
		if ((L.Browser.touch && !L.Browser.pointer) || (L.Browser.cypressTest && (window.mode.isMobile() || window.mode.isTablet()))) {
			this.dragging.disable();
			this.dragging._draggable._manualDrag = true;
			this._mainEvents('off');
			this.addHandler('touchGesture', L.Map.TouchGesture);
		} else {
			this.addHandler('mouse', L.Map.Mouse);
			this.addHandler('scrollHandler', L.Map.Scroll);
			this.addHandler('doubleClickZoom', L.Map.DoubleClickZoom);
		}

		if (this.options.imagePath) {
			L.Icon.Default.imagePath = this.options.imagePath;
		}
		this._addLayers(this.options.layers);
		app.socket = new app.definitions.Socket(this);

		this._progressBar = L.progressOverlay(new L.point(150, 25));

		this._textInput = L.textInput();
		this.addLayer(this._textInput);

		// When all these conditions are met, fire statusindicator:initializationcomplete
		this.initConditions = {
			'doclayerinit': false,
			'statusindicatorfinish': false,
			'StyleApply': false,
			'CharFontName': false,
			'updatepermission': false
		};
		this.initComplete = false;

		this.on('updatepermission', function(e) {
			if (!this.initComplete) {
				this._fireInitComplete('updatepermission');
			}

			if (e.perm === 'readonly') {
				L.DomUtil.addClass(this._container.parentElement, 'readonly');
				if (window.mode.isDesktop() || window.mode.isTablet()) {
					L.DomUtil.addClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
				}
				L.DomUtil.addClass(L.DomUtil.get('main-menu'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'readonly');
			} else {
				L.DomUtil.removeClass(this._container.parentElement, 'readonly');
				if (window.mode.isDesktop() || window.mode.isTablet()) {
					L.DomUtil.removeClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
				}
				L.DomUtil.removeClass(L.DomUtil.get('main-menu'), 'readonly');
				L.DomUtil.removeClass(L.DomUtil.get('presentation-controls-wrapper'), 'readonly');
			}
		}, this);
		this.on('doclayerinit', function() {
			if (!this.initComplete) {
				this._fireInitComplete('doclayerinit');
			}

			// We need core's knowledge of whether it is a mobile phone
			// or not to be in sync with the test in _onJSDialogMsg in TileLayer.js.
			if (window.mode.isMobile())
			{
				document.getElementById('document-container').classList.add('mobile');
				this._size = new L.Point(0,0);
				this._onResize();
			}
		});
		this.on('updatetoolbarcommandvalues', function(e) {
			if (this.initComplete) {
				return;
			}
			if (e.commandName === '.uno:StyleApply') {
				this._fireInitComplete('StyleApply');
			}
			else if (e.commandName === '.uno:CharFontName') {
				this._fireInitComplete('CharFontName');
			}
		});
		if (window.ThisIsTheAndroidApp) {
			this.on('readonlymode', function() {
				this.setPermission('edit');
			});
		}

		this.showBusy(_('Initializing...'), false);
		this.on('statusindicator', this._onUpdateProgress, this);

		this.on('editorgotfocus', this._onEditorGotFocus, this);

		// Fired to signal that the input focus is being changed.
		this.on('changefocuswidget', this._onChangeFocusWidget, this);

		this.on('searchstart', this._onSearchStart, this);

		// View info (user names and view ids)
		this._viewInfo = {};
		this._viewInfoByUserName = {};

		// View color map
		this._viewColors = {};

		// This becomes true if document was ever modified by the user
		this._everModified = false;

		// This is the new file name, if the document is renamed, which is used on uno:Save's result.
		this._renameFilename = '';

		// Document is completely loaded or not
		this._docLoaded = false;

		// Unlike _docLoaded, this is flagged only once,
		// after we receive status for the first time.
		this._docLoadedOnce = false;

		this._isNotebookbarLoadedOnCore = false;

		this.on('commandstatechanged', function(e) {
			if (e.commandName === '.uno:ModifiedStatus') {
				this._everModified = this._everModified || (e.state === 'true');

				// Fire an event to let the client know whether the document needs saving or not.
				this.fire('postMessage', {msgId: 'Doc_ModifiedStatus', args: { Modified: e.state === 'true' }});
			}
		}, this);

		this.on('commandvalues', function(e) {
			if (e.commandName === '.uno:LanguageStatus' && L.Util.isArray(e.commandValues)) {
				app.languages = [];
				e.commandValues.forEach(function(language) {
					var split = language.split(';');
					language = split[0];
					var code = '';
					if (split.length > 1)
						code = split[1];
					app.languages.push({translated: _(language), neutral: language, iso: code});
				});
				app.languages.sort(function(a, b) {
					return a.translated < b.translated ? -1 : a.translated > b.translated ? 1 : 0;
				});
				this.fire('languagesupdated');
			}
		});

		this.on('docloaded', function(e) {
			this._docLoaded = e.status;
			if (this._docLoaded) {
				app.socket.sendMessage('blockingcommandstatus isRestrictedUser=' + this.Restriction.isRestrictedUser + ' isLockedUser=' + this.Locking.isLockedUser);
				app.idleHandler.notifyActive();
				if (!document.hasFocus()) {
					this.fire('editorgotfocus');
					this.focus();
				}
				app.idleHandler._activate();
				if (window.ThisIsTheAndroidApp) {
					window.postMobileMessage('hideProgressbar');
				}
			} else if (this._docLayer) {
				// remove the comments and changes
				var commentSection = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name);
				if (commentSection)
					commentSection.clearList();
			}

			if (!window.mode.isMobile())
				this.initializeModificationIndicator();

			// Show sidebar.
			if (this._docLayer && !this._docLoadedOnce) {
				// Let the first page finish loading then load the sidebar.
				setTimeout(this.uiManager.initializeSidebar.bind(this.uiManager), 200);
			}

			// We have loaded.
			if (!this._docLoadedOnce) {
				this._docLoadedOnce = this._docLoaded;
			}
		}, this);
	},

	loadDocument: function(socket) {
		app.socket.connect(socket);
		if (this._clip)
			this._clip.clearSelection();
	},

	sendInitUNOCommands: function() {
		// TODO: remove duplicated init code
		app.socket.sendMessage('commandvalues command=.uno:LanguageStatus');
		app.socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
		if (this._docLayer._docType === 'spreadsheet') {
			this._docLayer._gotFirstCellCursor = false;
			if (this._docLayer.options.sheetGeometryDataEnabled)
				this._docLayer.requestSheetGeometryData();
			this._docLayer.refreshViewData();
			this._docLayer._update();
		}
		this._docLayer._getToolbarCommandsValues();
	},

	// public methods that modify map state

	getViewId: function (username) {
		for (var idx in this._viewInfo) {
			if (this._viewInfo[idx].username === username) {
				return this._viewInfo[idx].id;
			}
		}
		return -1;
	},

	addView: function(viewInfo) {
		this._viewInfo[viewInfo.id] = viewInfo;
		if (viewInfo.userextrainfo !== undefined && viewInfo.userextrainfo.avatar !== undefined) {
			this._viewInfoByUserName[viewInfo.username] = viewInfo;
		}
		this.fire('postMessage', {msgId: 'View_Added', args: {Deprecated: true, ViewId: viewInfo.id, UserId: viewInfo.userid, UserName: viewInfo.username, UserExtraInfo: viewInfo.userextrainfo, Color: L.LOUtil.rgbToHex(viewInfo.color), ReadOnly: viewInfo.readonly}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('addview', {viewId: viewInfo.id, username: viewInfo.username, extraInfo: viewInfo.userextrainfo, readonly: this.isViewReadOnly(viewInfo.id)});

		this.updateAvatars();
	},

	removeView: function(viewid) {
		var username = this._viewInfo[viewid].username;
		delete this._viewInfoByUserName[this._viewInfo[viewid].username];
		delete this._viewInfo[viewid];
		this.fire('postMessage', {msgId: 'View_Removed', args: {Deprecated: true, ViewId: viewid}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('removeview', {viewId: viewid, username: username});
	},


	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		zoom = zoom === undefined ? this.getZoom() : zoom;
		this._resetView(L.latLng(center), this._limitZoom(zoom));
		return this;
	},

	updateAvatars: function() {
		if (this._docLayer && this._docLayer._annotations && this._docLayer._annotations._items) {
			for (var idxAnno in this._docLayer._annotations._items) {
				var annotation = this._docLayer._annotations._items[idxAnno];
				var username = annotation._data.author;
				if (this._viewInfoByUserName[username])
					annotation._data.avatar = this._viewInfoByUserName[username].userextrainfo.avatar;
				annotation._updateContent();
			}
		}
	},

	initializeModificationIndicator: function() {
		var lastModButton = L.DomUtil.get('menu-last-mod');
		if (lastModButton !== null && lastModButton !== undefined
			&& lastModButton.firstChild.innerHTML !== null
			&& lastModButton.firstChild.childElementCount == 0) {
			if (this._lastmodtime == null) {
				// No modification time -> hide the indicator
				L.DomUtil.setStyle(lastModButton, 'display', 'none');
				return;
			}
			var mainSpan = document.createElement('span');
			this.lastModIndicator = document.createElement('span');
			mainSpan.appendChild(this.lastModIndicator);

			this.updateModificationIndicator(this._lastmodtime);

			// Replace menu button body with new content
			lastModButton.firstChild.innerHTML = '';
			lastModButton.firstChild.appendChild(mainSpan);

			if (L.Params.revHistoryEnabled) {
				L.DomUtil.setStyle(lastModButton, 'cursor', 'pointer');
			}
		}
	},

	updateModificationIndicator: function(newModificationTime) {
		var timeout;

		if (typeof newModificationTime === 'string') {
			this._lastmodtime = newModificationTime;
		}

		clearTimeout(this._modTimeout);

		if (this.lastModIndicator !== null && this.lastModIndicator !== undefined) {
			var dateTime = new Date(this._lastmodtime.replace(/,.*/, 'Z'));
			var dateValue;

			var elapsed = Date.now() - dateTime;
			var rtf1 = new Intl.RelativeTimeFormat(String.locale, { style: 'narrow' });
			if (elapsed < 60000) {
				dateValue = _('Last saved:') + ' ' + rtf1.format(-Math.round(elapsed / 1000), 'second');
				timeout = 6000;
			} else if (elapsed < 3600000) {
				dateValue = _('Last saved:') + ' ' + rtf1.format(-Math.round(elapsed / 60000), 'minute');
				timeout = 60000;
			} else if (elapsed < 3600000 * 24) {
				dateValue = _('Last saved:') + ' ' + rtf1.format(-Math.round(elapsed / 3600000), 'hour');
				timeout = 60000;
			} else {
				dateValue = _('Last saved:') + ' ' + dateTime.toLocaleDateString(String.locale,
					{ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
				timeout = 60000;
			}

			this.lastModIndicator.innerHTML = dateValue;

			if (timeout) {
				this._modTimeout = setTimeout(L.bind(this.updateModificationIndicator, this, -1), timeout);
			}
		}
	},

	showBusy: function(label, bar) {
		if (window.ThisIsTheAndroidApp)
			return;

		// If document is already loaded, ask the toolbar widget to show busy
		// status on the bottom statusbar
		if (this._docLayer) {
			this.fire('showbusy', {label: label});
			return;
		}
		this._progressBar.delayedStart(this, label, bar);
	},

	hideBusy: function () {
		if (window.ThisIsTheAndroidApp)
			return;

		this.fire('hidebusy');
		this._progressBar.end(this);
	},

	zoomToFactor: function (zoom) {
		return Math.pow(1.2, (zoom - this.options.zoom));
	},

	setDesktopCalcViewOnZoom: function (zoom, animate) {
		var calcLayer = this._docLayer;
		if (!calcLayer.options.sheetGeometryDataEnabled || !calcLayer.sheetGeometry)
			return false;

		var sheetGeom = calcLayer.sheetGeometry;
		var zoomScaleAbs = this.zoomToFactor(zoom);

		var cssBounds = this.getPixelBounds();
		var cssBoundsSize = cssBounds.getSize();

		var topLeftCell = sheetGeom.getCellFromPos(
			cssBounds.getTopLeft().multiplyBy(app.dpiScale), 'corepixels');
		// top-left w.r.t current zoom.
		var topLeftPx = sheetGeom.getCellRect(topLeftCell.x, topLeftCell.y)
			.getTopLeft().divideBy(window.devicePixelRatio);
		// top-left w.r.t new zoom.
		var newTopLeftPx = sheetGeom.getCellRect(topLeftCell.x, topLeftCell.y, zoomScaleAbs)
			.getTopLeft().divideBy(app.dpiScale);

		var cursorInBounds = calcLayer._cursorCorePixels ?
			cssBounds.contains(
				L.point(calcLayer._cursorCorePixels.getTopLeft().divideBy(app.dpiScale))) : false;

		var cursorActive = calcLayer.isCursorVisible();
		if (cursorActive && cursorInBounds) {
			var cursorBounds = calcLayer._cursorCorePixels;
			var cursorCenter = calcLayer._corePixelsToTwips(cursorBounds.getCenter());
			var newCursorCenter = sheetGeom.getTileTwipsAtZoom(cursorCenter, zoomScaleAbs);
			// convert to css pixels at zoomScale.
			newCursorCenter._multiplyBy(zoomScaleAbs / 15 / app.dpiScale)._round();
			var newBounds = new L.Bounds(newTopLeftPx, newTopLeftPx.add(cssBoundsSize));

			if (!newBounds.contains(newCursorCenter)) {
				var margin = 10;
				var diffX = 0;
				var diffY = 0;
				var docSize = sheetGeom.getSize('corepixels').divideBy(app.dpiScale);
				if (newCursorCenter.x < newBounds.min.x) {
					diffX = Math.max(0, newCursorCenter.x - margin) - newBounds.min.x;
				} else if (newCursorCenter.x > newBounds.max.x) {
					diffX = Math.min(docSize.x, newCursorCenter.x + margin) - newBounds.max.x;
				}

				if (newCursorCenter.y < newBounds.min.y) {
					diffY = Math.max(0, newCursorCenter.y - margin) - newBounds.min.y;
				} else if (newCursorCenter.y > newBounds.max.y) {
					diffY = Math.min(docSize.y, newCursorCenter.y + margin) - newBounds.max.y;
				}

				newTopLeftPx._add(new L.Point(diffX, diffY));
				topLeftPx._add(new L.Point(diffX / zoomScaleAbs, diffY / zoomScaleAbs));
				// FIXME: pan to topLeftPx before the animation ?
			}
		}

		var newHalfSize = cssBoundsSize.divideBy(2);
		var newCenter = newTopLeftPx.add(newHalfSize);
		var newCenterLatLng = this.unproject(newCenter, zoom);
		// pinch center w.r.t current zoom scale.
		var newPinchCenterLatLng = this.unproject(topLeftPx, this.getZoom());

		this._ignoreCursorUpdate = true;
		var thisObj = this;
		var mapUpdater = function() {
			thisObj._resetView(L.latLng(newCenterLatLng), thisObj._limitZoom(zoom));
		};
		var runAtFinish = function() {
			thisObj._ignoreCursorUpdate = false;
			if (cursorActive) {
				calcLayer.activateCursor();
			}
		};

		if (animate) {
			this._docLayer.runZoomAnimation(zoom, newPinchCenterLatLng,
				mapUpdater,
				runAtFinish);
		} else {
			mapUpdater();
			runAtFinish();
		}
	},

	ignoreCursorUpdate: function () {
		return this._ignoreCursorUpdate;
	},

	enableTextInput: function () {
		this._setTextInputState(true /* enable? */);
	},

	disableTextInput: function () {
		this._setTextInputState(false /* enable? */);
	},

	_setTextInputState: function (enable) {
		var docLayer = this._docLayer;
		if (!docLayer)
			return;
		this._ignoreCursorUpdate = !enable;

		if (!docLayer.isCursorVisible())
			return;

		if (!enable) {
			this._textInput.disable();
		} else {
			this._textInput.enable();
			docLayer._updateCursorPos();
		}
	},

	setZoom: function (zoom, options, animate) {

		// do not animate zoom when in a cypress test.
		if (animate && L.Browser.cypressTest)
			animate = false;

		if (this._docLayer instanceof L.CanvasTileLayer) {
			if (!zoom)
				zoom = this._clientZoom || this.options.zoom;
			else
				this._clientZoom = zoom;
		}

		if (!this._loaded) {
			this._zoom = this._limitZoom(zoom);
			return this;
		}

		var curCenter = this.getCenter();
		if (this._docLayer && this._docLayer._docType === 'spreadsheet') {
			// for spreadsheets, when the document is smaller than the viewing area
			// we want it to be glued to the row/column headers instead of being centered
			this._docLayer._checkSpreadSheetBounds(zoom);
			if (window.mode.isDesktop()) {
				return this.setDesktopCalcViewOnZoom(zoom, animate);
			}
		}

		this._docLayer.setZoomChanged(true);
		var thisObj = this;
		var cssBounds = this.getPixelBounds();
		var mapUpdater;
		var runAtFinish;
		if (this._docLayer && this._docLayer._visibleCursor && this.getBounds().contains(this._docLayer._visibleCursor.getCenter())) {
			// Calculate new center after zoom. The intent is that the caret
			// position stays the same.
			var zoomScale = 1.0 / this.getZoomScale(zoom, this._zoom);
			var caretPos = this._docLayer._visibleCursor.getCenter();
			var newCenter = new L.LatLng(curCenter.lat + (caretPos.lat - curCenter.lat) * (1.0 - zoomScale),
						     curCenter.lng + (caretPos.lng - curCenter.lng) * (1.0 - zoomScale));

			mapUpdater = function() {
				thisObj.setView(newCenter, zoom, {zoom: options});
			};
			runAtFinish = function() {
				thisObj._docLayer.setZoomChanged(false);
			};

			if (animate) {
				this._docLayer.runZoomAnimation(zoom,
					// pinchCenter
					new L.LatLng(
						// Use the current y-center if there is a top margin.
						cssBounds.min.y < 0 ? curCenter.lat : caretPos.lat,
						// Use the current x-center if there is a left margin.
						cssBounds.min.x < 0 ? curCenter.lng : caretPos.lng),
					mapUpdater,
					runAtFinish);
			} else {
				mapUpdater();
				runAtFinish();
			}

			return;
		}

		mapUpdater = function() {
			thisObj.setView(curCenter, zoom, {zoom: options});
		};

		runAtFinish = function() {
			thisObj._docLayer.setZoomChanged(false);
		};

		if (animate) {
			this._docLayer.runZoomAnimation(zoom,
				// pinchCenter
				curCenter,
				mapUpdater,
				runAtFinish);
		} else {
			mapUpdater();
			runAtFinish();
		}
	},

	zoomIn: function (delta, options, animate) {
		return this.setZoom(this._zoom + (delta || 1), options, animate);
	},

	zoomOut: function (delta, options, animate) {
		return this.setZoom(this._zoom - (delta || 1), options, animate);
	},

	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof L.Point ? latlng : this.latLngToContainerPointIgnoreSplits(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLngIgnoreSplits(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	panBy: function (offset) { // (Point)
		// replaced with animated panBy in Map.PanAnimation.js
		this.fire('movestart');

		this._rawPanBy(L.point(offset));

		this.fire('move');
		return this.fire('moveend');
	},

	setMaxBounds: function (bounds) {
		bounds = L.latLngBounds(bounds);

		this.options.maxBounds = bounds;

		if (this._loaded) {
			this.panInsideBounds(this.options.maxBounds);
		}
	},

	setDocBounds: function (bounds) {
		bounds = L.latLngBounds(bounds);
		this.options.docBounds = bounds;
	},

	getCorePxDocBounds: function () {
		var topleft = this.project(this.options.docBounds.getNorthWest());
		var bottomRight = this.project(this.options.docBounds.getSouthEast());
		return new L.Bounds(this._docLayer._cssPixelsToCore(topleft),
			this._docLayer._cssPixelsToCore(bottomRight));
	},

	panInsideBounds: function (bounds, options) {
		var center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, bounds);

		if (center.equals(newCenter)) { return this; }

		return this.panTo(newCenter, options);
	},

	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = L.extend({
			animate: false,
			pan: false
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(L.bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	stop: function () {
		L.Util.cancelAnimFrame(this._flyToFrame);
		if (this._panAnim) {
			this._panAnim.stop();
		}
		return this;
	},

	// TODO handler.addTo
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		// Check for the special proof-of-concept case where no WOPI is involved but we
		// still run COOL in an iframe of its own and thus need to receive the
		// postMessage things.
		if (name === 'wopi' && this.options['notWopiButIframe']) {
			handler.addHooks();
		}

		return this;
	},

	remove: function () {

		this._initEvents(true);

		try {
			// throws error in IE6-8
			delete this._container._leaflet;
		} catch (e) {
			this._container._leaflet = undefined;
		}

		L.DomUtil.remove(this._mapPane);

		if (this._clearControlPos) {
			this._clearControlPos();
		}

		this._clearHandlers();

		if (this._loaded) {
			this.fire('unload');
		}

		if (this._docLayer) {
			this.removeLayer(this._docLayer);
		}
		app.socket.close();
		return this;
	},

	createPane: function (name, container) {
		var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
		    pane = L.DomUtil.create('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}
		return pane;
	},


	// public methods for getting map state

	hasInfoForView: function(viewid)  {
		return (viewid in this._viewInfo);
	},

	getViewName: function(viewid) {
		return this._viewInfo[viewid].username;
	},

	getViewColor: function(viewid) {
		return this._viewInfo[viewid].color;
	},

	isViewReadOnly: function(viewid) {
		return this._viewInfo[viewid].readonly !== '0';
	},

	getCenter: function () { // (Boolean) -> LatLng
		this._checkIfLoaded();
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	getZoom: function () {
		return this._zoom;
	},

	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new L.LatLngBounds(sw, ne);
	},

	getMinZoom: function () {
		return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
	},

	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	getLayerMaxBounds: function () {
		return L.bounds(this.latLngToLayerPoint(this.options.maxBounds.getNorthWest()),
			this.latLngToLayerPoint(this.options.maxBounds.getSouthEast()));
	},

	getLayerDocBounds: function () {
		return L.bounds(this.latLngToLayerPoint(this.options.docBounds.getNorthWest()),
			this.latLngToLayerPoint(this.options.docBounds.getSouthEast()));
	},

	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new L.Point(
				this._container.clientWidth,
				this._container.clientHeight);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	getPixelBounds: function (center, zoom) {
		var topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	getPixelBoundsCore: function (center, zoom) {
		var bounds = this.getPixelBounds(center, zoom);
		bounds.min = bounds.min.multiplyBy(app.dpiScale);
		bounds.max = bounds.max.multiplyBy(app.dpiScale);
		return bounds;
	},

	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._pixelOrigin;
	},

	getPixelWorldBounds: function (zoom) {
		return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
	},

	getPane: function (pane) {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	},

	getContainer: function () {
		return this._container;
	},

	// We have one global winId that controls what window (dialog, sidebar, or
	// the main document) has the actual focus.  0 means the document.
	setWinId: function (id) {
		// window.app.console.log('winId set to: ' + id);
		if (typeof id === 'string')
			id = parseInt(id);
		this._winId = id;
	},

	// Getter for the winId, see setWinId() for more.
	getWinId: function () {
		if (this.formulabar && this.formulabar.hasFocus())
			return 0;
		return this._winId;
	},

	// Returns true iff the document has input focus,
	// as opposed to a dialog, sidebar, formula bar, etc.
	editorHasFocus: function () {
		return this.getWinId() === 0 && !this.calcInputBarHasFocus();
	},

	// Returns true iff the formula-bar has the focus.
	calcInputBarHasFocus: function () {
		return this.formulabar && this.formulabar.hasFocus();
	},

	// TODO replace with universal implementation after refactoring projections

	getZoomScale: function (toZoom, fromZoom) {
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this.getZoom() : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	},

	getScaleZoom: function (scale, fromZoom) {
		fromZoom = fromZoom === undefined ? this.getZoom() : fromZoom;
		return fromZoom + (Math.log(scale) / Math.log(1.2));
	},


	// conversion methods

	project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
		zoom = zoom === undefined ? this.getZoom() : zoom;
		var projectedPoint = this.options.crs.latLngToPoint(L.latLng(latlng), zoom);
		return new L.Point(L.round(projectedPoint.x, 1e-6), L.round(projectedPoint.y, 1e-6));
	},

	unproject: function (point, zoom) { // (Point[, Number]) -> LatLng
		zoom = zoom === undefined ? this.getZoom() : zoom;
		return this.options.crs.pointToLatLng(L.point(point), zoom);
	},

	/**
	 * Get LatLng coordinates after negating the X cartesian-coordinate.
	 * This is useful in Calc RTL mode as mouse events have regular document
	 * coordinates(latlng) but draw-objects(shapes) have negative document
	 * X coordinates.
	 */
	negateLatLng: function (latlng, zoom) { // (LatLng[, Number]) -> LatLng
		var docPos = this.project(latlng, zoom);
		docPos.x = -docPos.x;
		return this.unproject(docPos, zoom);
	},

	layerPointToLatLng: function (point) { // (Point)
		var projectedPoint = L.point(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	latLngToLayerPoint: function (latlng) { // (LatLng)
		var projectedPoint = this.project(L.latLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	wrapLatLng: function (latlng) {
		return this.options.crs.wrapLatLng(L.latLng(latlng));
	},

	distance: function (latlng1, latlng2) {
		return this.options.crs.distance(L.latLng(latlng1), L.latLng(latlng2));
	},

	containerPointToLayerPoint: function (point) { // (Point)
		var splitPanesContext = this.getSplitPanesContext();
		if (!splitPanesContext) {
			return this.containerPointToLayerPointIgnoreSplits(point);
		}
		var splitPos = splitPanesContext.getSplitPos();
		var pixelOrigin = this.getPixelOrigin();
		var mapPanePos = this._getMapPanePos();
		var result = L.point(point).clone();
		var pointX = point.x;
		if (this._docLayer.isCalcRTL()) {
			pointX = this._container.clientWidth - pointX;
			result.x = pointX;
		}

		if (pointX <= splitPos.x) {
			result.x -= pixelOrigin.x;
		}
		else {
			result.x -= mapPanePos.x;
		}

		if (point.y <= splitPos.y) {
			result.y -= pixelOrigin.y;
		}
		else {
			result.y -= mapPanePos.y;
		}

		return result;
	},

	containerPointToLayerPointIgnoreSplits: function (point) { // (Point)
		return L.point(point).subtract(this._getMapPanePos());
	},

	layerPointToContainerPoint: function (point) { // (Point)
		var splitPanesContext = this.getSplitPanesContext();
		if (!splitPanesContext) {
			return this.layerPointToContainerPointIgnoreSplits(point);
		}

		var splitPos = splitPanesContext.getSplitPos();
		var pixelOrigin = this.getPixelOrigin();
		var mapPanePos = this._getMapPanePos();
		var result = L.point(point).add(pixelOrigin);

		if (result.x > splitPos.x) {
			result.x -= (pixelOrigin.x - mapPanePos.x);
		}

		if (result.y > splitPos.y) {
			result.y -= (pixelOrigin.y - mapPanePos.y);
		}

		return result;
	},

	layerPointToContainerPointIgnoreSplits: function (point) { // (Point)
		return L.point(point).add(this._getMapPanePos());
	},

	containerPointToLatLngIgnoreSplits: function (point) {
		var layerPoint = this.containerPointToLayerPointIgnoreSplits(L.point(point));
		return this.layerPointToLatLng(layerPoint);
	},

	latLngToContainerPointIgnoreSplits: function (latlng) {
		return this.layerPointToContainerPointIgnoreSplits(this.latLngToLayerPoint(L.latLng(latlng)));
	},

	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(L.latLng(latlng)));
	},

	mouseEventToContainerPoint: function (e) { // (MouseEvent)
		return L.DomEvent.getMousePosition(e, this._container);
	},

	mouseEventToLayerPoint: function (e) { // (MouseEvent)
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},

	// Give the focus to the text input.
	// @acceptInput (only on "mobile" (= mobile phone) or on iOS and Android in general) true if we want to
	// accept key input, and show the virtual keyboard.
	focus: function (acceptInput) {
		this._textInput.focus(acceptInput);
	},

	// just set the keyboard state for mobile
	// we dont want to change the focus, we know that keyboard is closed
	// and we are just setting the state here
	setAcceptInput: function (acceptInput) {
		this._textInput._setAcceptInput(acceptInput);
	},

	// Lose focus to stop accepting keyboard input.
	// On mobile, it will hide the virtual keyboard.
	blur: function () {
		this._textInput.blur();
	},

	hasFocus: function () {
		return document.activeElement === this._textInput.activeElement();
	},

	// Returns true iff the textarea is enabled and we focused on it.
	// On mobile, this signifies that the keyboard should be visible.
	canAcceptKeyboardInput: function() {
		return this._textInput.canAcceptKeyboardInput();
	},

	isSearching: function() {
		return this._isSearching;
	},

	_fireInitComplete: function (condition) {
		if (this.initComplete) {
			return;
		}

		this.initConditions[condition] = true;
		for (var key in this.initConditions) {
			if (!this.initConditions[key]) {
				return;
			}
		}
		this.fire('statusindicator', {statusType: 'initializationcomplete'});
		this.initComplete = true;
	},

	_initContainer: function (id) {
		var container = this._container = L.DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet) {
			throw new Error('Map container is already initialized.');
		}

		if (window.mode.isDesktop()) {
			this._resizeDetector = L.DomUtil.create('iframe', 'resize-detector', container);
			this._resizeDetector.title = 'Intentionally blank';
			this._resizeDetector.setAttribute('aria-hidden', 'true');
			this._resizeDetector.contentWindow.addEventListener('touchstart', L.DomEvent.preventDefault, {passive: false});
			L.DomEvent.on(this._resizeDetector.contentWindow, 'contextmenu', L.DomEvent.preventDefault);
		}

		this._fileDownloader = L.DomUtil.create('iframe', '', container);
		L.DomUtil.setStyle(this._fileDownloader, 'display', 'none');

		L.DomEvent.on(this._fileDownloader.contentWindow, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.addListener(container, 'scroll', this._onScroll, this);
		container._leaflet = true;
	},

	_onScroll: function() {
		this._container.scrollTop = 0;
		this._container.scrollLeft = 0;
	},

	_initLayout: function () {
		var container = this._container;

		this._fadeAnimated = this.options.fadeAnimation && L.Browser.any3d;

		L.DomUtil.addClass(container, 'leaflet-container' +
			(L.Browser.touch ? ' leaflet-touch' : '') +
			(L.Browser.retina ? ' leaflet-retina' : '') +
			(L.Browser.ielt9 ? ' leaflet-oldie' : '') +
			(L.Browser.safari ? ' leaflet-safari' : '') +
			(this._fadeAnimated ? ' leaflet-fade-anim' : ''));

		var position = L.DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'absolute';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};
		this._paneRenderers = {};

		this._mapPane = this.createPane('mapPane', this._container);

		this.createPane('tilePane');
		this.createPane('shadowPane');
		this.createPane('overlayPane');
		this.createPane('markerPane');
		this.createPane('popupPane');
		this.createPane('formfieldPane');

		if (!this.options.markerZoomAnimation) {
			L.DomUtil.addClass(panes.markerPane, 'leaflet-zoom-hide');
			L.DomUtil.addClass(panes.shadowPane, 'leaflet-zoom-hide');
		}
	},


	// private methods that modify map state

	_resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

		var zoomChanged = (this._zoom !== zoom);

		if (!afterZoomAnim) {
			this.fire('movestart');

			if (zoomChanged) {
				this.fire('zoomstart');
			}
		}

		this._zoom = zoom;

		if (!preserveMapOffset) {
			L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
		}

		this._pixelOrigin = this._getNewPixelOrigin(center);

		var loading = !this._loaded;
		this._loaded = true;

		this.fire('viewreset', {hard: !preserveMapOffset});

		if (loading) {
			this.fire('load');
		}

		this.fire('move');

		if (zoomChanged || afterZoomAnim) {
			this.fire('zoomend');
			this.fire('zoomlevelschange');
		}

		this.fire('moveend', {hard: !preserveMapOffset});
	},

	_rawPanBy: function (offset) {
		L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// DOM event handling
	_mainEvents: function (onOff) {
		L.DomEvent[onOff](this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove dragover drop ' +
			'trplclick qdrplclick', this._handleDOMEvent, this);
	},

	_initEvents: function (remove) {
		if (!L.DomEvent) { return; }

		this._targets = {};

		this._mouseOut = false;

		var onOff = remove ? 'off' : 'on';

		this._mainEvents(onOff);

		if (this.options.trackResize) {
			var winTarget = this._resizeDetector && this._resizeDetector.contentWindow ? this._resizeDetector.contentWindow :
				window;
			L.DomEvent[onOff](winTarget, 'resize', this._onResize, this);
		}

		L.DomEvent[onOff](window, 'blur', this._onLostFocus, this);
		L.DomEvent[onOff](window, 'focus', this._onGotFocus, this);
	},

	_onResize: function () {
		L.Util.cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = L.Util.requestAnimFrame(
			function () { this.invalidateSize({debounceMoveend: true}); }, this, false, this._container);

		if (this.sidebar)
			this.sidebar.onResize();

		this.showCalcInputBar();
	},

	showCalcInputBar: function() {
		var wrapper = document.getElementById('calc-inputbar-wrapper');
		if (wrapper)
			wrapper.style.display = 'block';
	},

	// Change the focus to a dialog or editor.
	// @dialog is the instance of the dialog class.
	// @winId is the ID of the dialog/sidebar, or 0 for the editor.
	// @acceptInput iff defined, map.focus is called and passed to it.
	_changeFocusWidget: function (dialog, winId, acceptInput) {
		if (!this._loaded) { return; }

		this.setWinId(winId);
		this._activeDialog = dialog;
		this._isSearching = false;

		if (this.editorHasFocus()) {
			// The document has the focus.
			var doclayer = this._docLayer;
			if (doclayer)
				doclayer._updateCursorAndOverlay();
		} else if (acceptInput !== undefined) {
			// A dialog has the focus.
			this.focus(acceptInput);
			this._textInput.hideCursor(); // The cursor is in the dialog.
		}
	},

	// Our browser tab lost focus.
	_onLostFocus: function () {
		app.idleHandler._deactivate();
	},

	// The editor got focus (probably a dialog closed or user clicked to edit).
	_onEditorGotFocus: function() {
		this._changeFocusWidget(null, 0);
		if (this.formulabar)
			this.onFormulaBarBlur();
	},

	// Our browser tab got focus.
	_onGotFocus: function () {
		if (this.editorHasFocus()) {
			this.fire('editorgotfocus');
		}
		else if (this._activeDialog) {
			this._activeDialog.focus(this.getWinId());
		}

		app.idleHandler._activate();
	},

	// Event to change the focus to dialog or editor.
	_onChangeFocusWidget: function (e) {
		if (e.winId === 0) {
			this._onEditorGotFocus();
		} else {
			this._changeFocusWidget(e.dialog, e.winId, e.acceptInput);
		}
	},

	_onSearchStart: function () {
		this._isSearching = true;
	},

	_onUpdateProgress: function (e) {
		if (e.statusType === 'start') {
			if (e.text) {
				// e.text translated by Core
				this.showBusy(e.text);
			}
		}
		else if (e.statusType === 'setvalue') {
			this._progressBar.setValue(e.value);
		}
		else if (e.statusType === 'finish' || e.statusType === 'coolloaded' || e.statusType === 'reconnected') {
			this.hideBusy();
		}
	},

	_isMouseEnteringLeaving: function (e) {
		var target = e.target || e.srcElement,
		    related = e.relatedTarget;

		if (!target) { return false; }

		return (L.DomUtil.hasClass(target, 'leaflet-tile')
			&& !(related && (L.DomUtil.hasClass(related, 'leaflet-tile')
				|| L.DomUtil.hasClass(related, 'leaflet-cursor'))));
	},

	_handleDOMEvent: function (e) {
		app.idleHandler.notifyActive();

		if (!this._docLayer || !this._loaded || !this._enabled || L.DomEvent._skipped(e)) { return; }

		// find the layer the event is propagating from
		var target = this._targets[L.stamp(e.target || e.srcElement)],
		    //type = e.type === 'keypress' && e.keyCode === 13 ? 'click' : e.type;
		    type = e.type;

		// For touch devices, to pop-up the keyboard, it is required to call
		// .focus() method on hidden input within actual 'click' event here
		// Calling from some other place with no real 'click' event doesn't work.

		if (type === 'click' || type === 'dblclick') {
			if (this.isEditMode()) {
				this.fire('editorgotfocus');
				this.focus();
			}

			// unselect if anything is selected already
			if (app.sectionContainer.doesSectionExist(L.CSections.CommentList.name)) {
				app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).unselect();
			}
		}

		// we need to keep track about the last action, this
		// will help us to avoid wrongly removing the editor
		if (type === 'keypress') {
			this.lastActionByUser = true;
		}

		// we need to keep track if we have entered/left the map
		this._mouseEnteringLeaving = false;
		// mouse leaving the map ?
		if (!target && !this._mouseOut && type === 'mouseout') {
			this._mouseEnteringLeaving = this._isMouseEnteringLeaving(e);
			this._mouseOut = this._mouseEnteringLeaving; // event type == mouseout
		}
		// mouse entering the map ?
		if (!target && this._mouseOut && type === 'mouseover') {
			this._mouseEnteringLeaving = this._isMouseEnteringLeaving(e);
			this._mouseOut = !this._mouseEnteringLeaving; // event type == mouseover
		}

		// special case for map mouseover/mouseout events so that they're actually mouseenter/mouseleave
		if (!target && !this._mouseEnteringLeaving && (type === 'mouseover' || type === 'mouseout') &&
				!L.DomEvent._checkMouse(this._container, e)) { return; }

		// prevents outline when clicking on keyboard-focusable element
		if (type === 'mousedown') {
			L.DomUtil.preventOutline(e.target || e.srcElement);
			// Prevents image dragging on Mozilla when map's dragging
			// option is set to false
			e.preventDefault();
		}

		// workaround for drawing shapes, without this shapes cannot be shrunken
		if (target !== undefined && target._path !== undefined && type === 'mousemove') {
			target = undefined;
		}
		this._fireDOMEvent(target || this, e, type);
	},

	_fireDOMEvent: function (target, e, type) {
		if (this.uiManager.isUIBlocked())
			return;

		if (!target.listens(type, true) && (type !== 'click' || !target.listens('preclick', true))) { return; }

		if (type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}

		// prevents firing click after you just dragged an object
		if (e.type === 'click' && !e._simulated && this._draggableMoved(target)) { return; }

		var data = {
			originalEvent: e
		};
		if (e.type !== 'keypress' && e.type !== 'keyup' && e.type !== 'keydown' &&
			e.type !== 'copy' && e.type !== 'cut' && e.type !== 'paste' &&
		    e.type !== 'compositionstart' && e.type !== 'compositionupdate' && e.type !== 'compositionend' && e.type !== 'textInput') {
			data.containerPoint = target instanceof L.Marker ?
				this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = this.layerPointToLatLng(data.layerPoint);
		}
		if (type === 'click') {
			target.fire('preclick', data, true);
		}
		target.fire(type, data, true);
	},

	_draggableMoved: function (obj) {
		obj = obj.options.draggable ? obj : this;
		return obj.dragging && obj.dragging.moved();
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, {target: this});
		} else {
			this.on('load', callback, context);
		}
		return this;
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return L.DomUtil.getPosition(this._mapPane) || new L.Point(0, 0);
	},

	_getTopLeftPoint: function (center, zoom) {
		var pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();

		return pixelOrigin.subtract(this._getMapPanePos());
	},

	_getNewPixelOrigin: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._floor();
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPointIgnoreSplits(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new L.Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var nwOffset = this.project(maxBounds.getNorthWest(), zoom).subtract(pxBounds.min),
		    seOffset = this.project(maxBounds.getSouthEast(), zoom).subtract(pxBounds.max),

		    dx = this._rebound(nwOffset.x, -seOffset.x),
		    dy = this._rebound(nwOffset.y, -seOffset.y);

		return new L.Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
		// TODO: do we really need ceil and floor ?
		// for spreadsheets it can cause one pixel alignment offset btw grid and row/column header
		// and a one pixel horizontal auto-scrolling issue;
		// both issues have been fixed by rounding the projection: see Map.project above;
		// anyway in case of similar problems, this code needs to be checked
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom();

		return Math.max(min, Math.min(max, zoom));
	},

	_goToViewId: function(id) {
		if (id === -1)
			return;

		if (this.getDocType() === 'spreadsheet') {
			this._docLayer.goToCellViewCursor(id);
		} else if (this.getDocType() === 'text' || this.getDocType() === 'presentation') {
			this._docLayer.goToViewCursor(id);
		}
	},

	_setFollowing: function(followingState, viewId) {
		var userDefined = viewId !== null && viewId !== undefined;
		var followDefined = followingState !== null && followingState !== undefined;

		var followEditor = true;
		var followUser = false;

		if (userDefined && viewId !== -1 && viewId !== this._docLayer.viewId) {
			followUser = true;
			followEditor = false;
		}

		if (followDefined && followingState === false) {
			followEditor = false;
			followUser = false;
		}

		this._docLayer._followUser = followUser;
		this._docLayer._followEditor = followEditor;

		if (followUser) {
			this._goToViewId(viewId);
			this._docLayer._followThis = viewId;
		}
		else if (followEditor) {
			var editorId = this._docLayer._editorId;
			if (editorId !== -1 && editorId !== this._docLayer.viewId) {
				this._goToViewId(editorId);
				this._docLayer._followThis = editorId;
			}
		}
		else {
			this.fire('deselectuser', {viewId: this._docLayer._followThis});
			this._docLayer._followThis = -1;
		}

		// Notify about changes
		this.fire('postMessage', {msgId: 'FollowUser_Changed',
			args: {FollowedViewId: this._docLayer._followThis,
				IsFollowUser: followUser,
				IsFollowEditor: followEditor}});
	},

	getSplitPanesContext: function () {
		var docLayer = this._docLayer;
		if (docLayer) {
			return docLayer.getSplitPanesContext();
		}

		return undefined;
	},

	_setPaneOpacity: function(paneClassString, opacity) {
		var panes = document.getElementsByClassName(paneClassString);
		if (panes.length)
			panes[0].style.opacity = opacity;
	},

	setOverlaysOpacity: function(opacity) {
		this._setPaneOpacity('leaflet-pane leaflet-overlay-pane', opacity);
	},

	setMarkersOpacity: function(opacity) {
		this._setPaneOpacity('leaflet-pane leaflet-marker-pane', opacity);
	},

	getTileSectionMgr: function() {
		if (this._docLayer)
			return this._docLayer._painter;
		return undefined;
	},

	getCursorOverlayContainer: function() {
		if (this._docLayer)
			return this._docLayer._cursorOverlayDiv;
		return undefined;
	}
});

L.map = function (id, options) {
	return new L.Map(id, options);
};
