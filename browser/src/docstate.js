/* global Proxy _ */

window.app = { // Shouldn't have any functions defined.
	definitions: {}, // Class instances are created using definitions under this variable.
	dpiScale: window.devicePixelRatio,
	roundedDpiScale: Math.round(window.devicePixelRatio),
	map: null, // Make map object a part of this.
	twipsToPixels: 0, // Twips to pixels multiplier.
	pixelsToTwips: 0, // Pixels to twips multiplier.
	file: {
		editComment: false,
		readOnly: true,
		permission: 'readonly',
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
			pageRectangleList: [], // Array of arrays: [x, y, w, h] (as usual) // twips only. Pixels will be calculated on the fly. Corresponding pixels may change too ofte

			/*
				Starts as null, so we can see if the first invalidation happened or not.
				This is a rectangle: [x, y, w, h].
				One should consider this as a document object coordinate  as in CanvasSectionContainer.
				This gives the coordinate relative to the document, not relative to the UI.
			*/
			cursorPosition: null,
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
	notebookbarAccessibility: null,
	socket: window.app.socket,
	console: window.app.console,
	languages: [], // all available languages, fetched from core
	favouriteLanguages: ['de-DE', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'it', 'nl-NL', 'pt-BR', 'pt-PT', 'ru'],
	colorPalettes: {
		'ThemeColors': { name: _('Theme colors'), colors: [] },
		'StandardColors': { name: _('Standard'), colors: [
			['000000', '555555', '888888', 'BBBBBB', 'DDDDDD', 'EEEEEE', 'F7F7F7', 'FFFFFF'],
			['FF011B', 'FF9838', 'FFFD59', '01FD55', '00FFFE', '006CE7', '9B24F4', 'FF21F5'],
			['FFEAEA', 'FCEFE1', 'FCF5E1', 'EBF7E7', 'E9F3F5', 'ECF4FC', 'EAE6F4', 'F5E7ED'],
			['F4CCCC', 'FCE5CD', 'FFF2CC', 'D9EAD3', 'D0E0E3', 'CFE2F3', 'D9D1E9', 'EAD1DC'],
			['EA9899', 'F9CB9C', 'FEE599', 'B6D7A8', 'A2C4C9', '9FC5E8', 'B4A7D6', 'D5A6BD'],
			['E06666', 'F6B26B', 'FED966', '93C47D', '76A5AF', '6FA8DC', '8E7CC3', 'C27BA0'],
			['CC0814', 'E69138', 'F1C232', '6AA84F', '45818E', '3D85C6', '674EA7', 'A54D79'],
			['99050C', 'B45F17', 'BF901F', '37761D', '124F5C', '0A5394', '351C75', '741B47'],
			// ['660205', '783F0B', '7F6011', '274E12', '0C343D', '063762', '20124D', '4C1030'],
		] },
	},
};

var activateValidation = false;

if (activateValidation) {
/*
	For debugging purposes.

	* Easier debugging.
	* Value range checks.

	It logs the changes of the variables of "window.app" object.
	This provides debugging of window.app object and makes easier use of these global states of the document.
	window.app object can contain cursor position etc. variables related to document state.
	One needs to only watch the data structure and add new variables into related sub-object (file, view, tile etc.).

	This validator also enables global data validation.
	If a variable of window.app should stay in a specified range:
		* One can add a check for that variable into "set" function below.
	This validation feature may also be useful with Cypress tests and Javascript unit tests.

	This first version only contains the logging of the changes.
*/
	var validator = {
		set: function(obj, prop, value) {
			// The default behavior to store the value
			obj[prop] = value;
			console.log('window.app property changed: ' + prop, value);
			// Indicate success
			return true;
		}
	};

	window.app = new Proxy(window.app, validator);
	window.app.file = new Proxy(window.app.file, validator);

}

window.JSDialog = {}; // initialize jsdialog module
