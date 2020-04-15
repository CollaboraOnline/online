/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * LibreOffice Online toolbar
 */

/* global $ w2ui w2utils vex _ _UNO */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/
(function(global) {

var map;

function onDelete(e) {
	if (e !== false) {
		map.deletePage();
	}
}

function _updateVisibilityForToolbar(toolbar) {
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
	});

	console.log('explicitly hiding: ' + toHide);
	console.log('explicitly showing: ' + toShow);

	toHide.forEach(function(item) { toolbar.hide(item); });
	toShow.forEach(function(item) { toolbar.show(item); });
}

function _updateToolbarsVisibility() {
	_updateVisibilityForToolbar(w2ui['editbar']);
}

function resizeToolbar() {
	if ($(window).width() !== map.getSize().x) {
		var toolbarUp = w2ui['editbar'];
		var statusbar = w2ui['actionbar'];
		toolbarUp.resize();
		statusbar.resize();
	}
}

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

function onClick(e, id, item) {
	if (w2ui['editbar'].get(id) !== null) {
		var toolbar = w2ui['editbar'];
		item = toolbar.get(id);
	}
	else if ('document-signing-bar' in w2ui && w2ui['document-signing-bar'].get(id) !== null) {
		toolbar = w2ui['document-signing-bar'];
		item = toolbar.get(id);
	}
	else if ('actionbar' in w2ui && w2ui['actionbar'].get(id) !== null) {
		toolbar = w2ui['actionbar'];
		item = toolbar.get(id);
	}
	else if ('spreadsheet-toolbar' in w2ui && w2ui['spreadsheet-toolbar'].get(id) !== null) {
		toolbar = w2ui['spreadsheet-toolbar'];
		item = toolbar.get(id);
	}
	else if ('presentation-toolbar' in w2ui && w2ui['presentation-toolbar'].get(id) !== null) {
		toolbar = w2ui['presentation-toolbar'];
		item = toolbar.get(id);
	}
	else if (w2ui['searchbar'].get(id) !== null) {
		toolbar = w2ui['searchbar'];
		item = toolbar.get(id);
	}
	else {
		throw new Error('unknown id: ' + id);
	}

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
		if (map._permission !== 'readonly') {
			map.fire('postMessage', {msgId: 'UI_Save'});
			if (!map._disableDefaultAction['UI_Save']) {
				map.save(false /* An explicit save should terminate cell edit */, false /* An explicit save should save it again */);
			}
		}
	}
	else if (id === 'repair') {
		map._socket.sendMessage('commandvalues command=.uno:DocumentRepair');
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
	else if (id === 'insertpage') {
		map.insertPage();
	}
	else if (id === 'duplicatepage') {
		map.duplicatePage();
	}
	else if (id === 'deletepage') {
		vex.dialog.confirm({
			message: _('Are you sure you want to delete this page?'),
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('OK') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			],
			callback: onDelete
		});
	}
	else if (id === 'insertsheet') {
		var nPos = $('#spreadsheet-tab-scroll')[0].childElementCount;
		map.insertPage(nPos);
		map.insertPage.scrollToEnd = true;
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
		// Set a very high value, so that scroll is set to the maximum possible value internally.
		// https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft
		L.DomUtil.get('spreadsheet-tab-scroll').scrollLeft = 100000;
	}
	else if (id === 'insertgraphic' || item.id === 'localgraphic') {
		L.DomUtil.get('insertgraphic').click();
	}
	else if (item.id === 'remotegraphic') {
		map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
	}
	else if (id === 'fontcolor' && typeof e.color === 'undefined') {
		map.fire('mobilewizard', getColorPickerData('Font Color'));
	}
	else if (id === 'backcolor' && typeof e.color === 'undefined') {
		map.fire('mobilewizard', getColorPickerData('Highlight Color'));
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
		map._docLayer.postKeyboardEvent('input',
						 map.keyboard.keyCodes.enter,
						 map.keyboard._toUNOKeyCode(map.keyboard.keyCodes.enter));

		w2ui['formulabar'].hide('acceptformula', 'cancelformula');
		w2ui['formulabar'].show('sum', 'function');
	}
	else if (id === 'fold' || id === 'hamburger-tablet') {
		map.toggleMenubar();
	}
	else if (id === 'close' || id === 'closemobile') {
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
	else if (id === 'link') {
		map.showHyperlinkDialog();
	}
	else if (id === 'languagecode') {
		map.fire('languagedialog');
	}
	else {
		map.handleSigningClickEvent(id, item); // this handles a bunch of signing bar click events
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

	if (color.startsWith('#'))
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

	default: console.log('ignored border: ' + num);
	}

	// TODO we may consider keeping it open in the future if we add border color
	// and style to this popup too
	closePopup();
}

