/* -*- js-indent-level: 8 -*- */
/*
 * window.L.Map.Mouse is handling mouse interaction with the document
 */

/* global app TileManager */

window.L.Map.mergeOptions({
	mouse: true
});

window.L.Map.Mouse = window.L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._mouseEventsQueue = [];
	},

	addHooks: function () {
		this._map.on('mousedown mouseup mouseover mouseout mousemove dblclick trplclick qdrplclick',
			this._onMouseEvent, this);
	},

	removeHooks: function () {
		this._map.off('mousedown mouseup mouseover mouseout mousemove dblclick trplclick qdrplclick',
			this._onMouseEvent, this);
	},

	_isMouseOnValidityDropdown: function() {
		if (app.sectionContainer) {
			let section = app.sectionContainer.getSectionWithName(app.CSections.CalcValidityDropDown.name);
			if (section && section.sectionProperties.mouseEntered)
				return true;

			section = app.sectionContainer.getSectionWithName(app.CSections.FormFieldButton.name);
			if (section && section.sectionProperties.mouseEntered)
				return true;
		}

		return false;
	},

	_onMouseEvent: window.touch.mouseOnly(function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (this._isMouseOnAnHTMLSection())
			return;

		app.idleHandler.notifyActive();
		var docLayer = this._map._docLayer;
		if (!docLayer || this._map.rulerActive || (this._map.slideShow && this._map.slideShow.fullscreen) ||
			(this._map.slideShowPresenter && this._map.slideShowPresenter.isFullscreen())) {
			return;
		}

		var modifier = 0;
		var shift = e.originalEvent.shiftKey ? app.UNOModifier.SHIFT : 0;
		var ctrl = e.originalEvent.ctrlKey ? app.UNOModifier.CTRL : 0;
		var alt = e.originalEvent.altKey ? app.UNOModifier.ALT : 0;
		var cmd = e.originalEvent.metaKey ? app.UNOModifier.CTRLMAC : 0;
		modifier = shift | ctrl | alt | cmd;

		var buttons = 0;
		buttons |= e.originalEvent.button === app.JSButtons.left ? app.LOButtons.left : 0;
		buttons |= e.originalEvent.button === app.JSButtons.middle ? app.LOButtons.middle : 0;
		buttons |= e.originalEvent.button === app.JSButtons.right ? app.LOButtons.right : 0;

		// Turn ctrl-left-click into right-click for browsers on macOS
		if (window.L.Browser.mac) {
			if (modifier == app.UNOModifier.CTRL && buttons == app.LOButtons.left) {
				modifier = 0;
				buttons = app.LOButtons.right;
			}
		}

		var mouseEnteringLeavingMap = this._map._mouseEnteringLeaving;

		if (mouseEnteringLeavingMap && e.type === 'mouseover' && this._mouseDown) {
			window.L.DomEvent.off(document, 'mousemove', this._onMouseMoveOutside, this);
			window.L.DomEvent.off(document, 'mouseup', this._onMouseUpOutside, this);
		}
		else if (e.type === 'mousedown') {
			TileManager.resetPreFetching();
			this._mouseDown = true;
			this._buttonDown = buttons;
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
			}
			var mousePos = docLayer._latLngToTwips(e.latlng);
			this._mouseEventsQueue.push(window.L.bind(function () {
				this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, buttons, modifier);
			}, docLayer));
			this._holdMouseEvent = setTimeout(window.L.bind(this._executeMouseEvents, this), 500);
		}
		else if (e.type === 'mouseup') {
			this._mouseDown = false;
			if (this._map.dragging.enabled()) {
				if (this._mouseEventsQueue.length === 0) {
					// mouse up after panning
					return;
				}
			}

			var scrollSection = app.sectionContainer.getSectionWithName(app.CSections.Scroll.name);
			if (scrollSection.sectionProperties.mouseIsOnVerticalScrollBar || scrollSection.sectionProperties.mouseIsOnHorizontalScrollBar)
				return;

			// Core side is handling the mouseup by itself when the right button is down.
			// If we fire mouseup for right button, there will be duplicate.
			// Without this, selected text in a text box is un-selected via a right click. Therefore, copy / cut operations are disabled.
			if (this._buttonDown === app.LOButtons.right && modifier === 0)
				return;

			clearTimeout(this._holdMouseEvent);
			this._holdMouseEvent = null;
			var timeDiff = Date.now() - this._clickTime;
			if (this._clickTime && timeDiff > 1 && timeDiff <= 250) {
				// double click, a click was sent already
				this._mouseEventsQueue = [];
				this._clickCount++;
				if (this._clickCount < 4) {
					// Reset the timer in order to keep resetting until
					// we could have sent through a quadruple click. After this revert
					// to normal behaviour so that a following single-click is treated
					// as a separate click, in order to match LO desktop behaviour.
					// (Clicking five times results in paragraph selection after 4 clicks,
					// followed by resetting to a single cursor and no selection on the
					// fifth click.)
					this._clickTime = Date.now();
				}
				return;
			}
			else {
				this._clickTime = Date.now();
				this._clickCount = 1;
				mousePos = docLayer._latLngToTwips(e.latlng);
				var timeOut = 0;
				this._mouseEventsQueue.push(window.L.bind(function () {
					var docLayer = this._map._docLayer;
					this._mouseEventsQueue = [];
					docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, buttons, modifier);
					this._map.focus();
				}, this));
				this._holdMouseEvent = setTimeout(window.L.bind(this._executeMouseEvents, this), timeOut);
			}

			this._map.fire('scrollvelocity', { vx: 0, vy: 0 });
		}
		else if (e.type === 'mousemove' && this._mouseDown) {
			if (this._mouseOverTimeout)
				clearTimeout(this._mouseOverTimeout);

			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
				this._holdMouseEvent = null;
				if (this._map.dragging.enabled()) {
					// The user just panned the document
					this._mouseEventsQueue = [];
					return;
				}
				for (var i = 0; i < this._mouseEventsQueue.length; i++) {
					// synchronously execute old mouse events so we know that
					// they arrive to the server before the move command
					this._mouseEventsQueue[i]();
				}
				this._mouseEventsQueue = [];
			}
			if (!this._map.dragging.enabled()) {
				mousePos = docLayer._latLngToTwips(e.latlng);
				docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, buttons, modifier);

				this._map.fire('handleautoscroll', { pos: e.containerPoint, map: this._map });
			}
		}
		else if (e.type === 'mousemove' && !this._mouseDown) {
			clearTimeout(this._mouseOverTimeout);
			mousePos = docLayer._latLngToTwips(e.latlng);
			this._mouseOverTimeout = setTimeout(window.L.bind(function () {
				docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 0, modifier);
			}, this),
				100);
		}
		else if (e.type === 'dblclick' || e.type === 'trplclick' || e.type === 'qdrplclick') {
			mousePos = docLayer._latLngToTwips(e.latlng);
			var clicks = {
				dblclick: 2,
				trplclick: 3,
				qdrplclick: 4
			};
			var count = clicks[e.type];

			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, count, buttons, modifier);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, count, buttons, modifier);
		}
		else if (mouseEnteringLeavingMap && e.type === 'mouseout' && this._mouseDown) {
			window.L.DomEvent.on(document, 'mousemove', this._onMouseMoveOutside, this);
			window.L.DomEvent.on(document, 'mouseup', this._onMouseUpOutside, this);
		}
	}),

	_executeMouseEvents: function () {
		this._holdMouseEvent = null;
		for (var i = 0; i < this._mouseEventsQueue.length; i++) {
			this._mouseEventsQueue[i]();
		}
		this._mouseEventsQueue = [];
	},

	_onMouseMoveOutside: window.touch.mouseOnly(function (e) {
		this._map._handleDOMEvent(e);
		if (this._map.dragging.enabled()) {
			this._map.dragging._draggable._onMove(e);
		}
	}),

	_onMouseUpOutside: window.touch.mouseOnly(function (e) {
		this._mouseDown = false;
		window.L.DomEvent.off(document, 'mousemove', this._onMouseMoveOutside, this);
		window.L.DomEvent.off(document, 'mouseup', this._onMouseUpOutside, this);

		this._map._handleDOMEvent(e);
		if (this._map.dragging.enabled()) {
			this._map.dragging._draggable._onUp(e);
		}
		else if (this._map._docLayer) {
			// If it is not handled by the dragged object, it should be safe to send mouseUp event to the core side.
			const mousePos = this._map._docLayer._latLngToTwips(this._map.mouseEventToLatLng(e));
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);

			const section = app.sectionContainer.getSectionWithName(app.CSections.Scroll.name);
			if (section) section.onScrollVelocity({ vx: 0, vy: 0 });
		}
	})
});
