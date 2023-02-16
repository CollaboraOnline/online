/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Collabora Online toolbar
 */

/* global app $ w2ui _ */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/
(function(global) {

var map;

function _cancelSearch() {
	var toolbar = window.mode.isMobile() ? w2ui['searchbar'] : w2ui['actionbar'];
	var searchInput = L.DomUtil.get('search-input');
	map.resetSelection();
	toolbar.hide('cancelsearch');
	toolbar.disable('searchprev');
	toolbar.disable('searchnext');
	searchInput.value = '';
	if (window.mode.isMobile()) {
		searchInput.focus();
		// odd, but on mobile we need to invoke it twice
		toolbar.hide('cancelsearch');
	}

	map._onGotFocus();
}

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

function onClose() {
	if (window.ThisIsAMobileApp) {
		window.postMobileMessage('BYE');
	} else {
		map.fire('postMessage', {msgId: 'close', args: {EverModified: map._everModified, Deprecated: true}});
		map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: map._everModified}});
	}
	if (!map._disableDefaultAction['UI_Close']) {
		map.remove();
	}
}

function getToolbarItemById(id) {
	var item;
	if (w2ui['editbar'].get(id) !== null) {
		var toolbar = w2ui['editbar'];
		item = toolbar.get(id);
	}
	else if ('actionbar' in w2ui && w2ui['actionbar'].get(id) !== null) {
		toolbar = w2ui['actionbar'];
		item = toolbar.get(id);
	}
	else if (w2ui['searchbar'].get(id) !== null) {
		toolbar = w2ui['searchbar'];
		item = toolbar.get(id);
	}
	else {
		throw new Error('unknown id: ' + id);
	}
	return item;
}

