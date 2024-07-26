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
	isAdminUser: null, // Is admin on the integrator side - used eg. to show update warnings
	calc: {
		cellAddress: null, // To be assigned SimplePoint.
		cellCursorVisible: false,
		cellCursorRectangle: null, // To be assigned SimpleRectangle.
		otherCellCursors: {},
		splitCoordinate: null, // SimplePoint.
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
		textCursor: {
			visible: false,

			/*
				Starts as null, so we can see if the first invalidation happened or not.
				This is a simpleRectangle.
				One should consider this as a document object coordinate as in CanvasSectionContainer.
				This gives the coordinate relative to the document, not relative to the UI.
			*/
			rectangle: null // SimpleRectangle.
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
	following: { // describes which cursor we follow with the view
		mode: 'none', // none | user | editor
		viewId: -1, // viewId of currently followed user
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
			[{Value: '000000'}, {Value: '111111'}, {Value: '1c1c1c'}, {Value: '333333'}, {Value: '666666'}, {Value: '808080'}, {Value: '999999'}, {Value: 'b2b2b2'}, {Value: 'cccccc'}, {Value: 'dddddd'}, {Value: 'eeeeee'}, {Value: 'ffffff'}],
			[{Value: 'ffff00'}, {Value: 'ffbf00'}, {Value: 'ff8000'}, {Value: 'ff4000'}, {Value: 'ff0000'}, {Value: 'bf0041'}, {Value: '800080'}, {Value: '55308d'}, {Value: '2a6099'}, {Value: '158466'}, {Value: '00a933'}, {Value: '81d41a'}],
			[{Value: 'ffffd7'}, {Value: 'fff5ce'}, {Value: 'ffdbb6'}, {Value: 'ffd8ce'}, {Value: 'ffd7d7'}, {Value: 'f7d1d5'}, {Value: 'e0c2cd'}, {Value: 'dedce6'}, {Value: 'dee6ef'}, {Value: 'dee7e5'}, {Value: 'dde8cb'}, {Value: 'f6f9d4'}],
			[{Value: 'ffffa6'}, {Value: 'ffe994'}, {Value: 'ffb66c'}, {Value: 'ffaa95'}, {Value: 'ffa6a6'}, {Value: 'ec9ba4'}, {Value: 'bf819e'}, {Value: 'b7b3ca'}, {Value: 'b4c7dc'}, {Value: 'b3cac7'}, {Value: 'afd095'}, {Value: 'e8f2a1'}],
			[{Value: 'ffff6d'}, {Value: 'ffde59'}, {Value: 'ff972f'}, {Value: 'ff7b59'}, {Value: 'ff6d6d'}, {Value: 'e16173'}, {Value: 'a1467e'}, {Value: '8e86ae'}, {Value: '729fcf'}, {Value: '81aca6'}, {Value: '77bc65'}, {Value: 'd4ea6b'}],
			[{Value: 'ffff38'}, {Value: 'ffd428'}, {Value: 'ff860d'}, {Value: 'ff5429'}, {Value: 'ff3838'}, {Value: 'd62e4e'}, {Value: '8d1d75'}, {Value: '6b5e9b'}, {Value: '5983b0'}, {Value: '50938a'}, {Value: '3faf46'}, {Value: 'bbe33d'}],
			[{Value: 'e6e905'}, {Value: 'e8a202'}, {Value: 'ea7500'}, {Value: 'ed4c05'}, {Value: 'f10d0c'}, {Value: 'a7074b'}, {Value: '780373'}, {Value: '5b277d'}, {Value: '3465a4'}, {Value: '168253'}, {Value: '069a2e'}, {Value: '5eb91e'}],
			[{Value: 'acb20c'}, {Value: 'b47804'}, {Value: 'b85c00'}, {Value: 'be480a'}, {Value: 'c9211e'}, {Value: '861141'}, {Value: '650953'}, {Value: '55215b'}, {Value: '355269'}, {Value: '1e6a39'}, {Value: '127622'}, {Value: '468a1a'}],
			[{Value: '706e0c'}, {Value: '784b04'}, {Value: '7b3d00'}, {Value: '813709'}, {Value: '8d281e'}, {Value: '611729'}, {Value: '4e102d'}, {Value: '481d32'}, {Value: '383d3c'}, {Value: '28471f'}, {Value: '224b12'}, {Value: '395511'}],
			[{Value: '443205'}, {Value: '472702'}, {Value: '492300'}, {Value: '4b2204'}, {Value: '50200c'}, {Value: '41190d'}, {Value: '3b160e'}, {Value: '3a1a0f'}, {Value: '362413'}, {Value: '302709'}, {Value: '2e2706'}, {Value: '342a06'}],
			// ['660205', '783F0B', '7F6011', '274E12', '0C343D', '063762', '20124D', '4C1030'],
		] },
		'ThemeColors': { name: _('Theme colors'), colors: [] },
		'DocumentColors': { name: _('Document colors'), colors: [] },
	},
	colorLastSelection: {}, // last used colors for uno commands

	serverAudit: null, // contains list of warnings / errors detected on the server instance

	events: null, // See app/DocEvents.ts for details.
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
window.SlideShow = {}; // initialize slideshow module
