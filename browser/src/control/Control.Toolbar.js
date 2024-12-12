/* -*- js-indent-level: 8; fill-column: 100 -*- */

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
 * Collabora Online toolbar
 */

/* global app $ _ JSDialog */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/

(function(global) {

var map;

function getUNOCommand(unoData) {
	if (typeof unoData !== 'object')
		return unoData;

	if (!map._clip)
		return unoData.textCommand;

	var selectionType = map._clip._selectionType;

	if (!selectionType || selectionType === 'text')
		return unoData.textCommand;

	return unoData.objectCommand;
}

function _setBorders(left, right, bottom, top, horiz, vert, color) {
	var params = {
		OuterBorder: {
			type : '[]any',
			value : [
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : color }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : left }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : color }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : right }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : color }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : bottom }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : color }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : top }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'long', value : 0 },
				{ type : 'long', value : 0 },
				{ type : 'long', value : 0 },
				{ type : 'long', value : 0 },
				{ type : 'long', value : 0 }
			]
		},
		InnerBorder: {
			type : '[]any',
			value : [
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : color }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : horiz }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : color }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : vert }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'short', value : 0 },
				{ type : 'short', value : 127 },
				{ type : 'long', value : 0 }
			]
		}};
	map.sendUnoCommand('.uno:SetBorderStyle', params);
}

// close the popup

var lastClosePopupCallback = undefined;

function closePopup() {
	if (lastClosePopupCallback) {
		lastClosePopupCallback();
		lastClosePopupCallback = undefined;
	}
	map.focus();
}

function setBorderStyle(num, color) {
	if (color === undefined)
		color = 0; // black
	else if (color.startsWith('#'))
		color = parseInt('0x' + color.substring(1, color.length));

	switch (num) {
	case 0: map.sendUnoCommand('.uno:FormatCellBorders'); break;

	case 1: _setBorders(0, 0, 0, 0, 0, 0, color); break;
	case 2: _setBorders(1, 0, 0, 0, 0, 0, color); break;
	case 3: _setBorders(0, 1, 0, 0, 0, 0, color); break;
	case 4: _setBorders(1, 1, 0, 0, 0, 0, color); break;

	case 5: _setBorders(0, 0, 0, 1, 0, 0, color); break;
	case 6: _setBorders(0, 0, 1, 0, 0, 0, color); break;
	case 7: _setBorders(0, 0, 1, 1, 0, 0, color); break;
	case 8: _setBorders(1, 1, 1, 1, 0, 0, color); break;

	case 9:  _setBorders(0, 0, 1, 1, 1, 0, color); break;
	case 10: _setBorders(1, 1, 1, 1, 1, 0, color); break;
	case 11: _setBorders(1, 1, 1, 1, 0, 1, color); break;
	case 12: _setBorders(1, 1, 1, 1, 1, 1, color); break;

	default: window.app.console.log('ignored border: ' + num);
	}

	// TODO we may consider keeping it open in the future if we add border color
	// and style to this popup too
	closePopup();
}

global.setBorderStyle = setBorderStyle;

function getBorderStyleMenuElements(closeCallback) {
	lastClosePopupCallback = closeCallback;

	const table = document.createElement('table');
	table.id = 'setborderstyle-grid';

	for (let i = 0; i < 12; i++) {
		let tr = document.createElement('tr');
		table.appendChild(tr);
		for (let j = 0; j < 4; j++) {
			let td = document.createElement('td');
			tr.appendChild(td);
			const num = String(i + j + 1);
			td.className = 'w2ui-tb-image w2ui-icon ' + (i + j < 9 ? 'frame0' + String(i + j + 1): 'frame' + String(i + j + 1));
			td.onclick = function() { setBorderStyle(parseInt(num)); };
		}
		i += 3;
	}

	let tr = document.createElement('tr');
	let td = document.createElement('td');
	td.setAttribute('colspan', 4);
	td.onclick = function() { setBorderStyle(0); };

	let div = document.createElement('div');
	div.id = 'div-frame13';
	div.textContent = _('More...');

	td.appendChild(div);
	tr.appendChild(td);
	table.appendChild(tr);

	return table;
}

global.getBorderStyleMenuElements = getBorderStyleMenuElements;

function setConditionalFormat(num, unoCommand, jsdialogDropdown) {
	var params = {
		IconSet: {
			type : 'short',
			value : num
		}};
	map.sendUnoCommand(unoCommand, params);

	if (jsdialogDropdown)
		JSDialog.CloseAllDropdowns();
	else
		closePopup();
}

global.setConditionalFormat = setConditionalFormat;

function moreConditionalFormat (unoCommand, jsdialogDropdown) {
	map.sendUnoCommand(unoCommand);

	if (jsdialogDropdown)
		JSDialog.CloseAllDropdowns();
	else
		closePopup();
}

global.moreConditionalFormat = moreConditionalFormat;

function getConditionalFormatMenuElementsImpl(more, type, count, unoCommand, jsdialogDropdown) {
	const table = document.createElement('table');
	table.id = 'conditionalformatmenu-grid';

	for (let i = 0; i < count; i += 3) {
		for (let j = i; j < i + 3; j++) {
			let number = j;

			// iconset07 deliberately left out, see the .css for the reason
			if (type === 'iconset' && number >= 7)
				number++;

			const iconClass = type + (number < 10 ? '0': '') + number;
			const button = document.createElement('button');
			button.className = 'w2ui-tb-image w2ui-icon ' + iconClass;
			button.onclick = function() {
				setConditionalFormat(number, unoCommand, !!jsdialogDropdown);
			};
			table.appendChild(button);
		}
	}

	if (more) {
		const button = document.createElement('button');
		button.id = 'more';
		button.onclick = function() {
			moreConditionalFormat(unoCommand, !!jsdialogDropdown);
		};
		button.textContent = _('More...');
		table.appendChild(button);
	}

	return table;
}

