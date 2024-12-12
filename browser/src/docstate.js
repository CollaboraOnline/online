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
		partHashes: null, // hashes used to distinguish parts (we use sheet name)
	},
	impress: {
		partList: null, // Info for parts.
		notesMode: false, // Opposite of "NormalMultiPaneGUI".
		twipsCorrection: 0.567 // There is a constant ratio between tiletwips and impress page twips. For now, this seems safe to use.
	},
	map: null, // Make map object a part of this.
	dispatcher: null, // A Dispatcher class instance is assigned to this.
	twipsToPixels: 0, // Twips to pixels multiplier.
	pixelsToTwips: 0, // Pixels to twips multiplier.
	accessibilityState: false, // If accessibility was enabled by user
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
			[{Value: '000000'}, {Value: '111111'}, {Value: '1C1C1C'}, {Value: '333333'}, {Value: '666666'}, {Value: '808080'}, {Value: '999999'}, {Value: 'B2B2B2'}, {Value: 'CCCCCC'}, {Value: 'DDDDDD'}, {Value: 'EEEEEE'}, {Value: 'FFFFFF'}],
			[{Value: 'FFFF00'}, {Value: 'FFBF00'}, {Value: 'FF8000'}, {Value: 'FF4000'}, {Value: 'FF0000'}, {Value: 'BF0041'}, {Value: '800080'}, {Value: '55308D'}, {Value: '2A6099'}, {Value: '158466'}, {Value: '00A933'}, {Value: '81D41A'}],
			[{Value: 'FFFFD7'}, {Value: 'FFF5CE'}, {Value: 'FFDBB6'}, {Value: 'FFD8CE'}, {Value: 'FFD7D7'}, {Value: 'F7D1D5'}, {Value: 'E0C2CD'}, {Value: 'DEDCE6'}, {Value: 'DEE6EF'}, {Value: 'DEE7E5'}, {Value: 'DDE8CB'}, {Value: 'F6F9D4'}],
			[{Value: 'FFFFA6'}, {Value: 'FFE994'}, {Value: 'FFB66C'}, {Value: 'FFAA95'}, {Value: 'FFA6A6'}, {Value: 'EC9BA4'}, {Value: 'BF819E'}, {Value: 'B7B3CA'}, {Value: 'B4C7DC'}, {Value: 'B3CAC7'}, {Value: 'AFD095'}, {Value: 'E8F2A1'}],
			[{Value: 'FFFF6D'}, {Value: 'FFDE59'}, {Value: 'FF972F'}, {Value: 'FF7B59'}, {Value: 'FF6D6D'}, {Value: 'E16173'}, {Value: 'A1467E'}, {Value: '8E86AE'}, {Value: '729FCF'}, {Value: '81ACA6'}, {Value: '77BC65'}, {Value: 'D4EA6B'}],
			[{Value: 'FFFF38'}, {Value: 'FFD428'}, {Value: 'FF860D'}, {Value: 'FF5429'}, {Value: 'FF3838'}, {Value: 'D62E4E'}, {Value: '8D1D75'}, {Value: '6B5E9B'}, {Value: '5983B0'}, {Value: '50938A'}, {Value: '3FAF46'}, {Value: 'BBE33D'}],
			[{Value: 'E6E905'}, {Value: 'E8A202'}, {Value: 'EA7500'}, {Value: 'ED4C05'}, {Value: 'F10D0C'}, {Value: 'A7074B'}, {Value: '780373'}, {Value: '5B277D'}, {Value: '3465A4'}, {Value: '168253'}, {Value: '069A2E'}, {Value: '5EB91E'}],
			[{Value: 'ACB20C'}, {Value: 'B47804'}, {Value: 'B85C00'}, {Value: 'BE480A'}, {Value: 'C9211E'}, {Value: '861141'}, {Value: '650953'}, {Value: '55215B'}, {Value: '355269'}, {Value: '1E6A39'}, {Value: '127622'}, {Value: '468A1A'}],
			[{Value: '706E0C'}, {Value: '784B04'}, {Value: '7B3D00'}, {Value: '813709'}, {Value: '8D281E'}, {Value: '611729'}, {Value: '4E102D'}, {Value: '481D32'}, {Value: '383D3C'}, {Value: '28471F'}, {Value: '224B12'}, {Value: '395511'}],
			[{Value: '443205'}, {Value: '472702'}, {Value: '492300'}, {Value: '4B2204'}, {Value: '50200C'}, {Value: '41190D'}, {Value: '3B160E'}, {Value: '3A1A0F'}, {Value: '362413'}, {Value: '302709'}, {Value: '2E2706'}, {Value: '342A06'}],
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
