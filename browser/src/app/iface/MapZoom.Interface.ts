/* -*- js-indent-level: 8 -*- */
// Subset of MapInterface containing zoom options.
// Needed in ServerCommand and its unit tests.
interface MapZoomInterface {
	_docLayer: {
		options: {
			tileWidthTwips: number;
		};
	};
	options: {
		zoom: number;
	};
}

/* vim:set shiftwidth=8 softtabstop=8 noexpandtab: */