// for icon set conditional formatting
function getConditionalFormatMenuElements(more, jsdialogDropdown) {
	return getConditionalFormatMenuElementsImpl(more, 'iconset', 21, '.uno:IconSetFormatDialog', jsdialogDropdown);
}

global.getConditionalFormatMenuElements = getConditionalFormatMenuElements;

// for color scale conditional formatting
function getConditionalColorScaleMenuElements(more, jsdialogDropdown) {
	return getConditionalFormatMenuElementsImpl(more, 'scaleset', 12, '.uno:ColorScaleFormatDialog', jsdialogDropdown);
}

global.getConditionalColorScaleMenuElements = getConditionalColorScaleMenuElements;

// for data bar conditional formatting
function getConditionalDataBarMenuElements(more, jsdialogDropdown) {
	return getConditionalFormatMenuElementsImpl(more, 'databarset', 12, '.uno:DataBarFormatDialog', jsdialogDropdown);
}

global.getConditionalDataBarMenuElements = getConditionalDataBarMenuElements;

var sendInsertTableFunction = function(event) {
	var col = $(event.target).index() + 1;
	var row = $(event.target).parent().index() + 1;
	$('.col').removeClass('bright');
	var status = $('#inserttable-status')
	status.html('<br/>');
	var msg = 'uno .uno:InsertTable {' +
		' "Columns": { "type": "long","value": '
		+ col +
		' }, "Rows": { "type": "long","value": '
		+ row + ' }}';

	app.socket.sendMessage(msg);
	closePopup();
};

var highlightTableFunction = function(event) {
	var col = $(event.target).index() + 1;
	var row = $(event.target).parent().index() + 1;
	$('.col').removeClass('bright');
	$('.row:nth-child(-n+' + row + ') .col:nth-child(-n+' + col + ')')
		.addClass('bright');
	var status = $('#inserttable-status')
	status.html(col + 'x' + row);
};

function getInsertTablePopupElements(closeCallback) {
	lastClosePopupCallback = closeCallback;

	const container = document.createElement('div');

	const grid = document.createElement('div');
	grid.className = 'inserttable-grid';
	grid.onmouseover = highlightTableFunction;
	grid.onclick = sendInsertTableFunction;

	const statusDiv = document.createElement('div');
	statusDiv.id = 'inserttable-status';
	statusDiv.className = 'cool-font';
	statusDiv.style.padding = '5px';

	container.textContent = '\n';
	container.appendChild(grid);
	container.appendChild(statusDiv);

	insertTable(container.children[0]);

	const wrapperContainer = document.createElement('div');

	const wrapper = document.createElement('div');
	wrapper.id = 'inserttable-wrapper';

	const popUp = document.createElement('div');
	popUp.id = 'inserttable-popup';
	popUp.className = 'inserttable-pop ui-widget ui-corner-all';
	popUp.tabIndex = 0;

	wrapperContainer.appendChild(wrapper);
	wrapperContainer.appendChild(popUp);

	popUp.appendChild(grid);

	return wrapperContainer;
}

function insertTable(grid = document.getElementsByClassName('inserttable-grid')[0]) {
	var rows = 10;
	var cols = 10;

	for (var r = 0; r < rows; r++) {
		const row = document.createElement('div');
		row.className = 'row';
		grid.appendChild(row);

		for (var c = 0; c < cols; c++) {
			const col = document.createElement('button');
			col.setAttribute('aria-label', (1 + r) + 'x' + (1 + c));
			col.onfocus = highlightTableFunction;
			col.className = 'col';
			row.appendChild(col);
		}
	}
}

