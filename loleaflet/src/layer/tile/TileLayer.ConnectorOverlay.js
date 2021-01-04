/* -*- js-indent-level: 8 -*- */
/*
 * Connector Overlay
 */

L.TileLayer.include({
	_initializeConnectorOverlay: function () {
		this._edgeMarkers = [];
	},

	_onConnectorSelectedMsg: function(textMsg) {
		console.log('connector selected arrived', textMsg);
		this._initEdgeMarkers(textMsg);
	},

	_initEdgeMarkers: function(textMsg) {
		this._clearEdgeMarkers();
		textMsg = '[' + textMsg.substr('connectorselected:'.length) + ']';
		var msgData = JSON.parse(textMsg);
		var createEdgeFunction = L.bind(function(edge) {
			var pixels = this._convertTwipsToPixels(edge);
			// it starts in the offset of marks witdh/2 height/2 !
			pixels.x = this._convertPixelToTwips(pixels.x-12);
			pixels.y = this._convertPixelToTwips(pixels.y-12);
			return L.marker(this._twipsToLatLng(pixels, this._map.getZoom()), {
				icon: L.divIcon({
					className: 'table-move-marker',
					iconSize: null
				}),
				draggable: true
			});
		}, this);
		if (msgData.length > 5) {
			var properties = msgData[5].properties;
			var Edge0 = properties['Edge0'];
			var Edge1 = properties['Edge1'];
			this._edgeMarkers.push(createEdgeFunction(Edge0));
			this._edgeMarkers.push(createEdgeFunction(Edge1));
			this._map.addLayer(this._edgeMarkers[0]);
			this._map.addLayer(this._edgeMarkers[1]);
		}
	},

	_clearEdgeMarkers: function() {
		for (var i = 0; i< this._edgeMarkers.length; i++) {
			this._map.removeLayer(this._edgeMarkers[i]);
		}
		this._edgeMarkers = [];
	}
});
