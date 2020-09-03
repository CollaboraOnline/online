/* -*- js-indent-level: 8 -*- */
/*
 * LibreOffice Online toolbar
 */

/* global $ closebutton w2ui w2utils vex _ _UNO */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/
(function(global) {

var map;

function _useSimpleUI() {
	return L.Browser.mobile && $('#main-menu').css('display') === 'none';
}

function onDelete(e) {
	if (e !== false) {
		map.deletePage();
	}
}

var nUsers, oneUser, noUser;

function _mobilify() {
	var toolbarUp = w2ui['toolbar-up'];
	var statusbar = w2ui['toolbar-down'];

	toolbarUp.items.forEach(function(item) {
		if (item.mobile === false && !item.hidden) {
			toolbarUp.hide(item.id);
		}
	});

	statusbar.items.forEach(function(item) {
		if (item.mobile === false && !item.hidden) {
			statusbar.hide(item.id);
		}
	});
}

function resizeToolbar() {
	if ($(window).width() !== map.getSize().x) {
		var toolbarUp = w2ui['toolbar-up'];
		var statusbar = w2ui['toolbar-down'];
		toolbarUp.resize();
		statusbar.resize();
	}
}

function _cancelSearch() {
	var toolbar = w2ui['toolbar-down'];
	map.resetSelection();
	toolbar.hide('cancelsearch');
	toolbar.disable('searchprev');
	toolbar.disable('searchnext');
	L.DomUtil.get('search-input').value = '';
	map.focus();
}

function onClick(e, id, item, subItem) {
	if (w2ui['toolbar-up'].get(id) !== null) {
		var toolbar = w2ui['toolbar-up'];
		item = toolbar.get(id);
	}
	else if (w2ui.formulabar.get(id) !== null) {
		toolbar = w2ui.formulabar;
		item = toolbar.get(id);
	}
	else if ('document-signing-bar' in w2ui && w2ui['document-signing-bar'].get(id) !== null) {
		toolbar = w2ui['document-signing-bar'];
		item = toolbar.get(id);
	}
	else if (w2ui['toolbar-down'].get(id) !== null) {
		toolbar = w2ui['toolbar-down'];
		item = toolbar.get(id);
	}
	else if (w2ui['spreadsheet-toolbar'].get(id) !== null) {
		toolbar = w2ui['spreadsheet-toolbar'];
		item = toolbar.get(id);
	}
	else if (w2ui['presentation-toolbar'].get(id) !== null) {
		toolbar = w2ui['presentation-toolbar'];
		item = toolbar.get(id);
	}
	else {
		throw new Error('unknown id: ' + id);
	}
	var docLayer = map._docLayer;
	if (id !== 'zoomin' && id !== 'zoomout') {
		map.focus();
	}
	if (item.disabled) {
		return;
	}

	if (item.postmessage && item.type === 'button') {
		map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: item.id} });
	}
	else if (item.uno) {
		if (item.unosheet && map.getDocType() === 'spreadsheet') {
			map.toggleCommandState(item.unosheet);
		}
		else {
			map.toggleCommandState(item.uno);
		}
	}
	else if (id === 'save') {
		map.fire('postMessage', {msgId: 'UI_Save'});
		if (!map._disableDefaultAction['UI_Save']) {
			map.save(false /* An explicit save should terminate cell edit */, false /* An explicit save should save it again */);
		}
	}
	else if (id === 'repair') {
		map._socket.sendMessage('commandvalues command=.uno:DocumentRepair');
	}
	else if (id === 'zoomin' && map.getZoom() < map.getMaxZoom()) {
		map.zoomIn(1);
	}
	else if (id === 'zoomout' && map.getZoom() > map.getMinZoom()) {
		map.zoomOut(1);
	}
	else if (item.scale) {
		map.setZoom(item.scale);
	}
	else if (id === 'zoomreset') {
		map.setZoom(map.options.zoom);
	}
	else if (id === 'prev' || id === 'next') {
		if (docLayer._docType === 'text') {
			map.goToPage(id);
		}
		else {
			map.setPart(id);
		}
	}
	else if (id === 'searchprev') {
		map.search(L.DomUtil.get('search-input').value, true);
	}
	else if (id === 'searchnext') {
		map.search(L.DomUtil.get('search-input').value);
	}
	else if (id === 'cancelsearch') {
		_cancelSearch();
	}
	else if (id === 'presentation' && map.getDocType() === 'presentation') {
		map.fire('fullscreen');
	}
	else if (id === 'insertannotation') {
		map.insertComment();
	}
	else if (id === 'insertpage') {
		map.insertPage();
	}
	else if (id === 'duplicatepage') {
		map.duplicatePage();
	}
	else if (id === 'deletepage') {
		vex.dialog.confirm({
			message: _('Are you sure you want to delete this page?'),
			callback: onDelete
		});
	}
	else if (id === 'insertsheet') {
		var nPos = $('#spreadsheet-tab-scroll')[0].childElementCount;
		map.insertPage(nPos + 1);
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').prop('scrollWidth'));
	}
	else if (id === 'firstrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft(0);
	}
	// TODO: We should get visible tab's width instead of 60px
	else if (id === 'nextrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft() + 60);
	}
	else if (id === 'prevrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft() - 30);
	}
	else if (id === 'lastrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft() + 120);
	}
	else if (id === 'insertgraphic' || item.id === 'localgraphic') {
		L.DomUtil.get('insertgraphic').click();
	}
	else if (item.id === 'remotegraphic') {
		map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
	}
	else if (id === 'fontcolor' && typeof e.color !== 'undefined') {
		onColorPick(id, e.color);
	}
	else if (id === 'backcolor' && typeof e.color !== 'undefined') {
		onColorPick(id, e.color)
	}
	else if (id === 'backgroundcolor' && typeof e.color !== 'undefined') {
		onColorPick(id, e.color)
	}
	else if (id === 'sum') {
		map.sendUnoCommand('.uno:AutoSum');
	}
	else if (id === 'function') {
		L.DomUtil.get('formulaInput').value = '=';
		L.DomUtil.get('formulaInput').focus();
		map.cellEnterString(L.DomUtil.get('formulaInput').value);
	}
	else if (id === 'cancelformula') {
		map.sendUnoCommand('.uno:Cancel');
		w2ui['formulabar'].hide('acceptformula', 'cancelformula');
		w2ui['formulabar'].show('sum', 'function');
	}
	else if (id === 'acceptformula') {
		// focus on map, and press enter
		map.focus();
		map._docLayer._postKeyboardEvent('input',
						 map.keyboard.keyCodes.enter,
						 map.keyboard._toUNOKeyCode(map.keyboard.keyCodes.enter));

		w2ui['formulabar'].hide('acceptformula', 'cancelformula');
		w2ui['formulabar'].show('sum', 'function');
	}
	else if (id.startsWith('StateTableCellMenu') && subItem) {
		e.done(function () {
			var menu = w2ui['toolbar-down'].get('StateTableCellMenu');
			if (subItem.id === '1') { // 'None' was clicked, remove all other options
				menu.selected = ['1'];
			}
			else { // Something else was clicked, remove the 'None' option from the array
				var index = menu.selected.indexOf('1');
				if (index > -1) {
					menu.selected.splice(index, 1);
				}
			}
			var value = 0;
			for (var it = 0; it < menu.selected.length; it++) {
				value = +value + parseInt(menu.selected[it]);
			}
			var command = {
				'StatusBarFunc': {
					type: 'unsigned short',
					value: value
				}
			};
			map.sendUnoCommand('.uno:StatusBarFunc', command);
		});
	}
	else if (id === 'logout') {
		map.signingLogout();
	}
	else if (id === 'sign') {
		map.signDocument();
	}
	else if (id === 'fullscreen') {
		if (item.checked) {
			toolbar.uncheck(id);
		}
		else {
			toolbar.check(id);
		}
		L.toggleFullScreen();
	}
}

function setBorders(left, right, bottom, top, horiz, vert) {
	var params = {
		OuterBorder: {
			type : '[]any',
			value : [
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : 0 }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : left }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : 0 }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : right }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : 0 }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : bottom }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : 0 }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : top }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
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
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : 0 }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : horiz }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'com.sun.star.table.BorderLine2', value : { Color : { type : 'com.sun.star.util.Color', value : 0 }, InnerLineWidth : { type : 'short', value : 0 }, OuterLineWidth : { type : 'short', value : vert }, LineDistance : { type : 'short', value : 0 },  LineStyle : { type : 'short', value : 0 }, LineWidth : { type : 'unsigned long', value : 0 } } },
				{ type : 'short', value : 0 },
				{ type : 'short', value : 127 },
				{ type : 'long', value : 0 }
			]
		}};
	map.sendUnoCommand('.uno:SetBorderStyle', params);
}

function setBorderStyle(num) {
	switch (num) {
	case 0: map.sendUnoCommand('.uno:FormatCellBorders'); break;

	case 1: setBorders(0, 0, 0, 0, 0, 0); break;
	case 2: setBorders(1, 0, 0, 0, 0, 0); break;
	case 3: setBorders(0, 1, 0, 0, 0, 0); break;
	case 4: setBorders(1, 1, 0, 0, 0, 0); break;

	case 5: setBorders(0, 0, 0, 1, 0, 0); break;
	case 6: setBorders(0, 0, 1, 0, 0, 0); break;
	case 7: setBorders(0, 0, 1, 1, 0, 0); break;
	case 8: setBorders(1, 1, 1, 1, 0, 0); break;

	case 9: setBorders(0, 0, 1, 1, 1, 0); break;
	case 10: setBorders(1, 1, 1, 1, 1, 0); break;
	case 11: setBorders(1, 1, 1, 1, 0, 1); break;
	case 12: setBorders(1, 1, 1, 1, 1, 1); break;

	default: console.log('ignored border: ' + num);
	}

	// close the popup
	// TODO we may consider keeping it open in the future if we add border color
	// and style to this popup too
	if ($('#w2ui-overlay-toolbar-up').length > 0) {
		$('#w2ui-overlay-toolbar-up').removeData('keepOpen')[0].hide();
	}
	map.focus();
}