var shapes = {
	'insertshapes': {
		'Basic Shapes': [
			{img: 'basicshapes_rectangle', uno: 'BasicShapes.rectangle'},
			{img: 'basicshapes_round-rectangle', uno: 'BasicShapes.round-rectangle'},
			{img: 'basicshapes_quadrat', uno: 'BasicShapes.quadrat'},
			{img: 'basicshapes_round-quadrat', uno: 'BasicShapes.round-quadrat'},
			{img: 'basicshapes_circle', uno: 'BasicShapes.circle'},
			{img: 'basicshapes_ellipse', uno: 'BasicShapes.ellipse'},

			{img: 'basicshapes_circle-pie', uno: 'BasicShapes.circle-pie'},
			{img: 'basicshapes_isosceles-triangle', uno: 'BasicShapes.isosceles-triangle'},
			{img: 'basicshapes_right-triangle', uno: 'BasicShapes.right-triangle'},
			{img: 'basicshapes_trapezoid', uno: 'BasicShapes.trapezoid'},
			{img: 'basicshapes_diamond', uno: 'BasicShapes.diamond'},
			{img: 'basicshapes_parallelogram', uno: 'BasicShapes.parallelogram'},

			{img: 'basicshapes_pentagon', uno: 'BasicShapes.pentagon'},
			{img: 'basicshapes_hexagon', uno: 'BasicShapes.hexagon'},
			{img: 'basicshapes_octagon', uno: 'BasicShapes.octagon'},
			{img: 'basicshapes_cross', uno: 'BasicShapes.cross'},
			{img: 'basicshapes_ring', uno: 'BasicShapes.ring'},
			{img: 'basicshapes_block-arc', uno: 'BasicShapes.block-arc'},

			{img: 'basicshapes_can', uno: 'BasicShapes.can'},
			{img: 'basicshapes_cube', uno: 'BasicShapes.cube'},
			{img: 'basicshapes_paper', uno: 'BasicShapes.paper'},
			{img: 'basicshapes_frame', uno: 'BasicShapes.frame'}
		],

		'Symbol Shapes':  [
			{img: 'symbolshapes', uno: 'SymbolShapes.smiley'},
			{img: 'symbolshapes_sun', uno: 'SymbolShapes.sun'},
			{img: 'symbolshapes_moon', uno: 'SymbolShapes.moon'},
			{img: 'symbolshapes_lightning', uno: 'SymbolShapes.lightning'},
			{img: 'symbolshapes_heart', uno: 'SymbolShapes.heart'},
			{img: 'symbolshapes_flower', uno: 'SymbolShapes.flower'},

			{img: 'symbolshapes_cloud', uno: 'SymbolShapes.cloud'},
			{img: 'symbolshapes_forbidden', uno: 'SymbolShapes.forbidden'},
			{img: 'symbolshapes_puzzle', uno: 'SymbolShapes.puzzle'},
			{img: 'symbolshapes_bracket-pair', uno: 'SymbolShapes.bracket-pair'},
			{img: 'symbolshapes_left-bracket', uno: 'SymbolShapes.left-bracket'},
			{img: 'symbolshapes_right-bracket', uno: 'SymbolShapes.right-bracket'},

			{img: 'symbolshapes_brace-pair', uno: 'SymbolShapes.brace-pair'},
			{img: 'symbolshapes_left-brace', uno: 'SymbolShapes.left-brace'},
			{img: 'symbolshapes_right-brace', uno: 'SymbolShapes.right-brace'},
			{img: 'symbolshapes_quad-bevel', uno: 'SymbolShapes.quad-bevel'},
			{img: 'symbolshapes_octagon-bevel', uno: 'SymbolShapes.octagon-bevel'},
			{img: 'symbolshapes_diamond-bevel', uno: 'SymbolShapes.diamond-bevel'}
		],

		'Block Arrows': [
			{img: 'arrowshapes_left-arrow', uno: 'ArrowShapes.left-arrow'},
			{img: 'arrowshapes_right-arrow', uno: 'ArrowShapes.right-arrow'},
			{img: 'arrowshapes_up-arrow', uno: 'ArrowShapes.up-arrow'},
			{img: 'arrowshapes_down-arrow', uno: 'ArrowShapes.down-arrow'},
			{img: 'arrowshapes_left-right-arrow', uno: 'ArrowShapes.left-right-arrow'},
			{img: 'arrowshapes_up-down-arrow', uno: 'ArrowShapes.up-down-arrow'},

			{img: 'arrowshapes_up-right-arrow', uno: 'ArrowShapes.up-right-arrow'},
			{img: 'arrowshapes_up-right-down-arrow', uno: 'ArrowShapes.up-right-down-arrow'},
			{img: 'arrowshapes_quad-arrow', uno: 'ArrowShapes.quad-arrow'},
			{img: 'arrowshapes_corner-right-arrow', uno: 'ArrowShapes.corner-right-arrow'},
			{img: 'arrowshapes_split-arrow', uno: 'ArrowShapes.split-arrow'},
			{img: 'arrowshapes_striped-right-arrow', uno: 'ArrowShapes.striped-right-arrow'},

			{img: 'arrowshapes_notched-right-arrow', uno: 'ArrowShapes.notched-right-arrow'},
			{img: 'arrowshapes_pentagon-right', uno: 'ArrowShapes.pentagon-right'},
			{img: 'arrowshapes_chevron', uno: 'ArrowShapes.chevron'},
			{img: 'arrowshapes_right-arrow-callout', uno: 'ArrowShapes.right-arrow-callout'},
			{img: 'arrowshapes_left-arrow-callout', uno: 'ArrowShapes.left-arrow-callout'},
			{img: 'arrowshapes_up-arrow-callout', uno: 'ArrowShapes.up-arrow-callout'},

			{img: 'arrowshapes_down-arrow-callout', uno: 'ArrowShapes.down-arrow-callout'},
			{img: 'arrowshapes_left-right-arrow-callout', uno: 'ArrowShapes.left-right-arrow-callout'},
			{img: 'arrowshapes_up-down-arrow-callout', uno: 'ArrowShapes.up-down-arrow-callout'},
			{img: 'arrowshapes_up-right-arrow-callout', uno: 'ArrowShapes.up-right-arrow-callout'},
			{img: 'arrowshapes_quad-arrow-callout', uno: 'ArrowShapes.quad-arrow-callout'},
			{img: 'arrowshapes_circular-arrow', uno: 'ArrowShapes.circular-arrow'},

			{img: 'arrowshapes_split-round-arrow', uno: 'ArrowShapes.split-round-arrow'},
			{img: 'arrowshapes_s-sharped-arrow', uno: 'ArrowShapes.s-sharped-arrow'}
		],

		'Stars and Banners': [
			{img: 'starshapes_bang', uno: 'StarShapes.bang'},
			{img: 'starshapes_star4', uno: 'StarShapes.star4'},
			{img: 'starshapes_star5', uno: 'StarShapes.star5'},
			{img: 'starshapes_star6', uno: 'StarShapes.star6'},
			{img: 'starshapes_star8', uno: 'StarShapes.star8'},
			{img: 'starshapes_star12', uno: 'StarShapes.star12'},

			{img: 'starshapes_star24', uno: 'StarShapes.star24'},
			{img: 'starshapes_concave-star6', uno: 'StarShapes.concave-star6'},
			{img: 'starshapes_vertical-scroll', uno: 'StarShapes.vertical-scroll'},
			{img: 'starshapes_horizontal-scroll', uno: 'StarShapes.horizontal-scroll'},
			{img: 'starshapes_signet', uno: 'StarShapes.signet'},
			{img: 'starshapes_doorplate', uno: 'StarShapes.doorplate'}
		],

		'Callouts': [
			{img: 'calloutshapes_rectangular-callout', uno: 'CalloutShapes.rectangular-callout'},
			{img: 'calloutshapes_round-rectangular-callout', uno: 'CalloutShapes.round-rectangular-callout'},
			{img: 'calloutshapes_round-callout', uno: 'CalloutShapes.round-callout'},
			{img: 'calloutshapes_cloud-callout', uno: 'CalloutShapes.cloud-callout'},
			{img: 'calloutshapes_line-callout-1', uno: 'CalloutShapes.line-callout-1'},
			{img: 'calloutshapes_line-callout-2', uno: 'CalloutShapes.line-callout-2'},
			{img: 'calloutshapes_line-callout-3', uno: 'CalloutShapes.line-callout-3'}
		],

		'Flowchart': [
			{img: 'flowchartshapes_flowchart-process', uno: 'FlowchartShapes.flowchart-process'},
			{img: 'flowchartshapes_flowchart-alternate-process', uno: 'FlowchartShapes.flowchart-alternate-process'},
			{img: 'flowchartshapes_flowchart-decision', uno: 'FlowchartShapes.flowchart-decision'},
			{img: 'flowchartshapes_flowchart-data', uno: 'FlowchartShapes.flowchart-data'},
			{img: 'flowchartshapes_flowchart-predefined-process', uno: 'FlowchartShapes.flowchart-predefined-process'},
			{img: 'flowchartshapes_flowchart-internal-storage', uno: 'FlowchartShapes.flowchart-internal-storage'},

			{img: 'flowchartshapes_flowchart-document', uno: 'FlowchartShapes.flowchart-document'},
			{img: 'flowchartshapes_flowchart-multidocument', uno: 'FlowchartShapes.flowchart-multidocument'},
			{img: 'flowchartshapes_flowchart-terminator', uno: 'FlowchartShapes.flowchart-terminator'},
			{img: 'flowchartshapes_flowchart-preparation', uno: 'FlowchartShapes.flowchart-preparation'},
			{img: 'flowchartshapes_flowchart-manual-input', uno: 'FlowchartShapes.flowchart-manual-input'},
			{img: 'flowchartshapes_flowchart-manual-operation', uno: 'FlowchartShapes.flowchart-manual-operation'},

			{img: 'flowchartshapes_flowchart-connector', uno: 'FlowchartShapes.flowchart-connector'},
			{img: 'flowchartshapes_flowchart-off-page-connector', uno: 'FlowchartShapes.flowchart-off-page-connector'},
			{img: 'flowchartshapes_flowchart-card', uno: 'FlowchartShapes.flowchart-card'},
			{img: 'flowchartshapes_flowchart-punched-tape', uno: 'FlowchartShapes.flowchart-punched-tape'},
			{img: 'flowchartshapes_flowchart-summing-junction', uno: 'FlowchartShapes.flowchart-summing-junction'},
			{img: 'flowchartshapes_flowchart-or', uno: 'FlowchartShapes.flowchart-or'},

			{img: 'flowchartshapes_flowchart-collate', uno: 'FlowchartShapes.flowchart-collate'},
			{img: 'flowchartshapes_flowchart-sort', uno: 'FlowchartShapes.flowchart-sort'},
			{img: 'flowchartshapes_flowchart-extract', uno: 'FlowchartShapes.flowchart-extract'},
			{img: 'flowchartshapes_flowchart-merge', uno: 'FlowchartShapes.flowchart-merge'},
			{img: 'flowchartshapes_flowchart-stored-data', uno: 'FlowchartShapes.flowchart-stored-data'},
			{img: 'flowchartshapes_flowchart-delay', uno: 'FlowchartShapes.flowchart-delay'},

			{img: 'flowchartshapes_flowchart-sequential-access', uno: 'FlowchartShapes.flowchart-sequential-access'},
			{img: 'flowchartshapes_flowchart-magnetic-disk', uno: 'FlowchartShapes.flowchart-magnetic-disk'},
			{img: 'flowchartshapes_flowchart-direct-access-storage', uno: 'FlowchartShapes.flowchart-direct-access-storage'},
			{img: 'flowchartshapes_flowchart-display', uno: 'FlowchartShapes.flowchart-display'}
		]
	},
	'insertconnectors': {
		'Connectors': [
			{img: 'connectors_connector', uno: 'Connector'},
			{img: 'connectors_connectorarrows', uno: 'ConnectorArrows'},
			{img: 'connectors_connectorarrowend', uno: 'ConnectorArrowEnd'},
			{img: 'connectors_connectorlinearrowend', uno: 'ConnectorLineArrowEnd'},
			{img: 'connectors_connectorcurvearrowend', uno: 'ConnectorCurveArrowEnd'},
			{img: 'connectors_connectorlinesarrowend', uno: 'ConnectorLinesArrowEnd'},
			{img: 'connectors_connectorline', uno: 'ConnectorLine'},
			{img: 'connectors_connectorcurve', uno: 'ConnectorCurve'},
			{img: 'connectors_connectorlines', uno: 'ConnectorLines'},
			{img: 'connectors_connectorlinearrows', uno: 'ConnectorLineArrows'},
			{img: 'connectors_connectorcurvearrows', uno: 'ConnectorCurvearrows'}
		]
	}
};

