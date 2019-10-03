/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Map.CalcTap is used to enable mobile taps.
 */

L.Map.mergeOptions({
	touchGesture: true,
});

/* global Hammer $ */
L.Map.TouchGesture = L.Handler.extend({
	statics: {
		MAP: 1,
		CURSOR: 2,
		GRAPHIC: 4,
		MARKER: 8,
		TABLE: 16,
		TEXT_CURSOR_HANDLE: 32,
		TEXT_SELECTION_HANDLE: 64
	},

	initialize: function (map) {
		L.Handler.prototype.initialize.call(this, map);
		this._state = L.Map.TouchGesture.MAP;

		if (window.ThisIsTheiOSApp && !this._toolbar) {
			this._toolbar = L.control.contextToolbar();
			this._toolbarAdded = 0;
		}

		if (!this._hammer) {
			this._hammer = new Hammer(this._map._mapPane);
			this._hammer.get('swipe').set({
				direction: Hammer.DIRECTION_ALL
			});
			this._hammer.get('pan').set({
				direction: Hammer.DIRECTION_ALL
			});
			this._hammer.get('pinch').set({
				enable: true
			});

			var singleTap = this._hammer.get('tap');
			var doubleTap = this._hammer.get('doubletap');
			var tripleTap = new Hammer.Tap({event: 'tripletap', taps: 3 });
			this._hammer.add(tripleTap);
			tripleTap.recognizeWith([doubleTap, singleTap]);

			if (L.Browser.touch) {
				L.DomEvent.on(this._map._mapPane, 'touchstart touchmove touchend touchcancel', L.DomEvent.preventDefault);
			}

			if (Hammer.prefixed(window, 'PointerEvent') !== undefined) {
				L.DomEvent.on(this._map._mapPane, 'pointerdown pointermove pointerup pointercancel', L.DomEvent.preventDefault);
			}

			// IE10 has prefixed support, and case-sensitive
			if (window.MSPointerEvent && !window.PointerEvent) {
				L.DomEvent.on(this._map._mapPane, 'MSPointerDown MSPointerMove MSPointerUp MSPointerCancel', L.DomEvent.preventDefault);
			}

			L.DomEvent.on(this._map._mapPane, 'mousedown mousemove mouseup', L.DomEvent.preventDefault);
			L.DomEvent.on(document, 'contextmenu', L.DomEvent.preventDefault);
		}

		for (var events in L.Draggable.MOVE) {
			L.DomEvent.on(document, L.Draggable.END[events], this._onDocUp, this);
		}

		/// $.contextMenu does not support touch events so,
		/// attach 'touchend' menu clicks event handler
		if (this._hammer.input instanceof Hammer.TouchInput) {
			var $doc = $(document);
			$doc.on('touchend.contextMenu', '.context-menu-item', function (e) {
				var $elem = $(this);

				if ($elem.data().contextMenu.selector === '.leaflet-layer') {
					$.contextMenu.handle.itemClick.apply(this, [e]);
				}
			});
		}
	},

	addHooks: function () {
		this._hammer.on('hammer.input', L.bind(this._onHammer, this));
		this._hammer.on('tap', L.bind(this._onTap, this));
		this._hammer.on('panstart', L.bind(this._onPanStart, this));
		this._hammer.on('pan', L.bind(this._onPan, this));
		this._hammer.on('panend', L.bind(this._onPanEnd, this));
		this._hammer.on('pinchstart', L.bind(this._onPinchStart, this));
		this._hammer.on('pinchmove', L.bind(this._onPinch, this));
		this._hammer.on('pinchend', L.bind(this._onPinchEnd, this));
		this._hammer.on('tripletap', L.bind(this._onTripleTap, this));
		if (window.ThisIsTheiOSApp) {
			this._map.on('input.press', this._onInputPressiOSOnly, this);
			this._map.on('input.dragstart', this._onInputDragStartiOSOnly, this);
			this._map.on('input.dragend', this._onInputDragEndiOSOnly, this);
			this._map.on('input.blur', this._onInputLostFocusiOSOnly, this);
			this._map.on('textselected', this._onTextSelectediOSOnly, this);
			this._map.on('textselection.dragend', this._onTextSelectionHandleDragEndiOSOnly, this);
		}
		this._map.on('updatepermission', this._onPermission, this);
		this._onPermission({perm: this._map._permission});
	},

	removeHooks: function () {
		this._hammer.off('hammer.input', L.bind(this._onHammer, this));
		this._hammer.off('tap', L.bind(this._onTap, this));
		this._hammer.off('panstart', L.bind(this._onPanStart, this));
		this._hammer.off('pan', L.bind(this._onPan, this));
		this._hammer.off('panend', L.bind(this._onPanEnd, this));
		this._hammer.off('pinchstart', L.bind(this._onPinchStart, this));
		this._hammer.off('pinchmove', L.bind(this._onPinch, this));
		this._hammer.off('pinchend', L.bind(this._onPinchEnd, this));
		this._hammer.off('doubletap', L.bind(this._onDoubleTap, this));
		this._hammer.off('tripletap', L.bind(this._onTripleTap, this));
		this._map.off('updatepermission', this._onPermission, this);
	},

	_onPermission: function (e) {
		if (e.perm == 'edit') {
			this._hammer.on('doubletap', L.bind(this._onDoubleTap, this));
			this._hammer.on('press', L.bind(this._onPress, this));
		} else {
			this._hammer.off('doubletap', L.bind(this._onDoubleTap, this));
			this._hammer.off('press', L.bind(this._onPress, this));
		}
	},

	_onHammer: function (e) {
		this._map.notifyActive();
		if (e.isFirst) {
			var point = e.pointers[0],
			    containerPoint = this._map.mouseEventToContainerPoint(point),
			    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
			    latlng = this._map.layerPointToLatLng(layerPoint);

			if (this._map._docLayer._graphicMarker) {
				this._marker = this._map._docLayer._graphicMarker.transform.getMarker(layerPoint);
			}

			var cursorHandleBounds;
			if (this._map._clipboardContainer._cursorHandler)
				cursorHandleBounds = this._map._clipboardContainer._cursorHandler.getBounds();
			var startTextSelectionHandleBounds;
			if (this._map._docLayer._selectionHandles['start'])
				startTextSelectionHandleBounds = this._map._docLayer._selectionHandles['start'].getBounds();
			var endTextSelectionHandleBounds;
			if (this._map._docLayer._selectionHandles['end'])
				endTextSelectionHandleBounds = this._map._docLayer._selectionHandles['end'].getBounds();

			if (this._marker) {
				this._state = L.Map.TouchGesture.MARKER;
			} else if (this._map._docLayer._graphicMarker && this._map._docLayer._graphicMarker.getBounds().contains(latlng)) {
				if (this._map._docLayer.hasTableSelection())
					this._state = L.Map.TouchGesture.TABLE;
				else
					this._state = L.Map.TouchGesture.GRAPHIC;
			} else if (this._map._docLayer._cellCursor && this._map._docLayer._cellCursor.contains(latlng)) {
				this._state = L.Map.TouchGesture.CURSOR;
			} else if (cursorHandleBounds && cursorHandleBounds.padHorizontally(0.2).contains(latlng)) {
				this._state = L.Map.TouchGesture.TEXT_CURSOR_HANDLE;
			} else if ((startTextSelectionHandleBounds && startTextSelectionHandleBounds.padHorizontally(0.2).contains(latlng))
				|| (endTextSelectionHandleBounds && endTextSelectionHandleBounds.padHorizontally(0.2).contains(latlng))) {
				this._state = L.Map.TouchGesture.TEXT_SELECTION_HANDLE;
			} else {
				this._state = L.Map.TouchGesture.MAP;
			}
			// console.log('==> _onHammer: _state: ' + this._state);
		}

		if (e.isLast && this._state !== L.Map.TouchGesture.MAP) {
			this._state = L.Map.TouchGesture.hitTest.MAP;
			this._marker = undefined;
		}

		if ($(e.srcEvent.target).has(this._map._mapPane)) {
			L.DomEvent.preventDefault(e.srcEvent);
			L.DomEvent.stopPropagation(e.srcEvent);
		}
	},

	_onDocUp: function () {
		if (!this._map.touchGesture.enabled()) {
			this._map.touchGesture.enable();
		}
	},

	_addContextToolbar: function (commands, latlng, timeStamp) {
		this._toolbar.remove();
		this._toolbar.addTo(this._map);
		this._toolbar.setEntries(commands);
		this._toolbar.setPosition(latlng);
		this._toolbarAdded = timeStamp;
	},

	_getTextSelectionNorthCenter: function () {
		var result;
		var selections = this._map._docLayer._selections;
		if (selections) {
			var layers = selections.getLayers();
			if (layers && layers.length === 1) {
				var mapBounds = this._map.getBounds();
				var bounds = layers[0].getBounds();
				bounds = mapBounds.intersection(bounds);
				result = bounds.getCenter();
				result.lat = bounds.getNorth();
			}
		}
		return result;
	},

	_onPress: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		var docLayer = this._map._docLayer;

		if (window.ThisIsTheiOSApp) {
			// if user has pressed on cursor or text selection handles don't perform any action
			// so far we skip also press actions on graphics and cell cursor
			// we check focus in order to not get unexpected behavior with open dialogs
			var hasPressedOnCellCursor = this._state === L.Map.TouchGesture.CURSOR;
			if ((this._state === L.Map.TouchGesture.MAP && this._map.hasFocus()) || hasPressedOnCellCursor) {
				// console.log('==> onPress: ' + e.timeStamp);
				// no text selected
				if (!docLayer.containsSelection(latlng) && !hasPressedOnCellCursor) {
					// I see several press events generated for the same press action, try to skip the redundant ones.
					if (!this._prevPressContainerPoint || !(this._contextToolbarTimeout && containerPoint.equals(this._prevPressContainerPoint))) {
						// we can skip when the toolbar is already active and user has pressed at the text cursor position
						if (this._toolbar.isVisible() && docLayer._visibleCursor.padHorizontally(0.2).contains(latlng))
							return;
						// place the text cursor where user pressed
						docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
						docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);

						var that = this;
						var timeout = 300;
						var prevCursorPos = this._map.latLngToContainerPoint(docLayer._visibleCursor.getNorthEast());

						var setContextToolbar = function (n) {
							var toolbarUpdated = false;
							// is the text cursor visible ?
							if (docLayer._isCursorVisible && !docLayer._isEmptyRectangle(docLayer._visibleCursor) && docLayer._cursorMarker) {
								var posLatLng = docLayer._visibleCursor.getNorthEast();
								var pos = that._map.latLngToContainerPoint(posLatLng);
								// do the client get the new cursor position ? if client doesn't, let's try to re-schedule this routine
								if (!pos.equals(prevCursorPos) || !that._toolbar.isVisible()) {
									var commands = 'TEXT_CURSOR_TOOLBAR';
									// console.log('==> onPress: Adding context toolbar ' + Date.now() + ', call: ' + n);
									that._addContextToolbar(commands, posLatLng, Date.now());
									toolbarUpdated = true;
								}
							}
							// if the toolbar has not been update re-schedule this routine
							if (!toolbarUpdated && n < 5) {
								n += 1;
								that._contextToolbarTimeout = setTimeout(setContextToolbar, n * timeout, n);
							} else {
								that._contextToolbarTimeout = null;
							}
						};

						if (this._contextToolbarTimeout)
							clearTimeout(this._contextToolbarTimeout);
						this._contextToolbarTimeout = setTimeout(setContextToolbar, timeout, 1);
					}
				// if some text is selected and the toolbar is active, the user wants to trigger the context menu
				} else if (hasPressedOnCellCursor && !this._toolbar.isVisible()) {
					if (!this._prevPressContainerPoint || !(this._toolbar.isVisible() && containerPoint.equals(this._prevPressContainerPoint))) {
						var commands = 'TEXT_CURSOR_TOOLBAR';
						// console.log('==> onPress: Adding context toolbar ' + e.timeStamp);
						this._addContextToolbar(commands, latlng, e.timeStamp);
					}
				} else if (this._toolbar.isVisible() && e.timeStamp - this._toolbarAdded >= 1000) {
					// console.log('==> onPress: Removing context toolbar ' + e.timeStamp);
					this._toolbar.remove();
					this._toolbarAdded = null;
					this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
					// send right click to trigger context menus
					docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 4, 0);
					docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 4, 0);
				}
			}
			this._prevPressContainerPoint = containerPoint;
		} else {
			this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
			// send right click to trigger context menus
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 4, 0);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 4, 0);
		}
		e.preventDefault();
	},

	_onTap: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (window.ThisIsTheiOSApp) {
			if (this._toolbarAdded) {
				this._toolbar.remove();
				this._toolbarAdded = null;
			}
		}
		this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);

		this._map.focus();
	},

	_onDoubleTap: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		var docLayer = this._map._docLayer;

		if (window.ThisIsTheiOSApp) {
			this._newTextSelection = false;
		}
		docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2, 1, 0);
		docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2, 1, 0);

		if (window.ThisIsTheiOSApp) {
			var that = this;
			var timeout = 300;
			var prevCursorPos = this._map.latLngToContainerPoint(docLayer._visibleCursor.getSouthWest());

			var setContextToolbar = function (n) {
				var canBeUpdated = false;
				var commands, pos, posLatLng;
				if (that._newTextSelection) {
					commands = 'TEXT_SELECTION_TOOLBAR';
					posLatLng = that._getTextSelectionNorthCenter() || latlng;
					canBeUpdated = true;
				} else if (docLayer._isCursorVisible && !docLayer._isEmptyRectangle(docLayer._visibleCursor) && docLayer._cursorMarker) {
					posLatLng = docLayer._visibleCursor.getNorthEast();
					pos = that._map.latLngToContainerPoint(posLatLng);
					if (!pos.equals(prevCursorPos) || !that._toolbar.isVisible()) {
						commands = 'TEXT_CURSOR_TOOLBAR';
						canBeUpdated = true;
					}
				}
				if (!canBeUpdated && n < 5) {
					n += 1;
					that._contextToolbarTimeout = setTimeout(setContextToolbar, n * timeout, n);
				} else {
					if (canBeUpdated) {
						// console.log('==> onDoubleTap: Adding context toolbar ' + Date.now() + ', call: ' + n);
						that._addContextToolbar(commands, posLatLng, Date.now());
					}
					that._contextToolbarTimeout = null;
				}
			};

			if (this._contextToolbarTimeout)
				clearTimeout(this._contextToolbarTimeout);
			this._contextToolbarTimeout = setTimeout(setContextToolbar, timeout, 1);
		}
	},

	_onTripleTap: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 8192);
		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 8192);
	},

	_onPanStart: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (window.ThisIsTheiOSApp) {
			if (this._toolbar.isVisible())
				this._toolbar.hide();
		}

		var originalCellCursor = this._map._docLayer._cellCursor;
		var increaseRatio = 0.40;
		var increasedCellCursor = null;
		if (originalCellCursor) {
			increasedCellCursor = originalCellCursor.padVertically(increaseRatio);
		}

		if (increasedCellCursor && increasedCellCursor.contains(latlng)) {
			if (!originalCellCursor.contains(latlng)) {
				var lat = latlng.lat;
				var lng = latlng.lng;

				var sw = originalCellCursor._southWest,
				ne = originalCellCursor._northEast;
				var heightBuffer = Math.abs(sw.lat - ne.lat) * increaseRatio;

				if (lat < originalCellCursor.getSouthWest().lat) {
					lat = lat + heightBuffer;
				}

				if (lat > originalCellCursor.getNorthEast().lat) {
					lat = lat - heightBuffer;
				}

				latlng = new L.LatLng(lat, lng);
				mousePos = this._map._docLayer._latLngToTwips(latlng);
			}
		}

		if (this._state === L.Map.TouchGesture.MARKER) {
			this._map._fireDOMEvent(this._marker, e.srcEvent, 'mousedown');
		} else if (this._state === L.Map.TouchGesture.GRAPHIC) {
			var mouseEvent = this._map._docLayer._createNewMouseEvent('mousedown', e.srcEvent);
			this._map._docLayer._graphicMarker._onDragStart(mouseEvent);
		} else if (this._state === L.Map.TouchGesture.TABLE) {
			this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		} else if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onDown(this._constructFakeEvent(point, 'mousedown'));
		}
	},

	_onPan: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (this._state === L.Map.TouchGesture.MARKER) {
			this._map._fireDOMEvent(this._map, e.srcEvent, 'mousemove');
		} else if (this._state === L.Map.TouchGesture.GRAPHIC) {
			var mouseEvent = this._map._docLayer._createNewMouseEvent('mousemove', e.srcEvent);
			this._map._docLayer._graphicMarker._onDrag(mouseEvent);
		} else if (this._state === L.Map.TouchGesture.TABLE) {
			this._map._docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 1, 0);
		} else if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onMove(this._constructFakeEvent(point, 'mousemove'));
		}
	},

	_onPanEnd: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (window.ThisIsTheiOSApp) {
			if (this._toolbarAdded) {
				// set to the previous position
				this._toolbar.setPosition(this._toolbar._latlng);
				this._toolbar.show();
				this._toolbarAdded = Date.now();
			}
		}

		if (this._state === L.Map.TouchGesture.MARKER) {
			this._map._fireDOMEvent(this._map, e.srcEvent, 'mouseup');
		} else if (this._state === L.Map.TouchGesture.GRAPHIC) {
			var mouseEvent = this._map._docLayer._createNewMouseEvent('mouseup', e.srcEvent);
			this._map._docLayer._graphicMarker._onDragEnd(mouseEvent);
		} else if (this._state === L.Map.TouchGesture.TABLE) {
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
		} else if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onUp(this._constructFakeEvent(point, 'mouseup'));
		}
	},

	_onPinchStart: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			this._pinchStartCenter = {x: e.center.x, y: e.center.y};
		}
		if (window.ThisIsTheiOSApp) {
			if (this._toolbar.isVisible())
				this._toolbar.hide();
		}
	},

	_onPinch: function (e) {
		if (!this._pinchStartCenter)
			return;

		if (this._map.getDocType() !== 'spreadsheet') {
			// we need to invert the offset or the map is moved in the opposite direction
			var offset = {x: e.center.x - this._pinchStartCenter.x, y: e.center.y - this._pinchStartCenter.y};
			var center = {x: this._pinchStartCenter.x - offset.x, y: this._pinchStartCenter.y - offset.y};
			this._center = this._map.mouseEventToLatLng({clientX: center.x, clientY: center.y});
			this._zoom = this._map.getScaleZoom(e.scale);
			this._map._animateZoom(this._center, this._zoom, false, true);
		}
	},

	_onPinchEnd: function () {
		if (this._map.getDocType() !== 'spreadsheet') {
			var oldZoom = this._map.getZoom(),
			    zoomDelta = this._zoom - oldZoom,
			    finalZoom = this._map._limitZoom(zoomDelta > 0 ? Math.ceil(this._zoom) : Math.floor(this._zoom));
			if (this._center) {
				this._map._animateZoom(this._center, finalZoom, true, true);
			}
		}

		if (window.ThisIsTheiOSApp) {
			if (this._toolbarAdded) {
				this._toolbar.setPosition(this._toolbar._latlng);
				this._toolbar.show();
				this._toolbarAdded = Date.now();
			}
		}
	},

	_onInputPressiOSOnly: function (e) {
		if (this._toolbar.isVisible())
			return;
		var posLatLng = this._map._docLayer._visibleCursor.getNorthEast() || L.latLng(e);
		this._addContextToolbar('TEXT_CURSOR_TOOLBAR', posLatLng, Date.now());
	},

	_onInputDragStartiOSOnly: function () {
		if (this._toolbar.isVisible())
			this._toolbar.hide();
		// not set this._toolbarAdded to null it's checked on drag end
	},

	_onInputDragEndiOSOnly: function (e) {
		if (!this._toolbarAdded)
			return; // show the toolbar only if it was already active before starting dragging
		var posLatLng = L.latLng(e);
		this._toolbar.setPosition(posLatLng);
		this._toolbar.show();
		this._toolbarAdded = Date.now();
	},

	_onInputLostFocusiOSOnly: function () {
		// remove the toolbar when a dialog pops up
		if (!this._toolbar.isVisible())
			return;
		this._toolbar.remove();
		this._toolbarAdded = null;
	},

	_onTextSelectionHandleDragEndiOSOnly: function (e) {
		var posLatLng = L.latLng(e);
		var that = this;
		var timeout = 300;

		var setContextToolbar = function (n) {
			if (that._newTextSelection) {
				posLatLng = that._getTextSelectionNorthCenter() || posLatLng;
				that._addContextToolbar('TEXT_SELECTION_TOOLBAR', posLatLng, Date.now());
			} else if (n < 5) {
				n += 1;
				setTimeout(setContextToolbar, n * timeout, n);
			}
		};

		setTimeout(setContextToolbar, timeout, 1);
	},

	_onTextSelectediOSOnly: function () {
		this._newTextSelection = true;
	},

	_constructFakeEvent: function (evt, type) {
		var fakeEvt = {
			type: type,
			canBubble: false,
			cancelable: true,
			screenX: evt.screenX,
			screenY: evt.screenY,
			clientX: evt.clientX,
			clientY: evt.clientY,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			metaKey: false,
			button: 0,
			target: evt.target,
			preventDefault: function () {}
		};

		return fakeEvt;
	}
});
