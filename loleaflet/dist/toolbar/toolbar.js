/*
 * LibreOffice Online toolbar
 */
$(function () {
	$('#toolbar-up-more').w2toolbar({
		name: 'toolbar-up-more',
		items: [
		],
		onClick: function (e) {
			onClick(e.target);
		}
	});

	$('#toolbar-up').w2toolbar({
		name: 'toolbar-up',
		items: [
			{ type: 'html',  id: 'left' },
			// Unfortunately the toolbar does not provide access to menu items
			// so we have to define different menu items if we want to have different
			// entries for text / presentation / spreadsheet files
			{ type: 'menu',   id: 'writer:menu:file', caption: _("File"), items: [
				{ text: _("Download as PDF document (.pdf)"), id: 'downloadas-pdf' },
				{ text: _("Download as ODF Text document (.odt)"), id: 'downloadas-odt' },
				{ text: _("Download as Microsoft Word 2003 (.doc)"), id: 'downloadas-doc' },
				{ text: _("Download as Microsoft Word (.docx)"), id: 'downloadas-docx' },
				{ text: _("Print"), id: 'print' }
			]},

			{ type: 'menu', hidden: true, id: 'impress:menu:file', caption: _("File"), items: [
				{ text: _("Download as PDF document (.pdf)"), id: 'downloadas-pdf' },
				{ text: _("Download as ODF Presentation (.odp)"), id: 'downloadas-odp' },
				{ text: _("Download as Microsoft Powerpoint 2003 (.ppt)"), id: 'downloadas-ppt' },
				{ text: _("Download as Microsoft Powerpoint (.pptx)"), id: 'downloadas-pptx' },
				{ text: _("Print"), id: 'print' }
			]},

			{ type: 'menu', hidden: true, id: 'calc:menu:file', caption: _("File"), items: [
				{ text: _("Download as PDF document (.pdf)"), id: 'downloadas-pdf' },
				{ text: _("Download as ODF Spreadsheet (.ods)"), id: 'downloadas-ods' },
				{ text: _("Download as Microsoft Excel 2003 (.xls)"), id: 'downloadas-xls' },
				{ text: _("Download as Microsoft Excel (.xlsx)"), id: 'downloadas-xlsx' },
				{ text: _("Print"), id: 'print' }
			]},

			{ type: 'menu', hidden: true, id: 'other:menu:file', caption: _("File"), items: [
				{ text: _("Download as PDF document (.pdf)"), id: 'downloadas-pdf' },
				{ text: _("Print"), id: 'print' }
			]},

			{ type: 'button',  id: 'save', img: 'save', hint: _("Save"), uno: 'Save' },
			{ type: 'break' },
			{ type: 'button',  id: 'undo',  img: 'undo', hint: _("Undo"), uno: 'Undo' },
			{ type: 'button',  id: 'redo',  img: 'redo', hint: _("Redo"), uno: 'Redo' },
			{ type: 'break' },
			{ type: 'html',   id: 'styles', html: '<select class="styles-select"></select>' },
			{ type: 'html',   id: 'fonts', html: '<select class="fonts-select"></select>' },
			{ type: 'html',   id: 'fontsizes', html: '<select class="fontsizes-select"></select>' },
			{ type: 'break' },
			{ type: 'button',  id: 'bold',  img: 'bold', hint: _("Bold"), uno: 'Bold' },
			{ type: 'button',  id: 'italic', img: 'italic', hint: _("Italic"), uno: 'Italic' },
			{ type: 'button',  id: 'underline',  img: 'underline', hint: _("Underline"), uno: 'Underline' },
			{ type: 'button',  id: 'strikeout', img: 'strikeout', hint: _("Strikeout"), uno: 'Strikeout' },
			{ type: 'break' },
			{ type: 'html',  id: 'fontcolor-html', html: '<input id="fontColorPicker" style="display:none;">' },
			{ type: 'button',  id: 'fontcolor', img: 'color', hint: _("Font Color") },
			{ type: 'html',  id: 'backcolor-html', html: '<input id="backColorPicker" style="display:none;">' },
			{ type: 'button',  id: 'backcolor', img: 'backcolor', hint: _("Highlighting") },
			{ type: 'break' },
			{ type: 'button',  id: 'alignleft',  img: 'alignleft', hint: _("Align left"), uno: 'LeftPara', unosheet: 'HorizontalAlignment {"HorizontalAlignment":{"type":"unsigned short", "value":"1"}}'  },
			{ type: 'button',  id: 'alignhorizontal',  img: 'alignhorizontal', hint: _("Center horizontaly"), uno: 'CenterPara', unosheet: 'HorizontalAlignment {"HorizontalAlignment":{"type":"unsigned short", "value":"2"}}' },
			{ type: 'button',  id: 'alignright',  img: 'alignright', hint: _("Align right"), uno: 'RightPara', unosheet: 'HorizontalAlignment {"HorizontalAlignment":{"type":"unsigned short", "value":"3"}}' },
			{ type: 'button',  id: 'alignblock',  img: 'alignblock', hint: _("Justified"), uno: 'JustifyPara', unosheet: 'HorizontalAlignment {"HorizontalAlignment":{"type":"unsigned short", "value":"4"}}' },
			{ type: 'break' },
			{ type: 'button',  id: 'bullet',  img: 'bullet', hint: _("Bullets on/off"), uno: 'DefaultBullet' },
			{ type: 'button',  id: 'numbering',  img: 'numbering', hint: _("Numbering on/off"), uno: 'DefaultNumbering' },
			{ type: 'break' },
			{ type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _("Increase Indent"), uno: 'IncrementIndent' },
			{ type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _("Decrease Indent"), uno: 'DecrementIndent' },
			{ type: 'break', id: 'incdecindent' },
			{ type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _("Insert Graphic") },
			{ type: 'break' },
			{ type: 'button',  id: 'help',  img: 'help', hint: _("Help") },
			{ type: 'html', id: 'right' },
			{ type: 'button',  id: 'more', img: 'more', hint: _("More") },
			{ type: 'button',  id: 'close',  img: 'closedoc', hint: _("Close Document"), hidden: true },
		],
		onClick: function (e) {
			onClick(e.target);
		}
	});

	$('#formulabar').w2toolbar({
		name: 'formulabar',
		items: [
			{ type: 'html',  id: 'left' },
			{ type: 'button',  id: 'sum',  img: 'autosum', hint: _("Sum") },
			{ type: 'button',  id: 'function',  img: 'equal', hint: _("Function") },
			{ type: 'button', hidden: true, id: 'cancelformula',  img: 'cancel', hint: _("Cancel") },
			{ type: 'button', hidden: true, id: 'acceptformula',  img: 'accepttrackedchanges', hint: _("Accept") },
			{ type: 'html', id: 'formula', html: '<input id="formulaInput" onkeyup="onFormulaInput()"' +
			   	'onblur="onFormulaBarBlur()" onfocus="onFormulaBarFocus()" type=text>' }
		],
		onClick: function (e) {
			onClick(e.target);
		}
	});
	$('#spreadsheet-toolbar').w2toolbar({
		name: 'spreadsheet-toolbar',
		items: [
			{ type: 'button',  id: 'firstrecord',  img: 'firstrecord', hint: _("First Sheet") },
			{ type: 'button',  id: 'prevrecord',  img: 'prevrecord', hint: _("Previous Sheet") },
			{ type: 'button',  id: 'nextrecord',  img: 'nextrecord', hint: _("Next Sheet") },
			{ type: 'button',  id: 'lastrecord',  img: 'lastrecord', hint: _("Last Sheet") }
		],
		onClick: function (e) {
			onClick(e.target);
		}
	});
	$('#toolbar-down').w2toolbar({
		name: 'toolbar-down',
		items: [
			{ type: 'html',  id: 'search',
				html: '<div style="padding: 3px 10px;">'+
					  ' Search:'+
					  '    <input size="10" id="search-input" onkeypress="onSearch(event)"' +
					  			'style="padding: 3px; border-radius: 2px; border: 1px solid silver"/>'+
					  '</div>'
			},
			{ type: 'button',  id: 'searchprev', img: 'prev', hint: _("Search backwards"), disabled: true },
			{ type: 'button',  id: 'searchnext', img: 'next', hint: _("Search forward"), disabled: true },
			{ type: 'button',  id: 'cancelsearch', img: 'cancel', hint: _("Cancel the search"), hidden: true },
			{ type: 'html', id: 'left' },
			{ type: 'button',  id: 'presentation', img: 'presentation', hint: _("Fullscreen presentation") },
			{ type: 'button',  id: 'insertpage', img: 'insertpage', hint: _("Insert Page") },
			{ type: 'button',  id: 'duplicatepage', img: 'duplicatepage', hint: _("Duplicate Page") },
			{ type: 'button',  id: 'deletepage', img: 'deletepage', hint: _("Delete Page") },
			{ type: 'html', id: 'right' },
			{ type: 'break' },
			{ type: 'button',  id: 'takeedit', img: 'edit', hint: _("Take edit lock (others can only view)")},
			{ type: 'html',    id: 'takeedit_text', html: '<div id="takeedit_text">VIEWING</div>' },
			{ type: 'break' },
			{ type: 'button',  id: 'prev', img: 'prev', hint: _("Previous page") },
			{ type: 'button',  id: 'next', img: 'next', hint: _("Next page") },
			{ type: 'break', id: 'prevnextbreak' },
			{ type: 'button',  id: 'zoomreset', img: 'zoomreset', hint: _("Reset zoom") },
			{ type: 'button',  id: 'zoomout', img: 'zoomout', hint: _("Zoom out") },
			{ type: 'html',    id: 'zoomlevel', html: '<div id="zoomlevel">100%</div>'},
			{ type: 'button',  id: 'zoomin', img: 'zoomin', hint: _("Zoom in") }
		],
		onClick: function (e) {
			onClick(e.target);
		}
	});

	$('#fontColorPicker').colorpicker({showOn:'none', hideButton:true});
	$("#fontColorPicker").on("change.color", onColorPick);
	$('#backColorPicker').colorpicker({showOn:'none', hideButton:true});
	$("#backColorPicker").on("change.color", onColorPick);
	var fontColorIndicator = L.DomUtil.create('div', 'font-color-indicator', L.DomUtil.get('tb_toolbar-up_item_fontcolor'));
	fontColorIndicator.id = 'fontcolorindicator';
	var backColorIndicator = L.DomUtil.create('div', 'back-color-indicator', L.DomUtil.get('tb_toolbar-up_item_backcolor'));
	backColorIndicator.id = 'backcolorindicator';
});