function createShapesPanel(shapeType) {
	const wrapper = document.createElement('div');
	wrapper.className = 'ui-grid-cell';
	wrapper.id = 'insertshape-wrapper';

	const grid = document.createElement('div');
	grid.className = 'insertshape-grid insertshapes';

	var collection = shapes[shapeType];

	for (var s in collection) {
		const rowHeader = document.createElement('div');
		rowHeader.className = 'row-header cool-font';
		rowHeader.textContent = _(s);
		grid.appendChild(rowHeader);

		const row = document.createElement('div');
		row.className = 'row';
		grid.appendChild(row);

		for (let idx = 0; idx < collection[s].length; ++idx) {
			const shape = collection[s][idx];

			const col = document.createElement('div');
			col.className = 'col w2ui-icon ' + shape.img;
			col.dataset.uno = shape.uno;
			row.appendChild(col);
		}
	}

	grid.onclick = function(e) {
		map.sendUnoCommand('.uno:' + e.target.dataset.uno);
		map._docLayer._closeMobileWizard();
	};

	wrapper.appendChild(grid);

	return wrapper;
}

var onShapeClickFunction = function(e) {
	app.map.sendUnoCommand('.uno:' + $(e.target).data().uno);
	closePopup();
	e.stopPropagation();
};

var onShapeKeyUpFunction = function(event) {
	if (event.code === 'Enter' || event.code === 'Space') {
		app.map.sendUnoCommand('.uno:' + event.target.dataset.uno);
		closePopup();
	}
	event.stopPropagation();
};

