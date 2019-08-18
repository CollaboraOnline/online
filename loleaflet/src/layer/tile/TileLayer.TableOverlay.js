/* -*- js-indent-level: 8 -*- */
/*
 * Table Overlay
 */

L.TileLayer.include({
	_initializeTableOverlay: function () {
		this._tableColumnMarkers = [];
		this._tableRowMarkers = [];
		this._tableMarkersDragged = false;
	},
	_setMarkerPosition: function(marker) {
		var point = this._twipsToLatLng(marker._pointTwips, this._map.getZoom());
		point = this._map.project(point);
		var markerRect = marker._icon.getBoundingClientRect();
		if (marker._type.startsWith('column'))
			point = point.subtract(new L.Point(markerRect.width / 2, markerRect.height));
		else
			point = point.subtract(new L.Point(markerRect.width, markerRect.height / 2));
		point = this._map.unproject(point);
		marker.setLatLng(point);

		if (marker._type.startsWith('column'))
			marker.dragging.freezeY(true);
		else
			marker.dragging.freezeX(true);
	},
	_createMarker: function(markerType, entry, left, right) {
		var className;
		if (markerType === 'column')
			className = 'table-column-resize-marker';
		else
			className = 'table-row-resize-marker';

		var marker = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: className,
				iconSize: null
			}),
			draggable: true
		});
		this._map.addLayer(marker);
		marker._type = markerType + '-' + entry.type;
		marker._position = parseInt(entry.position);
		marker._min = parseInt(entry.min);
		marker._max = parseInt(entry.max);
		marker._index = parseInt(entry.index);
		if (markerType === 'column') {
			marker._pointTwips = new L.Point(this._tablePositionColumnOffset + marker._position, left);
			marker._pointTop = new L.Point(this._tablePositionColumnOffset + marker._position, left);
			marker._pointTop = this._twipsToLatLng(marker._pointTop, this._map.getZoom());
			marker._pointBottom = new L.Point(this._tablePositionColumnOffset + marker._position, right);
			marker._pointBottom = this._twipsToLatLng(marker._pointBottom, this._map.getZoom());
		}
		else {
			marker._pointTwips = new L.Point(left, this._tablePositionRowOffset + marker._position);
			marker._pointTop = new L.Point(left, this._tablePositionRowOffset + marker._position);
			marker._pointTop = this._twipsToLatLng(marker._pointTop, this._map.getZoom());
			marker._pointBottom = new L.Point(right, this._tablePositionRowOffset + marker._position);
			marker._pointBottom = this._twipsToLatLng(marker._pointBottom, this._map.getZoom());
		}
		this._setMarkerPosition(marker);
		marker.on('dragstart drag dragend', this._onTableResizeMarkerDrag, this);
		return marker;
	},
	_onTableSelectedMsg: function (textMsg) {
		if (this._tableMarkersDragged == true) {
			return;
		}

		// Clean-up first
		var markerIndex;
		for (markerIndex = 0; markerIndex < this._tableColumnMarkers.length; markerIndex++) {
			this._map.removeLayer(this._tableColumnMarkers[markerIndex]);
		}
		this._tableColumnMarkers = [];

		for (markerIndex = 0; markerIndex < this._tableRowMarkers.length; markerIndex++) {
			this._map.removeLayer(this._tableRowMarkers[markerIndex]);
		}
		this._tableRowMarkers = [];

		// Parse the message
		textMsg = textMsg.substring('tableselected:'.length + 1);
		var message = JSON.parse(textMsg);

		// Create markers
		if (message.rows && message.rows.entries.length > 0 && message.columns && message.columns.entries.length > 0) {
			this._tablePositionColumnOffset = parseInt(message.columns.tableOffset);
			this._tablePositionRowOffset = parseInt(message.rows.tableOffset);
			var firstRowPosition = parseInt(message.rows.left) + this._tablePositionRowOffset;
			var lastRowPosition = parseInt(message.rows.right) + this._tablePositionRowOffset;
			var firstColumnPosition = parseInt(message.columns.left) + this._tablePositionColumnOffset;
			var lastColumnPosition = parseInt(message.columns.right) + this._tablePositionColumnOffset;
			var markerX, i, entry;

			entry = { type: 'left', position: message.columns.left, index: 0 };
			markerX = this._createMarker('column', entry, firstRowPosition, lastRowPosition);
			this._tableColumnMarkers.push(markerX);

			for (i = 0; i < message.columns.entries.length; i++) {
				entry = message.columns.entries[i];
				entry.type = 'middle';
				entry.index = i;
				markerX = this._createMarker('column', entry, firstRowPosition, lastRowPosition);
				this._tableColumnMarkers.push(markerX);
			}

			entry = { type: 'right', position: message.columns.right, index: 0 };
			markerX = this._createMarker('column', entry, firstRowPosition, lastRowPosition);
			this._tableColumnMarkers.push(markerX);

			for (i = 0; i < message.rows.entries.length; i++) {
				entry = message.rows.entries[i];
				entry.type = 'middle';
				entry.index = i;
				markerX = this._createMarker('row', entry, firstColumnPosition, lastColumnPosition);
				this._tableRowMarkers.push(markerX);
			}

			entry = { type: 'right', position: message.rows.right };
			markerX = this._createMarker('row', entry, firstColumnPosition, lastColumnPosition);
			this._tableRowMarkers.push(markerX);
		}
	},

	// Update dragged text selection.
	_onTableResizeMarkerDrag: function (e) {
		if (e.type === 'dragstart') {
			e.target.isDragged = true;
			this._tableMarkersDragged = true;
		}
		else if (e.type === 'dragend') {
			e.target.isDragged = false;
			this._tableMarkersDragged = false;
		}

		// modify the mouse position - move to center of the marker
		var aMousePosition = e.target.getLatLng();
		aMousePosition = this._map.project(aMousePosition);
		var size = e.target._icon.getBoundingClientRect();
		aMousePosition = aMousePosition.add(new L.Point(size.width / 2, size.height / 2));
		aMousePosition = this._map.unproject(aMousePosition);
		var aLatLonPosition = aMousePosition;
		aMousePosition = this._latLngToTwips(aMousePosition);

		var newPosition;
		if (e.target._type.startsWith('column')) {
			newPosition = aMousePosition.x - this._tablePositionColumnOffset;
			e.target._pointTop.lng = aLatLonPosition.lng;
			e.target._pointBottom.lng = aLatLonPosition.lng;
		}
		else {
			newPosition = aMousePosition.y - this._tablePositionRowOffset;
			e.target._pointTop.lat = aLatLonPosition.lat;
			e.target._pointBottom.lat = aLatLonPosition.lat;
		}

		e.target._position = newPosition;

		var bounds = new L.LatLngBounds(e.target._pointTop, e.target._pointBottom);

		if (e.type === 'dragstart') {
			this._rectangle = new L.Rectangle(bounds);
			this._map.addLayer(this._rectangle);
		}
		else if (e.type === 'drag') {
			this._rectangle.setBounds(bounds);
		}
		else if (e.type === 'dragend') {
			this._map.removeLayer(this._rectangle);
			this._rectangle = null;

			var params = {
				BorderType: {
					type : 'string',
					value : e.target._type
				},
				Index: {
					type : 'uint16',
					value : e.target._index
				},
				NewPosition: {
					type : 'int32',
					value : e.target._position
				}
			}

			this._map.sendUnoCommand('.uno:TableChangeCurrentBorderPosition', params);
		}

		if (e.originalEvent)
			e.originalEvent.preventDefault();
	}
});

