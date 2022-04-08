window.app = { // Shouldn't have any functions defined.
	definitions: {}, // Class instances are created using definitions under this variable.
	dpiScale: window.devicePixelRatio,
	roundedDpiScale: Math.round(window.devicePixelRatio),
	twipsToPixels: 0, // Twips to pixels multiplier.
	pixelsToTwips: 0, // Pixels to twips multiplier.
	file: {
		editComment: false,
		readOnly: true,
		disableSidebar: false,
		size: {
			pixels: [0, 0], // This can change according to the zoom level and document's size.
			twips: [0, 0]
		},
		viewedRectangle: [0, 0, 0, 0], // Visible part of the file (x, y, w, h).
		fileBasedView: false, // (draw-impress only) Default is false. For read-only documents, user can view all parts at once. In that case, this variable is set to "true".
		calc: {
			cellCursor: {
				address: [0, 0],
				rectangle: {
					pixels: [0, 0, 0, 0],
					twips: [0, 0, 0, 0]
				},
				visible: false,
			}
		},
		writer: {
			pageRectangleList: [] // Array of arrays: [x, y, w, h] (as usual) // twips only. Pixels will be calculated on the fly. Corresponding pixels may change too ofte
		},
	},
	view: {
		commentHasFocus: false,
		size: {
			pixels: [0, 0] // This can be larger than the document's size.
		}
	},
	tile: {
		size: {
			pixels: [0, 0],
			twips: [0, 0]
		}
	},
	socket: window.app.socket,
	console: window.app.console,
};