var onShapeKeyDownFunction = function(event) {
	if (event.code === 'Escape') {
		closePopup();
		app.map.focus();
	}
};

function insertShapes(shapeType, grid = document.getElementsByClassName('insertshape-grid')[0], width) {

	grid.classList.add(shapeType);

	if (window.mode.isDesktop() || window.mode.isTablet())
		grid.style.marginBottom = '0px';

	if (grid.firstChild)
		return;

	var collection = shapes[shapeType];

	for (let s in collection) {
		const rowHeader = document.createElement('div');
		rowHeader.className = 'row-header cool-font';
		rowHeader.textContent = _(s);
		grid.appendChild(rowHeader);

		var rows = Math.ceil(collection[s].length / width);
		var idx = 0;
		const row = document.createElement('div');
		row.className = 'row';
		grid.appendChild(row);
		for (let r = 0; r < rows; r++) {

			for (let c = 0; c < width; c++) {
				if (idx >= collection[s].length) {
					break;
				}

				const shape = collection[s][idx++];
				const col = document.createElement('div');

				col.className = 'col w2ui-icon ' + shape.img;
				col.dataset.uno = shape.uno;
				col.tabIndex = 0;
				col.setAttribute('index', r + ':' + c);
				row.appendChild(col);
			}

			if (idx >= collection[s].length)
				break;
		}
	}
}

function getShapesPopupElements(closeCallback) {
	lastClosePopupCallback = closeCallback;

	const grid = document.createElement('div');
	grid.className = 'insertshape-grid';
	grid.onclick = onShapeClickFunction;
	grid.onkeyup = onShapeKeyUpFunction;
	grid.onkeydown = onShapeKeyDownFunction;

	const container = document.createElement('div');
	container.appendChild(grid);

	insertShapes('insertshapes', container.children[0], 10);

	const wrapperContainer = document.createElement('div');

	const wrapper = document.createElement('div');
	wrapper.id = 'insertshape-wrapper';

	wrapperContainer.appendChild(wrapper);

	const popUp = document.createElement('div');
	popUp.id = 'insertshape-popup';
	popUp.className = 'insertshape-pop ui-widget ui-corner-all';

	wrapperContainer.appendChild(popUp);

	popUp.appendChild(grid);

	return wrapperContainer;
}

function getConnectorsPopupElements(closeCallback) {
	lastClosePopupCallback = closeCallback;

	const gridContainer = document.createElement('div');

	const grid = document.createElement('div');
	grid.className = 'insertshape-grid';
	grid.onclick = onShapeClickFunction;
	grid.onkeyup = onShapeKeyUpFunction;
	grid.onkeydown = onShapeKeyDownFunction;

	gridContainer.appendChild(grid);

	insertShapes('insertconnectors', gridContainer.children[0], 2);


	const wrapperContainer = document.createElement('div');
	const wrapper = document.createElement('div');

	wrapper.id = 'insertshape-wrapper';

	const popUp = document.createElement('div');
	popUp.id = 'insertshape-popup';
	popUp.className = 'insertshape-pop ui-widget ui-corner-all';

	wrapperContainer.appendChild(wrapper);
	wrapperContainer.appendChild(popUp);
	popUp.appendChild(grid);

	return wrapperContainer;
}

function getColorPickerElements(id) {
	const div = document.createElement('div');
	div.id = id + '-wrapper';
	return div;
}

function getColorPickerData(type) {
	var uno;
	if (type === 'Font Color') {
		if (map.getDocType() === 'spreadsheet' ||
		    map.getDocType() === 'presentation')
			uno = '.uno:Color';
		else
			uno = '.uno:FontColor';
	} else if (type === 'Highlight Color') {
		if (map.getDocType() === 'spreadsheet')
			uno = '.uno:BackgroundColor';
		else
			uno = '.uno:CharBackColor';
	}
	var data = {
		id: 'colorpicker',
		type: 'window',
		text: _(type),
		enabled: 'true',
		children: [
			{
				type: 'toolitem',
				text: '',
				command: uno,
				nosubmenu: true
			}
		],
		vertical: 'true'
	};
	return data;
}

function setupSearchInput() {
	$('#search-input').off('input', onSearchInput).on('input', onSearchInput);
	$('#search-input').off('keydown', onSearchKeyDown).on('keydown', onSearchKeyDown);
	$('#search-input').off('focus', onSearchFocus).on('focus', onSearchFocus);
	$('#search-input').off('blur', onSearchBlur).on('blur', onSearchBlur);
}