var formatButtons = ['bold', 'italic', 'underline', 'strikeout', 'bullet', 'numbering', 'save',
	'alignleft', 'alignhorizontal', 'alignright', 'alignblock', 'incrementindent', 'decrementindent'];

function onSearch(e) {
	if (e.keyCode === 13) {
		var toolbar = w2ui['toolbar-down'];
		map.search(L.DomUtil.get('search-input').value);
		toolbar.enable('searchprev');
		toolbar.enable('searchnext');
		toolbar.show('cancelsearch');
	}
	else {
		map.fire('requestloksession');
	}
}

function onClick(id) {
	if (w2ui['toolbar-up'].get(id) !== null) {
		var toolbar = w2ui['toolbar-up'];
		var item = toolbar.get(id) ;
	}
	else if (w2ui['formulabar'].get(id) !== null) {
		toolbar = w2ui['formulabar'];
		item = toolbar.get(id) ;
	}
	else if (w2ui['toolbar-down'].get(id) !== null) {
		toolbar = w2ui['toolbar-down'];
		item = toolbar.get(id) ;
	}
	else if (w2ui['spreadsheet-toolbar'].get(id) !== null) {
		toolbar = w2ui['spreadsheet-toolbar'];
		item = toolbar.get(id) ;
	}
	else if (id.indexOf(':') >= 0) {
		// we just handle a menu item click,
		// like File->Download as
		var index = id.indexOf(':');
		var app = id.substring(0, index);
		if (app === 'writer' ||
			app === 'impress' ||
			app === 'calc' ||
			app === 'other') {
			// remove the app from the id so that we have a single hander
			id = id.substring(index + 1);
		}
		item = {};
	}
	else {
		throw new Error('unknown id: ' + id);
	}
	var docLayer = map._docLayer;
	map.focus();
	if (item.disabled) {
		return;
	}
	if (item.uno) {
		if (item.unosheet && map.getDocType() === 'spreadsheet') {
			map.toggleCommandState(item.unosheet);
		}
		else {
			map.toggleCommandState(item.uno);
		}
	}
	else if (id === 'zoomin' && map.getZoom() < map.getMaxZoom()) {
		map.zoomIn(1);
	}
	else if (id === 'zoomout' && map.getZoom() > map.getMinZoom()) {
		map.zoomOut(1);
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
	else if (id === 'edit') {
		if (item.checked) {
			map.setPermission('view');
		}
		else {
			map.setPermission('edit');
		}
	}
	else if (id === 'select') {
		if (item.checked) {
			map.disableSelection();
			toolbar.uncheck(id);
		}
		else {
			map.enableSelection();
			toolbar.check(id);
		}
	}
	else if (id === 'menu:file:saveas') {
		var dialog = '<label for="url">URL</label>' +
					'<input name="url" type="text" value=' + map._docLayer.options.doc + '/>' +
					'<label for="format">Format</label>' +
					'<input name="format" type="text" />' +
					'<label for="options">Options</label>' +
					'<input name="options" type="text" />';
		vex.dialog.open({
			message: 'Save as:',
			input: dialog,
			callback: onSaveAs
		});
	}
	else if (id === 'takeedit') {
		if (!item.checked) {
			map._socket.sendMessage('takeedit');
		}
	}
	else if (id === 'searchprev') {
		map.search(L.DomUtil.get('search-input').value, true);
	}
	else if (id === 'searchnext') {
		map.search(L.DomUtil.get('search-input').value);
	}
	else if (id === 'cancelsearch') {
		map.resetSelection();
		toolbar.hide('cancelsearch');
		toolbar.disable('searchprev');
		toolbar.disable('searchnext');
		L.DomUtil.get('search-input').value = '';
	}
	else if (id === 'print' || id === 'menu:file:print') {
		map.print();
	}
	else if ((id === 'menu:file:presentation' || id === 'presentation')
			&& map.getDocType() === 'presentation') {
		map.fire('fullscreen');
	}
	else if (id === 'insertpage') {
		map.insertPage();
	}
	else if (id === 'duplicatepage') {
		map.duplicatePage();
	}
	else if (id === 'deletepage') {
		vex.dialog.confirm({
			message: _("Are you sure you want to delete this page?"),
			callback: onDelete
		});
	}
	else if (id === 'firstrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft(0);
	}
	// TODO: We should get visible tab's width instead of 60px
	else if (id === 'nextrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft()+60);
	}
	else if (id === 'prevrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft()-60);
	}
	else if (id === 'lastrecord') {
		$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').prop("scrollWidth"));
	}
	else if (id.startsWith('menu:file:downloadas-')) {
		var format = id.substring('menu:file:downloadas-'.length);
		// remove the extension if any
		var fileName = title.substr(0, title.lastIndexOf('.')) || title;
		// check if it is empty
		fileName = fileName === '' ? 'document' : fileName;
		map.downloadAs(fileName + '.' + format, format);
	}
	else if (id === 'insertgraphic') {
		L.DomUtil.get('insertgraphic').click();
	}
	else if (id === 'fontcolor') {
		// absolutely no idea why, but without the timeout, the popup is
		// closed as soon as it is opend
		setTimeout(function () {$('#fontColorPicker').colorpicker('showPalette')}, 0);
	}
	else if (id === 'backcolor') {
		// absolutely no idea why, but without the timeout, the popup is
		// closed as soon as it is opend
		setTimeout(function () {$('#backColorPicker').colorpicker('showPalette')}, 0);
	}
	else if (id === 'sum') {
		L.DomUtil.get('formulaInput').value = '=SUM()';
		L.DomUtil.get('formulaInput').focus();
		map.cellEnterString(L.DomUtil.get('formulaInput').value);
	}
	else if (id === 'function') {
		L.DomUtil.get('formulaInput').value = '=';
		L.DomUtil.get('formulaInput').focus();
		map.cellEnterString(L.DomUtil.get('formulaInput').value);
	}
	else if (id === 'cancelformula') {
		L.DomUtil.get('formulaInput').value = '';
		map.cellEnterString(L.DomUtil.get('formulaInput').value);
	}
	else if (id === 'acceptformula') {
		map.cellEnterString(L.DomUtil.get('formulaInput').value);
	}
	else if (id === 'more') {
		$('#toolbar-up-more').toggle();
		if ($('#toolbar-up-more').is(':visible')) {
			toolbar.check('more');
		}
		else {
			toolbar.uncheck('more');
		}
		resizeToolbar();
	}
	else if (id === 'help') {
		var w = window.innerWidth / 2;
		var h = window.innerHeight / 2;
		$.modal('<iframe src="/loleaflet/dist/loleaflet-help.html" width="' + w + '" height="' + h + '" style="border:0">', {
			overlayClose:true,
			opacity: 80,
			overlayCss: {
				backgroundColor : "#000"
			},
			containerCss: {
				overflow : "hidden",
				backgroundColor : "#fff",
				padding : "12px",
				border : "2px solid #000"
			}
		});
	}
	else if (id === 'close') {
		window.parent.postMessage('close', '*');
		map.remove();
	}
}

function onDelete (e) {
	if (e !== false) {
		map.deletePage();
	}
}

function onSaveAs (e) {
	if (e !== false) {
		map.saveAs(e.url, e.format, e.options);
	}
}

function onStyleSelect (e) {
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
		map.applyStyle(style, 'Default');
	}
	map.focus();
}

