/* -*- js-indent-level: 8 -*- */
/* global app */
/*
 * L.Path is the base class for all Leaflet vector layers like polygons and circles.
 */

L.Path = L.Layer.extend({

	options: {
		stroke: true,
		color: '#3388ff',
		weight: 3,
		opacity: 1,
		lineCap: 'round',
		lineJoin: 'round',
		// dashArray: null
		// dashOffset: null

		// fill: false
		// fillColor: same as color by default
		fillOpacity: 0.2,
		fillRule: 'evenodd',

		// className: ''
		interactive: true,
		fixed: false,
	},

	initialize: function () {
		L.Layer.prototype.initialize.call(this);
	},

	onAdd: function () {
		this._pathNodeCollection = new L.Path.PathNodeCollection();
		this._renderer = this._map.getRenderer(this);
		this._renderer._initPath(this);
		this._reset();
		this._renderer._addPath(this);
	},

	onRemove: function () {
		this._renderer._removePath(this);
	},

	getEvents: function () {
		return {
			viewreset: this._project,
			moveend: this._update
		};
	},

	redraw: function () {
		if (this._map) {
			this._renderer._updatePath(this);
		}
		return this;
	},

	setStyle: function (style) {
		L.setOptions(this, style);
		if (this._renderer) {
			this._renderer._updateStyle(this);
		}
		return this;
	},

	bringToFront: function () {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	},

	bringToBack: function () {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	},

	_reset: function () {
		// defined in child classes
		this._project();
		this._update();
	},

	_clickTolerance: function () {
		// used when doing hit detection for Canvas layers
		return (
			(this.options.stroke ? this.options.weight / 2 : 0) +
			(window.touch.currentlyUsingTouchscreen() ? 10 : 0)
		);
	},

	addPathNode: function (pathNode, actualRenderer) {

		this._path = undefined;

		if (!this._pathNodeCollection) {
			this._pathNodeCollection = new L.Path.PathNodeCollection();
		}

		this._pathNodeCollection.add(new L.Path.PathNodeData(pathNode, actualRenderer));
	},

	getPathNode: function (actualRenderer) {
		return this._pathNodeCollection.getPathNode(actualRenderer);
	},

	addClass: function (className) {
		this._pathNodeCollection.addOrRemoveClass(className, true /* add */);
	},

	removeClass: function (className) {
		this._pathNodeCollection.addOrRemoveClass(className, false /* add */);
	},

	setCursorType: function (cursorType) {
		this._pathNodeCollection.setCursorType(cursorType);
	},

});

L.Path.PathNodeData = L.Class.extend({

	initialize: function (pathNode, actualRenderer) {

		window.app.console.assert(pathNode, 'invalid pathNode argument!');
		window.app.console.assert(actualRenderer, 'invalid actualRenderer argument!');

		if (!(pathNode instanceof Node)) {
			window.app.console.error('Not a node instance!');
		}

		this._pathNode = pathNode;
		this._actualRenderer = actualRenderer;
		this._data = {};
	},

	key: function () {
		return L.Path.PathNodeData.key(this._actualRenderer);
	},

	getNode: function () {
		if (!(this._pathNode instanceof Node)) {
			window.app.console.error('Not a node instance!');
		}
		return this._pathNode;
	},

	getActualRenderer: function () {
		return this._actualRenderer;
	},

	setCustomField: function (fieldName, value) {
		window.app.console.assert(typeof fieldName === 'string' && fieldName, 'invalid fieldName');
		this._data[fieldName] = value;
	},

	getCustomField: function (fieldName) {
		window.app.console.assert(typeof fieldName === 'string' && fieldName, 'invalid fieldName');
		return this._data[fieldName];
	},

	clearCustomField: function (fieldName) {
		window.app.console.assert(typeof fieldName === 'string' && fieldName, 'invalid fieldName');
		delete this._data[fieldName];
	},

	addOrRemoveClass: function (className, add) {
		if (add) {
			L.DomUtil.addClass(this._pathNode, className);
		}
		else {
			L.DomUtil.removeClass(this._pathNode, className);
		}
	},

	setCursorType: function (cursorType) {
		this._pathNode.style.cursor = cursorType;
	},

});

L.Path.PathNodeData.key = function (layer) {
	return app.util.stamp(layer);
};

L.Path.PathNodeCollection = L.Class.extend({

	initialize: function () {
		this.clear();
	},

	add: function (pathNodeData) {

		window.app.console.assert(pathNodeData instanceof L.Path.PathNodeData,
			'invalid pathNodeData argument!');

		this._collection[pathNodeData.key()] = pathNodeData;
	},

	clear: function () {
		this._collection = {};
	},

	getPathNode: function (actualRenderer) {

		window.app.console.assert(actualRenderer, 'invalid actualRenderer argument!');
		var key = L.Path.PathNodeData.key(actualRenderer);
		var nodeData = this._collection[key];

		window.app.console.assert(nodeData, 'cannot find path node!');

		return nodeData.getNode();
	},

	forEachNode: function (callback) {
		var that = this;
		Object.keys(this._collection).forEach(function (key) {
			callback(that._collection[key]);
		});
	},

	addOrRemoveClass: function (className, add) {
		window.app.console.assert(className, 'className not provided!');
		this.forEachNode(function (nodeData) {
			nodeData.addOrRemoveClass(className, add);
		});
	},

	setCursorType: function (cursorType) {
		this.forEachNode(function (nodeData) {
			nodeData.setCursorType(cursorType);
		});
	},

});