global.setBorderStyle = setBorderStyle;

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

			map._socket.sendMessage(msg);

			closePopup();
		}
	}, '.col');
}

var shapes = {
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

	'Stars': [
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
};

function createShapesPanel() {
	var $grid = $('<div/>').addClass('insertshape-grid');

	for (var s in shapes) {
		var $rowHeader = $('<div/>').addClass('row-header loleaflet-font').append(_(s));
		$grid.append($rowHeader);
		var $row = $('<div/>').addClass('row');
		$grid.append($row);
		for (var idx = 0; idx < shapes[s].length; ++idx) {
			var shape = shapes[s][idx];
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

function insertShapes(mobile) {
	var width = 10;
	var $grid = $('.insertshape-grid');

	if ($grid.children().size() > 0)
		return;

	for (var s in shapes) {
		var $rowHeader = $('<div/>').addClass('row-header loleaflet-font').append(_(s));
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
			if (mobile)
				vex.closeAll();
			else
				closePopup();
		}
	});
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
		text: type,
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

	if (window.mode.isMobile()) {
		$('#toolbar-search').hide();
		$('#mobile-edit-button').show();
	} else {
		$('#toolbar-down').show();
		initNormalToolbar();
	}
}

// mobile:false means hide it both for normal Online used from a mobile phone browser, and in a mobile app on a mobile phone
// mobilebrowser:false means hide it for normal Online used from a mobile browser, but don't hide it in a mobile app
// tablet:true means show it in normal Online from a tablet browser, and in a mobile app on a tablet
// tablet:false means hide it in normal Online used from a tablet browser, and in a mobile app on a tablet

function createMainToolbar() {
	var toolItems = [
		{type: 'button',  id: 'closemobile',  img: 'closemobile', desktop: false, mobile: false, tablet: true, hidden: true},
		{type: 'button',  id: 'save', img: 'save', hint: _UNO('.uno:Save')},
		{type: 'button',  id: 'print', img: 'print', hint: _UNO('.uno:Print', 'text'), mobile: false, tablet: false},
		{type: 'break', id: 'savebreak', mobile: false},
		{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true, mobile: false},
		{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true, mobile: false},
		{type: 'button',  id: 'formatpaintbrush',  img: 'copyformat', hint: _UNO('.uno:FormatPaintbrush'), uno: 'FormatPaintbrush', mobile: false},
		{type: 'button',  id: 'reset',  img: 'deleteformat', hint: _UNO('.uno:ResetAttributes', 'text'), uno: 'ResetAttributes', mobile: false},
		{type: 'break', mobile: false, tablet: false,},
		{type: 'html', id: 'styles',
			html: '<select class="styles-select"><option>' + _('Default Style') + '</option></select>',
			onRefresh: function (edata) {
				if (!edata.item.html) {
					edata.isCancelled = true;
				} else {
					$.extend(edata, { onComplete: function (e) {
						$('.styles-select').select2();
						e.item.html = undefined;
					}});
				}
			}, hidden: true, desktop: true, mobile: false, tablet: false},
		{type: 'html', id: 'fonts',
			html: '<select class="fonts-select"><option>Liberation Sans</option></select>',
			onRefresh: function (edata) {
				if (!edata.item.html) {
					edata.isCancelled = true;
				} else {
					$.extend(edata, { onComplete: function (e) {
						$('.fonts-select').select2();
						e.item.html = undefined;
					}});
				}
			}, mobile: false},
		{type: 'html',   id: 'fontsizes',
			html: '<select class="fontsizes-select">',
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
		{type: 'break', id: 'breakstyles', mobile: false, tablet: false },
		{type: 'button', id: 'languagecode', desktop: false, mobile: true, tablet: false},
		{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: 'Bold'},
		{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic'},
		{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: 'Underline'},
		{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: 'Strikeout'},
		{type: 'break', id: 'breakformatting'},
		{type: 'text-color',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor')},
		{type: 'color',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackColor', 'text'), hidden: true},
		{type: 'color',  id: 'backgroundcolor', img: 'backgroundcolor', hint: _UNO('.uno:BackgroundColor'), hidden: true},
		{type: 'break' , id: 'breakcolor', mobile:false},
		{type: 'button',  id: 'leftpara',  img: 'alignleft', hint: _UNO('.uno:LeftPara', '', true),
			uno: {textCommand: 'LeftPara', objectCommand: 'ObjectAlignLeft'},
			hidden: true, unosheet: 'AlignLeft', disabled: true},
		{type: 'button',  id: 'centerpara',  img: 'alignhorizontal', hint: _UNO('.uno:CenterPara', '', true),
			uno: {textCommand: 'CenterPara', objectCommand: 'AlignCenter'},
			hidden: true, unosheet: 'AlignHorizontalCenter', disabled: true},
		{type: 'button',  id: 'rightpara',  img: 'alignright', hint: _UNO('.uno:RightPara', '', true),
			uno: {textCommand: 'RightPara', objectCommand: 'ObjectAlignRight'},
			hidden: true, unosheet: 'AlignRight', disabled: true},
		{type: 'button',  id: 'justifypara',  img: 'alignblock', hint: _UNO('.uno:JustifyPara', '', true), uno: 'JustifyPara', hidden: true, unosheet: '', disabled: true},
		{type: 'break', id: 'breakpara', hidden: true},
		{type: 'drop',  id: 'setborderstyle',  img: 'setborderstyle', hint: _('Borders'), hidden: true,
			html: '<table id="setborderstyle-grid"><tr><td class="w2ui-tb-image w2ui-icon frame01" onclick="setBorderStyle(1)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame02" onclick="setBorderStyle(2)"></td><td class="w2ui-tb-image w2ui-icon frame03" onclick="setBorderStyle(3)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame04" onclick="setBorderStyle(4)"></td></tr><tr><td class="w2ui-tb-image w2ui-icon frame05" onclick="setBorderStyle(5)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame06" onclick="setBorderStyle(6)"></td><td class="w2ui-tb-image w2ui-icon frame07" onclick="setBorderStyle(7)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame08" onclick="setBorderStyle(8)"></td></tr><tr><td class="w2ui-tb-image w2ui-icon frame09" onclick="setBorderStyle(9)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame10" onclick="setBorderStyle(10)"></td><td class="w2ui-tb-image w2ui-icon frame11" onclick="setBorderStyle(11)"></td>' +
			      '<td class="w2ui-tb-image w2ui-icon frame12" onclick="setBorderStyle(12)"></td></tr><tr>' +
			      '<td colspan="4" class="w2ui-tb-image w2ui-icon frame13" onclick="setBorderStyle(0)"><div id="div-frame13">' + _('More...') + '</div></td></tr></table>'
		},
		{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), hidden: true, uno: 'ToggleMergeCells', disabled: true},
		{type: 'break', id: 'breakmergecells', hidden: true},
		{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), hidden: true,
			items: [
				{id: 'alignleft', text: _UNO('.uno:AlignLeft', 'spreadsheet', true), icon: 'alignleft', uno: 'AlignLeft'},
				{id: 'alignhorizontalcenter', text: _UNO('.uno:AlignHorizontalCenter', 'spreadsheet', true), icon: 'alignhorizontal', uno: 'AlignHorizontalCenter'},
				{id: 'alignright', text: _UNO('.uno:AlignRight', 'spreadsheet', true), icon: 'alignright', uno: 'AlignRight'},
				{id: 'alignblock', text: _UNO('.uno:AlignBlock', 'spreadsheet', true), icon: 'alignblock', uno: 'AlignBlock'},
			]},
		{type: 'menu',  id: 'linespacing',  img: 'linespacing', hint: _UNO('.uno:FormatSpacingMenu'), hidden: true,
			items: [
				{id: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: 'SpacePara1'},
				{id: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: 'SpacePara15'},
				{id: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: 'SpacePara2'},
				{type: 'break'},
				{id: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: 'ParaspaceIncrease'},
				{id: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: 'ParaspaceDecrease'}
			]},
		{type: 'button',  id: 'wraptext',  img: 'wraptext', hint: _UNO('.uno:WrapText', 'spreadsheet', true), hidden: true, uno: 'WrapText', disabled: true},
		{type: 'break', id: 'breakspacing', hidden: true},
		{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true), hidden: true, uno: 'DefaultNumbering', disabled: true},
		{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), hidden: true, uno: 'DefaultBullet', disabled: true},
		{type: 'break', id: 'breakbullet', hidden: true},
		{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: 'IncrementIndent', hidden: true, disabled: true},
		{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: 'DecrementIndent', hidden: true, disabled: true},
		{type: 'break', id: 'breakindent', hidden: true},
		{type: 'button',  id: 'sortascending',  img: 'sortascending', hint: _UNO('.uno:SortAscending', 'spreadsheet', true), uno: 'SortAscending', disabled: true, hidden: true},
		{type: 'button',  id: 'sortdescending',  img: 'sortdescending', hint: _UNO('.uno:SortDescending', 'spreadsheet', true), uno: 'SortDescending', disabled: true, hidden: true},
		{type: 'break', id: 'breaksorting', hidden: true},
		{type: 'drop', id: 'conditionalformaticonset',  img: 'conditionalformatdialog', hint: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet', true), hidden: true,
			html: '<table id="conditionalformatmenu-grid"><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset00" onclick="setConditionalFormatIconSet(0)"/><td class="w2ui-tb-image w2ui-icon iconset01" onclick="setConditionalFormatIconSet(1)"/><td class="w2ui-tb-image w2ui-icon iconset02" onclick="setConditionalFormatIconSet(2)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset03" onclick="setConditionalFormatIconSet(3)"/><td class="w2ui-tb-image w2ui-icon iconset04" onclick="setConditionalFormatIconSet(4)"/><td class="w2ui-tb-image w2ui-icon iconset05" onclick="setConditionalFormatIconSet(5)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset06" onclick="setConditionalFormatIconSet(6)"/><td class="w2ui-tb-image w2ui-icon iconset08" onclick="setConditionalFormatIconSet(8)"/><td class="w2ui-tb-image w2ui-icon iconset09" onclick="setConditionalFormatIconSet(9)"/></tr><tr>' + // iconset07 deliberately left out, see the .css for the reason
				  '<td class="w2ui-tb-image w2ui-icon iconset10" onclick="setConditionalFormatIconSet(10)"/><td class="w2ui-tb-image w2ui-icon iconset11" onclick="setConditionalFormatIconSet(11)"/><td class="w2ui-tb-image w2ui-icon iconset12" onclick="setConditionalFormatIconSet(12)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset13" onclick="setConditionalFormatIconSet(13)"/><td class="w2ui-tb-image w2ui-icon iconset14" onclick="setConditionalFormatIconSet(14)"/><td class="w2ui-tb-image w2ui-icon iconset15" onclick="setConditionalFormatIconSet(15)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset16" onclick="setConditionalFormatIconSet(16)"/><td class="w2ui-tb-image w2ui-icon iconset17" onclick="setConditionalFormatIconSet(17)"/><td class="w2ui-tb-image w2ui-icon iconset18" onclick="setConditionalFormatIconSet(18)"/></tr><tr>' +
				  '<td class="w2ui-tb-image w2ui-icon iconset19" onclick="setConditionalFormatIconSet(19)"/><td class="w2ui-tb-image w2ui-icon iconset20" onclick="setConditionalFormatIconSet(20)"/><td class="w2ui-tb-image w2ui-icon iconset21" onclick="setConditionalFormatIconSet(21)"/></tr></table>'
		},
		{type: 'button',  id: 'numberformatcurrency',  img: 'numberformatcurrency', hint: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), hidden: true, uno: 'NumberFormatCurrency', disabled: true},
		{type: 'button',  id: 'numberformatpercent',  img: 'numberformatpercent', hint: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), hidden: true, uno: 'NumberFormatPercent', disabled: true},
		{type: 'button',  id: 'numberformatdecdecimals',  img: 'numberformatdecdecimals', hint: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatDecDecimals', disabled: true},
		{type: 'button',  id: 'numberformatincdecimals',  img: 'numberformatincdecimals', hint: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatIncDecimals', disabled: true},
		{type: 'break',   id: 'break-number', hidden: true},
		{type: 'button',  id: 'inserttextbox', img: 'text', hint: _UNO('.uno:Text', '', true), uno: 'Text?CreateDirectly:bool=true', hidden: true},
		{type: 'button',  id: 'insertannotation', img: 'annotation', hint: _UNO('.uno:InsertAnnotation', '', true), hidden: true},
		{type: 'drop',  id: 'inserttable',  img: 'inserttable', hint: _('Insert table'), hidden: true, overlay: {onShow: insertTable},
		 html: '<div id="inserttable-wrapper"><div id="inserttable-popup" class="inserttable-pop ui-widget ui-corner-all"><div class="inserttable-grid"></div><div id="inserttable-status" class="loleaflet-font" style="padding: 5px;"><br/></div></div></div>'},
		{type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true)},
		{type: 'menu', id: 'menugraphic', img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true), hidden: true,
			items: [
				{id: 'localgraphic', text: _('Insert Local Image')},
				{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true)},
			]},
		{type: 'button',  id: 'insertobjectchart',  img: 'insertobjectchart', hint: _UNO('.uno:InsertObjectChart', '', true), uno: 'InsertObjectChart'},
		{type: 'drop',  id: 'insertshapes',  img: 'basicshapes_ellipse', hint: _('Insert shapes'), overlay: {onShow: insertShapes},
			html: '<div id="insertshape-wrapper"><div id="insertshape-popup" class="insertshape-pop ui-widget ui-corner-all"><div class="insertshape-grid"></div></div></div>'},
		{type: 'button',  id: 'link',  img: 'link', hint: _UNO('.uno:HyperlinkDialog', '', true), disabled: true},
		{type: 'button',  id: 'insertsymbol', img: 'insertsymbol', hint: _UNO('.uno:InsertSymbol', '', true), uno: 'InsertSymbol'},
		{type: 'spacer'},
		{type: 'button',  id: 'edit',  img: 'edit'},
		{type: 'button',  id: 'sidebar', img: 'sidebar_modify_page', hint: _UNO('.uno:Sidebar', '', true), uno: '.uno:Sidebar', hidden: true},
		{type: 'button',  id: 'modifypage', img: 'sidebar_modify_page', hint: _UNO('.uno:ModifyPage', 'presentation', true), uno: '.uno:ModifyPage', hidden: true},
		{type: 'button',  id: 'slidechangewindow', img: 'sidebar_slide_change', hint: _UNO('.uno:SlideChangeWindow', 'presentation', true), uno: '.uno:SlideChangeWindow', hidden: true},
		{type: 'button',  id: 'customanimation', img: 'sidebar_custom_animation', hint: _UNO('.uno:CustomAnimation', 'presentation', true), uno: '.uno:CustomAnimation', hidden: true},
		{type: 'button',  id: 'masterslidespanel', img: 'sidebar_master_slides', hint: _UNO('.uno:MasterSlidesPanel', 'presentation', true), uno: '.uno:MasterSlidesPanel', hidden: true},
		{type: 'break', id: 'breaksidebar', hidden: true},
		{type: 'button',  id: 'fold',  img: 'fold', desktop: true, mobile: false, hidden: true},
		{type: 'button',  id: 'hamburger-tablet',  img: 'hamburger', desktop: false, mobile: false, tablet: true, iosapptablet: false, hidden: true},
		{type: 'button', id: 'languagecode', desktop: false, mobile: true, tablet: false}
	];

	var toolbar = $('#toolbar-up');
	toolbar.w2toolbar({
		name: 'editbar',
		tooltip: 'bottom',
		items: toolItems,
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		},
		onRefresh: function(event) {
			if ((event.target === 'styles' || event.target === 'fonts' || event.target === 'fontsizes') && event.item) {
				var toolItem = $(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(event.item.id));
				if ((window.mode.isDesktop() && event.item.desktop == false)
					|| (window.mode.isTablet() && event.item.tablet == false)) {
					toolItem.css('display', 'none');
				} else {
					toolItem.css('display', '');
				}
			}

			if (event.target === 'inserttable')
				insertTable();

			if (event.target === 'insertshapes')
				insertShapes();
		}
	});

	toolbar.bind('touchstart', function() {
		w2ui['editbar'].touchStarted = true;
	});
}