function unoCmdToToolbarId(commandname)
{
	var id = commandname.toLowerCase().substr(5);
	var selectionType = 'text';

	if (map._clip && map._clip._selectionType)
		selectionType = map._clip._selectionType;

	if (map.getDocType() === 'spreadsheet') {
		switch (id) {
		case 'alignleft':
			id = 'leftpara';
			break;
		case 'alignhorizontalcenter':
			id = 'centerpara';
			break;
		case 'alignright':
			id = 'rightpara';
			break;
		}
	}
	else if (selectionType == 'complex') {

		// ignore the text align state messages.
		if (id === 'leftpara' || id === 'rightpara' ||
			id === 'centerpara') {
			id = '';
		}

		// convert the object align statemessages to align button ids.
		switch (id) {
		case 'objectalignleft':
			id = 'leftpara';
			break;
		case 'aligncenter':
			id = 'centerpara';
			break;
		case 'objectalignright':
			id = 'rightpara';
			break;
		}
	}
	else if (id === 'objectalignleft' || id === 'aligncenter' ||
		id === 'objectalignright') {
		// selectionType is 'text', so ignore object align state messages.
		id = '';
	}

	if (id === 'hyperlinkdialog')
		id = 'link';

	return id;
}

function updateSearchButtons() {
	var toolbar = window.mode.isMobile() ? app.map.mobileSearchBar: app.map.statusBar;
	if (!toolbar) {
		console.debug('Cannot find search bar');
		return;
	}

	// conditionally disabling until, we find a solution for tdf#108577
	if (L.DomUtil.get('search-input').value === '') {
		toolbar.enableItem('searchprev', false);
		toolbar.enableItem('searchnext', false);
		toolbar.showItem('cancelsearch', false);
	} else {
		toolbar.enableItem('searchprev', true);
		toolbar.enableItem('searchnext', true);
		toolbar.showItem('cancelsearch', true);
	}
}

function onSearchInput() {
	updateSearchButtons();
	if (map.getDocType() === 'text') {
		// perform the immediate search in Writer
		map.search(L.DomUtil.get('search-input').value, false, '', 0, true /* expand search */);
	}
}

function onSearchKeyDown(e) {
	var entry = L.DomUtil.get('search-input');
	if ((e.keyCode === 71 && e.ctrlKey) || e.keyCode === 114 || e.keyCode === 13) {
		if (e.shiftKey) {
			map.search(entry.value, true);
		} else {
			map.search(entry.value);
		}
		e.preventDefault();
	} else if (e.ctrlKey && e.keyCode === 70) {
		entry.focus();
		entry.select();
		e.originalEvent.preventDefault();
	} else if (e.keyCode === 27) {
		map.cancelSearch();
	}
}

function onSearchFocus() {
	// Start searching.
	map.fire('searchstart');

	updateSearchButtons();
}

function onSearchBlur() {
	map._onGotFocus();
}

function onInsertGraphic() {
	var insertGraphic = L.DomUtil.get('insertgraphic');
	if ('files' in insertGraphic) {
		for (var i = 0; i < insertGraphic.files.length; i++) {
			var file = insertGraphic.files[i];
			map.insertGraphic(file);
		}
	}

	// Set the value to null everytime so that onchange event is triggered,
	// even if the same file is selected
	insertGraphic.value = null;
	return false;
}

function onInsertMultimedia() {
	var insertMultimedia = L.DomUtil.get('insertmultimedia');
	if ('files' in insertMultimedia) {
		for (var i = 0; i < insertMultimedia.files.length; i++) {
			var file = insertMultimedia.files[i];
			map.insertMultimedia(file);
		}
	}

	// Set the value to null everytime so that onchange event is triggered,
	// even if the same file is selected
	insertMultimedia.value = null;
	return false;
}

function onInsertBackground() {
	var selectBackground = L.DomUtil.get('selectbackground');
	if ('files' in selectBackground) {
		for (var i = 0; i < selectBackground.files.length; i++) {
			var file = selectBackground.files[i];
			map.selectBackground(file);
		}
	}

	// Set the value to null everytime so that onchange event is triggered,
	// even if the same file is selected
	selectBackground.value = null;
	return false;
}

function onWopiProps(e) {
	if (e.DisableCopy) {
		$('#addressInput input').bind('copy', function(evt) {
			evt.preventDefault();
		});
	}
}

function processStateChangedCommand(commandName, state) {
	var toolbar = window.mode.isMobile() ? app.map.mobileBottomBar : app.map.topToolbar;
	if (!toolbar)
		return;

	var color, div;

	if (!commandName)
		return;

	if (commandName === '.uno:AssignLayout') {
		$('.styles-select').val(state).trigger('change');
	}
	else if (commandName === '.uno:FontColor' || commandName === '.uno:Color') {
		if (!toolbar) return;
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		color = parseInt(state);
		if (color === -1) {
			color = 'transparent';
		}
		else {
			color = color.toString(16);
			color = '#' + Array(7 - color.length).join('0') + color;
		}

		div = L.DomUtil.get('fontcolorindicator');
		if (div) {
			L.DomUtil.setStyle(div, 'background', color);
		}
	}
	else if (commandName === '.uno:BackgroundColor' || commandName === '.uno:CharBackColor') {
		if (!toolbar) return;
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		color = parseInt(state);
		if (color === -1) {
			color = 'transparent';
		}
		else {
			color = color.toString(16);
			color = '#' + Array(7 - color.length).join('0') + color;
		}

		div = L.DomUtil.get('backcolorindicator');
		if (div) {
			L.DomUtil.setStyle(div, 'background', color);
		}
	}
	else if (commandName === '.uno:ModifiedStatus') {
		if (document.getElementById('save')) {
			if (state === 'true' && map.saveState)
				map.saveState.showModifiedStatus();
			else
				document.getElementById('save').classList.remove('savemodified');
		}
		state = ''; // stop processing below
	}
	else if (commandName === '.uno:DocumentRepair') {
		if (state === 'true') {
			toolbar.enableItem('repair', true);
		} else {
			toolbar.enableItem('repair', false);
		}
	}

	if (commandName === '.uno:SpacePara1' || commandName === '.uno:SpacePara15'
		|| commandName === '.uno:SpacePara2') {
		// TODO
		//if (toolbar) toolbar.refresh();
	}

	var id = unoCmdToToolbarId(commandName);
	// id is set to '' by unoCmdToToolbarId() if the statechange message should be ignored.
	if (id === '')
		return;

	if (state === 'true') {
		if (map.isEditMode()) {
			toolbar.enableItem(id, true);
		}
		// TODO: toolbar.check(id);
	}
	else if (state === 'false') {
		if (map.isEditMode()) {
			toolbar.enableItem(id, true);
		}
		// TODO: toolbar.uncheck(id);
	}
	// Change the toolbar button states if we are in editmode
	// If in non-edit mode, will be taken care of when permission is changed to 'edit'
	else if (map.isEditMode() && (state === 'enabled' || state === 'disabled')) {
		if (state === 'enabled') {
			toolbar.enableItem(id, true);
		} else {
			// TODO: toolbar.uncheck(id);
			toolbar.enableItem(id, false);
		}
	}
}