global.setBorderStyle = setBorderStyle;

function setConditionalFormatIconSet(num) {
	var params = {
		IconSet: {
			type : 'short',
			value : num
		}};
	map.sendUnoCommand('.uno:IconSetFormatDialog', params);

	// close the popup
	if ($('#w2ui-overlay-toolbar-up').length > 0) {
		$('#w2ui-overlay-toolbar-up').removeData('keepOpen')[0].hide();
	}
	map.focus();
}

global.setConditionalFormatIconSet = setConditionalFormatIconSet;

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

			if ($('#w2ui-overlay-toolbar-up').length > 0) {
				$('#w2ui-overlay-toolbar-up').removeData('keepOpen')[0].hide();
			}

			map._socket.sendMessage(msg);
			// refocus map due popup
			map.focus();
		}
	}, '.col');
}

var shapes = {
	'Basic': [
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

	'Symbols':  [
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

	'Arrows': [
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

	'Star': [
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

	'Callout': [
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
};

function insertShapes() {
	var width = 10;
	var $grid = $('.insertshape-grid');

	if ($grid.children().size() > 0)
		return;

	for (var s in shapes) {
		var $rowHeader = $('<div/>').addClass('row-header loleaflet-font').append(s);
		$grid.append($rowHeader);

		var rows = Math.ceil(shapes[s].length / width);
		var idx = 0;
		for (var r = 0; r < rows; r++) {
			var $row = $('<div/>').addClass('row');
			$grid.append($row);
			for (var c = 0; c < width; c++) {
				if (idx >= shapes[s].length) {
					break;
				}
				var shape = shapes[s][idx++];
				var $col = $('<div/>').addClass('col w2ui-icon').addClass(shape.img);
				$col.data('uno', shape.uno);
				$row.append($col);
			}

			if (idx >= shapes[s].length)
				break;
		}
	}

	$grid.on({
		click: function(e) {
			map.sendUnoCommand('.uno:' + $(e.target).data().uno);
		}
	});
}

function onColorPick(id, color) {
	if (map.getPermission() !== 'edit') {
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

var stylesSelectValue;
var fontsSelectValue;

function createToolbar() {
	var toolItems = [
		{type: 'button',  id: 'save', img: 'save', hint: _UNO('.uno:Save')},
		{type: 'break', id: 'savebreak'},
		{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true, mobile: false},
		{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true, mobile: false},
		{type: 'button',  id: 'repair', img: 'repair', hint: _('Document repair'), disabled: true, mobile: false},
		{type: 'break', id: 'breakundo', mobile: false},
		{type: 'html',   id: 'styles', html: '<select class="styles-select"></select>', mobile: false},
		{type: 'html',   id: 'fonts', html: '<select class="fonts-select"></select>', mobile: false},
		{type: 'html',   id: 'fontsizes', html: '<select class="fontsizes-select"></select>',
			onRefresh: function (edata) {
				if (!edata.item.html) {
					edata.isCancelled = true;
				} else {
					$.extend(edata, { onComplete: function (e) {
						$('.fontsizes-select').select2({ dropdownAutoWidth: true, width: 'auto'});
						e.item.html = undefined;
					}});
				}
			}, mobile: false},
		{type: 'break', id: 'breakstyles', mobile: false},
		{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: 'Bold', disabled: true},
		{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic', disabled: true},
		{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: 'Underline', disabled: true},
		{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: 'Strikeout', disabled: true},
		{type: 'break', id: 'breakformatting'},
		{type: 'text-color',  id: 'fontcolor', hint: _UNO('.uno:FontColor')},
		{type: 'color',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackColor', 'text')},
		{type: 'color',  id: 'backgroundcolor', img: 'backgroundcolor', hint: _UNO('.uno:BackgroundColor')},
		{type: 'break', id: 'breakcolor'},
		{type: 'button',  id: 'leftpara',  img: 'alignleft', hint: _UNO('.uno:LeftPara', '', true), uno: 'LeftPara', unosheet: 'AlignLeft', disabled: true},
		{type: 'button',  id: 'centerpara',  img: 'alignhorizontal', hint: _UNO('.uno:CenterPara', '', true), uno: 'CenterPara', unosheet: 'AlignHorizontalCenter', disabled: true},
		{type: 'button',  id: 'rightpara',  img: 'alignright', hint: _UNO('.uno:RightPara', '', true), uno: 'RightPara', unosheet: 'AlignRight', disabled: true},
		{type: 'button',  id: 'justifypara',  img: 'alignblock', hint: _UNO('.uno:JustifyPara', '', true), uno: 'JustifyPara', unosheet: '', disabled: true},
		{type: 'break',  id: 'wraptextseparator'},
		{type: 'button',  id: 'wraptext',  img: 'wraptext', hint: _UNO('.uno:WrapText', 'spreadsheet', true), uno: 'WrapText', disabled: true},
		{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), uno: 'ToggleMergeCells', disabled: true},
		{type: 'break',   id: 'break-toggle'},
		{type: 'button',  id: 'numberformatcurrency',  img: 'numberformatcurrency', hint: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), uno: 'NumberFormatCurrency', disabled: true},
		{type: 'button',  id: 'numberformatpercent',  img: 'numberformatpercent', hint: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), uno: 'NumberFormatPercent', disabled: true},
		{type: 'button',  id: 'numberformatdecimal',  img: 'numberformatdecimal', hint: _UNO('.uno:NumberFormatDecimal', 'spreadsheet', true), uno: 'NumberFormatDecimal', disabled: true},
		{type: 'button',  id: 'numberformatdate',  img: 'numberformatdate', hint: _UNO('.uno:NumberFormatDate', 'spreadsheet', true), uno: 'NumberFormatDate', disabled: true},
		{type: 'button',  id: 'numberformatincdecimals',  img: 'numberformatincdecimals', hint: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), uno: 'NumberFormatIncDecimals', disabled: true},
		{type: 'button',  id: 'numberformatdecdecimals',  img: 'numberformatdecdecimals', hint: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), uno: 'NumberFormatDecDecimals', disabled: true},
		{type: 'break',   id: 'break-number'},
		{type: 'button',  id: 'sortascending',  img: 'sortascending', hint: _UNO('.uno:SortAscending', 'spreadsheet', true), uno: 'SortAscending', disabled: true},
		{type: 'button',  id: 'sortdescending',  img: 'sortdescending', hint: _UNO('.uno:SortDescending', 'spreadsheet', true), uno: 'SortDescending', disabled: true},
		{type: 'break',   id: 'break-align'},
		{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: 'DefaultBullet', disabled: true},
		{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true), uno: 'DefaultNumbering', disabled: true},
		{type: 'break',   id: 'break-numbering'},
		{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: 'IncrementIndent', disabled: true},
		{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: 'DecrementIndent', disabled: true},
		{type: 'break', id: 'incdecindent'},
		{type: 'drop',  id: 'inserttable',  img: 'inserttable', hint: _('Insert table'), overlay: {onShow: insertTable},
		 html: '<div id="inserttable-wrapper"><div id="inserttable-popup" class="inserttable-pop ui-widget ui-widget-content ui-corner-all"><div class="inserttable-grid"></div><div id="inserttable-status" class="loleaflet-font" style="padding: 5px;"><br/></div></div></div>'},
		{type: 'drop',  id: 'setborderstyle',  img: 'setborderstyle', hint: _('Borders'),
			html: '<table id="setborderstyle-grid"><tr><td class="w2ui-tb-image w2ui-icon frame01" onclick="setBorderStyle(1)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame02" onclick="setBorderStyle(2)"></td><td class="w2ui-tb-image w2ui-icon frame03" onclick="setBorderStyle(3)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame04" onclick="setBorderStyle(4)"></td></tr><tr><td class="w2ui-tb-image w2ui-icon frame05" onclick="setBorderStyle(5)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame06" onclick="setBorderStyle(6)"></td><td class="w2ui-tb-image w2ui-icon frame07" onclick="setBorderStyle(7)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame08" onclick="setBorderStyle(8)"></td></tr><tr><td class="w2ui-tb-image w2ui-icon frame09" onclick="setBorderStyle(9)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame10" onclick="setBorderStyle(10)"></td><td class="w2ui-tb-image w2ui-icon frame11" onclick="setBorderStyle(11)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame12" onclick="setBorderStyle(12)"></td></tr><tr>' +
			      '<td colspan="4" class="w2ui-tb-image w2ui-icon frame13" onclick="setBorderStyle(0)"><div id="div-frame13">' + _('More...') + '</div></td></tr></table>'
		},
		{type: 'drop', id: 'conditionalformaticonset',  img: 'conditionalformatdialog', hint: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet', true),
			html: '<table id="conditionalformatmenu-grid"><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset00" onclick="setConditionalFormatIconSet(0)"/><td class="w2ui-tb-image w2ui-icon iconset01" onclick="setConditionalFormatIconSet(1)"/><td class="w2ui-tb-image w2ui-icon iconset02" onclick="setConditionalFormatIconSet(2)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset03" onclick="setConditionalFormatIconSet(3)"/><td class="w2ui-tb-image w2ui-icon iconset04" onclick="setConditionalFormatIconSet(4)"/><td class="w2ui-tb-image w2ui-icon iconset05" onclick="setConditionalFormatIconSet(5)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset06" onclick="setConditionalFormatIconSet(6)"/><td class="w2ui-tb-image w2ui-icon iconset08" onclick="setConditionalFormatIconSet(8)"/><td class="w2ui-tb-image w2ui-icon iconset09" onclick="setConditionalFormatIconSet(9)"/></tr><tr>' + // iconset07 deliberately left out, see the .css for the reason
				  '<td class="w2ui-tb-image w2ui-icon iconset10" onclick="setConditionalFormatIconSet(10)"/><td class="w2ui-tb-image w2ui-icon iconset11" onclick="setConditionalFormatIconSet(11)"/><td class="w2ui-tb-image w2ui-icon iconset12" onclick="setConditionalFormatIconSet(12)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset13" onclick="setConditionalFormatIconSet(13)"/><td class="w2ui-tb-image w2ui-icon iconset14" onclick="setConditionalFormatIconSet(14)"/><td class="w2ui-tb-image w2ui-icon iconset15" onclick="setConditionalFormatIconSet(15)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset16" onclick="setConditionalFormatIconSet(16)"/><td class="w2ui-tb-image w2ui-icon iconset17" onclick="setConditionalFormatIconSet(17)"/><td class="w2ui-tb-image w2ui-icon iconset18" onclick="setConditionalFormatIconSet(18)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset19" onclick="setConditionalFormatIconSet(19)"/><td class="w2ui-tb-image w2ui-icon iconset20" onclick="setConditionalFormatIconSet(20)"/><td class="w2ui-tb-image w2ui-icon iconset21" onclick="setConditionalFormatIconSet(21)"/></tr></table>'
		},
		{type: 'drop',  id: 'insertshapes',  img: 'basicshapes_ellipse', hint: _('Insert shapes'), overlay: {onShow: insertShapes},
		 html: '<div id="insertshape-wrapper"><div id="insertshape-popup" class="insertshape-pop ui-widget ui-widget-content ui-corner-all"><div class="insertshape-grid"></div></div></div>'},
		{type: 'button',  id: 'insertobjectchart',  img: 'insertobjectchart', hint: _UNO('.uno:InsertObjectChart', '', true), uno: 'InsertObjectChart'},
		{type: 'button',  id: 'insertannotation', img: 'annotation', hint: _UNO('.uno:InsertAnnotation', '', true)},
		{type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true)},
		{type: 'menu', id: 'menugraphic', img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true), hidden: true,
			items: [
				{id: 'localgraphic', text: _('Insert Local Image'), icon: 'insertgraphic'},
				{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true), icon: 'insertgraphic'},
			]},
		{type: 'button',  id: 'insertsymbol', img: 'specialcharacter', hint: _UNO('.uno:InsertSymbol', '', true), uno: '.uno:InsertSymbol'}
	];

	if (_useSimpleUI()) {
		initMobileToolbar(toolItems);
	} else {
		initNormalToolbar(toolItems);
	}
}