function createSigningBar() {
	if (L.DomUtil.get('document-signing-bar') !== null) {
		var toolbar = $('#document-signing-bar');
		toolbar.w2toolbar({
			name: 'document-signing-bar',
			tooltip: 'bottom',
			items: map.setupSigningToolbarItems(),
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
}

function createSpreadsheetToolbar() {
	var toolbar = $('#spreadsheet-toolbar');
	toolbar.w2toolbar({
		name: 'spreadsheet-toolbar',
		tooltip: 'bottom',
		hidden: true,
		items: [
			{type: 'button',  id: 'firstrecord',  img: 'firstrecord', hint: _('First sheet')},
			{type: 'button',  id: 'prevrecord',  img: 'prevrecord', hint: _('Previous sheet')},
			{type: 'button',  id: 'nextrecord',  img: 'nextrecord', hint: _('Next sheet')},
			{type: 'button',  id: 'lastrecord',  img: 'lastrecord', hint: _('Last sheet')},
			{type: 'button',  id: 'insertsheet', img: 'insertsheet', hint: _('Insert sheet')}
		],
		onClick: function (e) {
			onClick(e, e.target);
			hideTooltip(this, e.target);
		}
	});
	toolbar.bind('touchstart', function() {
		w2ui['spreadsheet-toolbar'].touchStarted = true;
	});
}

function createPresentationToolbar() {
	var toolbar = $('#presentation-toolbar');
	toolbar.w2toolbar({
		name: 'presentation-toolbar',
		tooltip: 'bottom',
		hidden: true,
		items: [
			{type: 'html',  id: 'left'},
			{type: 'button',  id: 'presentation', img: 'presentation', hidden:true, hint: _('Fullscreen presentation')},
			{type: 'break', id: 'presentationbreak', hidden:true},
			{type: 'button',  id: 'insertpage', img: 'insertpage', hint: _UNO('.uno:TaskPaneInsertPage', 'presentation')},
			{type: 'button',  id: 'duplicatepage', img: 'duplicatepage', hint: _UNO('.uno:DuplicateSlide', 'presentation')},
			{type: 'button',  id: 'deletepage', img: 'deletepage', hint: _UNO('.uno:DeleteSlide', 'presentation')},
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
}

function initNormalToolbar() {
	createMainToolbar();
	map.addControl(L.control.formulaBar({showfunctionwizard: true}));
	createSigningBar();
	createSpreadsheetToolbar();
	createPresentationToolbar();
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

function documentNameConfirm() {
	var value = $('#document-name-input').val();
	if (value !== null && value != '' && value != map['wopi'].BaseFileName) {
		if (map['wopi'].UserCanRename && map['wopi'].SupportsRename) {
			if (value.lastIndexOf('.') > 0) {
				var fname = map['wopi'].BaseFileName;
				var ext = fname.substr(fname.lastIndexOf('.')+1, fname.length);
				// check format conversion
				if (ext != value.substr(value.lastIndexOf('.')+1, value.length)) {
					map.saveAs(value);
				} else {
					// same extension, just rename the file
					// file name must be without the extension for rename
					value = value.substr(0, value.lastIndexOf('.'));
					map.sendUnoCommand('.uno:Save');
					map._RenameFile = value;
				}
			}
		} else {
			// saveAs for rename
			map.saveAs(value);
		}
	}
	map._onGotFocus();
}

function documentNameCancel() {
	$('#document-name-input').val(map['wopi'].BaseFileName);
	map._onGotFocus();
}

function onDocumentNameKeyPress(e) {
	$('#document-name-input').css('width',(($('#document-name-input').val().length + 1) * 10) + 'px');
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
	if (e.HideSaveOption) {
		w2ui['editbar'].hide('save');
	}
	if (e.HideExportOption) {
		w2ui['presentation-toolbar'].hide('presentation', 'presentationbreak');
	}
	if (e.HidePrintOption) {
		w2ui['editbar'].hide('print');
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
	if (e.EnableInsertRemoteImage === true && w2ui['editbar']) {
		w2ui['editbar'].hide('insertgraphic');
		w2ui['editbar'].show('menugraphic');
	}
}

function onDocLayerInit() {
	var toolbarUp = w2ui['editbar'];
	var docType = map.getDocType();
	var data;

	switch (docType) {
	case 'spreadsheet':
		if (toolbarUp) {
			toolbarUp.show('textalign', 'wraptext', 'breakspacing', 'insertannotation', 'conditionalformaticonset',
			'numberformatcurrency', 'numberformatpercent',
			'numberformatincdecimals', 'numberformatdecdecimals', 'break-number', 'togglemergecells', 'breakmergecells',
			'setborderstyle', 'sortascending', 'sortdescending', 'breaksorting', 'backgroundcolor', 'breaksidebar', 'sidebar');
			toolbarUp.remove('styles');
		}

		if (!window.mode.isMobile()) {
			$('#spreadsheet-toolbar').show();
		}

		break;
	case 'text':
		if (toolbarUp)
			toolbarUp.show('leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
			'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'incrementindent', 'decrementindent',
			'breakindent', 'inserttable', 'insertannotation', 'backcolor', 'breaksidebar', 'sidebar');

		break;
	case 'presentation':
		// Fill the style select box if not yet filled
		if ($('.styles-select')[0] && $('.styles-select')[0].length === 1) {
			data = [''];
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

		if (toolbarUp) {
			toolbarUp.show('breaksidebar', 'modifypage');
		}

		var presentationToolbar = w2ui['presentation-toolbar'];
		if (!map['wopi'].HideExportOption && presentationToolbar) {
			presentationToolbar.show('presentation', 'presentationbreak');
		}

		// FALLTHROUGH intended
	case 'drawing':
		if (toolbarUp)
			toolbarUp.show('leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
			'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'inserttextbox', 'inserttable', 'backcolor',
			'breaksidebar', 'modifypage', 'slidechangewindow', 'customanimation', 'masterslidespanel');

		if (!window.mode.isMobile()) {
			$('#presentation-toolbar').show();
		}
		break;
	}

	if (L.DomUtil.get('document-signing-bar') !== null) {
		map.signingInitializeBar();
	}

	_updateToolbarsVisibility();

	if (window.mode.isMobile() || window.mode.isTablet()) {
		if (!window.ThisIsAMobileApp)
			$('#document-name-input').hide();
		else
			$('#document-name-input').show();
	} else {
		$('#document-name-input').show();
	}

	if (toolbarUp)
		toolbarUp.refresh();

	if (window.ThisIsAMobileApp) {
		// We can now set the document name in the menu bar
		$('#document-name-input').prop('disabled', false);
		$('#document-name-input').removeClass('editable');
		$('#document-name-input').focus(function() { $(this).blur(); });
		// Call decodecodeURIComponent twice: Reverse both our encoding and the encoding of
		// the name in the file system.
		$('#document-name-input').val(decodeURIComponent(decodeURIComponent(map.options.doc.replace(/.*\//, '')))
					      // To conveniently see the initial visualViewport scale and size, un-comment the following line.
					      // + ' (' + window.visualViewport.scale + '*' + window.visualViewport.width + 'x' + window.visualViewport.height + ')'
					      // TODO: Yes, it would be better to see it change as you rotate the device or invoke Split View.
					     );
	}

	if (docType == 'spreadsheet') {
		var el = w2ui['spreadsheet-toolbar'];
		if (el)
			el.resize();
	}

	data = [6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20,
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
		});}
	});
	$('.fontsizes-select').off('select2:select', onFontSizeSelect).on('select2:select', onFontSizeSelect);
}

function onCommandStateChanged(e) {
	var toolbar = w2ui['editbar'];
	var statusbar = w2ui['actionbar'];
	var commandName = e.commandName;
	var state = e.state;
	var found = false;
	var value, color, div;

	if (!commandName)
		return;

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
		$('#tb_editbar_item_fontcolor .w2ui-tb-image').css('box-shadow', 'inset 0 -2px #ffffff, inset 0px -6px ' + color);
		$('#tb_editbar_item_fontcolor .w2ui-tb-down').css('display', 'none');
		$('#tb_editbar_item_fontcolor .w2ui-tb-caption').css('display', 'none');

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
		//writer
		$('#tb_editbar_item_backcolor .w2ui-tb-image').css('box-shadow', 'inset 0 -2px #ffffff, inset 0px -6px ' + color);
		$('#tb_editbar_item_backcolor .w2ui-tb-down').css('display', 'none');
		$('#tb_editbar_item_backcolor .w2ui-tb-caption').css('display', 'none');
		//calc?
		$('#tb_editbar_item_backgroundcolor .w2ui-tb-image').css('box-shadow', 'inset 0 -2px #ffffff, inset 0px -6px ' + color);
		$('#tb_editbar_item_backgroundcolor .w2ui-tb-down').css('display', 'none');
		$('#tb_editbar_item_backgroundcolor .w2ui-tb-caption').css('display', 'none');

		div = L.DomUtil.get('backcolorindicator');
		if (div) {
			L.DomUtil.setStyle(div, 'background', color);
		}
	}
	else if (commandName === '.uno:LanguageStatus') {
		var code = state;
		var split = code.split(';');
		if (split.length > 1) {
			code = split[1];
		}
		w2ui['editbar'].set('languagecode', {text: code});
	}
	else if (commandName === '.uno:ModifiedStatus') {
		if (e.state === 'true') {
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

	var id = unoCmdToToolbarId(commandName);
	// id is set to '' by unoCmdToToolbarId() if the statechange message should be ignored.
	if (id === '')
		return;

	if (state === 'true') {
		if (map._permission === 'edit') {
			toolbar.enable(id);
		}
		toolbar.check(id);
	}
	else if (state === 'false') {
		if (map._permission === 'edit') {
			toolbar.enable(id);
		}
		toolbar.uncheck(id);
	}
	// Change the toolbar button states if we are in editmode
	// If in non-edit mode, will be taken care of when permission is changed to 'edit'
	else if (map._permission === 'edit' && (state === 'enabled' || state === 'disabled')) {
		var toolbarUp = toolbar;
		if (window.mode.isMobile()) {
			toolbarUp = statusbar;
		}
		if (map.getDocType() === 'presentation' && (id === 'deletepage' || id === 'insertpage' || id === 'duplicatepage')) {
			toolbarUp = w2ui['presentation-toolbar'];
		}
		if (state === 'enabled') {
			toolbarUp.enable(id);
		} else {
			toolbarUp.uncheck(id);
			toolbarUp.disable(id);
		}
	}
}

function updateCommandValues(e) {
	var data = [];
	var commandValues;
	// 1) For .uno:StyleApply
	// we need an empty option for the place holder to work
	if (e.commandName === '.uno:StyleApply') {
		var styles = [];
		var topStyles = [];
		commandValues = map.getToolbarCommandValues(e.commandName);
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
		w2ui['editbar'].resize();
	} else if (e.commandName === '.uno:CharFontName') {
		// 2) For .uno:CharFontName
		commandValues = map.getToolbarCommandValues(e.commandName);
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
		w2ui['editbar'].resize();
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
			if (map._RenameFile) {
				map.renameFile(map._RenameFile);
				map._RenameFile = '';
			}
		}
		var postMessageObj = {
			success: e.success
		};
		if (!e.success) {
			// add the result reason string if failed
			postMessageObj['result'] = e.result && e.result.value;
		}

		if (window.ThisIsTheAndroidApp) {
			window.postMobileMessage('SAVE ' + JSON.stringify(postMessageObj));
		} else {
			map.fire('postMessage', {msgId: 'Action_Save_Resp', args: postMessageObj});
		}
	}
	else if ((commandName === '.uno:Undo' || commandName === '.uno:Redo') &&
		e.success === true && e.result.value && !isNaN(e.result.value)) { /*UNDO_CONFLICT*/
		$('#tb_editbar_item_repair').w2overlay({ html: '<div style="padding: 10px; line-height: 150%">' +
			_('Conflict Undo/Redo with multiple users. Please use document repair to resolve') + '</div>'});
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
			} else if (!alwaysEnable) {
				toolbar.disable(items[idx].id);
			}
		}
	}

	var spreadsheetButtons = ['insertsheet'];
	var presentationButtons = ['insertpage', 'duplicatepage', 'deletepage'];
	if (e.perm === 'edit') {
		// Enable list boxes
		$('.styles-select').prop('disabled', false);
		$('.fonts-select').prop('disabled', false);
		$('.fontsizes-select').prop('disabled', false);

		toolbar = w2ui['spreadsheet-toolbar'];
		if (toolbar) {
			spreadsheetButtons.forEach(function(id) {
				toolbar.enable(id);
			});
		}

		toolbar = w2ui['presentation-toolbar'];
		if (toolbar) {
			presentationButtons.forEach(function(id) {
				toolbar.enable(id);
			});
		}

		if (toolbar) {
			presentationButtons.forEach(function(id) {
				if (id === 'deletepage') {
					var itemState = map['stateChangeHandler'].getItemValue('.uno:DeletePage');
				} else if (id === 'insertpage') {
					itemState = map['stateChangeHandler'].getItemValue('.uno:InsertPage');
				} else if (id === 'duplicatepage') {
					itemState = map['stateChangeHandler'].getItemValue('.uno:DuplicatePage');
				} else {
					itemState = 'enabled';
				}

				if (itemState === 'enabled') {
					toolbar.enable(id);
				} else {
					toolbar.disable(id);
				}
			});
		}

		if (window.mode.isMobile()) {
			$('#toolbar-down').show();
		}
	}
	else {
		// Disable list boxes
		$('.styles-select').prop('disabled', true);
		$('.fonts-select').prop('disabled', true);
		$('.fontsizes-select').prop('disabled', true);

		toolbar = w2ui['spreadsheet-toolbar'];
		if (toolbar) {
			spreadsheetButtons.forEach(function(id) {
				toolbar.disable(id);
			});
		}

		toolbar = w2ui['presentation-toolbar'];
		if (toolbar) {
			presentationButtons.forEach(function(id) {
				toolbar.disable(id);
			});
		}

		if (window.mode.isMobile()) {
			$('#toolbar-down').hide();
		}
	}

	// We've resized the document container.
	map.invalidateSize();
}

function editorUpdate(e) { // eslint-disable-line no-unused-vars
	var docLayer = map._docLayer;

	if (e.target.checked) {
		var editorId = docLayer._editorId;

		docLayer._followUser = false;
		docLayer._followEditor = true;
		if (editorId !== -1 && editorId !== docLayer.viewId) {
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
}

global.editorUpdate = editorUpdate;

$(window).resize(function() {
	resizeToolbar();
});

$(document).ready(function() {
	// Attach insert file action
	$('#insertgraphic').on('change', onInsertFile);
	$('#selectbackground').on('change', onInsertBackground);
});

function setupToolbar(e) {
	map = e;

	createToolbar();

	map.on('focussearch', function () {
		var entry = L.DomUtil.get('search-input');
		entry.focus();
		entry.select();
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

	if (!window.mode.isMobile()) {
		map.on('updatetoolbarcommandvalues', function(e) {
			updateCommandValues(e);
		});
	}

	map.on('doclayerinit', onDocLayerInit);
	map.on('updatepermission', onUpdatePermission);
	map.on('wopiprops', onWopiProps);
	map.on('commandresult', onCommandResult);
	map.on('updateparts pagenumberchanged', onUpdateParts);
	map.on('commandstatechanged', onCommandStateChanged);

	if (!L.Params.closeButtonEnabled) {
		$('#closebuttonwrapper').hide();
	} else if (L.Params.closeButtonEnabled && !window.mode.isMobile()) {
		$('#closebuttonwrapper').show();
		$('.closebuttonimage').show();
	}

	$('#closebutton').click(function() {
		map.fire('postMessage', {msgId: 'close', args: {EverModified: map._everModified, Deprecated: true}});
		map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: map._everModified}});
		if (!map._disableDefaultAction['UI_Close']) {
			map.remove();
		}
	});
}

global.setupToolbar = setupToolbar;
global.onClick = onClick;
global.hideTooltip = hideTooltip;
global.onStyleSelect = onStyleSelect;
global.insertTable = insertTable;
global.insertShapes = insertShapes;
global.createShapesPanel = createShapesPanel;
global.onUpdatePermission = onUpdatePermission;
global.setupSearchInput = setupSearchInput;
global.getUNOCommand = getUNOCommand;

}(window));
