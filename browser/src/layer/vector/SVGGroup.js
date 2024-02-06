/* -*- js-indent-level: 8 -*- */
/*
 * L.SVGGroup
 */

/* global _ */

import { Bounds } from '../../geometry/Bounds';

L.SVGGroup = L.Layer.extend({

	options: {
		noClip: true,
		manualDrag: window.touch.isTouchEvent,
	},

	noManualDrag: window.memo.decorator(function(f) {
		return function(e) {
			if (!this.options.manualDrag(e)) {
				return f.apply(this, arguments);
			}
		};
	}),

	initialize: function (bounds, options) {
		L.setOptions(this, options);
		this._pathNodeCollection = new L.Path.PathNodeCollection();
		this._bounds = bounds;
		this._rect = L.rectangle(bounds, this.options);
		this._hasSVGNode = false;

		this.on('dragstart scalestart rotatestart', this._showEmbeddedSVG, this);
		this.on('dragend scaleend rotateend', this._hideEmbeddedSVG, this);
	},

	setVisible: function (visible) {
		this._forEachSVGNode(function (svgNode) {
			if (visible)
				svgNode.setAttribute('visibility', 'visible');
			else
				svgNode.setAttribute('visibility', 'hidden');
		});
	},

	sizeSVG: function () {

		if (!this._hasSVGNode) {
			return;
		}

		var size = Bounds.toBounds(this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
			this._map.latLngToLayerPoint(this._bounds.getSouthEast())).getSize();

		this._forEachSVGNode(function (svgNode) {
			svgNode.setAttribute('width', size.x);
			svgNode.setAttribute('height', size.y);
			svgNode.setAttribute('preserveAspectRatio', 'none');
		});
	},

	parseSVG: function (svgString) {
		var parser = new DOMParser();
		return parser.parseFromString(svgString, 'image/svg+xml');
	},

	addEmbeddedVideo: function(svgString) {
		var svgDoc = this.parseSVG(svgString);

		if (svgDoc.lastChild.localName !== 'foreignObject') {
			console.error('Failed to parse svg for embedded video');
			return;
		}

		var svgLastChild = svgDoc.lastChild;

		// remove opacity
		this._forEachGroupNode(function (groupNode) {
			L.DomUtil.removeClass(groupNode, 'leaflet-control-buttons-disabled');
		});

		// allow mouse interaction
		this._renderer._container.setAttribute('pointer-events', 'all');

		// add video nodes
		this._renderer._container.firstChild.appendChild(svgLastChild);

		var point = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
		svgLastChild.setAttribute('x', point.x);
		svgLastChild.setAttribute('y', point.y);

		var videoContainer = svgLastChild.querySelector('body');
		var videos = svgLastChild.getElementsByTagName('video');
		this.addVideoSupportHandlers(videos);

		function _fixSVGPos() {
			var mat = svgLastChild.getScreenCTM();
			var boundingBox = this._renderer._container.getBoundingClientRect();
			videoContainer.style.transform = 'matrix(' + [mat.a, mat.b, mat.c, mat.d, mat.e - boundingBox.x, mat.f - boundingBox.y].join(', ') + ')';
		}
		var fixSVGPos = _fixSVGPos.bind(this);

		if (L.Browser.safari) {
			fixSVGPos();
			var observer = new MutationObserver(fixSVGPos);

			observer.observe(this._renderer._container, {
				attributes: true
			});
		}
	},

	addVideoSupportHandlers: function(videos) {
		if (!videos)
			return;

		var that = this;

		// slide show may have more than one video and it does not require any selection
		for (var i = 0; i < videos.length; i++) {
			var video = videos[i];
			var sources = video.getElementsByTagName('source');

			video.addEventListener('playing', function() {
				window.setTimeout(function() {
					if (video.webkitDecodedFrameCount === 0) {
						that.showUnsupportedVideoWarning();
					}
				}, 1000);
			});

			video.addEventListener('error', function() {
				that.showUnsupportedVideoWarning();
			});

			if (sources.length) {
				sources[0].addEventListener('error', function() {
					that.showUnsupportedVideoWarning();
				});
			}
		}

	},

	showUnsupportedVideoWarning: function() {
		var videoWarning = _('Document contains unsupported video');
		L.Map.THIS.uiManager.showSnackbar(videoWarning);
	},

	addEmbeddedSVG: function (svgString) {
		var svgDoc = this.parseSVG(svgString);

		if (svgDoc.lastChild.localName !== 'svg')
			return;

		var svgLastChild = svgDoc.lastChild;
		var thisObj = this;
		this._forEachGroupNode(function (groupNode, rectNode, nodeData) {
			var svgNode = groupNode.insertBefore(svgLastChild, rectNode);
			nodeData.setCustomField('svg', svgNode);
			nodeData.setCustomField('dragShape', rectNode);
			thisObj._dragShapePresent = true;
			svgNode.setAttribute('pointer-events', 'none');
			svgNode.setAttribute('opacity', thisObj._dragStarted ? 1 : 0);
		});

		this._hasSVGNode = true;

		this.sizeSVG();
		this._update();
	},

	isCalcRTL: function () {
		return this._map._docLayer.isCalcRTL();
	},

	_onDragStart: function(evt) {
		if (!this._map || !this._dragShapePresent || !this.dragging)
			return;
		if (this._map._docLayer._cursorMarker && this._map._docLayer._cursorMarker.isVisible())
			return;
		this._dragStarted = true;
		this._moved = false;

		this._forEachDragShape(function (dragShape) {
			L.DomEvent.on(dragShape, 'mousemove', this.noManualDrag(this._onDrag), this);
			L.DomEvent.on(dragShape, 'mouseup', this.noManualDrag(this._onDragEnd), this);
			if (this.dragging.constraint)
				L.DomEvent.on(dragShape, 'mouseout', this.noManualDrag(this._onDragEnd), this);
		}.bind(this));

		var data = {
			originalEvent: evt,
			containerPoint: this._map.mouseEventToContainerPoint(evt)
		};
		this.dragging._onDragStart(data);

		var pos = this._map.mouseEventToLatLng(evt);
		if (this.isCalcRTL()) {
			pos = this._map.negateLatLng(pos);
		}
		this.fire('graphicmovestart', {pos: pos});
	},

	_onDrag: function(evt) {
		if (!this._map || !this._dragShapePresent || !this.dragging)
			return;

		if (!this._moved) {
			this._moved = true;
			this._showEmbeddedSVG();
		}

		this.dragging._onDrag(evt);
	},

	_onDragEnd: function(evt) {
		if (!this._map || !this._dragShapePresent || !this.dragging)
			return;

		this._forEachDragShape(function (dragShape) {
			L.DomEvent.off(dragShape, 'mousemove', this.noManualDrag(this._onDrag), this);
			L.DomEvent.off(dragShape, 'mouseup', this.noManualDrag(this._onDragEnd), this);
			if (this.dragging.constraint)
				L.DomEvent.off(dragShape, 'mouseout', this.noManualDrag(this._onDragEnd), this);
		}.bind(this));

		this._moved = false;
		this._hideEmbeddedSVG();

		if (this._map) {
			var pos = this._map.mouseEventToLatLng(evt);
			if (this.isCalcRTL()) {
				pos = this._map.negateLatLng(pos);
			}
			this.fire('graphicmoveend', {pos: pos});
		}

		if (this.options.manualDrag(evt) || evt.type === 'mouseup')
			this.dragging._onDragEnd(evt);
		this._dragStarted = false;
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

	getBounds: function () {
		return this._bounds;
	},

	getEvents: function () {
		return {};
	},

	onAdd: function () {
		this._dragStarted = false;
		this._renderer = this._map.getRenderer(this);
		this._renderer._initGroup(this);
		this._renderer._initPath(this._rect);
		this._renderer._addGroup(this);

		this._forEachGroupNode(function (groupNode, rectNode, nodeData) {

			if (!groupNode || !rectNode) {
				return;
			}

			this._rect._map = this._map;
			this._rect._renderer = this._renderer;
			L.DomUtil.addClass(groupNode, 'leaflet-control-buttons-disabled');

			if (this.options.svg) {
				var doc = this.parseSVG(this.options.svg);
				if (doc && doc.lastChild.localName === 'svg') {
					this._hasSVGNode = true;
					var svgNode = groupNode.appendChild(doc.lastChild);
					nodeData.setCustomField('svg', svgNode);
					svgNode.setAttribute('opacity', 0);
					svgNode.setAttribute('pointer-events', 'none');
				}
				delete this.options.svg;
			}

			groupNode.appendChild(rectNode);
			nodeData.setCustomField('dragShape', rectNode);
			this._dragShapePresent = true;

			L.DomEvent.on(rectNode, 'mousedown', this.noManualDrag(this._onDragStart), this);
		}.bind(this));

		this.sizeSVG();

		this._update();
	},

	onRemove: function () {
		this._rect._map = this._rect._renderer = null;
		this._pathNodeCollection.forEachNode(function (nodeData) {

			var actualRenderer = nodeData.getActualRenderer();
			var rectNode = this._rect.getPathNode(actualRenderer);

			this.removeInteractiveTarget(rectNode);
			L.DomUtil.remove(rectNode);

		}.bind(this));

		this.removeEmbeddedSVG();
		this._renderer._removeGroup(this);
	},

	removeEmbeddedSVG: function () {
		if (!this._hasSVGNode) {
			return;
		}

		this._pathNodeCollection.forEachNode(function (nodeData) {
			var svgNode = nodeData.getCustomField('svg');
			L.DomUtil.remove(svgNode);
			nodeData.clearCustomField('svg');
		});

		this._dragShapePresent = false;
		this._hasSVGNode = false;
		this._update();
	},

	_hideEmbeddedSVG: function () {
		this._forEachSVGNode(function (svgNode) {
			svgNode.setAttribute('opacity', 0);
		});
	},

	_hasVisibleEmbeddedSVG: function () {
		var result = false;
		this._forEachSVGNode(function (svgNode) {
			if (parseInt(svgNode.getAttribute('opacity')) !== 0)
				result = true;
		});

		return result;
	},

	_transform: function(matrix) {
		if (this._renderer) {
			if (matrix) {
				this._renderer.transformPath(this, matrix);
			} else {
				this._renderer._resetTransformPath(this);
				this._update();
			}
		}
		return this;
	},

	_project: function () {
		// window.app.console.log()
	},

	_reset: function () {
		this._update();
	},

	_showEmbeddedSVG: function () {
		this._forEachSVGNode(function (svgNode) {
			svgNode.setAttribute('opacity', 1);
		});
	},

	_update: function () {
		this._rect.setBounds(this._bounds);
		var point = this._map.latLngToLayerPoint(this._bounds.getNorthWest());

		this._forEachSVGNode(function (svgNode) {
			svgNode.setAttribute('x', point.x);
			svgNode.setAttribute('y', point.y);
		}.bind(this));
	},

	_updatePath: function () {
		this._update();
	},

	addPathNode: function (pathNode, actualRenderer) {

		this._path = undefined;

		if (!this._pathNodeCollection) {
			this._pathNodeCollection = new L.Path.PathNodeCollection();
		}

		this._pathNodeCollection.add(new L.Path.PathNodeData(pathNode, actualRenderer));
	},

	getPathNode: function (actualRenderer) {

		window.app.console.assert(this._pathNodeCollection, 'missing _pathNodeCollection member!');
		return this._pathNodeCollection.getPathNode(actualRenderer);
	},

	addClass: function (className) {
		this._pathNodeCollection.addOrRemoveClass(className, true /* add */);
	},

	removeClass: function (className) {
		this._pathNodeCollection.addOrRemoveClass(className, false /* add */);
	},

	_forEachGroupNode: function (callback) {

		var that = this;
		this._pathNodeCollection.forEachNode(function (nodeData) {

			var actualRenderer = nodeData.getActualRenderer();
			var groupNode = nodeData.getNode();
			var rectNode = that._rect.getPathNode(actualRenderer);

			callback(groupNode, rectNode, nodeData);

		});

		return true;
	},

	_forEachSVGNode: function (callback) {
		if (!this._hasSVGNode) {
			return false;
		}

		this._pathNodeCollection.forEachNode(function (nodeData) {
			var svgNode = nodeData.getCustomField('svg');
			if (svgNode) {
				callback(svgNode);
			}
		});

		return true;
	},

	_forEachDragShape: function (callback) {
		if (!this._dragShapePresent) {
			return false;
		}

		this._pathNodeCollection.forEachNode(function (nodeData) {
			var dragShape = nodeData.getCustomField('dragShape');
			if (dragShape) {
				callback(dragShape);
			}
		});

		return true;
	},

});

L.svgGroup = function (bounds, options) {
	return new L.SVGGroup(bounds, options);
};