function updateFontSizeList (font) {
	var oldSize = $(".fontsizes-select").val();
	var found = false;
	$(".fontsizes-select").find('option').remove();
	var data = [''];
	data = data.concat(map.getToolbarCommandValues('.uno:CharFontName')[font]);
	$(".fontsizes-select").select2({
		data: data,
		placeholder: _("Size"),
		//Allow manually entered font size.
		createTag:function(query) {
			return {
				id: query.term,
				text: query.term,
				tag: true
			}
		},
		tags: true,
	});
	$(".fontsizes-select option").each(function (i, e) {
		if ($(e).text() == oldSize) {
			$(".fontsizes-select").val(oldSize).trigger('change');
			found = true;
			return;
		}
	});
	if (!found) {
		// we need to add the size
		$('.fontsizes-select')
			.append($("<option></option>")
			.text(oldSize));
	}
	$(".fontsizes-select").val(oldSize).trigger('change');
	sortFontSizes();
}

function sortFontSizes() {
	var oldVal = $('.fontsizes-select').val();
	var selectList = $('.fontsizes-select option');
	selectList.sort(function (a,b){
		a = parseFloat($(a).text() * 1);
		b = parseFloat($(b).text() * 1);
		if(a > b) {
		    return 1;
		} else if (a < b) {
		    return -1;
		}
		return 0;
	});
	$('.fontsizes-select').html(selectList);
	$('.fontsizes-select').val(oldVal).trigger('change');
}