function onCommandStateChanged(e) {
	processStateChangedCommand(e.commandName, e.state);
}

function onUpdateParts(e) {
	if (e.docType === 'text') {
		var current = e.currentPage;
		var count = e.pages;
	}
	else {
		current = e.selectedPart;
		count = e.parts;
	}

	// TODO
	var toolbar = null;
	if (!toolbar) {
		return;
	}

	if (!window.mode.isMobile()) {
		if (e.docType === 'presentation') {
			// TODO
			//toolbar.set('prev', {hint: _('Previous slide')});
			//toolbar.set('next', {hint: _('Next slide')});
		}
		else {
			toolbar.showItem('presentation', false);
			toolbar.showItem('insertpage', false);
			toolbar.showItem('duplicatepage', false);
			toolbar.showItem('deletepage', false);
		}
	}

	if (app.file.fileBasedView) {
		toolbar.enableItem('prev', true);
		toolbar.enableItem('next', true);
		return;
	}

	if (e.docType !== 'spreadsheet') {
		if (current === 0) {
			toolbar.enableItem('prev', false);
		}
		else {
			toolbar.enableItem('prev', true);
		}

		if (current === count - 1) {
			toolbar.enableItem('next', false);
		}
		else {
			toolbar.enableItem('next', true);
		}
	}
}

function onCommandResult(e) {
	var commandName = e.commandName;

	if (commandName === '.uno:Save') {
		if (e.success) {
			// Saved a new version; the document is modified.
			map._everModified = true;

			// document is saved for rename
			if (map._renameFilename) {
				var renameFilename = map._renameFilename;
				map._renameFilename = '';
				map.renameFile(renameFilename);
			}
		}
		var postMessageObj = {
			success: e.success
		};
		if (!e.success) {
			// add the result reason string if failed
			postMessageObj['result'] = e.result && e.result.value;
		}

		map.fire('postMessage', {msgId: 'Action_Save_Resp', args: postMessageObj});
	}
	else if ((commandName === '.uno:Undo' || commandName === '.uno:Redo') &&
		e.success === true && e.result.value && !isNaN(e.result.value)) { /*UNDO_CONFLICT*/
		var alertOptions = {
			messages: [
				_('Conflict Undo/Redo with multiple users. Please use document repair to resolve')
			],
		};
		JSDialog.showInfoModalWithOptions('undo-conflict-error', alertOptions);
	} else if (map.zotero &&
		((commandName === '.uno:DeleteTextFormField' && e.result.DeleteTextFormField.startsWith('ADDIN ZOTERO_')) ||
		(commandName === '.uno:DeleteField' && e.result.DeleteField.startsWith('ZOTERO_')) ||
		(commandName === '.uno:DeleteSection' && e.result.DeleteSection.startsWith('ZOTERO_BIBL')))) {
		if (commandName === '.uno:DeleteSection')
			map.zotero.markBibliographyStyleHasBeenSet(true);
		map.zotero.handleRefreshCitationsAndBib(false);
	} else if (map.zotero && commandName === '.uno:DeleteBookmark' && e.result.DeleteBookmark.startsWith('ZOTERO_BREF_')) {
		map.zotero.setCustomProperty(e.result.DeleteBookmark, '');
		map.zotero.handleRefreshCitationsAndBib(false);
	} else if (commandName === '.uno:OpenHyperlink') {
		// allow to process other incoming messages first
		setTimeout(function () {
			map._docLayer.scrollToPos(new app.definitions.simplePoint(app.file.textCursor.rectangle.x1, app.file.textCursor.rectangle.y1));
		}, 0);
	}
}