function initMobileToolbar(toolItems) {
	var toolbar = $('#toolbar-up');
	toolbar.w2toolbar({
		name: 'toolbar-down',
		tooltip: 'bottom',
		items: [
			{type: 'button',  id: 'close',  img: 'closemobile'},
			{type: 'spacer'},
			{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
			{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
			{type: 'button',  id: 'fullscreen', img: 'fullscreen', hint: _UNO('.uno:FullScreen', 'text')},
			{type: 'drop', id: 'userlist', img: 'users', html: '<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
				'<hr><table class="loleaflet-font" id="editor-btn">' +
				'<tr>' +
				'<td><input type="checkbox" name="alwaysFollow" id="follow-checkbox" onclick="editorUpdate(event)"></td>' +
				'<td>' + _('Always follow the editor') + '</td>' +
				'</tr>' +
				'</table>' +
				'<p id="currently-msg">' + _('Current') + ' - <b><span id="current-editor"></span></b></p>' +
				'</div>'
			},
		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		}
	});
	toolbar.bind('touchstart', function(e) {
		w2ui['toolbar-down'].touchStarted = true;
		var touchEvent = e.originalEvent;
		if (touchEvent && touchEvent.touches.length > 1) {
			L.DomEvent.preventDefault(e);
		}
	});

	toolbar = $('#formulabar');
	toolbar.w2toolbar({
		name: 'formulabar',
		tooltip: 'bottom',
		items: [
			{type: 'html',  id: 'left'},
			{type: 'html', id: 'address', html: '<input id="addressInput" type="text">'},
			{type: 'break'},
			{type: 'button',  id: 'sum',  img: 'autosum', hint: _('Sum')},
			{type: 'button',  id: 'function',  img: 'equal', hint: _('Function')},
			{type: 'button', hidden: true, id: 'cancelformula',  img: 'cancel', hint: _('Cancel')},
			{type: 'button', hidden: true, id: 'acceptformula',  img: 'accepttrackedchanges', hint: _('Accept')},
			{type: 'html', id: 'formula', html: '<input id="formulaInput" type="text">'}

		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		},
		onRefresh: function() {
			$('#addressInput').off('keyup', onAddressInput).on('keyup', onAddressInput);
			$('#formulaInput').off('keyup', onFormulaInput).on('keyup', onFormulaInput);
			$('#formulaInput').off('blur', onFormulaBarBlur).on('blur', onFormulaBarBlur);
			$('#formulaInput').off('focus', onFormulaBarFocus).on('focus', onFormulaBarFocus);
		}
	});
	toolbar.bind('touchstart', function(e) {
		w2ui['formulabar'].touchStarted = true;
		var touchEvent = e.originalEvent;
		if (touchEvent && touchEvent.touches.length > 1) {
			L.DomEvent.preventDefault(e);
		}
	});

	$(w2ui.formulabar.box).find('.w2ui-scroll-left, .w2ui-scroll-right').hide();
	w2ui.formulabar.on('resize', function(target, e) {
		e.isCancelled = true;
	});

	toolbar = $('#spreadsheet-toolbar');
	toolbar.w2toolbar({
		name: 'spreadsheet-toolbar',
		tooltip: 'bottom',
		items: [
			{type: 'button',  id: 'firstrecord',  img: 'firstrecord', hidden: true, hint: _('First sheet')},
			{type: 'button',  id: 'prevrecord',  img: 'prevrecord', hidden: true, hint: _('Previous sheet')},
			{type: 'button',  id: 'nextrecord',  img: 'nextrecord', hidden: true, hint: _('Next sheet')},
			{type: 'button',  id: 'lastrecord',  img: 'lastrecord', hidden: true, hint: _('Last sheet')},
			{type: 'button',  id: 'insertsheet', img: 'insertsheet', hidden:true, hint: _('Insert sheet')}
		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		}
	});
	toolbar.bind('touchstart', function(e) {
		w2ui['spreadsheet-toolbar'].touchStarted = true;
		var touchEvent = e.originalEvent;
		if (touchEvent && touchEvent.touches.length > 1) {
			L.DomEvent.preventDefault(e);
		}
	});

	toolbar = $('#presentation-toolbar');
	toolbar.w2toolbar({
		name: 'presentation-toolbar',
		tooltip: 'bottom',
		items: []
	});

	toolbar = $('#toolbar-down');
	toolbar.w2toolbar({
		name: 'toolbar-up',
		tooltip: 'top',
		items: toolItems,
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		},
		onRefresh: function(edata) {
			if (edata.item && (edata.item.id === 'styles' || edata.item.id === 'fonts' || edata.item.id === 'fontsizes')) {
				var toolItem = $(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(edata.item.id));
				if (edata.item.hidden) {
					toolItem.css('display', 'none');
				} else {
					toolItem.css('display', '');
				}
			}

			if (map.getDocType() === 'presentation') {
				// Fill the style select box if not yet filled
				if ($('.styles-select')[0] && $('.styles-select')[0].length === 0) {
					var data = [''];
					// Inserts a separator element
					data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

					L.Styles.impressLayout.forEach(function(layout) {
						data = data.concat({id: layout.id, text: _(layout.text)});
					}, this);

					$('.styles-select').select2({
						data: data,
						placeholder: _UNO('.uno:LayoutStatus', 'presentation')
					});
					$('.styles-select').on('select2:select', onStyleSelect);
				}
			}

			updateCommandValues();

			insertTable();

			insertShapes();
		}
	});

	toolbar.bind('touchstart', function(e) {
		w2ui['toolbar-up'].touchStarted = true;
		var touchEvent = e.originalEvent;
		if (touchEvent && touchEvent.touches.length > 1) {
			L.DomEvent.preventDefault(e);
		}
	});
}

function initNormalToolbar(toolItems) {
	var toolbar = $('#toolbar-up');
	toolbar.w2toolbar({
		name: 'toolbar-up',
		tooltip: 'bottom',
		items: toolItems,
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		},
		onRefresh: function() {
			if (map.getDocType() === 'presentation') {
				// Fill the style select box if not yet filled
				if ($('.styles-select')[0] && $('.styles-select')[0].length === 1) {
					var data = [''];
					// Inserts a separator element
					data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

					L.Styles.impressLayout.forEach(function(layout) {
						data = data.concat({id: layout.id, text: _(layout.text)});
					}, this);

					$('.styles-select').select2({
						data: data,
						placeholder: _UNO('.uno:LayoutStatus', 'presentation')
					});
					$('.styles-select').on('select2:select', onStyleSelect);
				}
			}

			updateCommandValues();

			insertTable();

			insertShapes();
		}
	});

	toolbar.bind('touchstart', function() {
		w2ui['toolbar-up'].touchStarted = true;
	});

	toolbar = $('#formulabar');
	toolbar.w2toolbar({
		name: 'formulabar',
		tooltip: 'bottom',
		items: [
			{type: 'html',  id: 'left'},
			{type: 'html', id: 'address', html: '<input id="addressInput" type="text">'},
			{type: 'break'},
			{type: 'button',  id: 'sum',  img: 'autosum', hint: _('Sum')},
			{type: 'button',  id: 'function',  img: 'equal', hint: _('Function')},
			{type: 'button', hidden: true, id: 'cancelformula',  img: 'cancel', hint: _('Cancel')},
			{type: 'button', hidden: true, id: 'acceptformula',  img: 'accepttrackedchanges', hint: _('Accept')},
			{type: 'html', id: 'formula', html: '<input id="formulaInput" type="text">'}
		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		},
		onRefresh: function() {
			$('#addressInput').off('keyup', onAddressInput).on('keyup', onAddressInput);
			$('#formulaInput').off('keyup', onFormulaInput).on('keyup', onFormulaInput);
			$('#formulaInput').off('blur', onFormulaBarBlur).on('blur', onFormulaBarBlur);
			$('#formulaInput').off('focus', onFormulaBarFocus).on('focus', onFormulaBarFocus);
		}
	});
	toolbar.bind('touchstart', function() {
		w2ui['formulabar'].touchStarted = true;
	});

	$(w2ui.formulabar.box).find('.w2ui-scroll-left, .w2ui-scroll-right').hide();
	w2ui.formulabar.on('resize', function(target, e) {
		e.isCancelled = true;
	});

	if (L.DomUtil.get('document-signing-bar') !== null) {
		toolbar = $('#document-signing-bar');
		toolbar.w2toolbar({
			name: 'document-signing-bar',
			tooltip: 'bottom',
			items: [
				{type: 'html',  id: 'left'},
				{type: 'html', id: 'logo', html: '<p><b>Vereign</b></p>'},
				{type: 'button',  id: 'sign',  caption: 'Sign', img: '', hint: _('Sign document')},
				{type: 'break' },
				{type: 'html', id: 'user-label', html: '<p>User:</p>'},
				{type: 'html', id: 'user', html: '<none>'},
				{type: 'break' },
				{type: 'button',  id: 'logout',  caption: 'Logout', img: '', hint: _('Logout')},
			],
			onClick: function (e) {
				onClick(e, e.target);
				hideTooltip(this, e.target);
			},
			onRefresh: function() {
			}
		});
		toolbar.bind('touchstart', function() {
			w2ui['document-signing-bar'].touchStarted = true;
		});
	}

	toolbar = $('#spreadsheet-toolbar')
	toolbar.w2toolbar({
		name: 'spreadsheet-toolbar',
		tooltip: 'bottom',
		items: [
			{type: 'button',  id: 'firstrecord',  img: 'firstrecord', hidden: true, hint: _('First sheet')},
			{type: 'button',  id: 'prevrecord',  img: 'prevrecord', hidden: true, hint: _('Previous sheet')},
			{type: 'button',  id: 'nextrecord',  img: 'nextrecord', hidden: true, hint: _('Next sheet')},
			{type: 'button',  id: 'lastrecord',  img: 'lastrecord', hidden: true, hint: _('Last sheet')},
			{type: 'button',  id: 'insertsheet', img: 'insertsheet', hidden:true, hint: _('Insert sheet')}
		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		}
	});
	toolbar.bind('touchstart', function() {
		w2ui['spreadsheet-toolbar'].touchStarted = true;
	});

	toolbar = $('#presentation-toolbar');
	toolbar.w2toolbar({
		name: 'presentation-toolbar',
		tooltip: 'bottom',
		items: [
			{type: 'html',  id: 'left'},
			{type: 'button',  id: 'presentation', img: 'presentation', hidden:true, hint: _('Fullscreen presentation')},
			{type: 'break', id: 'presentationbreak', hidden:true},
			{type: 'button',  id: 'insertpage', img: 'insertpage', hidden:true, hint: _UNO('.uno:TaskPaneInsertPage', 'presentation')},
			{type: 'button',  id: 'duplicatepage', img: 'duplicatepage', hidden:true, hint: _UNO('.uno:DuplicateSlide', 'presentation')},
			{type: 'button',  id: 'deletepage', img: 'deletepage', hidden:true, hint: _UNO('.uno:DeleteSlide', 'presentation')},
			{type: 'html',  id: 'right'}
		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		}
	});
	toolbar.bind('touchstart', function() {
		w2ui['presentation-toolbar'].touchStarted = true;
	});

	toolbar = $('#toolbar-down');
	if ($('#main-menu').css('display') !== 'none') {
		toolbar.w2toolbar({
			name: 'toolbar-down',
			tooltip: 'top',
			items: [
				{type: 'html',  id: 'search',
				 html: '<div style="padding: 3px 5px 3px 10px;" class="loleaflet-font">' +
				 '<input size="15" id="search-input" placeholder="' + _('Search') + '"' +
				 'style="padding: 3px; border-radius: 2px; border: 1px solid silver"/>' +
				 '</div>'
				},
				{type: 'button',  id: 'searchprev', img: 'prev', hint: _UNO('.uno:UpSearch'), disabled: true},
				{type: 'button',  id: 'searchnext', img: 'next', hint: _UNO('.uno:DownSearch'), disabled: true},
				{type: 'button',  id: 'cancelsearch', img: 'cancel', hint: _('Cancel the search'), hidden: true},
				{type: 'html',  id: 'left'},
				{type: 'html',  id: 'right'},
				{type: 'html',    id: 'modifiedstatuslabel', html: '<div id="modifiedstatuslabel" class="loleaflet-font"></div>', mobile:false},
				{type: 'break', id: 'modifiedstatuslabelbreak', mobile:false},
				{type: 'drop', id: 'userlist', text: _('No users'), html: '<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
					'<hr><table class="loleaflet-font" id="editor-btn">' +
					'<tr>' +
					'<td><input type="checkbox" name="alwaysFollow" id="follow-checkbox" onclick="editorUpdate(event)"></td>' +
					'<td>' + _('Always follow the editor') + '</td>' +
					'</tr>' +
					'</table>' +
					'<p id="currently-msg">' + _('Current') + ' - <b><span id="current-editor"></span></b></p>' +
					'</div>'
				},
				{type: 'break', id: 'userlistbreak'},
				{type: 'button',  id: 'prev', img: 'prev', hint: _UNO('.uno:PageUp', 'text')},
				{type: 'button',  id: 'next', img: 'next', hint: _UNO('.uno:PageDown', 'text')},
				{type: 'break', id: 'prevnextbreak'},
				{type: 'button',  id: 'zoomreset', img: 'zoomreset', hint: _('Reset zoom')},
				{type: 'button',  id: 'zoomout', img: 'zoomout', hint: _UNO('.uno:ZoomMinus')},
				{type: 'menu-radio', id: 'zoom', text: '100%',
					selected: 'zoom100',
					mobile: false,
					items: [
						{ id: 'zoom50', text: '50%', scale: 6},
						{ id: 'zoom60', text: '60%', scale: 7},
						{ id: 'zoom70', text: '70%', scale: 8},
						{ id: 'zoom85', text: '85%', scale: 9},
						{ id: 'zoom100', text: '100%', scale: 10},
						{ id: 'zoom120', text: '120%', scale: 11},
						{ id: 'zoom150', text: '150%', scale: 12},
						{ id: 'zoom175', text: '175%', scale: 13},
						{ id: 'zoom200', text: '200%', scale: 14}
					]
				},
				{type: 'button',  id: 'zoomin', img: 'zoomin', hint: _UNO('.uno:ZoomPlus')}
			],
			onClick: function (e) {
				hideTooltip(this, e.target);
				if (e.item.id === 'userlist') {
					setTimeout(function() {
						var cBox = $('#follow-checkbox')[0];
						var docLayer = map._docLayer;
						var editorId = docLayer._editorId;

						if (cBox)
							cBox.checked = docLayer._followEditor;

						if (docLayer.editorId !== -1 && map._viewInfo[editorId])
							$('#current-editor').text(map._viewInfo[editorId].username);
						else
							$('#currently-msg').hide();
					}, 100);
					return;
				}
				onClick(e, e.target, e.item, e.subItem);
			},
			onRefresh: function() {
				$('#tb_toolbar-down_item_userlist .w2ui-tb-caption').addClass('loleaflet-font');
				$('#search-input').off('input', onSearch).on('input', onSearch);
				$('#search-input').off('keydown', onSearchKeyDown).on('keydown', onSearchKeyDown);
			}
		});
	}
	else {
		toolbar.w2toolbar({
			name: 'toolbar-down',
			tooltip: 'top',
			items: []
		});
	}
	toolbar.bind('touchstart', function() {
		w2ui['toolbar-down'].touchStarted = true;
	});
}