function onFontSelect (e) {
	var font = e.target.value;
	updateFontSizeList(font);
	map.applyFont(font);
	map.focus();
}

function onFontSizeSelect (e) {
	var size = e.target.value;
	$(e.target).find('option[data-select2-tag]').removeAttr('data-select2-tag');
	map.applyFontSize(size);
		fontcolor = map.getDocType() === 'text' ? 'FontColor' : 'Color';
		command[fontcolor] = {};
	map.focus();
}

function onInsertFile () {
	var insertGraphic = L.DomUtil.get('insertgraphic');
	if ('files' in insertGraphic) {
		for (var i = 0; i < insertGraphic.files.length; i++) {
			var file = insertGraphic.files[i];
			map.insertFile(file);
		}
	}
}

function onColorPick (e, color) {
	if (map.getPermission() !== 'edit' || color === undefined) {
		return;
	}
	// transform from #FFFFFF to an Int
	color = parseInt(color.replace('#', ''), 16);
	var command = {};
	if (e.target.id === 'fontColorPicker') {
	  	fontcolor = { 'text': 'FontColor',
			'spreadsheet': 'Color',
			'presentation': 'Color' }[map.getDocType()];
		command[fontcolor] = {};
		command[fontcolor].type = 'long';
		command[fontcolor].value = color;
		var uno = '.uno:' + fontcolor;
	}
	else if (e.target.id === 'backColorPicker') {
		backcolor = { 'text': 'BackColor',
			'spreadsheet': 'BackgroundColor',
			'presentation': 'CharBackColor' }[map.getDocType()];
		command[backcolor] = {};
		command[backcolor].type = 'long';
		command[backcolor].value = color;
		uno = '.uno:' + backcolor;
	}
	map.sendUnoCommand(uno, command);
	map.focus();
}

