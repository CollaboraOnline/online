/* -*- js-indent-level: 8 -*- */
/*
 * L.SplitPanesSVG renders vector layers with SVG for split-panes.
 */

import { Bounds } from '../../geometry/Bounds';
import { Point } from '../../geometry/Point';

L.SplitPanesSVG = L.SplitPanesRenderer.extend({
	_initContainer: function () {

		this._container = document.createElement('div');

		this._setupPaneRenderers();
	},

	_setupPaneRenderers: function () {

		if (this._childRenderers) {
			return;
		}

		var map = this._map;
		this._rendererIds = ['fixed', 'topleft', 'topright', 'bottomleft', 'bottomright'];
		this._splitPaneNames = ['topleft', 'topright', 'bottomleft', 'bottomright'];
		this._childRenderers = {};
		this._rendererIds.forEach(function (rendererId) {
			var svgRenderer = L.svg(this.options);
			this._childRenderers[rendererId] = svgRenderer;
			svgRenderer.rendererId = rendererId;
			svgRenderer.setParentRenderer(this);
			map.addLayer(svgRenderer);
		}, this);
	},

	_forEachPaneRenderer: function (callback) {
		return this._forEachChildRenderer(callback, true /* skipFixed */);
	},

	_forEachChildRenderer: function (callback, skipFixed) {
		if (!this._childRenderers) {
			return false;
		}

		this._rendererIds.forEach(function (rendererId) {

			if (skipFixed === true && rendererId === 'fixed') {
				return;
			}

			var renderer = this._childRenderers[rendererId];
			callback(renderer, rendererId);

		}, this);

		return true;
	},

	_disposePaneRenderers: function () {

		if (!this._childRenderers) {
			return;
		}

		this._rendererIds.forEach(function (rendererId) {
			this._map.removeLayer(this._childRenderers[rendererId]);
			this._childRenderers[rendererId] = undefined;
		}, this);

		this._childRenderers = undefined;
	},

	onRemove: function () {
		this._disposePaneRenderers();
		L.SplitPanesRenderer.prototype.onRemove.call(this);
	},

	_isCalcRTL: function () {
		return this._map._docLayer.isCalcRTL();
	},

	// In RTL Calc mode this h-mirrors the top-left position of a rectangle else it does nothing.
	_transformContainerPoint: function (pos, size) {
		if (this._isCalcRTL()) {
			return new Point(this._map._size.x - pos.x - size.x, pos.y);
		}

		return pos;
	},

	getChildPosBounds: function (childRenderer) {
		window.app.console.assert(typeof childRenderer.rendererId === 'string', 'Child renderer does not have a rendererId!');
		var rendererId = childRenderer.rendererId;
		var renderer = this._childRenderers[rendererId];
		window.app.console.assert(renderer && L.stamp(renderer) === L.stamp(childRenderer), 'Child renderer does not belong to parent!');

		var splitPos = this._map.getSplitPanesContext().getSplitPos();
		var size = this._map.getSize();
		var pixelOrigin = this._map.getPixelOrigin();
		// Container coordinates.
		var topLeft = new Point(0, 0);
		// pos and boundPos should be in layer coordinates.
		var pos = undefined;
		var boundPos = undefined;

		if (rendererId === 'fixed') {
			// This is for displaying the pane-splitter horizontal/vertical lines.
			// is always glued to (0, 0) of the document.
			// The size is always the map's view size.
			pos = this._map.containerPointToLayerPointIgnoreSplits(topLeft).round();
			// All paths in this should set their DOM node positions in document coordinates rather than in layer coordinates.
			// This is taken care of if the paths are derived from L.Polyline
			boundPos = topLeft;
		}
		else if (rendererId === 'bottomright') {
			// this is the default splitPane where are no visible splits (splitPos = (0, 0)).
			topLeft = splitPos;
			size = size.subtract(splitPos);
			pos = this._map.containerPointToLayerPointIgnoreSplits(
				this._transformContainerPoint(topLeft, size)).round();
			// Don't apply container point transformation for viewBox bounds.
			boundPos = this._map.containerPointToLayerPointIgnoreSplits(topLeft).round();
		}
		else if (rendererId === 'topleft') {
			// is always glued to (0, 0) of the document.
			size.x = splitPos.x - 1;
			size.y = splitPos.y - 1;
			pos = this._map.containerPointToLayerPointIgnoreSplits(
				this._transformContainerPoint(topLeft, size)).round();
			boundPos = topLeft.subtract(pixelOrigin);
		}
		else if (rendererId === 'topright') {
			// is always glued to top (y = 0) of the document.
			topLeft.x = splitPos.x;
			size.x -= splitPos.x;
			size.y = splitPos.y - 1;
			pos = this._map.containerPointToLayerPointIgnoreSplits(
				this._transformContainerPoint(topLeft, size)).round();
			// Don't apply container point transformation for viewBox bounds.
			var boundPosX = this._map.containerPointToLayerPointIgnoreSplits(topLeft).round().x;
			boundPos = new Point(boundPosX, topLeft.y - pixelOrigin.y);
		}
		else if (rendererId === 'bottomleft') {
			// is always glued to left (x = 0) of the document.
			topLeft.y = splitPos.y;
			size.y -= splitPos.y;
			size.x = splitPos.x - 1;
			pos = this._map.containerPointToLayerPointIgnoreSplits(
				this._transformContainerPoint(topLeft, size)).round();
			boundPos = new Point(topLeft.x - pixelOrigin.x, pos.y);
		}
		else {
			window.app.console.error('unhandled rendererId : ' + rendererId);
		}

		var bounds;
		if (this._isCalcRTL()) {
			// Reason for this specialization:
			// To make shapes rendering in Calc RTL easier
			// all shapes have negative document X coordinates.
			// To match this, each svg viewBox (for each split pane) must
			// also use negated X coordinates.

			// So find the negated top 'visual' right in layer coordinates.
			// (negation has to be done in document coordinates)

			var docPosRightX = boundPos.x + size.x + pixelOrigin.x;
			var negatedTopRightLayerPoint = new Point(-docPosRightX - pixelOrigin.x, boundPos.y);
			bounds = new Bounds(negatedTopRightLayerPoint, negatedTopRightLayerPoint.add(size));
		} else {
			bounds = new Bounds(boundPos, boundPos.add(size));
		}

		return {
			bounds: bounds,
			position: pos,
		};
	},

	getEvents: function () {
		var events = {
			splitposchanged: this._update,
			updateparts: this._update,
			drag: this._update,
		};

		return events;
	},

	_update: function () {

		this._forEachChildRenderer(function (renderer) {
			renderer._update();
		});
	},

	// methods below are called by vector layers implementations

	_initPath: function (layer) {

		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._initPath(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._initPath(layer);
		});
	},

	_initGroup: function (layer) {

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._initGroup(layer);
		});
	},

	_fireMouseEvent: function () {
		// child renderers listen for ['mouseenter', 'mouseout'], and it refires with additional info
		// but these events have any listeners ? may be DomEvent.js generates other events ?

		// TODO: make the child renderers call this and create the right ones.
	},

	_addGroup: function (layer) {

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._addGroup(layer);
		});
	},

	_addPath: function (layer) {

		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._addPath(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._addPath(layer);
		});
	},

	_removeGroup: function (layer) {

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._removeGroup(layer);
		});
	},

	_removePath: function (layer) {
		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._removePath(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._removePath(layer);
		});
	},

	// should not forward to children.
	_updatePath: function (layer) {
		layer._project();
		layer._update();
	},

	_updateStyle: function (layer) {

		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._updateStyle(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._updateStyle(layer);
		});
	},

	// enough to forward the _setPath for the actual path-node modification part.
	_updatePoly: function (layer, closed) {
		this._setPath(layer, L.SVG.pointsToPath(layer._parts, closed));
	},

	// enough to forward the _setPath for the actual path-node modification part.
	_updateCircle: function (layer) {
		var p = layer._point;
		var r = layer._radius;
		var r2 = layer._radiusY || r;
		var arc = 'a' + r + ',' + r2 + ' 0 1,0 ';

		// drawing a circle with two half-arcs
		var d = layer._empty() ? 'M0 0' :
			'M' + (p.x - r) + ',' + p.y +
			arc + (r * 2) + ',0 ' +
			arc + (-r * 2) + ',0 ';

		this._setPath(layer, d);
	},

	_setPath: function (layer, path) {

		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._setPath(layer, path);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._setPath(layer, path);
		});
	},

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	_bringToFront: function (layer) {
		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._bringToFront(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._bringToFront(layer);
		});
	},

	_bringToBack: function (layer) {

		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._bringToBack(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._bringToBack(layer);
		});
	},

	intersectsBounds: function (pxBounds) {
		for (var i = 0; i < this._rendererIds.length; ++i) {
			var rendererId = this._rendererIds[i];
			if (this._childRenderers[rendererId].intersectsBounds(pxBounds)) {
				return true;
			}
		}

		return false;
	},

	addContainerClass: function (className) {
		L.DomUtil.addClass(this._container, className);
		this._forEachChildRenderer(function (childRenderer) {
			childRenderer.addContainerClass(className);
		});
	},

	removeContainerClass: function (className) {
		L.DomUtil.removeClass(this._container, className);
		this._forEachChildRenderer(function (childRenderer) {
			childRenderer.removeContainerClass(className);
		});
	},

});

L.splitPanesSVG = function (options) {
	return new L.SplitPanesSVG(options);
};
