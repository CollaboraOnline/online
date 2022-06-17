L.SVG.include({

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		layer.getPathNode(this).setAttributeNS(null, 'transform', '');
	},

	/**
	 * Applies matrix transformation to SVG
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		layer.getPathNode(this).setAttributeNS(null, 'transform',
			'matrix(' + matrix.join(' ') + ')');
	}

});

L.SplitPanesSVG.include({
	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		if (layer.options.fixed === true) {
			this._childRenderers['fixed']._resetTransformPath(layer);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer._resetTransformPath(layer);
		});
	},

	/**
	 * Applies matrix transformation to SVG
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		if (layer.options.fixed === true) {
			this._childRenderers['fixed'].transformPath(layer, matrix);
			return;
		}

		this._forEachPaneRenderer(function (paneRenderer) {
			paneRenderer.transformPath(layer, matrix);
		});
	}
});