var userJoinedPopupMessage = '<div>' + _('%user has joined') + '</div>';
var userLeftPopupMessage = '<div>' + _('%user has left') + '</div>';
var userPopupTimeout = null;

function localizeStateTableCell (text) {
	var stateArray = text.split(';');
	var stateArrayLength = stateArray.length;
	var localizedText = '';
	for (var i = 0; i < stateArrayLength; i++) {
		var labelValuePair = stateArray[i].split(':');
		localizedText += _(labelValuePair[0].trim()) + ':' + labelValuePair[1];
		if (stateArrayLength > 1 && i < stateArrayLength - 1) {
			localizedText += '; ';
		}
	}
	return localizedText;
}

function toLocalePattern (pattern, regex, text, sub1, sub2) {
	var matches = new RegExp(regex, 'g').exec(text);
	if (matches) {
		text = pattern.toLocaleString().replace(sub1, parseInt(matches[1].replace(',','')).toLocaleString(String.locale)).replace(sub2, parseInt(matches[2].replace(',','')).toLocaleString(String.locale));
	}
	return text;
}

function updateToolbarItem(toolbar, id, html) {
	var item = toolbar.get(id);
	if (item) {
		item.html = html;
	}
}

function unoCmdToToolbarId(commandname)
{
	var id = commandname.toLowerCase().substr(5);
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
	return id;
}

