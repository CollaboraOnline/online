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