function onUpdatePermission(e) {
	var toolbar = window.mode.isMobile() ? app.map.mobileBottomBar : app.map.topToolbar;
	if (toolbar) {
		// always enabled items
		var enabledButtons = ['closemobile', 'undo', 'redo', 'hamburger-tablet'];

		// copy the first array
		var items = toolbar.getToolItems(app.map.getDocType()).slice();
		for (var idx in items) {
			var found = enabledButtons.filter(function(id) { return id === items[idx].id; });
			var alwaysEnable = found.length !== 0;

			if (e.detail.perm === 'edit') {
				var unoCmd = map.getDocType() === 'spreadsheet' ? items[idx].unosheet : getUNOCommand(items[idx].uno);
				var keepDisabled = map['stateChangeHandler'].getItemValue(unoCmd) === 'disabled';
				if (!keepDisabled || alwaysEnable)
					toolbar.enableItem(items[idx].id, true);
				$('.main-nav').removeClass('readonly');
				$('#toolbar-down').removeClass('readonly');
			} else if (!alwaysEnable) {
				$('.main-nav').addClass('readonly');
				$('#toolbar-down').addClass('readonly');
				toolbar.enableItem(items[idx].id, false);
			}
		}

		if (e.detail.perm === 'edit') {
			$('#toolbar-mobile-back').removeClass('editmode-off');
			$('#toolbar-mobile-back').addClass('editmode-on');
			toolbar.updateItem({id: 'closemobile', type: 'customtoolitem', w2icon: 'editmode'});
		} else {
			$('#toolbar-mobile-back').removeClass('editmode-on');
			$('#toolbar-mobile-back').addClass('editmode-off');
			toolbar.updateItem({id: 'closemobile', type: 'customtoolitem', w2icon: 'closemobile'});
		}
	}
}

function editorUpdate(e) { // eslint-disable-line no-unused-vars
	var docLayer = map._docLayer;

	if (e.target.checked) {
		var editorId = docLayer._editorId;
		app.setFollowingEditor(editorId);
		if (editorId !== -1 && editorId !== docLayer._viewId)
			map._goToViewId(editorId);
	}
	else
		app.setFollowingOff();

	map.userList.hideTooltip();
}

global.editorUpdate = editorUpdate;

$(document).ready(function() {
	// Attach insert file action
	$('#insertgraphic').on('change', onInsertGraphic);
	$('#insertmultimedia').on('change', onInsertMultimedia);
	$('#selectbackground').on('change', onInsertBackground);
});

function setupToolbar(e) {
	map = e;

	map.on('focussearch', function () {
		var entry = L.DomUtil.get('search-input');
		entry.focus();
		entry.select();
	});

	map.on('search', function (e) {
		var searchInput = L.DomUtil.get('search-input');
		var toolbar = window.mode.isMobile() ? app.map.mobileSearchBar: app.map.statusBar;
		if (!toolbar) {
			console.debug('Cannot find search bar');
			return;
		}
		if (e.count === 0) {
			toolbar.enableItem('searchprev', false);
			toolbar.enableItem('searchnext', false);
			toolbar.showItem('cancelsearch', false);
			L.DomUtil.addClass(searchInput, 'search-not-found');
			$('#findthis').addClass('search-not-found');
			map.resetSelection();
			setTimeout(function () {
				$('#findthis').removeClass('search-not-found');
				L.DomUtil.removeClass(searchInput, 'search-not-found');
			}, 800);
		}
	});

	map.on('hyperlinkclicked', function (e) {
		if (e.url) {
			if (e.coordinates) {
				// Coordinates contains a list of numbers, 0-1 top-left of the cell with the hyperlink
				// 2-3 size of the cell, 4-5 number of th cell, 6-7 are the position of the click
				var strTwips = e.coordinates.match(/\d+/g);
				var linkPosition;
				if (strTwips.length > 7) {
					linkPosition = new app.definitions.simplePoint(parseInt(strTwips[6]), parseInt(strTwips[7]));
				}
				app.definitions.urlPopUpSection.showURLPopUP(e.url, new app.definitions.simplePoint(parseInt(strTwips[6]), parseInt(strTwips[1])), linkPosition);
			} else {
				map.fire('warn', {url: e.url, map: map, cmd: 'openlink'});
			}
		}
	});

	app.events.on('updatepermission', onUpdatePermission);
	map.on('wopiprops', onWopiProps);
	map.on('commandresult', onCommandResult);
	map.on('updateparts pagenumberchanged', onUpdateParts);

	if (map.options.wopi && L.Params.closeButtonEnabled && !window.mode.isMobile()) {
		$('#closebuttonwrapper').css('display', 'block');
		$('#closebutton').prop('title', _('Close document'));
		map.uiManager.enableTooltip($('#closebutton'));
	} else if (!L.Params.closeButtonEnabled) {
		$('#closebuttonwrapper').hide();
		$('#closebuttonwrapperseparator').hide();
	} else if (L.Params.closeButtonEnabled && !window.mode.isMobile()) {
		$('#closebuttonwrapper').css('display', 'block');
	}

	$('#closebutton').click(function () {
		let dispatcher = global.app.dispatcher;
		if (!dispatcher)
			dispatcher = new app.definitions['dispatcher']('global');

		dispatcher.dispatch('closeapp');
	});
}

global.setupToolbar = setupToolbar;
global.insertTable = insertTable;
global.getInsertTablePopupElements = getInsertTablePopupElements;
global.sendInsertTableFunction = sendInsertTableFunction;
global.highlightTableFunction = highlightTableFunction;
global.getShapesPopupElements = getShapesPopupElements;
global.getConnectorsPopupElements = getConnectorsPopupElements;
global.onShapeClickFunction = onShapeClickFunction;
global.onShapeKeyUpFunction = onShapeKeyUpFunction;
global.onShapeKeyDownFunction = onShapeKeyDownFunction;
global.createShapesPanel = createShapesPanel;
global.onUpdatePermission = onUpdatePermission;
global.setupSearchInput = setupSearchInput;
global.getUNOCommand = getUNOCommand;
global.unoCmdToToolbarId = unoCmdToToolbarId;
global.onCommandStateChanged = onCommandStateChanged;
global.processStateChangedCommand = processStateChangedCommand;
global.getColorPickerElements = getColorPickerElements;
global.onUpdateParts = onUpdateParts;
global.getColorPickerData = getColorPickerData;
}(window));