function onFormulaInput () {
	map.cellEnterString(L.DomUtil.get('formulaInput').value);
}

function onFormulaBarFocus () {
	var formulabar = w2ui['formulabar'];
	formulabar.hide('sum');
	formulabar.hide('function');
	formulabar.show('cancelformula');
	formulabar.show('acceptformula');
}

function onFormulaBarBlur() {
	var formulabar = w2ui['formulabar'];
	formulabar.show('sum');
	formulabar.show('function');
	formulabar.hide('cancelformula');
	formulabar.hide('acceptformula');
}

map.on('updatepermission', function (e) {
	var toolbar = w2ui['toolbar-down'];
	if (e.perm === 'edit') {
		toolbar.uncheck('select');
		toolbar.disable('select');
		toolbar.check('edit');
		toolbar.enable('edit');
	}
	else if (e.perm === 'view') {
		toolbar.uncheck('select');
		toolbar.enable('select');
		toolbar.uncheck('edit');
		toolbar.enable('edit');
	}
	else if (e.perm === 'readonly') {
		toolbar.uncheck('select');
		toolbar.enable('select');
		toolbar.uncheck('edit');
		toolbar.disable('edit');
	}
	formatButtons.forEach(function (id) {
		if (e.perm === 'edit') {
			toolbar.enable(id);
		}
		else {
			toolbar.disable(id);
		}
	});
	var toolbar = w2ui['toolbar-up'];
	var docType = map.getDocType();
	if (docType !== 'text') {
		toolbar.hide('writer:menu:file');
		if (docType === 'presentation' || docType === 'drawing') {
			toolbar.show('impress:menu:file');
		}
		else if (docType === 'spreadsheet') {
			toolbar.show('calc:menu:file');
		}
		else {
			toolbar.show('other:menu:file');
		}
	}
});

