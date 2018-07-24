/* -*- js-indent-level: 8 -*- */
/*
 * Popup extension to L.Path (polylines, polygons, circles), adding popup-related methods.
 */

L.Path.include({

	bindPopup: function (content, options) {

		if (content instanceof L.Popup) {
			this._popup = content;
		} else {
			if (!this._popup || options) {
				this._popup = new L.Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this.on({
				mouseover: this._openPopup,
				mouseout: this._delayClose,
				remove: this.closePopup,
				add: this.firstPopup
			});

			this._popupHandlersAdded = true;
		}

		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this.off({
				mouseover: this._openPopup,
				mouseout: this._delayClose,
				remove: this.closePopup,
				add: this.firstPopup
			});

			this._popupHandlersAdded = false;
		}
		return this;
	},

	firstPopup: function () {
		if (this._popup) {
			this._openPopup({latlng: this._bounds.getCenter()});
		}
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	_delayClose: function () {
		clearTimeout(this._timer);
		this._timer = setTimeout(L.bind(this.closePopup, this), 3000);
	},

	_openPopup: function (e) {
		if (!this._map.hasLayer(this._popup)) {
			this._popup.setLatLng(e.latlng);
			this._map.openPopup(this._popup);
			this._delayClose();
		}
	}
});