function onClick(e, id, item) {
	// dont reassign the item if we already have it
	item = item || getToolbarItemById(id);

	// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
	if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
		map.focus(map.canAcceptKeyboardInput()); // Maintain same keyboard state.
	}

	if (item.disabled) {
		return;
	}

	if (item.postmessage && item.type === 'button') {
		map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: item.id} });
	}
	else if (item.uno) {
		if (id === 'save') {
			map.fire('postMessage', {msgId: 'UI_Save', args: { source: 'toolbar' }});
		}
		if (item.unosheet && map.getDocType() === 'spreadsheet') {
			map.toggleCommandState(item.unosheet);
		}
		else {
			map.toggleCommandState(getUNOCommand(item.uno));
		}
	}
	else if (id === 'print') {
		map.print();
	}
	else if (id === 'save') {
		// Save only when not read-only.
		if (!map.isReadOnlyMode()) {
			map.fire('postMessage', {msgId: 'UI_Save', args: { source: 'toolbar' }});
			if (!map._disableDefaultAction['UI_Save']) {
				map.save(false /* An explicit save should terminate cell edit */, false /* An explicit save should save it again */);
			}
		}
	}
	else if (id === 'repair') {
		app.socket.sendMessage('commandvalues command=.uno:DocumentRepair');
	}
	else if (id === 'showsearchbar') {
		$('#toolbar-down').hide();
		$('#tb_editbar_item_showsearchbar .w2ui-button').removeClass('over');
		$('#toolbar-search').show();
		L.DomUtil.get('search-input').focus();
	}
	else if ((id === 'presentation' || id === 'fullscreen-presentation') && map.getDocType() === 'presentation') {
		map.fire('fullscreen');
	}
	else if (id === 'insertannotation') {
		map.insertComment();
	}
	else if (id === 'insertgraphic' || item.id === 'localgraphic') {
		L.DomUtil.get('insertgraphic').click();
	}
	else if (item.id === 'remotegraphic') {
		map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
	}
	else if (id === 'fontcolor' && typeof e.color === 'undefined') {
		map.fire('mobilewizard', {data: getColorPickerData('Font Color')});
	}
	else if (id === 'backcolor' && typeof e.color === 'undefined') {
		map.fire('mobilewizard', {data: getColorPickerData('Highlight Color')});
	}
	else if (id === 'fontcolor' && typeof e.color !== 'undefined') {
		onColorPick(id, e.color);
	}
	else if (id === 'backcolor' && typeof e.color !== 'undefined') {
		onColorPick(id, e.color);
	}
	else if (id === 'backgroundcolor' && typeof e.color !== 'undefined') {
		onColorPick(id, e.color);
	}
	else if (id === 'fold' || id === 'hamburger-tablet') {
		map.uiManager.toggleMenubar();
	}
	else if (id === 'close' || id === 'closemobile') {
		map.uiManager.enterReadonlyOrClose();
	}
	else if (id === 'link') {
		map.showHyperlinkDialog();
	}
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
function closePopup() {
	if ($('#w2ui-overlay-editbar').length > 0) {
		$('#w2ui-overlay-editbar').removeData('keepOpen')[0].hide();
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

function getBorderStyleMenuHtml() {
	return '<table id="setborderstyle-grid"><tr><td class="w2ui-tb-image w2ui-icon frame01" onclick="setBorderStyle(1)"></td>' +
	'<td class="w2ui-tb-image w2ui-icon frame02" onclick="setBorderStyle(2)"></td><td class="w2ui-tb-image w2ui-icon frame03" onclick="setBorderStyle(3)"></td>' +
	'<td class="w2ui-tb-image w2ui-icon frame04" onclick="setBorderStyle(4)"></td></tr><tr><td class="w2ui-tb-image w2ui-icon frame05" onclick="setBorderStyle(5)"></td>' +
	'<td class="w2ui-tb-image w2ui-icon frame06" onclick="setBorderStyle(6)"></td><td class="w2ui-tb-image w2ui-icon frame07" onclick="setBorderStyle(7)"></td>' +
	'<td class="w2ui-tb-image w2ui-icon frame08" onclick="setBorderStyle(8)"></td></tr><tr><td class="w2ui-tb-image w2ui-icon frame09" onclick="setBorderStyle(9)"></td>' +
	'<td class="w2ui-tb-image w2ui-icon frame10" onclick="setBorderStyle(10)"></td><td class="w2ui-tb-image w2ui-icon frame11" onclick="setBorderStyle(11)"></td>' +
	'<td class="w2ui-tb-image w2ui-icon frame12" onclick="setBorderStyle(12)"></td></tr><tr>' +
	'<td colspan="4" class="w2ui-tb-image w2ui-icon frame13" onclick="setBorderStyle(0)"><div id="div-frame13">' + _('More...') + '</div></td></tr></table>';
}

global.getBorderStyleMenuHtml = getBorderStyleMenuHtml;

function setConditionalFormatIconSet(num) {
	var params = {
		IconSet: {
			type : 'short',
			value : num
		}};
	map.sendUnoCommand('.uno:IconSetFormatDialog', params);

	closePopup();
}

global.setConditionalFormatIconSet = setConditionalFormatIconSet;

function getConditionalFormatMenuHtml(more) {
	var table = '<table id="conditionalformatmenu-grid"><tr>' +
	'<td class="w2ui-tb-image w2ui-icon iconset00" onclick="setConditionalFormatIconSet(0)"/><td class="w2ui-tb-image w2ui-icon iconset01" onclick="setConditionalFormatIconSet(1)"/><td class="w2ui-tb-image w2ui-icon iconset02" onclick="setConditionalFormatIconSet(2)"/></tr><tr>' +
	'<td class="w2ui-tb-image w2ui-icon iconset03" onclick="setConditionalFormatIconSet(3)"/><td class="w2ui-tb-image w2ui-icon iconset04" onclick="setConditionalFormatIconSet(4)"/><td class="w2ui-tb-image w2ui-icon iconset05" onclick="setConditionalFormatIconSet(5)"/></tr><tr>' +
	'<td class="w2ui-tb-image w2ui-icon iconset06" onclick="setConditionalFormatIconSet(6)"/><td class="w2ui-tb-image w2ui-icon iconset08" onclick="setConditionalFormatIconSet(8)"/><td class="w2ui-tb-image w2ui-icon iconset09" onclick="setConditionalFormatIconSet(9)"/></tr><tr>' + // iconset07 deliberately left out, see the .css for the reason
	'<td class="w2ui-tb-image w2ui-icon iconset10" onclick="setConditionalFormatIconSet(10)"/><td class="w2ui-tb-image w2ui-icon iconset11" onclick="setConditionalFormatIconSet(11)"/><td class="w2ui-tb-image w2ui-icon iconset12" onclick="setConditionalFormatIconSet(12)"/></tr><tr>' +
	'<td class="w2ui-tb-image w2ui-icon iconset13" onclick="setConditionalFormatIconSet(13)"/><td class="w2ui-tb-image w2ui-icon iconset14" onclick="setConditionalFormatIconSet(14)"/><td class="w2ui-tb-image w2ui-icon iconset15" onclick="setConditionalFormatIconSet(15)"/></tr><tr>' +
	'<td class="w2ui-tb-image w2ui-icon iconset16" onclick="setConditionalFormatIconSet(16)"/><td class="w2ui-tb-image w2ui-icon iconset17" onclick="setConditionalFormatIconSet(17)"/><td class="w2ui-tb-image w2ui-icon iconset18" onclick="setConditionalFormatIconSet(18)"/></tr><tr>' +
	'<td class="w2ui-tb-image w2ui-icon iconset19" onclick="setConditionalFormatIconSet(19)"/><td class="w2ui-tb-image w2ui-icon iconset20" onclick="setConditionalFormatIconSet(20)"/><td class="w2ui-tb-image w2ui-icon iconset21" onclick="setConditionalFormatIconSet(21)"/></tr>';
	if (more) {
		table += '<tr><td id="' + more + '">' + _('More...') + '</td></tr>';
	}
	table += '</table>';
	return table;
}

global.getConditionalFormatMenuHtml = getConditionalFormatMenuHtml;

function getInsertTablePopupHtml() {
	return '<div id="inserttable-wrapper">\
					<div id="inserttable-popup" class="inserttable-pop ui-widget ui-corner-all">\
						<div class="inserttable-grid"></div>\
						<div id="inserttable-status" class="cool-font" style="padding: 5px;"><br/></div>\
					</div>\
				</div>';
}

function insertTable() {
	var rows = 10;
	var cols = 10;
	var $grid = $('.inserttable-grid');
	var $status = $('#inserttable-status');

	// init
	for (var r = 0; r < rows; r++) {
		var $row = $('<div/>').addClass('row');
		$grid.append($row);
		for (var c = 0; c < cols; c++) {
			var $col = $('<div/>').addClass('col');
			$row.append($col);
		}
	}

	// events
	$grid.on({
		mouseover: function () {
			var col = $(this).index() + 1;
			var row = $(this).parent().index() + 1;
			$('.col').removeClass('bright');
			$('.row:nth-child(-n+' + row + ') .col:nth-child(-n+' + col + ')')
				.addClass('bright');
			$status.html(col + 'x' + row);

		},
		click: function() {
			var col = $(this).index() + 1;
			var row = $(this).parent().index() + 1;
			$('.col').removeClass('bright');
			$status.html('<br/>');
			var msg = 'uno .uno:InsertTable {' +
				' "Columns": { "type": "long","value": '
				+ col +
				' }, "Rows": { "type": "long","value": '
				+ row + ' }}';

			app.socket.sendMessage(msg);

			closePopup();
		}
	}, '.col');
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
	var $grid = $('<div/>').addClass('insertshape-grid');
	var collection = shapes[shapeType];

	for (var s in collection) {
		var $rowHeader = $('<div/>').addClass('row-header cool-font').append(_(s));
		$grid.append($rowHeader);
		var $row = $('<div/>').addClass('row');
		$grid.append($row);
		for (var idx = 0; idx < collection[s].length; ++idx) {
			var shape = collection[s][idx];
			var $col = $('<div/>').addClass('col w2ui-icon').addClass(shape.img);
			$col.data('uno', shape.uno);
			$row.append($col);
		}
	}

	$grid.on({
		click: function(e) {
			map.sendUnoCommand('.uno:' + $(e.target).data().uno);
			map._docLayer._closeMobileWizard();
		}
	});

	return $grid.get(0);
}

function insertShapes(shapeType) {
	var width = 10;
	var $grid = $('.insertshape-grid');
	$grid.addClass(shapeType);

	if (window.mode.isDesktop() || window.mode.isTablet())
		$grid.css('margin-botttom', '0px');

	if ($grid.children().length > 0)
		return;

	var collection = shapes[shapeType];

	for (var s in collection) {
		var $rowHeader = $('<div/>').addClass('row-header cool-font').append(_(s));
		$grid.append($rowHeader);

		var rows = Math.ceil(collection[s].length / width);
		var idx = 0;
		for (var r = 0; r < rows; r++) {
			var $row = $('<div/>').addClass('row');
			$grid.append($row);
			for (var c = 0; c < width; c++) {
				if (idx >= collection[s].length) {
					break;
				}
				var shape = collection[s][idx++];
				var $col = $('<div/>').addClass('col w2ui-icon').addClass(shape.img);
				$col.data('uno', shape.uno);
				$row.append($col);
			}

			if (idx >= collection[s].length)
				break;
		}
	}

	$grid.on({
		click: function(e) {
			map.sendUnoCommand('.uno:' + $(e.target).data().uno);
			closePopup();
		}
	});
}

function getShapesPopupHtml() {
	return '<div id="insertshape-wrapper">\
				<div id="insertshape-popup" class="insertshape-pop ui-widget ui-corner-all">\
					<div class="insertshape-grid"></div>\
				</div>\
			</div>';
}

function showColorPicker(id) {
	var it = w2ui['editbar'].get(id);
	var obj = w2ui['editbar'];
	var el = '#tb_editbar_item_' + id;
	if (it.transparent == null) it.transparent = true;
	$(el).w2color({ color: it.color, transparent: it.transparent }, function (color) {
		if (color != null) {
			obj.colorClick({ name: obj.name, item: it, color: color });
		}
		closePopup();
	});
}

function getColorPickerHTML(id) {
	return '<div id="' + id +'-wrapper' + '">\
			</div>';
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
		else if (map.getDocType() === 'presentation')
			uno = '.uno:CharBackColor';
		else
			uno = '.uno:BackColor';
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

function onColorPick(id, color) {
	if (!map.isEditMode()) {
		return;
	}
	// no fill or automatic color is -1
	if (color === '') {
		color = -1;
	}
	// transform from #FFFFFF to an Int
	else {
		color = parseInt(color.replace('#', ''), 16);
	}
	var command = {};
	var fontcolor, backcolor;
	if (id === 'fontcolor') {
		fontcolor = {'text': 'FontColor',
			     'spreadsheet': 'Color',
			     'presentation': 'Color'}[map.getDocType()];
		command[fontcolor] = {};
		command[fontcolor].type = 'long';
		command[fontcolor].value = color;
		var uno = '.uno:' + fontcolor;
	}
	// "backcolor" can be used in Writer and Impress and translates to "Highlighting" while
	// "backgroundcolor" can be used in Writer and Calc and translates to "Background color".
	else if (id === 'backcolor') {
		backcolor = {'text': 'BackColor',
			     'presentation': 'CharBackColor'}[map.getDocType()];
		command[backcolor] = {};
		command[backcolor].type = 'long';
		command[backcolor].value = color;
		uno = '.uno:' + backcolor;
	}
	else if (id === 'backgroundcolor') {
		backcolor = {'text': 'BackgroundColor',
			     'spreadsheet': 'BackgroundColor'}[map.getDocType()];
		command[backcolor] = {};
		command[backcolor].type = 'long';
		command[backcolor].value = color;
		uno = '.uno:' + backcolor;
	}
	map.sendUnoCommand(uno, command);
	map.focus();
}

function hideTooltip(toolbar, id) {
	if (toolbar.touchStarted) {
		setTimeout(function() {
			toolbar.tooltipHide(id, {});
		}, 5000);
		toolbar.touchStarted = false;
	}
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
	var toolbar = window.mode.isMobile() ? w2ui['searchbar'] : w2ui['actionbar'];
	// conditionally disabling until, we find a solution for tdf#108577
	if (L.DomUtil.get('search-input').value === '') {
		toolbar.disable('searchprev');
		toolbar.disable('searchnext');
		toolbar.hide('cancelsearch');
	}
	else {
		toolbar.enable('searchprev');
		toolbar.enable('searchnext');
		toolbar.show('cancelsearch');
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
		_cancelSearch();
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

function onInsertFile() {
	var insertGraphic = L.DomUtil.get('insertgraphic');
	if ('files' in insertGraphic) {
		for (var i = 0; i < insertGraphic.files.length; i++) {
			var file = insertGraphic.files[i];
			map.insertFile(file);
		}
	}

	// Set the value to null everytime so that onchange event is triggered,
	// even if the same file is selected
	insertGraphic.value = null;
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
		$('input#formulaInput').bind('copy', function(evt) {
			evt.preventDefault();
		});
		$('input#addressInput').bind('copy', function(evt) {
			evt.preventDefault();
		});
	}
}

function processStateChangedCommand(commandName, state) {
	var toolbar = w2ui['editbar'];
	var color, div;

	if (!commandName)
		return;

	if (commandName === '.uno:AssignLayout') {
		$('.styles-select').val(state).trigger('change');
	}
	else if (commandName === '.uno:FontColor' || commandName === '.uno:Color') {
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		color = parseInt(state);
		if (color === -1) {
			color = 'transparent';
		}
		else {
			color = color.toString(16);
			color = '#' + Array(7 - color.length).join('0') + color;
		}
		$('#tb_editbar_item_fontcolor table.w2ui-button .selected-color-classic').css('background-color', color);
		$('#tb_editbar_item_fontcolor .w2ui-tb-caption').css('display', 'none');

		div = L.DomUtil.get('fontcolorindicator');
		if (div) {
			L.DomUtil.setStyle(div, 'background', color);
		}
	}
	else if (commandName === '.uno:BackColor' || commandName === '.uno:BackgroundColor' || commandName === '.uno:CharBackColor') {
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		color = parseInt(state);
		if (color === -1) {
			color = 'transparent';
		}
		else {
			color = color.toString(16);
			color = '#' + Array(7 - color.length).join('0') + color;
		}
		//writer
		$('#tb_editbar_item_backcolor table.w2ui-button .selected-color-classic').css('background-color', color);
		$('#tb_editbar_item_backcolor .w2ui-tb-caption').css('display', 'none');

		//calc?
		$('#tb_editbar_item_backgroundcolor table.w2ui-button .selected-color-classic').css('background-color', color);
		$('#tb_editbar_item_backgroundcolor .w2ui-tb-caption').css('display', 'none');

		div = L.DomUtil.get('backcolorindicator');
		if (div) {
			L.DomUtil.setStyle(div, 'background', color);
		}
	}
	else if (commandName === '.uno:ModifiedStatus') {
		if (state === 'true') {
			w2ui['editbar'].set('save', {img:'savemodified'});
		}
		else {
			w2ui['editbar'].set('save', {img:'save'});
		}
	}
	else if (commandName === '.uno:DocumentRepair') {
		if (state === 'true') {
			toolbar.enable('repair');
		} else {
			toolbar.disable('repair');
		}
	}

	if (commandName === '.uno:SpacePara1' || commandName === '.uno:SpacePara15'
		|| commandName === '.uno:SpacePara2') {
		toolbar.refresh();
	}

	var id = unoCmdToToolbarId(commandName);
	// id is set to '' by unoCmdToToolbarId() if the statechange message should be ignored.
	if (id === '')
		return;

	if (state === 'true') {
		if (map.isEditMode()) {
			toolbar.enable(id);
		}
		toolbar.check(id);
	}
	else if (state === 'false') {
		if (map.isEditMode()) {
			toolbar.enable(id);
		}
		toolbar.uncheck(id);
	}
	// Change the toolbar button states if we are in editmode
	// If in non-edit mode, will be taken care of when permission is changed to 'edit'
	else if (map.isEditMode() && (state === 'enabled' || state === 'disabled')) {
		var toolbarUp = toolbar;
		if (state === 'enabled') {
			toolbarUp.enable(id);
		} else {
			toolbarUp.uncheck(id);
			toolbarUp.disable(id);
		}
	}
}

function onCommandStateChanged(e) {
	processStateChangedCommand(e.commandName, e.state);
}

function onUpdateParts(e) {
	$('#document-container').addClass(e.docType + '-doctype');
	if (e.docType === 'text') {
		var current = e.currentPage;
		var count = e.pages;
	}
	else {
		current = e.selectedPart;
		count = e.parts;
	}

	var toolbar = w2ui['actionbar'];
	if (!toolbar) {
		return;
	}

	if (!window.mode.isMobile()) {
		if (e.docType === 'presentation') {
			toolbar.set('prev', {hint: _('Previous slide')});
			toolbar.set('next', {hint: _('Next slide')});
		}
		else {
			toolbar.hide('presentation');
			toolbar.hide('insertpage');
			toolbar.hide('duplicatepage');
			toolbar.hide('deletepage');
		}
	}

	if (app.file.fileBasedView) {
		toolbar.enable('prev');
		toolbar.enable('next');
		return;
	}

	if (e.docType !== 'spreadsheet') {
		if (current === 0) {
			toolbar.disable('prev');
		}
		else {
			toolbar.enable('prev');
		}

		if (current === count - 1) {
			toolbar.disable('next');
		}
		else {
			toolbar.enable('next');
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
		$('#tb_editbar_item_repair').w2overlay({ html: '<div style="padding: 10px; line-height: 150%">' +
		_('Conflict Undo/Redo with multiple users. Please use document repair to resolve') + '</div>'});
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
	}
}

function onUpdatePermission(e) {
	var toolbar = w2ui['editbar'];
	if (toolbar) {
		// always enabled items
		var enabledButtons = ['closemobile', 'undo', 'redo', 'hamburger-tablet'];

		// copy the first array
		var items = toolbar.items.slice();
		for (var idx in items) {
			var found = enabledButtons.filter(function(id) { return id === items[idx].id; });
			var alwaysEnable = found.length !== 0;

			if (e.perm === 'edit') {
				var unoCmd = map.getDocType() === 'spreadsheet' ? items[idx].unosheet : getUNOCommand(items[idx].uno);
				var keepDisabled = map['stateChangeHandler'].getItemValue(unoCmd) === 'disabled';
				if (!keepDisabled || alwaysEnable) {
					toolbar.enable(items[idx].id);
				}
				$('.main-nav').removeClass('readonly');
				$('#toolbar-down').removeClass('readonly');
			} else if (!alwaysEnable) {
				$('.main-nav').addClass('readonly');
				$('#toolbar-down').addClass('readonly');
				toolbar.disable(items[idx].id);
			}
		}
		if (e.perm === 'edit') {
			$('#toolbar-mobile-back').removeClass('editmode-off');
			$('#toolbar-mobile-back').addClass('editmode-on');
			toolbar.set('closemobile', {img: 'editmode'});
		} else {
			$('#toolbar-mobile-back').removeClass('editmode-on');
			$('#toolbar-mobile-back').addClass('editmode-off');
			toolbar.set('closemobile', {img: 'closemobile'});
		}

	}
}

function editorUpdate(e) { // eslint-disable-line no-unused-vars
	var docLayer = map._docLayer;

	if (e.target.checked) {
		var editorId = docLayer._editorId;

		docLayer._followUser = false;
		docLayer._followEditor = true;
		if (editorId !== -1 && editorId !== docLayer._viewId) {
			map._goToViewId(editorId);
			docLayer._followThis = editorId;
		}

		var userlistItem = w2ui['actionbar'].get('userlist');
		if (userlistItem !== null) {
			$('.selected-user').removeClass('selected-user');
		}
	}
	else {
		docLayer._followEditor = false;
		docLayer._followThis = -1;
	}
	$('#tb_actionbar_item_userlist').w2overlay('');
	$('#userListPopover').hide();
}

global.editorUpdate = editorUpdate;

$(document).ready(function() {
	// Attach insert file action
	$('#insertgraphic').on('change', onInsertFile);
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
		var toolbar = w2ui['actionbar'];
		if (e.count === 0) {
			toolbar.disable('searchprev');
			toolbar.disable('searchnext');
			toolbar.hide('cancelsearch');
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
				var strTwips = e.coordinates.match(/\d+/g);
				var topLeftTwips = new L.Point(parseInt(strTwips[6]), parseInt(strTwips[1]));
				var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
				var bottomRightTwips = topLeftTwips.add(offset);
				var cellCursor = new L.LatLngBounds(
					map._docLayer._twipsToLatLng(topLeftTwips, map.getZoom()),
					map._docLayer._twipsToLatLng(bottomRightTwips, map.getZoom()));
				//click pos tweak
				cellCursor._northEast.lng = cellCursor._southWest.lng;
				map._docLayer._closeURLPopUp();
				map._docLayer._showURLPopUp(cellCursor._northEast, e.url);
			} else {
				map.fire('warn', {url: e.url, map: map, cmd: 'openlink'});
			}
		}
	});

	map.on('updatepermission', onUpdatePermission);
	map.on('wopiprops', onWopiProps);
	map.on('commandresult', onCommandResult);
	map.on('updateparts pagenumberchanged', onUpdateParts);

	if (map.options.wopi && L.Params.closeButtonEnabled && !window.mode.isMobile()) {
		$('#closebuttonwrapper').css('display', 'block');
		$('#closebuttonwrapper').prop('title', _('Close document'));
	} else if (!L.Params.closeButtonEnabled) {
		$('#closebuttonwrapper').hide();
	} else if (L.Params.closeButtonEnabled && !window.mode.isMobile()) {
		$('#closebuttonwrapper').css('display', 'block');
	}

	$('#closebutton').click(onClose);
}

function updateVisibilityForToolbar(toolbar, context) {
	if (!toolbar)
		return;

	var toShow = [];
	var toHide = [];

	toolbar.items.forEach(function(item) {
		if (window.ThisIsTheiOSApp && window.mode.isTablet() && item.iosapptablet === false) {
			toHide.push(item.id);
		}
		else if (((window.mode.isMobile() && item.mobile === false) || (window.mode.isTablet() && item.tablet === false) || (window.mode.isDesktop() && item.desktop === false) || (!window.ThisIsAMobileApp && item.mobilebrowser === false)) && !item.hidden) {
			toHide.push(item.id);
		}
		else if (((window.mode.isMobile() && item.mobile === true) || (window.mode.isTablet() && item.tablet === true) || (window.mode.isDesktop() && item.desktop === true) || (window.ThisIsAMobileApp && item.mobilebrowser === true)) && item.hidden) {
			toShow.push(item.id);
		}

		if (context && item.context) {
			if (item.context.indexOf(context) >= 0)
				toShow.push(item.id);
			else
				toHide.push(item.id);
		} else if (!context && item.context) {
			if (item.context.indexOf('default') >= 0)
				toShow.push(item.id);
			else
				toHide.push(item.id);
		}
	});

	window.app.console.log('explicitly hiding: ' + toHide);
	window.app.console.log('explicitly showing: ' + toShow);

	toHide.forEach(function(item) { toolbar.hide(item); });
	toShow.forEach(function(item) { toolbar.show(item); });
}

global.onClose = onClose;
global.setupToolbar = setupToolbar;
global.onClick = onClick;
global.hideTooltip = hideTooltip;
global.insertTable = insertTable;
global.getInsertTablePopupHtml = getInsertTablePopupHtml;
global.getShapesPopupHtml = getShapesPopupHtml;
global.insertShapes = insertShapes;
global.createShapesPanel = createShapesPanel;
global.onUpdatePermission = onUpdatePermission;
global.setupSearchInput = setupSearchInput;
global.getUNOCommand = getUNOCommand;
global.unoCmdToToolbarId = unoCmdToToolbarId;
global.onCommandStateChanged = onCommandStateChanged;
global.processStateChangedCommand = processStateChangedCommand;
global.showColorPicker = showColorPicker;
global.getColorPickerHTML = getColorPickerHTML;
global.updateVisibilityForToolbar = updateVisibilityForToolbar;
global.onUpdateParts = onUpdateParts;
}(window));