map.on('commandstatechanged', function (e) {
	var toolbar = w2ui['toolbar-up'];
	var commandName = e.commandName;
	var state = e.state;
	var found = false;
	if (commandName === '.uno:StyleApply') {
		if (!state)
			return;

		// For impress documents, template name is prefixed with style name.
		// Strip the template name until we support it
		if (map.getDocType() === 'presentation') {
			state = state.split('~LT~')[1];
			state = L.Styles.impressMapping[state];
		}

		$(".styles-select option").each(function () {
			value = this.value;
			// For writer we get UI names; ideally we should be getting only programmatic ones
			// For eg: 'Text body' vs 'Text Body'
			// (likely to be fixed in core to make the pattern consistent)
			if (value.toLowerCase() === state.toLowerCase()) {
				state = value;
				found = true;
				return;
			}
		});
		if (!found) {
			// we need to add the size
			$('.styles-select')
				.append($("<option></option>")
				.text(state));
		}
		$(".styles-select").val(state).trigger('change');
	}
	else if (commandName === '.uno:CharFontName') {
		$(".fonts-select option").each(function () {
			value = this.value;
			if (value.toLowerCase() === state.toLowerCase()) {
				found = true;
				updateFontSizeList(value);
				return;
			}
		});
		if (!found) {
			// we need to add the size
			$('.fonts-select')
				.append($("<option></option>")
				.text(state));
		}
		$(".fonts-select").val(state).trigger('change');
	}
	else if (commandName === '.uno:FontHeight') {
		if (state === '0') {
			state = '';
		}
		$(".fontsizes-select option").each(function (i, e) {
			if ($(e).text() == state) {
				found = true;
				return;
			}
		});
		if (!found) {
			// we need to add the size
			$('.fontsizes-select')
				.append($("<option></option>")
				.text(state).val(state));
		}
		$(".fontsizes-select").val(state).trigger('change');
		sortFontSizes();
	}
	else if (commandName === '.uno:FontColor' || commandName === '.uno:Color') {
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		var color = parseInt(e.state);
		if (color === -1) {
			color = 'transparent';
		}
		else {

			color = color.toString(16);
			color = '#' + '0'.repeat(6 - color.length) + color;
		}
		var div = L.DomUtil.get('fontcolorindicator');
		L.DomUtil.setStyle(div, 'background', color);
	}
	else if (commandName === '.uno:BackColor' || commandName === '.uno:BackgroundColor' || commandName === '.uno:CharBackColor') {
		// confusingly, the .uno: command is named differently in Writer, Calc and Impress
		var color = parseInt(e.state);
		if (color === -1) {
			color = 'transparent';
		}
		else {
			color = color.toString(16);
			color = '#' + '0'.repeat(6 - color.length) + color;
		}
		var div = L.DomUtil.get('backcolorindicator');
		L.DomUtil.setStyle(div, 'background', color);
	}

	formatButtons.forEach(function (id) {
		if ('.uno:' + toolbar.get(id).uno === commandName) {
			if (state === 'true') {
				toolbar.check(id);
			}
			else if (state === 'false') {
				toolbar.uncheck(id);
			}
			else if (state === 'enabled' && map._docLayer._permission === 'edit') {
				toolbar.enable(id);
			}
			else if (state === 'disabled') {
				toolbar.disable(id);
			}
		}
	});
});

