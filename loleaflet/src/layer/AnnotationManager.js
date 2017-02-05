/*
 *  L.AnnotationManager
 */

L.AnnotationManager = L.Class.extend({
	options: {
		marginX: 50,
		marginY: 10,
		offset: 5
	},

	initialize: function (map) {
		this._map = map;
		this._annotations = {};
		this._selected = {};
		this._arrow = L.polyline([], {color: 'darkblue', weight:1});
		this._map.on('AnnotationClick', this._onAnnotationClick, this);
	},

	clear: function () {
		for (var key in this._annotations) {
			this._map.removeLayer(this._annotations[key]);
		}
		this._map.removeLayer(this._arrow);
		this._annotations = {};
		this._selected = {};
	},

	fill: function (comments) {
		var docTopRight = this._map.project(this._map.options.maxBounds.getNorthEast()).add(L.point(this.options.marginX, this.options.marginY));
		var annotation, point;

		this.clear();
		for (var index in comments) {
			point = this._map._docLayer._twipsToPixels(L.LOUtil.stringToPoint(comments[index].anchorPos));
			point.x = docTopRight.x;
			annotation = L.annotation(this._map.unproject(point), comments[index]).addTo(this._map);
			this._annotations[annotation._data.id] = annotation;
		}

		this.layout();
	},

	select: function (id) {
		var topRight = this._map.project(this._map.options.maxBounds.getNorthEast());
		var annotation = this._annotations[id];
		var point0, point1, point2;
		if (annotation) {
			point0 = this._map._docLayer._twipsToPixels(L.LOUtil.stringToPoint(annotation._data.anchorPos));
			point1 = L.point(point0.x, point0.y - this.options.offset);
			point2 = L.point(topRight.x, point1.y);
			this._arrow.setLatLngs([this._map.unproject(point0), this._map.unproject(point1), this._map.unproject(point2)]);
			this._map.addLayer(this._arrow);
			if (this._selected.annotation) {
				this._selected.annotation.setLatLng(this._selected.latlng);
			}
			this._selected.annotation = annotation;
			this._selected.latlng = annotation._latlng;
			annotation.setLatLng(this._map.unproject(point2));
		}
	},

	layout: function () {
		var annotation, bounds, layoutBounds, foundBounds;
		this._bounds = [];
		for (var key in this._annotations) {
			annotation = this._annotations[key];
			bounds = annotation.getBounds();
			foundBounds = null;
			for (var itBounds in this._bounds) {
				layoutBounds = this._bounds[itBounds];
				if (layoutBounds.intersects(bounds)) {
					foundBounds = layoutBounds;
					break;
				}
			}

			if (foundBounds) {
				annotation.setLatLng(this._map.layerPointToLatLng(foundBounds.getBottomLeft()));
			}
			else {
				bounds.extend(L.point(bounds.min.x, bounds.min.y + this.options.marginY));
				bounds.extend(L.point(bounds.min.x, bounds.max.y + this.options.marginY));
				this._bounds.push(bounds);
			}
			annotation.show();
		}
	},

	add: function (annotation) {
	},

	remove: function (annotation) {
	},

	_onAnnotationClick: function (e) {
		this.select(e.id);
	}
});

L.annotationManager = function (map) {
	return new L.AnnotationManager(map);
};
