/* -*- js-indent-level: 8 -*- */
/*
 * Table Overlay
 */

L.CanvasTileLayer.include({
	_initializeTableOverlay: function () {
		this._tableColumnMarkers = [];
		this._tableRowMarkers = [];
		this._tableMarkersDragged = false;
		this._initMoveMarkers();
		this._tableSelectionColumnMarkers = [];
		this._tableSelectionRowMarkers = [];
		this._selectionHeaderDistanceFromTable = 6;
		this._selectionHeaderHeight = 16;
	},
	_setupTableOverlay: function() {
		this._map.on('messagesdone', this._updateTableMarkers, this);
		this._map.on('zoomend', this._onZoomForTableMarkers, this);
	},
	_convertPixelToTwips: function(pixel) {
		var point = this._latLngToTwips(this._map.unproject(new L.Point(pixel, 0)));
		return point.x;
	},
	_convertTwipsToPixels: function(twips) {
		var point = this._twipsToLatLng(twips);
		point = this._map.project(point);
		return point;
	},
	hasTableSelection: function () {
		if (!this._currentTableData)
			return false;
		return this._currentTableData.rows != null || this._currentTableData.columns != null;
	},
	_initMoveMarkers: function () {
		this._tableMoveMarker = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'table-move-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._tableMoveMarker.on('dragstart drag dragend', this._onTableMoveMarkerDrag, this);
	},
	_setMarkerPosition: function(marker) {
		var point = this._twipsToLatLng(marker._positionTwips, this._map.getZoom());
		point = this._map.project(point);
		var markerRect = marker._icon.getBoundingClientRect();

		var raiseDelta;
		var aboveSelectionHeaders = this._selectionHeaderDistanceFromTable + this._selectionHeaderHeight;
		aboveSelectionHeaders = this._convertPixelToTwips(aboveSelectionHeaders);

		if (marker._type.startsWith('column')) {
			point = point.subtract(new L.Point(markerRect.width / 2, markerRect.height));
			raiseDelta = new L.Point(0, aboveSelectionHeaders);
		}
		else {
			point = point.subtract(new L.Point(markerRect.width, markerRect.height / 2));
			raiseDelta = new L.Point(aboveSelectionHeaders, 0);
		}

		raiseDelta = this._map.project(this._twipsToLatLng(raiseDelta, this._map.getZoom()));
		point = point.subtract(raiseDelta);

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
		marker._initialPosition = marker._position;
		marker._min = parseInt(entry.min);
		marker._max = parseInt(entry.max);
		marker._index = parseInt(entry.index);
		if (markerType === 'column') {
			marker._positionTwips = new L.Point(this._tablePositionColumnOffset + marker._position, left);
			marker._topBorderPoint = new L.Point(this._tablePositionColumnOffset + marker._position, left);
			marker._topBorderPoint = this._twipsToLatLng(marker._topBorderPoint, this._map.getZoom());
			marker._bottomBorderPoint = new L.Point(this._tablePositionColumnOffset + marker._position, right);
			marker._bottomBorderPoint = this._twipsToLatLng(marker._bottomBorderPoint, this._map.getZoom());
		}
		else {
			marker._positionTwips = new L.Point(left, this._tablePositionRowOffset + marker._position);
			marker._topBorderPoint = new L.Point(left, this._tablePositionRowOffset + marker._position);
			marker._topBorderPoint = this._twipsToLatLng(marker._topBorderPoint, this._map.getZoom());
			marker._bottomBorderPoint = new L.Point(right, this._tablePositionRowOffset + marker._position);
			marker._bottomBorderPoint = this._twipsToLatLng(marker._bottomBorderPoint, this._map.getZoom());
		}
		this._setMarkerPosition(marker);
		marker.on('dragstart drag dragend', this._onTableBorderResizeMarkerDrag, this);
		return marker;
	},

	_clearTableMarkers: function() {
		var markerIndex;
		for (markerIndex = 0; markerIndex < this._tableColumnMarkers.length; markerIndex++) {
			this._map.removeLayer(this._tableColumnMarkers[markerIndex]);
		}
		this._tableColumnMarkers = [];

		for (markerIndex = 0; markerIndex < this._tableRowMarkers.length; markerIndex++) {
			this._map.removeLayer(this._tableRowMarkers[markerIndex]);
		}
		this._tableRowMarkers = [];

		for (markerIndex = 0; markerIndex < this._tableSelectionColumnMarkers.length; markerIndex++) {
			this._map.removeLayer(this._tableSelectionColumnMarkers[markerIndex]);
		}
		this._tableSelectionColumnMarkers = [];

		for (markerIndex = 0; markerIndex < this._tableSelectionRowMarkers.length; markerIndex++) {
			this._map.removeLayer(this._tableSelectionRowMarkers[markerIndex]);
		}
		this._tableSelectionRowMarkers = [];

		this._map.removeLayer(this._tableMoveMarker);
	},

	_updateTableMoveMarkerVisibility: function() {
		if (this._map._docLayer._cursorMarker && this._map._docLayer._cursorMarker.isVisible())
			this._map.removeLayer(this._tableMoveMarker);
		else if (this._currentTableData
			&& this._currentTableMarkerJson === this._lastTableMarkerJson
			&& this._currentTableData.rows && this._currentTableData.columns
			&& this._map.getDocType() === 'presentation' && this._currentTableData.rectangle
			&& !this._map.hasLayer(this._tableMoveMarker))
			this._map.addLayer(this._tableMoveMarker);
	},

	_updateTableMarkers: function() {
		if (this._currentTableData === undefined)
			return; // not writer, no table selected yet etc.
		if (this._currentTableMarkerJson === this._lastTableMarkerJson) {
			this._updateTableMoveMarkerVisibility(); // cursor might be shown, then it doesn't work
			return; // identical table setup.
		}
		this._lastTableMarkerJson = this._currentTableMarkerJson;

		// Clean-up first
		this._clearTableMarkers();

		// Create markers
		if (this._currentTableData.rows && this._currentTableData.columns) {
			this._tablePositionColumnOffset = parseInt(this._currentTableData.columns.tableOffset);
			this._tablePositionRowOffset = parseInt(this._currentTableData.rows.tableOffset);
			var firstRowPosition = parseInt(this._currentTableData.rows.left) + this._tablePositionRowOffset;
			var lastRowPosition = parseInt(this._currentTableData.rows.right) + this._tablePositionRowOffset;
			var firstColumnPosition = parseInt(this._currentTableData.columns.left) + this._tablePositionColumnOffset;
			var lastColumnPosition = parseInt(this._currentTableData.columns.right) + this._tablePositionColumnOffset;
			var markerX, i, entry;

			var columnPositions = [];
			var rowPositions = [];

			columnPositions.push(parseInt(this._currentTableData.columns.left));
			if (this._map.getDocType() !== 'presentation') {
				entry = { type: 'left', position: this._currentTableData.columns.left, index: 0 };
				markerX = this._createMarker('column', entry, firstRowPosition, lastRowPosition);
				this._tableColumnMarkers.push(markerX);
			}

			for (i = 0; i < this._currentTableData.columns.entries.length; i++) {
				entry = this._currentTableData.columns.entries[i];
				columnPositions.push(parseInt(entry.position));
				entry.type = 'middle';
				entry.index = i;
				markerX = this._createMarker('column', entry, firstRowPosition, lastRowPosition);
				this._tableColumnMarkers.push(markerX);
			}

			columnPositions.push(parseInt(this._currentTableData.columns.right));

			entry = { type: 'right', position: this._currentTableData.columns.right, index: 0 };
			markerX = this._createMarker('column', entry, firstRowPosition, lastRowPosition);
			this._tableColumnMarkers.push(markerX);

			this._addSelectionMarkers('column', columnPositions, firstRowPosition, lastRowPosition);

			rowPositions.push(parseInt(this._currentTableData.rows.left));
			for (i = 0; i < this._currentTableData.rows.entries.length; i++) {
				entry = this._currentTableData.rows.entries[i];
				rowPositions.push(parseInt(entry.position));
				entry.type = 'middle';
				entry.index = i;
				markerX = this._createMarker('row', entry, firstColumnPosition, lastColumnPosition);
				this._tableRowMarkers.push(markerX);
			}

			rowPositions.push(parseInt(this._currentTableData.rows.right));
			entry = { type: 'right', position: this._currentTableData.rows.right };
			markerX = this._createMarker('row', entry, firstColumnPosition, lastColumnPosition);
			this._tableRowMarkers.push(markerX);

			this._addSelectionMarkers('row', rowPositions, firstColumnPosition, lastColumnPosition);

			if (this._map.getDocType() === 'presentation' && this._currentTableData.rectangle) {
				var topLeftTwips = new L.Point(parseInt(this._currentTableData.rectangle.x), parseInt(this._currentTableData.rectangle.y));
				var offset = new L.Point(parseInt(this._currentTableData.rectangle.width), parseInt(this._currentTableData.rectangle.height));
				var bottomRightTwips = topLeftTwips.add(offset);

				var tableRectangle = new L.LatLngBounds(
					this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
					this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
				this._map.addLayer(this._tableMoveMarker);

				var markerRect;
				var movePosition = new L.LatLng(tableRectangle.getNorth(), tableRectangle.getWest());
				movePosition = this._map.project(movePosition);
				markerRect = this._tableMoveMarker._icon.getBoundingClientRect();
				movePosition = movePosition.subtract(new L.Point(markerRect.width + 4, markerRect.height + 4));
				movePosition = this._map.unproject(movePosition);
				this._tableMoveMarker.setLatLng(movePosition);

				this._updateTableMoveMarkerVisibility();
			}
		}
	},
	_onZoomForTableMarkers: function () {
		this._lastTableMarkerJson = 'foo';
		this._updateTableMarkers();
	},
	_onTableSelectedMsg: function (textMsg) {
		if (!this._map.isPermissionEdit()) {
			this._clearTableMarkers();
			return;
		}

		if (this._tableMarkersDragged == true) {
			return;
		}
		// Parse the message
		textMsg = textMsg.substring('tableselected:'.length + 1);
		var message = JSON.parse(textMsg);
		this._currentTableMarkerJson = textMsg;
		this._currentTableData = message;
	},
	_addSelectionMarkers: function (type, positions, start, end) {
		if (positions.length < 2)
			return;

		var startX, endX, startY, endY;
		var point1;

		var delta1 = this._convertPixelToTwips(this._selectionHeaderDistanceFromTable);

		// The 24 is the height and width of the .table-select-marker in cool.css
		var height = 24;
		var width = height;
		var selectionMarkerNominalSize = this._convertPixelToTwips(width);
		var classNameMarker = 'table-select-marker';

		for (var i = 0; i < positions.length - 1; i++) {
			if (type === 'column') {
				classNameMarker += ' table-select-marker--column';
				startX = this._tablePositionColumnOffset + positions[i];
				endX = this._tablePositionColumnOffset + positions[i + 1];
				startY = start;
				endY = end;
				point1 = this._twipsToLatLng(new L.Point(startX, startY - delta1 - selectionMarkerNominalSize),
							     this._map.getZoom());
				width = this._convertTwipsToPixels(new L.Point(endX - startX, 0)).x - 2;
			}
			else {
				classNameMarker += ' table-select-marker--row';
				startX = start;
				endX = end;
				startY = this._tablePositionRowOffset + positions[i];
				endY = this._tablePositionRowOffset + positions[i + 1];
				point1 = this._twipsToLatLng(new L.Point(startX - delta1 - selectionMarkerNominalSize, startY),
							     this._map.getZoom());
				height = this._convertTwipsToPixels(new L.Point(0, endY - startY)).y - 2;
			}

			var selectionRectangle = L.marker(point1,
				{
					icon: L.divIcon({
						className: classNameMarker,
						iconSize: [width, height],
						iconAnchor: [0, 0],
					}),
					draggable: true,
				});

			selectionRectangle._start = { x: startX, y: startY };
			selectionRectangle._end = { x: endX, y: endY };

			if (type === 'column')
				this._tableSelectionColumnMarkers.push(selectionRectangle);
			else
				this._tableSelectionRowMarkers.push(selectionRectangle);

			selectionRectangle.on('click', this._onSelectRowColumnClick, this);
			// We don't actually want this to be draggable of course, so use a dragstart
			// handler that freezes it.
			selectionRectangle.on('dragstart drag dragend', this._onSelectRowColumnDrag, this);
			this._map.addLayer(selectionRectangle);
		}
	},
	_onSelectRowColumnClick: function(e) {
		// fake selecting a column
		this._postSelectTextEvent('start', e.target._start.x + 5, e.target._start.y + 5);
		this._postSelectTextEvent('end', e.target._end.x - 5, e.target._end.y - 5);
	},
	_onSelectRowColumnDrag: function(e) {
		e.target.freezeX(true);
		e.target.freezeY(true);
	},

	// Update dragged text selection.
	_onTableBorderResizeMarkerDrag: function (e) {
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
			e.target._topBorderPoint.lng = aLatLonPosition.lng;
			e.target._bottomBorderPoint.lng = aLatLonPosition.lng;
		}
		else {
			newPosition = aMousePosition.y - this._tablePositionRowOffset;
			e.target._topBorderPoint.lat = aLatLonPosition.lat;
			e.target._bottomBorderPoint.lat = aLatLonPosition.lat;
		}
		e.target._position = newPosition;

		var bounds = new L.LatLngBounds(e.target._topBorderPoint, e.target._bottomBorderPoint);

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

			var offset = newPosition - e.target._initialPosition;
			e.target._initialPosition =  e.target._position;

			var params = {
				BorderType: {
					type : 'string',
					value : e.target._type
				},
				Index: {
					type : 'uint16',
					value : e.target._index
				},
				Offset: {
					type : 'int32',
					value : offset
				}
			};

			this._map.sendUnoCommand('.uno:TableChangeCurrentBorderPosition', params);
		}

		if (e.originalEvent)
			e.originalEvent.preventDefault();
	},
	_onTableMoveMarkerDrag: function (event) {
		var mouseEvent;
		if (this._graphicMarker == null)
			return;
		if (event.type == 'dragstart') {
			mouseEvent = this._createNewMouseEvent('mousedown', event.originalEvent);
			this._graphicMarker._onDragStart(mouseEvent);
		}
		else if (event.type == 'drag') {
			mouseEvent = this._createNewMouseEvent('mousemove', event.originalEvent);
			this._graphicMarker._onDrag(mouseEvent);
		}
		else if (event.type == 'dragend') {
			mouseEvent = this._createNewMouseEvent('mouseup', event.originalEvent);
			this._graphicMarker._onDragEnd(mouseEvent);
		}
	}
});