map.on('search', function (e) {
	var searchInput = L.DomUtil.get('search-input');
	var toolbar = w2ui['toolbar-down'];
	if (e.count === 0) {
		toolbar.disable('searchprev');
		toolbar.disable('searchnext');
		toolbar.hide('cancelsearch');
		L.DomUtil.addClass(searchInput, 'search-not-found');
		setTimeout(function () {L.DomUtil.removeClass(searchInput, 'search-not-found')}, 500);
	}
});


map.on('updatetoolbarcommandvalues', function (e) {
	// we need an empty option for the place holder to work
	var data = [{text: ''}];
	var styles = [];
	var topStyles = [];
	if (e.commandName === '.uno:StyleApply') {
		var commands = e.commandValues.Commands;
		if (commands && commands.length > 0) {
			// Inserts a separator element
			data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

			commands.forEach(function (command) {
				data = data.concat({id: command.id, text: L.Styles.styleMappings[command.text].toLocaleString()});
			}, this);
		}

		if (map.getDocType() === 'text') {
			styles = e.commandValues.ParagraphStyles.slice(7, 19);
			topStyles = e.commandValues.ParagraphStyles.slice(0, 7);
		}
		else if (map.getDocType() === 'spreadsheet') {
			styles = e.commandValues.CellStyles;
		}
		else if (map.getDocType() === 'presentation' || map.getDocType() === 'drawing') {
			styles = e.commandValues.Default;
		}

		if (topStyles.length > 0) {
			// Inserts a separator element
			data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

			topStyles.forEach(function (style) {
				data = data.concat({id: style, text: L.Styles.styleMappings[style].toLocaleString()});
			}, this);
		}

		if (styles.length > 0) {
			// Inserts a separator element
			data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

			styles.forEach(function (style) {
				var localeStyle;
				if (style.startsWith('outline')) {
					var outlineLevel = style.split('outline')[1];
					localeStyle = 'Outline'.toLocaleString() + ' ' + outlineLevel;
				} else {
					localeStyle = L.Styles.styleMappings[style].toLocaleString();
				}

				data = data.concat({id: style, text: localeStyle});
			}, this);
		}

		$(".styles-select").select2({
			data: data,
			placeholder: _("Style")
		});
		$(".styles-select").on('select2:select', onStyleSelect);
	}
	else if (e.commandName === '.uno:CharFontName') {
		data = data.concat(Object.keys(e.commandValues));
		$(".fonts-select").select2({
			data: data,
			placeholder: _("Font")
		});
		$(".fonts-select").on('select2:select', onFontSelect);

		$(".fontsizes-select").select2({
			placeholder: _("Size"),
			data: []
		});
		$(".fontsizes-select").on('select2:select', onFontSizeSelect);
	}
});

