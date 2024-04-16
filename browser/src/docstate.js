/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
	Shouldn't have any functions defined. See "docstatefunctions.js" for state functions.
	Class definitions can be added into "definitions" property and used like in below examples:
		* app.sectionContainer.addSection(new app.definitions.AutoFillMarkerSection());
		* var autoFillSection = new app.definitions.AutoFillMarkerSection();
*/
window.app = {
	definitions: {}, // Class instances are created using definitions under this variable.
	dpiScale: window.devicePixelRatio,
	roundedDpiScale: Math.round(window.devicePixelRatio),
	canvasSize: null, // To be assigned SimplePoint.
	viewId: null, // Unique view id of the user.
	calc: {
		cellAddress: null, // To be assigned SimplePoint.
		cellCursorVisible: false,
		cellCursorRectangle: null, // To be assigned SimpleRectangle.
		otherCellCursors: {}
	},
	map: null, // Make map object a part of this.
	dispatcher: null, // A Dispatcher class instance is assigned to this.
	twipsToPixels: 0, // Twips to pixels multiplier.
	pixelsToTwips: 0, // Pixels to twips multiplier.
	UI: {
		language: {
			fromURL: window.langParam, // This is set in global.js.
			fromBrowser: L.Browser.lang, // Again in global.js.
			notebookbarAccessibility: null
		}
	},
	file: {
		editComment: false,
		readOnly: true,
		permission: 'readonly',
		disableSidebar: false,
		cursor: {
			visible: false,

			/*
				Starts as null, so we can see if the first invalidation happened or not.
				This is a simpleRectangle.
				One should consider this as a document object coordinate as in CanvasSectionContainer.
				This gives the coordinate relative to the document, not relative to the UI.
			*/
			rectangle: null
		},
		size: {
			pixels: [0, 0], // This can change according to the zoom level and document's size.
			twips: [0, 0]
		},
		viewedRectangle: null, // Visible part of the file - SimpleRectangle.
		fileBasedView: false, // (draw-impress only) Default is false. For read-only documents, user can view all parts at once. In that case, this variable is set to "true".
		writer: {
			pageRectangleList: [], // Array of arrays: [x, y, w, h] (as usual) // twips only. Pixels will be calculated on the fly. Corresponding pixels may change too often.
		},
		exportFormats: [] // possible output formats
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

	// Below 2 are related to document. I guess we can move these into "file" property.
	languages: [], // all available languages, fetched from core
	favouriteLanguages: ['de-DE', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'it', 'nl-NL', 'pt-BR', 'pt-PT', 'ru'],
	colorPalettes: {
		'StandardColors': { name: _('Standard'), colors: [
			[{Value: '000000'}, {Value: '555555'}, {Value: '888888'}, {Value: 'BBBBBB'}, {Value: 'DDDDDD'}, {Value: 'EEEEEE'}, {Value: 'F7F7F7'}, {Value: 'FFFFFF'}],
			[{Value: 'FF011B'}, {Value: 'FF9838'}, {Value: 'FFFD59'}, {Value: '01FD55'}, {Value: '00FFFE'}, {Value: '006CE7'}, {Value: '9B24F4'}, {Value: 'FF21F5'}],
			[{Value: 'FFEAEA'}, {Value: 'FCEFE1'}, {Value: 'FCF5E1'}, {Value: 'EBF7E7'}, {Value: 'E9F3F5'}, {Value: 'ECF4FC'}, {Value: 'EAE6F4'}, {Value: 'F5E7ED'}],
			[{Value: 'F4CCCC'}, {Value: 'FCE5CD'}, {Value: 'FFF2CC'}, {Value: 'D9EAD3'}, {Value: 'D0E0E3'}, {Value: 'CFE2F3'}, {Value: 'D9D1E9'}, {Value: 'EAD1DC'}],
			[{Value: 'EA9899'}, {Value: 'F9CB9C'}, {Value: 'FEE599'}, {Value: 'B6D7A8'}, {Value: 'A2C4C9'}, {Value: '9FC5E8'}, {Value: 'B4A7D6'}, {Value: 'D5A6BD'}],
			[{Value: 'E06666'}, {Value: 'F6B26B'}, {Value: 'FED966'}, {Value: '93C47D'}, {Value: '76A5AF'}, {Value: '6FA8DC'}, {Value: '8E7CC3'}, {Value: 'C27BA0'}],
			[{Value: 'CC0814'}, {Value: 'E69138'}, {Value: 'F1C232'}, {Value: '6AA84F'}, {Value: '45818E'}, {Value: '3D85C6'}, {Value: '674EA7'}, {Value: 'A54D79'}],
			[{Value: '99050C'}, {Value: 'B45F17'}, {Value: 'BF901F'}, {Value: '37761D'}, {Value: '124F5C'}, {Value: '0A5394'}, {Value: '351C75'}, {Value: '741B47'}],
			// ['660205', '783F0B', '7F6011', '274E12', '0C343D', '063762', '20124D', '4C1030'],
		] },
		'ThemeColors': { name: _('Theme colors'), colors: [] },
		'DocumentColors': { name: _('Document colors'), colors: [] },
	},
	colorLastSelection: {}, // last used colors for uno commands
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