function onSearch() {
	var toolbar = w2ui['toolbar-down'];
	// conditionally disabling until, we find a solution for tdf#108577
	if (L.DomUtil.get('search-input').value === '') {
		toolbar.disable('searchprev');
		toolbar.disable('searchnext');
		toolbar.hide('cancelsearch');
	}
	else {
		if (map.getDocType() === 'text')
			map.search(L.DomUtil.get('search-input').value, false, '', 0, true /* expand search */);
		toolbar.enable('searchprev');
		toolbar.enable('searchnext');
		toolbar.show('cancelsearch');
	}
}

function onSearchKeyDown(e) {
	if ((e.keyCode === 71 && e.ctrlKey) || e.keyCode === 114 || e.keyCode === 13) {
		if (e.shiftKey) {
			map.search(L.DomUtil.get('search-input').value, true);
		} else {
			map.search(L.DomUtil.get('search-input').value);
		}
		e.preventDefault();
	} else if (e.keyCode === 27) {
		_cancelSearch();
	}
}

function documentNameConfirm() {
	var value = $('#document-name-input').val();
	if (value !== null && value != '' && value != map['wopi'].BaseFileName) {
		map.saveAs(value);
	}
	map._onGotFocus();
}

function documentNameCancel() {
	$('#document-name-input').val(map['wopi'].BaseFileName);
	map._onGotFocus();
}

function onDocumentNameKeyPress(e) {
	if (e.keyCode === 13) { // Enter key
		documentNameConfirm();
	} else if (e.keyCode === 27) { // Escape key
		documentNameCancel();
	}
}

function onDocumentNameFocus() {
	// hide the caret in the main document
	map._onLostFocus();
}

function onStyleSelect(e) {
	var style = e.target.value;
	if (style.startsWith('.uno:')) {
		map.sendUnoCommand(style);
	}
	else if (map.getDocType() === 'text') {
		map.applyStyle(style, 'ParagraphStyles');
	}
	else if (map.getDocType() === 'spreadsheet') {
		map.applyStyle(style, 'CellStyles');
	}
	else if (map.getDocType() === 'presentation' || map.getDocType() === 'drawing') {
		map.applyLayout(style);
	}
	map.focus();
}

function onFontSelect(e) {
	var font = e.target.value;
	map.applyFont(font);
	map.focus();
}