map.on('updateparts pagenumberchanged', function (e) {
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

	if (e.docType === 'spreadsheet') {
		toolbar.hide('prev');
		toolbar.hide('next');
		toolbar.hide('prevnextbreak');
	}
	else {
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
	if (e.docType !== 'text' && e.docType !== 'spreadsheet' ) {
		toolbar.hide('incrementindent');
		toolbar.hide('decrementindent');
		toolbar.hide('incdecindent');
	}

	var toolbar = w2ui['spreadsheet-toolbar'];
	if (e.docType !== 'spreadsheet') {
		toolbar.hide('firstrecord');
		toolbar.hide('nextrecord');
		toolbar.hide('prevrecord');
		toolbar.hide('lastrecord');
	}
});

map.on('commandresult', function (e) {
	var commandName = e.commandName;
	var success = e.success;

	if (commandName === '.uno:Save' && e.success == true) {
		// owncloud integration
		if (typeof window.parent.documentsMain != 'undefined') {
			window.parent.documentsMain.saveDocumentBack();
		}
	}
});

map.on('cellformula', function (e) {
	if (document.activeElement !== L.DomUtil.get('formulaInput')) {
		// if the user is not editing the formula bar
		L.DomUtil.get('formulaInput').value = e.formula;
	}
});

map.on('zoomend', function (e) {
	var _zoom_ratio = map.getZoomScale(map.getZoom(), map.options.zoom);
	var _zoom_percent = Math.round(_zoom_ratio * 100);
	$('#zoomlevel').html(_zoom_percent + '%');
});

map.on('hyperlinkclicked', function (e) {
	window.open(e.url, '_blank');
});

map.on('editlock', function (e) {
	var toolbar = w2ui['toolbar-down'];
	if (e.value) {
		toolbar.check('takeedit');
		toolbar.disable('takeedit');
		toolbar.set('takeedit', {hint: _('You are editing (others can only view)')});

		$('#takeedit_text').html('EDITING');
	}
	else {
		toolbar.uncheck('takeedit');
		toolbar.enable('takeedit');
		toolbar.set('takeedit', {hint: _('Take edit lock (others can only view)')});
		$('#takeedit_text')
			.w2tag('You are viewing now')
			.html('VIEWING');
		setTimeout(function() {
			$('#takeedit_text').w2tag('');
		}, 3000);
	}
});

$(window).resize(function() {
	resizeToolbar();
});

$(document).ready(function() {
	resizeToolbar();
	var toolbar = w2ui['toolbar-up'];
	if (closebutton) {
		toolbar.show('close');
	}
});

function resizeToolbar() {
	// move items from toolbar-up-more -> toolbar-up
	while ($('#toolbar-up')[0].scrollWidth <= $(window).width()) {
		var firstItem = $('#toolbar-up-more>table>tbody>tr>td:first');
		if (firstItem.length < 1) {
			break;
		}
		var detached = $(firstItem).detach();
		$(detached).insertAfter($('#toolbar-up>table>tbody>tr>td:nth-last-child(5)')[0]);
	}

	// move items from toolbar-up -> toolbar-up-more
	while ($('#toolbar-up')[0].scrollWidth > $(window).width()) {
		var detached = $('#toolbar-up>table>tbody>tr>td:nth-last-child(5)').detach();
		$('#toolbar-up-more>table>tbody>tr').prepend(detached);
	}

	// resize toolbar-up-more
	var lastItem = $('#toolbar-up-more>table>tbody>tr>td[valign="middle"]').last();
	if (lastItem.length) {
		$('#toolbar-up-more').width($(lastItem).position().left + $(lastItem).width());
	} else {
		$('#toolbar-up-more').hide();
		var toolbar = w2ui['toolbar-up'];
		toolbar.uncheck('more');
	}
}
