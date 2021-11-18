/*
 * A Leaflet layer that just sets the background colour of the map.
 *
 * This just changes the map container's style, and does not
 * implement pane positioning - adding two instances of this
 * layer to a map at a time will conflict.
 */

L.BackgroundColor = L.Layer.extend({
	options: {
		/*
		 * The background color that the map shall take when this layer is
		 * added to it. Must be a string containing a CSS color value, as per
		 * https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
		 *
		 * The default is Leaflet's default grey.
		 */
		color: '#dfdfdf'
	},

	onAdd: function() {
		return this.setColor(this.options.color);
	},

	remove: function() {
		delete this._map.style.background;
	},

	/*
	 * Expects a CSS color value. Sets the map background to that color, and
	 * resets the 'color' option of this layer.
	 */
	setColor: function(cssColor) {
		this.options.color = cssColor;
		if (this._map) {
			this._map.getContainer().style.background = cssColor;
		}
		return this;
	}
});

// LibreOffice-specific functionality follows.

/*
 * A L.BackgroundColor that automatically resets its color
 * based on 'statechange' messages from coolwsd.
 */
L.CalcBackground = L.BackgroundColor.extend({
	onAdd: function(map) {
		map.on('commandstatechanged', this._onStateChanged, this);
		return this.setColor(this.options.color);
	},

	remove: function() {
		delete this._map.style.background;
		this._map.off('commandstatechanged', this._onStateChanged, this);
	},

	// State flag for the heuristic algorithm used in _onStateChanged
	_bgCanBeSet: true,

	_onStateChanged: function(ev) {
		// There are lots of statechange events - but there is no indication of what the
		// background color of a Calc sheet is. In order to discern the background color
		// there is a heuristic method which uses three statechange events: BackgroundColor,
		// RowColSelCount and StatusPosDoc.
		// A BackgroundColor statechange will be regarded as a change of background
		// color only if:
		// - There has been no previous RowColSelCount statechange (first load),
		// - There has been a StatusPosDoc (sheet change) before the last RowColSelCount,
		// - The last RowColSelCount affected all the sheet (re-applying color).

		if (ev.commandName === '.uno:StatusDocPos') {
			this._bgCanBeSet = true;
			return;
		}
		if (ev.commandName === '.uno:RowColSelCount') {
			this._bgCanBeSet = ev.state === '1048576 rows, 1024 columns selected';
			return;
		}
		if (ev.commandName !== '.uno:BackgroundColor') {
			return;
		}

		// Given an integer coming from a websocket message from UNO,
		// calculate a '#RRGGBB' string for the corresponding CSS color
		// Special value: -1 means 'no fill' which translates to white background in Calc
		var color;
		if (ev.state === '-1') {
			color = 'white';
		} else {
			color =
				'#' +
				parseInt(ev.state)
					.toString(16)
					.padStart(6, '0');
		}

		this.setColor(color);
	}
});