function onFontSizeSelect(e) {
	map.applyFontSize(e.target.value);
	map.focus();
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

function onAddressInput(e) {
	if (e.keyCode === 13) {
		// address control should not have focus anymore
		map.focus();
		var value = L.DomUtil.get('addressInput').value;
		var command = {
			ToPoint : {
				type: 'string',
				value: value
			}

		};
		map.sendUnoCommand('.uno:GoToCell', command);
	} else if (e.keyCode === 27) { // 27 = esc key
		map.sendUnoCommand('.uno:Cancel');
		map.focus();
	}
}

function onFormulaInput(e) {
	// keycode = 13 is 'enter'
	if (e.keyCode === 13) {
		// formula bar should not have focus anymore
		map.focus();

		// forward the 'enter' keystroke to map to deal with the formula entered
		var data = {
			originalEvent: e
		};
		map.fire('keypress', data);
	} else if (e.keyCode === 27) { // 27 = esc key
		map.sendUnoCommand('.uno:Cancel');
		map.focus();
	} else {
		map.cellEnterString(L.DomUtil.get('formulaInput').value);
	}
}

function onFormulaBarFocus() {
	var formulabar = w2ui.formulabar;
	formulabar.hide('sum');
	formulabar.hide('function');
	formulabar.show('cancelformula');
	formulabar.show('acceptformula');
}

function onFormulaBarBlur() {
	// The timeout is needed because we want 'click' event on 'cancel',
	// 'accept' button to act before we hide these buttons because
	// once hidden, click event won't be processed.
	// TODO: Some better way to do it ?
	setTimeout(function() {
		var formulabar = w2ui.formulabar;
		formulabar.show('sum');
		formulabar.show('function');
		formulabar.hide('cancelformula');
		formulabar.hide('acceptformula');
	}, 250);
}



function onWopiProps(e) {
	if (e.HideSaveOption) {
		w2ui['toolbar-up'].hide('save');
	}
	if (e.HideExportOption) {
		w2ui['presentation-toolbar'].hide('presentation', 'presentationbreak');
	}
	if (e.DisableCopy) {
		$('input#formulaInput').bind('copy', function(evt) {
			evt.preventDefault();
		});
		$('input#addressInput').bind('copy', function(evt) {
			evt.preventDefault();
		});
	}
	if (e.BaseFileName !== null) {
		// set the document name into the name field
		$('#document-name-input').val(e.BaseFileName);
	}
	if (e.UserCanNotWriteRelative === false) {
		// Save As allowed
		$('#document-name-input').prop('disabled', false);
		$('#document-name-input').addClass('editable');
		$('#document-name-input').off('keypress', onDocumentNameKeyPress).on('keypress', onDocumentNameKeyPress);
		$('#document-name-input').off('focus', onDocumentNameFocus).on('focus', onDocumentNameFocus);
		$('#document-name-input').off('blur', documentNameCancel).on('blur', documentNameCancel);
	} else {
		$('#document-name-input').prop('disabled', true);
		$('#document-name-input').removeClass('editable');
		$('#document-name-input').off('keypress', onDocumentNameKeyPress);
	}
	if (e.EnableInsertRemoteImage === true) {
		w2ui['toolbar-up'].hide('insertgraphic');
		w2ui['toolbar-up'].show('menugraphic');
	}
}

function onDocLayerInit() {
	var toolbarUp = w2ui['toolbar-up'];
	var statusbar = w2ui['toolbar-down'];
	var docType = map.getDocType();

	switch (docType) {
	case 'spreadsheet':
		toolbarUp.remove('inserttable', 'styles', 'justifypara', 'defaultbullet', 'defaultnumbering', 'break-numbering', 'backcolor');
		if (!_useSimpleUI()) {
			statusbar.insert('left', [
				{type: 'break', id:'break1'},
				{type: 'html',  id: 'StatusDocPos',
					html: '<div id="StatusDocPos" class="loleaflet-font" title="'+_('Number of Sheets')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break2'},
				{type: 'html',  id: 'RowColSelCount',
					html: '<div id="RowColSelCount" class="loleaflet-font" title="'+_('Selected range of cells')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break3'},
				{type: 'html',  id: 'InsertMode', mobile: false,
					html: '<div id="InsertMode" class="loleaflet-font" title="'+_('Entering text mode')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break4'},
				{type: 'menu-radio', id: 'LanguageStatus', mobile: false},
				{type: 'break', id:'break5'},
				{type: 'html',  id: 'StatusSelectionMode', mobile: false,
					html: '<div id="StatusSelectionMode" class="loleaflet-font" title="'+_('Selection Mode')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break8', mobile: false},
				{type: 'html',  id: 'StateTableCell', mobile:false,
				 html: '<div id="StateTableCell" class="loleaflet-font" title="'+_('Choice of functions')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'menu-check', id: 'StateTableCellMenu', caption: '', selected: ['2', '512'], items: [
					{ id: '2', text: _('Average')},
					{ id: '8', text: _('CountA')},
					{ id: '4', text: _('Count')},
					{ id: '16', text: _('Maximum')},
					{ id: '32', text: _('Minimum')},
					{ id: '512', text: _('Sum')},
					{ id: '8192', text: _('Selection count')},
					{ id: '1', text: _('None')}
				]}
			]);
		}

		statusbar.set('zoom', {
			items: [
				{ id: 'zoom100', text: '100%', scale: 10},
				{ id: 'zoom200', text: '200%', scale: 14}
			]
		});

		// Remove irrelevant toolbars
		$('#presentation-toolbar').hide();

		break;
	case 'text':
		toolbarUp.remove('wraptextseparator', 'wraptext', 'togglemergecells', 'break-toggle', 'numberformatcurrency', 'numberformatpercent', 'numberformatdecimal', 'numberformatdate', 'numberformatincdecimals', 'numberformatdecdecimals', 'break-number', 'sortascending', 'sortdescending', 'setborderstyle', 'conditionalformaticonset');
		toolbarUp.hide('backgroundcolor');
		if (!_useSimpleUI()) {
			statusbar.insert('left', [
				{type: 'break', id: 'break1'},
				{type: 'html',  id: 'StatePageNumber',
					html: '<div id="StatePageNumber" class="loleaflet-font" title="'+_('Number of Pages')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break2'},
				{type: 'html',  id: 'StateWordCount', mobile: false,
					html: '<div id="StateWordCount" class="loleaflet-font" title="'+_('Word Counter')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break5', mobile: false},
				{type: 'html',  id: 'InsertMode', mobile: false,
					html: '<div id="InsertMode" class="loleaflet-font" title="'+_('Entering text mode')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break6', mobile:false},
				{type: 'html',  id: 'StatusSelectionMode', mobile: false,
					html: '<div id="StatusSelectionMode" class="loleaflet-font" title="'+_('Selection Mode')+ '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>' },
				{type: 'break', id:'break7', mobile:false},
				{type: 'menu-radio', id: 'LanguageStatus', mobile: false},
			]);
		}

		// Remove irrelevant toolbars
		$('#formulabar').hide();
		$('#spreadsheet-toolbar').hide();
		$('#presentation-toolbar').hide();

		break;
	case 'presentation':
		var presentationToolbar = w2ui['presentation-toolbar'];
		presentationToolbar.show('insertpage', 'duplicatepage', 'deletepage');
		if (!map['wopi'].HideExportOption) {
			presentationToolbar.show('presentation', 'presentationbreak');
		}
		toolbarUp.remove('insertannotation', 'wraptextseparator', 'wraptext', 'togglemergecells', 'break-toggle', 'numberformatcurrency', 'numberformatpercent', 'numberformatdecimal', 'numberformatdate', 'numberformatincdecimals', 'numberformatdecdecimals', 'break-number', 'sortascending', 'sortdescending', 'setborderstyle', 'conditionalformaticonset', 'backgroundcolor');
		if (!_useSimpleUI()) {
			statusbar.insert('left', [
				{type: 'break', id: 'break1'},
				{
					type: 'html', id: 'PageStatus',
					html: '<div id="PageStatus" class="loleaflet-font" title="' + _('Number of Slides') + '" style="padding: 5px 5px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp</div>'
				},
				{type: 'break', id: 'break2', mobile: false},
				{type: 'menu-radio', id: 'LanguageStatus', mobile: false}
			]);
		}

		// Remove irrelevant toolbars
		$('#formulabar').hide();
		$('#spreadsheet-toolbar').hide();

		break;
	case 'drawing':
		toolbarUp.remove('insertannotation', 'wraptextseparator', 'wraptext', 'togglemergecells', 'break-toggle', 'numberformatcurrency', 'numberformatpercent', 'numberformatdecimal', 'numberformatdate', 'numberformatincdecimals', 'numberformatdecdecimals', 'break-number', 'sortascending', 'sortdescending', 'setborderstyle', 'conditionalformaticonset', 'backgroundcolor');

		// Remove irrelevant toolbars
		$('#formulabar').hide();
		$('#spreadsheet-toolbar').hide();

		break;
	}

	if (L.Browser.mobile) {
		_mobilify();
		nUsers = '%n';
		oneUser = '1';
		noUser = '0';
		$('#document-name-input').hide();
	} else {
		nUsers = _('%n users');
		oneUser = _('1 user');
		noUser = _('0 users');
		$('#document-name-input').show();
	}

	updateUserListCount();
	toolbarUp.refresh();
	statusbar.refresh();

	var data = [6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20,
		22, 24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
	$('.fontsizes-select').select2({
		data: data,
		placeholder: ' ',
		//Allow manually entered font size.
		createTag: function(query) {
			return {
				id: query.term,
				text: query.term,
				tag: true
			};
		},
		tags: true,
		sorter: function(data) { return data.sort(function(a, b) {
			return parseFloat(a.text) - parseFloat(b.text);
		})}
	});
	$('.fontsizes-select').on('select2:select', onFontSizeSelect);
}

function onCommandStateChanged(e) {
	var toolbar = w2ui['toolbar-up'];
	var statusbar = w2ui['toolbar-down'];
	var commandName = e.commandName;
	var state = e.state;
	var found = false;
	var value, color, div;

	if (commandName === '.uno:AssignLayout') {
		$('.styles-select').val(state).trigger('change');
	} else if (commandName === '.uno:StyleApply') {
		if (!state) {
			return;
		}

		// For impress documents, no styles is supported.
		if (map.getDocType() === 'presentation') {
			return;
		}

		$('.styles-select option').each(function () {
			var value = this.value;
			// For writer we get UI names; ideally we should be getting only programmatic ones
			// For eg: 'Text body' vs 'Text Body'
			// (likely to be fixed in core to make the pattern consistent)
			if (state && value.toLowerCase() === state.toLowerCase()) {
				state = value;
				found = true;
				return;
			}
		});
		if (!found) {
			// we need to add the size
			$('.styles-select')
				.append($('<option></option>')
				.text(state));
		}

		stylesSelectValue = state;
		$('.styles-select').val(state).trigger('change');
	}
	else if (commandName === '.uno:CharFontName') {
		$('.fonts-select option').each(function () {
			value = this.value;
			if (value.toLowerCase() === state.toLowerCase()) {
				found = true;
				return;
			}
		});
		if (!found) {
			// we need to add the size
			$('.fonts-select')
				.append($('<option></option>')
				.text(state));
		}
		fontsSelectValue = state;
		$('.fonts-select').val(state).trigger('change');
	}
	else if (commandName === '.uno:FontHeight') {
		if (state === '0') {
			state = '';
		}

		$('.fontsizes-select option').each(function (i, e) {
			if ($(e).text() === state) {
				found = true;
			}
		});
		if (!found) {
			// we need to add the size
			$('.fontsizes-select')
				.append($('<option>')
				.text(state).val(state));
		}
		$('.fontsizes-select').val(state).trigger('change');
	}
	else if (commandName === '.uno:FontColor' || commandName === '.uno:Color') {
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		color = parseInt(e.state);
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
	else if (commandName === '.uno:BackColor' || commandName === '.uno:BackgroundColor' || commandName === '.uno:CharBackColor') {
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		color = parseInt(e.state);
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
	else if (commandName === '.uno:LanguageStatus') {
		statusbar.set('LanguageStatus', {text: _(state), selected: state});
	}
	else if (commandName === '.uno:ModifiedStatus') {
		var modifiedStatus = e.state === 'true';
		var html;
		if (modifiedStatus) {
			html = $('#modifiedstatuslabel').html('').parent().html();
			w2ui['toolbar-up'].set('save', {img:'savemodified'});
		}
		else {
			html = $('#modifiedstatuslabel').html(_('Document saved')).parent().html();
			w2ui['toolbar-up'].set('save', {img:'save'});
		}
		updateToolbarItem(statusbar, 'modifiedstatuslabel', html);
	}
	else if (commandName === '.uno:StatusDocPos') {
		state = toLocalePattern('Sheet %1 of %2', 'Sheet (\\d+) of (\\d+)', state, '%1', '%2');
		updateToolbarItem(statusbar, 'StatusDocPos', $('#StatusDocPos').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:RowColSelCount') {
		state = toLocalePattern('$1 rows, $2 columns selected', '(\\d+) rows, (\\d+) columns selected', state, '$1', '$2');
		state = toLocalePattern('$1 of $2 records found', '(\\d+) of (\\d+) records found', state, '$1', '$2');
		updateToolbarItem(statusbar, 'RowColSelCount', $('#RowColSelCount').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:InsertMode') {
		updateToolbarItem(statusbar, 'InsertMode', $('#InsertMode').html(state ? L.Styles.insertMode[state].toLocaleString() : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:StatusSelectionMode' ||
		 commandName === '.uno:SelectionMode') {
		updateToolbarItem(statusbar, 'StatusSelectionMode', $('#StatusSelectionMode').html(state ? L.Styles.selectionMode[state].toLocaleString() : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName == '.uno:StateTableCell') {
		updateToolbarItem(statusbar, 'StateTableCell', $('#StateTableCell').html(state ? localizeStateTableCell(state) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:StatusBarFunc') {
		var item = statusbar.get('StateTableCellMenu');
		if (item) {
			item.selected = [];
			// Check 'None' even when state is 0
			if (state === '0') {
				state = 1;
			}
			for (var it = 0; it < item.items.length; it++) {
				if (item.items[it].id & state) {
					item.selected.push(item.items[it].id);
				}
			}
		}
	}
	else if (commandName === '.uno:StatePageNumber') {
		state = toLocalePattern('Page %1 of %2', 'Page (\\d+) of (\\d+)', state, '%1', '%2');
		updateToolbarItem(statusbar, 'StatePageNumber', $('#StatePageNumber').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:StateWordCount') {
		state = toLocalePattern('%1 words, %2 characters', '([\\d,]+) words, ([\\d,]+) characters', state, '%1', '%2');
		updateToolbarItem(statusbar, 'StateWordCount', $('#StateWordCount').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:PageStatus') {
		state = toLocalePattern('Slide %1 of %2', 'Slide (\\d+) of (\\d+)', state, '%1', '%2');
		updateToolbarItem(statusbar, 'PageStatus', $('#PageStatus').html(state ? state : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp').parent().html());
	}
	else if (commandName === '.uno:DocumentRepair') {
		if (state === 'true') {
			toolbar.enable('repair');
		} else {
			toolbar.disable('repair');
		}
	}

	var id = unoCmdToToolbarId(commandName);
	if (state === 'true') {
		toolbar.enable(id);
		toolbar.check(id);
	}
	else if (state === 'false') {
		toolbar.enable(id);
		toolbar.uncheck(id);
	}
	// Change the toolbar button states if we are in editmode
	// If in non-edit mode, will be taken care of when permission is changed to 'edit'
	else if (map._permission === 'edit' && (state === 'enabled' || state === 'disabled')) {
		var toolbarUp = toolbar;
		if (_useSimpleUI()) {
			toolbarUp = statusbar;
		}
		if (state === 'enabled') {
			toolbarUp.enable(id);
		} else {
			toolbarUp.uncheck(id);
			toolbarUp.disable(id);
		}
	}
}


function onCommandValues(e) {
	if (e.commandName === '.uno:LanguageStatus' && L.Util.isArray(e.commandValues)) {
		var translated, neutral;
		var constLang = '.uno:LanguageStatus?Language:string=';
		var constDefault = 'Default_RESET_LANGUAGES';
		var constNone = 'Default_LANGUAGE_NONE';
		var resetLang = _('Reset to Default Language');
		var noneLang = _('None (Do not check spelling)');
		var languages = [];
		e.commandValues.forEach(function (language) {
			languages.push({ translated: _(language), neutral: language });
		});
		languages.sort(function (a, b) {
			return a.translated < b.translated ? -1 : a.translated > b.translated ? 1 : 0;
		});

		var toolbaritems = [];
		toolbaritems.push({ text: noneLang,
		 id: 'nonelanguage',
		 uno: constLang + constNone });


		for (var lang in languages) {
			translated = languages[lang].translated;
			neutral = languages[lang].neutral;
			toolbaritems.push({ id: neutral, text: translated, uno: constLang + encodeURIComponent('Default_' + neutral) });
		}

		toolbaritems.push({ id: 'reset', text: resetLang, uno: constLang + constDefault });

		w2ui['toolbar-down'].set('LanguageStatus', {items: toolbaritems});
	}
}

function updateCommandValues() {
	var data = [];
	// 1) For .uno:StyleApply
	// we need an empty option for the place holder to work
	if ($('.styles-select option').length === 0) {
		var styles = [];
		var topStyles = [];
		var commandValues = map.getToolbarCommandValues('.uno:StyleApply');
		if (typeof commandValues === 'undefined')
			return;
		var commands = commandValues.Commands;
		if (commands && commands.length > 0) {
			// Inserts a separator element
			data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

			commands.forEach(function (command) {
				var translated = command.text;
				if (L.Styles.styleMappings[command.text]) {
					// if it's in English, translate it
					translated = L.Styles.styleMappings[command.text].toLocaleString();
				}
				data = data.concat({id: command.id, text: translated });
			}, this);
		}

		if (map.getDocType() === 'text') {
			styles = commandValues.ParagraphStyles.slice(7, 19);
			topStyles = commandValues.ParagraphStyles.slice(0, 7);
		}
		else if (map.getDocType() === 'spreadsheet') {
			styles = commandValues.CellStyles;
		}
		else if (map.getDocType() === 'presentation') {
			// styles are not applied for presentation
			return;
		}

		if (topStyles.length > 0) {
			// Inserts a separator element
			data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

			topStyles.forEach(function (style) {
				data = data.concat({id: style, text: L.Styles.styleMappings[style].toLocaleString()});
			}, this);
		}

		if (styles !== undefined && styles.length > 0) {
			// Inserts a separator element
			data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

			styles.forEach(function (style) {
				var localeStyle;
				if (style.startsWith('outline')) {
					var outlineLevel = style.split('outline')[1];
					localeStyle = 'Outline'.toLocaleString() + ' ' + outlineLevel;
				} else {
					localeStyle = L.Styles.styleMappings[style];
					localeStyle = localeStyle === undefined ? style : localeStyle.toLocaleString();
				}

				data = data.concat({id: style, text: localeStyle});
			}, this);
		}

		$('.styles-select').select2({
			data: data,
			placeholder: _('Style')
		});
		$('.styles-select').val(stylesSelectValue).trigger('change');
		$('.styles-select').on('select2:select', onStyleSelect);
	}

	if ($('.fonts-select option').length === 0) {
		// 2) For .uno:CharFontName
		commandValues = map.getToolbarCommandValues('.uno:CharFontName');
		if (typeof commandValues === 'undefined') {
			return;
		}
		data = []; // reset data in order to avoid that the font select box is populated with styles, too.
		// Old browsers like IE11 et al don't like Object.keys with
		// empty arguments
		if (typeof commandValues === 'object') {
			data = data.concat(Object.keys(commandValues));
		}
		$('.fonts-select').select2({
			data: data.sort(function (a, b) {  // also sort(localely)
				return a.localeCompare(b);
			}),
			placeholder: _('Font')
		});
		$('.fonts-select').on('select2:select', onFontSelect);
		$('.fonts-select').val(fontsSelectValue).trigger('change');
	}
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

	var toolbar = w2ui['toolbar-down'];
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

	toolbar = w2ui['toolbar-up'];
	if (e.docType !== 'text' && e.docType !== 'spreadsheet') {
		toolbar.hide('incrementindent');
		toolbar.hide('decrementindent');
		toolbar.hide('incdecindent');
	}

	toolbar = w2ui['spreadsheet-toolbar'];
	if (e.docType === 'spreadsheet') {
		toolbar.show('firstrecord');
		toolbar.show('nextrecord');
		toolbar.show('prevrecord');
		toolbar.show('lastrecord');
		toolbar.show('insertsheet');
	}
}

function onCommandResult(e) {
	var commandName = e.commandName;

	if (commandName === '.uno:Save') {
		if (e.success) {
			// Saved a new version; the document is modified.
			map._everModified = true;
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
		$('#tb_toolbar-up_item_repair').w2overlay({ html: '<div style="padding: 10px; line-height: 150%">' +
			_('Conflict Undo/Redo with multiple users. Please use document repair to resolve') + '</div>'});
	}
}

function onUpdatePermission(e) {
	var toolbar = w2ui['toolbar-up'];

	// copy the first array
	var items = toolbar.items.slice();
	for (var idx in items) {
		var unoCmd = map.getDocType() === 'spreadsheet' ? items[idx].unosheet : items[idx].uno;
		var keepDisabled = map['stateChangeHandler'].getItemValue(unoCmd) === 'disabled';
		if (e.perm === 'edit') {
			if (!keepDisabled) {
				toolbar.enable(items[idx].id);
			}
		} else {
			toolbar.disable(items[idx].id);
		}
	}

	var spreadsheetButtons = ['firstrecord', 'prevrecord', 'nextrecord', 'lastrecord', 'insertsheet'];
	var formulaBarButtons = ['sum', 'function'];
	var presentationButtons = ['insertpage', 'duplicatepage', 'deletepage'];
	var toolbarDownButtons = ['next', 'prev'];
	if (e.perm === 'edit') {
		// Enable list boxes
		$('.styles-select').prop('disabled', false);
		$('.fonts-select').prop('disabled', false);
		$('.fontsizes-select').prop('disabled', false);

		// Enable formula bar
		$('#addressInput').prop('disabled', false);
		$('#formulaInput').prop('disabled', false);
		toolbar = w2ui.formulabar;
		formulaBarButtons.forEach(function(id) {
			toolbar.enable(id);
		});

		toolbar = w2ui['spreadsheet-toolbar'];
		spreadsheetButtons.forEach(function(id) {
			toolbar.enable(id);
		});

		toolbar = w2ui['presentation-toolbar'];
		presentationButtons.forEach(function(id) {
			toolbar.enable(id);
		});

		toolbar = w2ui['toolbar-down'];
		toolbarDownButtons.forEach(function(id) {
			toolbar.enable(id);
		});
		$('#search-input').prop('disabled', false);
	}
	else {
		// Disable list boxes
		$('.styles-select').prop('disabled', true);
		$('.fonts-select').prop('disabled', true);
		$('.fontsizes-select').prop('disabled', true);

		// Disable formula bar
		$('#addressInput').prop('disabled', true);
		$('#formulaInput').prop('disabled', true);

		toolbar = w2ui.formulabar;
		formulaBarButtons.forEach(function(id) {
			toolbar.disable(id);
		});

		toolbar = w2ui['spreadsheet-toolbar'];
		spreadsheetButtons.forEach(function(id) {
			toolbar.disable(id);
		});

		toolbar = w2ui['presentation-toolbar'];
		presentationButtons.forEach(function(id) {
			toolbar.disable(id);
		});

		toolbar = w2ui['toolbar-down'];
		toolbarDownButtons.forEach(function(id) {
			toolbar.disable(id);
		});
		$('#search-input').prop('disabled', true);
	}
}

function goToViewId(id) {
	var docLayer = map._docLayer;

	if (id === -1)
		return;

	if (map.getDocType() === 'spreadsheet') {
		docLayer.goToCellViewCursor(id);
	} else if (map.getDocType() === 'text' || map.getDocType() === 'presentation') {
		docLayer.goToViewCursor(id);
	}
}

function onUseritemClicked(e) { // eslint-disable-line no-unused-vars
	var docLayer = map._docLayer;
	var viewId = parseInt(e.currentTarget.id.replace('user-', ''));

	goToViewId(viewId);

	if (viewId === map._docLayer._viewId) {
		$('#tb_toolbar-down_item_userlist').w2overlay('');
		return;
	} else if (docLayer._followThis !== -1) {
		map.fire('setFollowOff');
	}

	docLayer._followThis = viewId;
	docLayer._followUser = true;
	docLayer._followEditor = false;

	selectUser(viewId);
}

global.onUseritemClicked = onUseritemClicked;

function editorUpdate(e) { // eslint-disable-line no-unused-vars
	var docLayer = map._docLayer;

	if (e.target.checked) {
		var editorId = docLayer._editorId;

		docLayer._followUser = false;
		docLayer._followEditor = true;
		if (editorId !== -1 && editorId !== docLayer.viewId) {
			goToViewId(editorId);
			docLayer._followThis = editorId;
		}

		var userlistItem = w2ui['toolbar-down'].get('userlist');
		if (userlistItem !== null) {
			$('.selected-user').removeClass('selected-user');
			if ($(userlistItem.html).find('.selected-user').length !== 0)
				userlistItem.html = $(userlistItem.html).find('.selected-user').removeClass('selected-user').parent().parent().parent()[0].outerHTML;
		}
	}
	else {
		docLayer._followEditor = false;
		docLayer._followThis = -1;
	}
	$('#tb_toolbar-down_item_userlist').w2overlay('');
}

global.editorUpdate = editorUpdate;

function selectUser(viewId) {
	var userlistItem = w2ui['toolbar-down'].get('userlist');
	if (userlistItem === null) {
		return;
	}

	userlistItem.html = $(userlistItem.html).find('#user-' + viewId).addClass('selected-user').parent().parent().parent()[0].outerHTML;
	$('#tb_toolbar-down_item_userlist').w2overlay('');
}

function deselectUser(viewId) {
	var userlistItem = w2ui['toolbar-down'].get('userlist');
	if (userlistItem === null) {
		return;
	}

	userlistItem.html = $(userlistItem.html).find('#user-' + viewId).removeClass('selected-user').parent().parent().parent()[0].outerHTML;
}

function getUserItem(viewId, userName, extraInfo, color) {
	var className = 'useritem';
	if (extraInfo !== undefined && extraInfo.avatar !== undefined) {
		className = 'useritem-avatar';
	}

	var html = '<tr class="' + className + '" id="user-' + viewId + '" onclick="onUseritemClicked(event)">' +
		     '<td class=usercolor style="background-color: ' + color  +';">';
	if (extraInfo !== undefined && extraInfo.avatar !== undefined) {
		html += '<img src="' + extraInfo.avatar + '" width="32" height="32" />';
	}

	// TODO: Add mail and other links as sub-menu.
	html += '</td>' +
		     '<td class="username loleaflet-font" >' + userName + '</td>' +
	    '</tr>';

	return html;
}

function updateUserListCount() {
	var userlistItem = w2ui['toolbar-down'].get('userlist');
	if (userlistItem === null) {
		return;
	}

	var count = $(userlistItem.html).find('#userlist_table tbody tr').length;
	if (count > 1) {
		userlistItem.text = nUsers.replace('%n', count);
	} else if (count === 1) {
		userlistItem.text = oneUser;
	} else {
		userlistItem.text = noUser;
	}

	w2ui['toolbar-down'].refresh();
}

function escapeHtml(input) {
	return $('<div>').text(input).html();
}

function onAddView(e) {
	var username = escapeHtml(e.username);
	$('#tb_toolbar-down_item_userlist')
		.w2overlay({
			class: 'loleaflet-font',
			html: userJoinedPopupMessage.replace('%user', username),
			style: 'padding: 5px'
		});
	clearTimeout(userPopupTimeout);
	userPopupTimeout = setTimeout(function() {
		$('#tb_toolbar-down_item_userlist').w2overlay('');
		clearTimeout(userPopupTimeout);
		userPopupTimeout = null;
	}, 3000);

	var color = L.LOUtil.rgbToHex(map.getViewColor(e.viewId));
	if (e.viewId === map._docLayer._viewId) {
		username = _('You');
		color = '#000';
	}

	// Mention readonly sessions in userlist
	if (e.readonly) {
		username += ' (' +  _('Readonly') + ')';
	}

	var userlistItem = w2ui['toolbar-down'].get('userlist');
	if (userlistItem !== null) {
		var newhtml = $(userlistItem.html).find('#userlist_table tbody').append(getUserItem(e.viewId, username, e.extraInfo, color)).parent().parent()[0].outerHTML;
		userlistItem.html = newhtml;
		updateUserListCount();
	}
}

$(window).resize(function() {
	resizeToolbar();
});

$(document).ready(function() {
	if (!closebutton) {
		$('#closebuttonwrapper').hide();
	} else {
		$('#closebutton').click(function() {
			if (window.ThisIsAMobileApp) {
				window.webkit.messageHandlers.lool.postMessage('BYE', '*');
			} else {
				map.fire('postMessage', {msgId: 'close', args: {EverModified: map._everModified, Deprecated: true}});
				map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: map._everModified}});
			}
			map.remove();
		});
	}

	// Attach insert file action
	$('#insertgraphic').on('change', onInsertFile);
});

function setupToolbar(e) {
	map = e;

	createToolbar();

	map.on('updateEditorName', function(e) {
		$('#currently-msg').show();
		$('#current-editor').text(e.username);
	});

	map.on('setFollowOff', function() {
		var docLayer = map._docLayer;
		var viewId = docLayer._followThis;
		if (viewId !== -1 && map._viewInfo[viewId]) {
			deselectUser(viewId);
		}
		docLayer._followThis = -1;
		docLayer._followUser = false;
		docLayer._followEditor = false;
	});

	map.on('keydown', function (e) {
		if (e.originalEvent.ctrlKey && !e.originalEvent.altKey &&
		   (e.originalEvent.key === 'f' || e.originalEvent.key === 'F')) {
			var entry = L.DomUtil.get('search-input');
			entry.focus();
			entry.select();
			e.originalEvent.preventDefault();
		}
	});

	map.on('hyperlinkclicked', function (e) {
		map.fire('warn', {url: e.url, map: map, cmd: 'openlink'});
	});

	map.on('cellformula', function (e) {
		if (document.activeElement !== L.DomUtil.get('formulaInput')) {
			// if the user is not editing the formula bar
			L.DomUtil.get('formulaInput').value = e.formula;
		}
	});

	map.on('zoomend', function () {
		var zoomPercent = 100;
		var zoomSelected = null;
		switch (map.getZoom()) {
		case 6:  zoomPercent =  50; zoomSelected = 'zoom50'; break;
		case 7:  zoomPercent =  60; zoomSelected = 'zoom60'; break;
		case 8:  zoomPercent =  70; zoomSelected = 'zoom70'; break;
		case 9:  zoomPercent =  85; zoomSelected = 'zoom85'; break;
		case 10: zoomPercent = 100; zoomSelected = 'zoom100'; break;
		case 11: zoomPercent = 120; zoomSelected = 'zoom120'; break;
		case 12: zoomPercent = 150; zoomSelected = 'zoom150'; break;
		case 13: zoomPercent = 175; zoomSelected = 'zoom175'; break;
		case 14: zoomPercent = 200; zoomSelected = 'zoom200'; break;
		default:
			var zoomRatio = map.getZoomScale(map.getZoom(), map.options.zoom);
			zoomPercent = Math.round(zoomRatio * 100) + '%';
			break;
		}
		w2ui['toolbar-down'].set('zoom', {text: zoomPercent, selected: zoomSelected});
	});

	map.on('celladdress', function (e) {
		if (document.activeElement !== L.DomUtil.get('addressInput')) {
			// if the user is not editing the address field
			L.DomUtil.get('addressInput').value = e.address;
		}
	});

	map.on('search', function (e) {
		var searchInput = L.DomUtil.get('search-input');
		var toolbar = w2ui['toolbar-down'];
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
			}, 500);
		}
	});

	map.on('updatetoolbarcommandvalues', function() {
		w2ui['toolbar-up'].refresh();
	});

	map.on('showbusy', function(e) {
		w2utils.lock(w2ui['toolbar-down'].box, e.label, true);
	});

	map.on('hidebusy', function() {
		// If locked, unlock
		if (w2ui['toolbar-down'].box.firstChild.className === 'w2ui-lock') {
			w2utils.unlock(w2ui['toolbar-down'].box);
		}
	});

	map.on('removeview', function(e) {
		var username = this.escapeHtml(e.username);
		$('#tb_toolbar-down_item_userlist')
			.w2overlay({
				class: 'loleaflet-font',
				html: userLeftPopupMessage.replace('%user', username),
				style: 'padding: 5px'
			});
		clearTimeout(userPopupTimeout);
		userPopupTimeout = setTimeout(function() {
			$('#tb_toolbar-down_item_userlist').w2overlay('');
			clearTimeout(userPopupTimeout);
			userPopupTimeout = null;
		}, 3000);

		if (e.viewId === map._docLayer._followThis) {
			map._docLayer._followThis = -1;
			map._docLayer._followUser = false;
		}

		var userlistItem = w2ui['toolbar-down'].get('userlist');
		if (userlistItem !== null) {
			userlistItem.html = $(userlistItem.html).find('#user-' + e.viewId).remove().end()[0].outerHTML;
			updateUserListCount();
		}
	});

	map.on('doclayerinit', onDocLayerInit);
	map.on('wopiprops', onWopiProps);
	map.on('addview', onAddView);
	map.on('updatepermission', onUpdatePermission);
	map.on('commandresult', onCommandResult);
	map.on('updateparts pagenumberchanged', onUpdateParts);
	map.on('commandstatechanged', onCommandStateChanged);
	map.on('commandvalues', onCommandValues, this);
}

global.setupToolbar = setupToolbar;

}(window));
