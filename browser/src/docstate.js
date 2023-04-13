/* global Proxy */

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
	socket: window.app.socket,
	console: window.app.console,
	languages: [], // all available languages, fetched from core
	favouriteLanguages: ['de-DE', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'it', 'nl-NL', 'pt-BR', 'pt-PT', 'ru'],
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

// Add a global listener for "alt" key. We will activate and deactivate a css rule when "alt" key is pressed and released.
window.addEventListener('keydown', function(event) {
	if (event.altKey || event.code === 'AltLeft')
		document.body.classList.add('activate-underlines');
});
window.addEventListener('keyup', function(event) {
	if (event.altKey || event.code === 'AltLeft')
		document.body.classList.remove('activate-underlines');
});
