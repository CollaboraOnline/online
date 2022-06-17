/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileBottomBar
 */

/* global $ w2ui _ _UNO */
L.Control.MobileBottomBar = L.Control.extend({

	options: {
		doctype: 'text'
	},

	initialize: function (docType) {
		L.setOptions(this, {docType: docType});
	},

	onAdd: function (map) {
		this.map = map;
		this.create();

		map.on('commandstatechanged', window.onCommandStateChanged);
		map.on('contextchange', this.onContextChange, this);
	},

	getToolItems: function(docType) {
		if (docType == 'text') {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				// context: ['default', 'Text', 'DrawText', 'Table']
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold', context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: '.uno:Italic', context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline', context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'break', id: 'breakcolor', context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), lockUno: '.uno:FontColor', context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackColor'), lockUno: '.uno:BackColor', context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'drop',  id: 'setborderstyle',  img: 'setborderstyle', hint: _('Borders'), hidden: true, html: window.getBorderStyleMenuHtml(), context: ['Table']},
				{type: 'break', id: 'breakalign-text', context: ['default', 'Text', 'DrawText']},
				{type: 'menu', id: 'align-text', img: 'alignblock', hint: _UNO('.uno:TextAlign'), lockUno: '.uno:TextAlign', context: ['default', 'Text'],
					items: [
						{id: 'leftpara-text', text: _UNO('.uno:LeftPara', 'text', true), img: 'alignleft', uno: '.uno:LeftPara'},
						{id: 'centerpara-text', text: _UNO('.uno:CenterPara', 'text', true), img: 'alignhorizontal', uno: '.uno:CenterPara'},
						{id: 'rightpara-text', text: _UNO('.uno:RightPara', 'text', true), img: 'alignright', uno: '.uno:RightPara'},
						{id: 'justifypara-text', text: _UNO('.uno:JustifyPara', 'text', true), img: 'alignblock', uno: '.uno:JustifyPara'},
					]},
				{type: 'break', id: 'breakalign-table', context: ['Table']},
				{type: 'menu', id: 'align-table', img: 'alignblock', hint: _UNO('.uno:TextAlign'), lockUno: '.uno:TextAlign', context: ['Table', 'DrawText'],
					items: [
						{id: 'leftpara-table', text: _UNO('.uno:LeftPara', 'text', true), img: 'alignleft', uno: '.uno:LeftPara'},
						{id: 'centerpara-table', text: _UNO('.uno:CenterPara', 'text', true), img: 'alignhorizontal', uno: '.uno:CenterPara'},
						{id: 'rightpara-table', text: _UNO('.uno:RightPara', 'text', true), img: 'alignright', uno: '.uno:RightPara'},
						{id: 'justifypara-table', text: _UNO('.uno:JustifyPara', 'text', true), img: 'alignblock', uno: '.uno:JustifyPara'},
						{type: 'break-table'},
						{id: 'cellverttop-table', text: _UNO('.uno:CellVertTop', 'text', true), img: 'cellverttop', uno: '.uno:CellVertTop'},
						{id: 'cellvertcenter-table', text: _UNO('.uno:CellVertCenter', 'text', true), img: 'cellvertcenter', uno: '.uno:CellVertCenter'},
						{id: 'cellvertbottom-table', text: _UNO('.uno:CellVertBottom', 'text', true), img: 'cellvertbottom', uno: '.uno:CellVertBottom'},
					]},
				{type: 'button',  id: 'defaultnumbering-text',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true),uno: '.uno:DefaultNumbering', disabled: true, context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'defaultbullet-text',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: '.uno:DefaultBullet', disabled: true, context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'incrementindent-text',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: '.uno:IncrementIndent', disabled: true, context: ['default', 'Text', 'DrawText', 'Table']},
				{type: 'button',  id: 'decrementindent-text',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: '.uno:DecrementIndent', disabled: true, context: ['default', 'Text', 'DrawText', 'Table']},
				// context: ['Table']
				{type: 'break', context: ['Table']},
				{type: 'menu', id: 'insertrowsbefore', img: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore'), lockUno: '.uno:InsertRowsBefore', context: ['Table'],
					items: [
						{id: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore', 'text', true), img: 'insertrowsbefore', uno: '.uno:InsertRowsBefore'},
						{id: 'insertrowsafter', hint: _UNO('.uno:InsertRowsAfter', 'text', true), img: 'insertrowsafter', uno: '.uno:InsertRowsAfter'},
						{id: 'deleterows', hint: _UNO('.uno:DeleteRows', 'text', true), img: 'deleterows', uno: '.uno:DeleteRows'},
						{type: 'break'},
						{id: 'entirecell', hint: _UNO('.uno:EntireCell', 'text', true), img: 'entirecell', uno: '.uno:EntireCell'},
						{id: 'entirerow', hint: _UNO('.uno:EntireRow', 'text', true), img: 'entirerow', uno: '.uno:EntireRow'},
						{id: 'selecttable', hint: _UNO('.uno:SelectTable', 'text', true), img: 'selecttable', uno: '.uno:SelectTable'},
						{type: 'break'},
						{id: 'setoptimalrowheight', hint: _UNO('.uno:SetOptimalRowHeight', 'text', true), img: 'setoptimalrowheight', uno: '.uno:SetOptimalRowHeight'},
					]},
				{type: 'menu', id: 'insertcolumnsbefore', img: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore'), lockUno: '.uno:InsertColumnsBefore', context: ['Table'],
					items: [
						{id: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore', 'text', true), img: 'insertcolumnsbefore', uno: '.uno:InsertColumnsBefore'},
						{id: 'insertcolumnsafter', hint: _UNO('.uno:InsertColumnsAfter', 'text', true), img: 'insertcolumnsafter', uno: '.uno:InsertColumnsAfter'},
						{id: 'deletecolumns', hint: _UNO('.uno:DeleteColumns', 'text', true), img: 'deletecolumns', uno: '.uno:DeleteColumns'},
						{type: 'break'},
						{id: 'entirecell', hint: _UNO('.uno:EntireCell', 'text', true), img: 'entirecell', uno: '.uno:EntireCell'},
						{id: 'entirecolumn', hint: _UNO('.uno:EntireColumn', 'text', true), img: 'entirecolumn', uno: '.uno:EntireColumn'},
						{id: 'selecttable', hint: _UNO('.uno:SelectTable', 'text', true), img: 'selecttable', uno: '.uno:SelectTable'},
						{type: 'break'},
						{id: 'setoptimalcolumnwidth', hint: _UNO('.uno:SetOptimalColumnWidth', 'text', true), img: 'setoptimalcolumnwidth', uno: '.uno:SetOptimalColumnWidth'},
					]},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'text', true), uno: '.uno:MergeCells', context: ['Table']},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'text', true), uno: '.uno:ToggleMergeCells', context: ['Table']},
				// context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']
				{type: 'menu', id: 'wrapmenu', img: 'wrapmenu', hint: _UNO('.uno:WrapMenu'), lockUno: '.uno:WrapMenu', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork'],
					items: [
						{id: 'wrapoff', hint: _UNO('.uno:WrapOff', 'text', true), img: 'wrapoff', uno: '.uno:WrapOff'},
						{id: 'wrapon', hint: _UNO('.uno:WrapOn', 'text', true), img: 'wrapon', uno: '.uno:WrapOn'},
						{id: 'wrapideal', hint: _UNO('.uno:WrapIdeal', 'text', true), img: 'wrapideal', uno: '.uno:WrapIdeal'},
						{type: 'break'},
						{id: 'wrapleft', hint: _UNO('.uno:WrapLeft', 'text', true), img: 'wrapleft', uno: '.uno:WrapLeft'},
						{id: 'wrapright', hint: _UNO('.uno:WrapRight', 'text', true), img: 'wrapright', uno: '.uno:WrapRight'},
						{id: 'wrapthrough', hint: _UNO('.uno:WrapThrough', 'text', true), img: 'wrapthrough', uno: '.uno:WrapThrough'},
						{type: 'break'},
						{id: 'wrapthroughtransparencytoggle', hint: _UNO('.uno:WrapThroughTransparencyToggle', 'text', true), img: 'wrapthroughtransparencytoggle', uno: '.uno:WrapThroughTransparencyToggle'},
						{id: 'wrapcontour', hint: _UNO('.uno:WrapContour', 'text', true), img: 'wrapcontour', uno: '.uno:WrapContour'},
						{id: 'wrapanchoronly', hint: _UNO('.uno:WrapAnchorOnly', 'text', true), img: 'wrapanchoronly', uno: '.uno:WrapAnchorOnly'},
					]},
				{type: 'break', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']},
				{type: 'menu', id: 'aligncenter', img: 'aligncenter', hint: _UNO('.uno:AlignCenter'), lockUno: '.uno:AlignCenter', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork'],
					items: [
						{id: 'objectalignleft', hint: _UNO('.uno:ObjectAlignLeft', 'text', true), img: 'objectalignleft', uno: '.uno:ObjectAlignLeft'},
						{id: 'aligncenter', hint: _UNO('.uno:AlignCenter', 'text', true), img: 'aligncenter', uno: '.uno:AlignCenter'},
						{id: 'objectalignright', hint: _UNO('.uno:ObjectAlignRight', 'text', true), img: 'objectalignright', uno: '.uno:ObjectAlignRight'},
						{type: 'break'},
						{id: 'alignup', hint: _UNO('.uno:AlignUp', 'text', true), img: 'alignup', uno: '.uno:AlignUp'},
						{id: 'alignmiddle', hint: _UNO('.uno:AlignMiddle', 'text', true), img: 'alignmiddle', uno: '.uno:AlignMiddle'},
						{id: 'aligndown', hint: _UNO('.uno:AlignDown', 'text', true), img: 'aligndown', uno: '.uno:AlignDown'},
					]},
				{type: 'menu', id: 'arrangemenu', img: 'arrangemenu', hint: _UNO('.uno:ArrangeMenu'), lockUno: '.uno:ArrangeMenu', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork'],
					items: [
						{id: 'bringtofront', hint: _UNO('.uno:BringToFront', 'text', true), img: 'bringtofront', uno: '.uno:BringToFront'},
						{type: 'break'},
						{id: 'objectforwardone', hint: _UNO('.uno:ObjectForwardOne', 'text', true), img: 'objectforwardone', uno: '.uno:ObjectForwardOne'},
						{id: 'objectbackone', hint: _UNO('.uno:ObjectBackOne', 'text', true), img: 'objectbackone', uno: '.uno:ObjectBackOne'},
						{type: 'break'},
						{id: 'sendtoback', hint: _UNO('.uno:SendToBack', 'text', true), img: 'sendtoback', uno: '.uno:SendToBack'},
					]},
				{type: 'button',  id: 'flipvertical',  img: 'flipvertical', hint: _UNO('.uno:FlipVertical', 'text', true), uno: '.uno:FlipVertical', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']},
				{type: 'button',  id: 'fliphorizontal',  img: 'fliphorizontal', hint: _UNO('.uno:FlipHorizontal', 'text', true), uno: '.uno:FlipHorizontal', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']},
			];
		} else if (docType == 'spreadsheet') {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: '.uno:Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'break'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), lockUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), lockUno: '.uno:BackgroundColor'},
				{type: 'break'},
				{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), lockUno: '.uno:TextAlign',
					items: [
						{id: 'alignleft', hint: _UNO('.uno:AlignLeft', 'spreadsheet', true), img: 'alignleft', uno: '.uno:AlignLeft'},
						{id: 'alignhorizontalcenter', hint: _UNO('.uno:AlignHorizontalCenter', 'spreadsheet', true), img: 'alignhorizontal', uno: '.uno:AlignHorizontalCenter'},
						{id: 'alignright', hint: _UNO('.uno:AlignRight', 'spreadsheet', true), img: 'alignright', uno: '.uno:AlignRight'},
						{id: 'alignblock', hint: _UNO('.uno:AlignBlock', 'spreadsheet', true), img: 'alignblock', uno: '.uno:AlignBlock'},
						{type: 'break'},
						{id: 'aligntop', hint: _UNO('.uno:AlignTop', 'spreadsheet', true), img: 'aligntop', uno: '.uno:AlignTop'},
						{id: 'alignvcenter', hint: _UNO('.uno:AlignVCenter', 'spreadsheet', true), img: 'alignvcenter', uno: '.uno:AlignVCenter'},
						{id: 'alignbottom', hint: _UNO('.uno:AlignBottom', 'spreadsheet', true), img: 'alignbottom', uno: '.uno:AlignBottom'},
					]},
				{type: 'button',  id: 'wraptext',  img: 'wraptext', hint: _UNO('.uno:WrapText', 'spreadsheet', true), uno: '.uno:WrapText', disabled: true},
				{type: 'break'},
				{type: 'menu', id: 'insertrowsbefore', img: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore'), lockUno: '.uno:InsertRowsBefore',
					items: [
						{id: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore', 'spreadsheet', true), img: 'insertrowsbefore', uno: '.uno:InsertRowsBefore'},
						{id: 'insertrowsafter', hint: _UNO('.uno:InsertRowsAfter', 'spreadsheet', true), img: 'insertrowsafter', uno: '.uno:InsertRowsAfter'},
						{id: 'deleterows', hint: _UNO('.uno:DeleteRows', 'spreadsheet', true), img: 'deleterows', uno: '.uno:DeleteRows'},
						{type: 'break'},
						{id: 'hiderow', hint: _UNO('.uno:HideRow', 'spreadsheet', true), img: 'hiderow', uno: '.uno:HideRow'},
						{id: 'showrow', hint: _UNO('.uno:ShowRow', 'spreadsheet', true), img: 'showrow', uno: '.uno:ShowRow'},
						{type: 'break'},
						{id: 'freezepanesrow', hint: _UNO('.uno:FreezePanesRow', 'spreadsheet', true), img: 'freezepanesrow', uno: '.uno:FreezePanesRow'},
					]},
				{type: 'menu', id: 'insertcolumnsbefore', img: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore'), lockUno: '.uno:InsertColumnsBefore',
					items: [
						{id: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore', 'spreadsheet', true), img: 'insertcolumnsbefore', uno: '.uno:InsertColumnsBefore'},
						{id: 'insertcolumnsafter', hint: _UNO('.uno:InsertColumnsAfter', 'spreadsheet', true), img: 'insertcolumnsafter', uno: '.uno:InsertColumnsAfter'},
						{id: 'deletecolumns', hint: _UNO('.uno:DeleteColumns', 'spreadsheet', true), img: 'deletecolumns', uno: '.uno:DeleteColumns'},
						{type: 'break'},
						{id: 'hidecolumn', hint: _UNO('.uno:HideColumn', 'spreadsheet', true), img: 'hidecolumn', uno: '.uno:HideColumn'},
						{id: 'showcolumn', hint: _UNO('.uno:ShowColumn', 'spreadsheet', true), img: 'showcolumn', uno: '.uno:ShowColumn'},
						{type: 'break'},
						{id: 'freezepanescolumn', hint: _UNO('.uno:FreezePanesColumn', 'spreadsheet', true), img: 'freezepanescolumn', uno: '.uno:FreezePanesColumn'},
					]},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), uno: '.uno:ToggleMergeCells', disabled: true},
				{type: 'break'},
				{type: 'drop', id: 'conditionalformaticonset',  img: 'conditionalformatdialog', hint: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet', true), html: window.getConditionalFormatMenuHtml(), uno: '.uno:ConditionalFormatMenu'},
				{type: 'button',  id: 'sortascending',  img: 'sortascending', hint: _UNO('.uno:SortAscending', 'spreadsheet', true), uno: '.uno:SortAscending'},
				{type: 'button',  id: 'sortdescending',  img: 'sortdescending', hint: _UNO('.uno:SortDescending', 'spreadsheet', true), uno: '.uno:SortDescending'},
				{type: 'break'},
				{type: 'menu', id: 'numberformatstandard', img: 'numberformatstandard', hint: _UNO('.uno:NumberFormatStandard'), lockUno: '.uno:NumberFormatStandard',
					items: [
						{id: 'numberformatstandard', hint: _UNO('.uno:NumberFormatStandard', 'spreadsheet', true), img: 'numberformatstandard', uno: '.uno:NumberFormatStandard'},
						{id: 'numberformatdecimal', hint: _UNO('.uno:NumberFormatDecimal', 'spreadsheet', true), img: 'numberformatdecimal', uno: '.uno:NumberFormatDecimal'},
						{id: 'numberformatpercent', hint: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), img: 'numberformatpercent', uno: '.uno:NumberFormatPercent'},
						{id: 'numberformatcurrency', hint: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), img: 'numberformatcurrency', uno: '.uno:NumberFormatCurrency'},
						{id: 'numberformatdate', hint: _UNO('.uno:NumberFormatDate', 'spreadsheet', true), img: 'numberformatdate', uno: '.uno:NumberFormatDate'},
						{id: 'numberformattime', hint: _UNO('.uno:NumberFormatTime', 'spreadsheet', true), img: 'numberformattime', uno: '.uno:NumberFormatTime'},
						{id: 'numberformatscientific', hint: _UNO('.uno:NumberFormatScientific', 'spreadsheet', true), img: 'numberformatscientific', uno: '.uno:NumberFormatScientific'},
						{type: 'break'},
						{id: 'numberformatthousands', hint: _UNO('.uno:NumberFormatThousands', 'spreadsheet', true), img: 'numberformatthousands', uno: '.uno:NumberFormatThousands'},
					]},
				{type: 'button',  id: 'numberformatincdecimals',  img: 'numberformatincdecimals', hint: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), uno: '.uno:NumberFormatIncDecimals', disabled: true},
				{type: 'button',  id: 'numberformatdecdecimals',  img: 'numberformatdecdecimals', hint: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), uno: '.uno:NumberFormatDecDecimals', disabled: true},
			];
		} else if ((docType == 'presentation') || (docType == 'drawing')) {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				// context: ['DrawPage']
				{type: 'button',  id: 'insertpage',  img: 'insertpage', hint: _UNO('.uno:InsertPage', 'presentation', true), uno: '.uno:InsertPage', context: ['DrawPage']},
				{type: 'button',  id: 'duplicatepage',  img: 'duplicatepage', hint: _UNO('.uno:DuplicatePage', 'presentation', true), uno: '.uno:DuplicatePage', context: ['DrawPage']},
				{type: 'button',  id: 'deletepage',  img: 'deletepage', hint: _UNO('.uno:DeletePage', 'presentation', true), uno: '.uno:DeletePage', context: ['DrawPage']},
				{type: 'break', context: ['DrawPage']},
				{type: 'button', id: 'fullscreen-' + docType, img: 'fullscreen', hint: _UNO('.uno:FullScreen', docType), context: ['DrawPage']},
				// context: ['default', 'Text', 'DrawText', 'Table']
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'break', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), lockUno: '.uno:FontColor', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), lockUno: '.uno:BackgroundColor', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'break', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), lockUno: '.uno:TextAlign', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table'],
					items: [
						{id: 'leftpara', hint: _UNO('.uno:LeftPara', '', true), img: 'alignleft',
							uno: {textCommand: '.uno:LeftPara', objectCommand: '.uno:ObjectAlignLeft'}},
						{id: 'centerpara', hint: _UNO('.uno:CenterPara', '', true), img: 'alignhorizontal',
							uno: {textCommand: '.uno:CenterPara', objectCommand: '.uno:AlignCenter'}},
						{id: 'rightpara', hint: _UNO('.uno:RightPara', '', true), img: 'alignright',
							uno: {textCommand: '.uno:RightPara', objectCommand: '.uno:ObjectAlignRight'}},
						{id: 'justifypara', hint: _UNO('.uno:JustifyPara', '', true), img: 'alignblock', uno: '.uno:JustifyPara'},
						{type: 'break'},
						{id: 'cellverttop', hint: _UNO('.uno:CellVertTop', '', true), img: 'cellverttop', uno: '.uno:CellVertTop'},
						{id: 'cellvertcenter', hint: _UNO('.uno:CellVertCenter', '', true), img: 'cellvertcenter', uno: '.uno:CellVertCenter'},
						{id: 'cellvertbottom', hint: _UNO('.uno:CellVertBottom', '', true), img: 'cellvertbottom', uno: '.uno:CellVertBottom'},
					]},
				{type: 'break', context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'button',  id: 'defaultnumbering-text',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true),uno: '.uno:DefaultNumbering', disabled: true, context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: '.uno:DefaultBullet', disabled: true, context: ['default', 'Text', 'DrawText', 'TextObject', 'Table']},
				{type: 'break', context: ['Table']},
				{type: 'menu', id: 'insertrowsbefore', img: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore'), lockUno: '.uno:InsertRowsBefore', context: ['Table'],
					items: [
						{id: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore', 'presentation', true), img: 'insertrowsbefore', uno: '.uno:InsertRowsBefore'},
						{id: 'insertrowsafter', hint: _UNO('.uno:InsertRowsAfter', 'presentation', true), img: 'insertrowsafter', uno: '.uno:InsertRowsAfter'},
						{id: 'deleterows', hint: _UNO('.uno:DeleteRows', 'presentation', true), img: 'deleterows', uno: '.uno:DeleteRows'},
						{type: 'break'},
						{id: 'entirerow', hint: _UNO('.uno:EntireRow', 'presentation', true), img: 'entirerow', uno: '.uno:EntireRow'},
						{id: 'selecttable', hint: _UNO('.uno:SelectTable', 'presentation', true), img: 'selecttable', uno: '.uno:SelectTable'},
						{type: 'break'},
						{id: 'setoptimalrowheight', hint: _UNO('.uno:SetOptimalRowHeight', 'presentation', true), img: 'setoptimalrowheight', uno: '.uno:SetOptimalRowHeight'},
					]},
				{type: 'menu', id: 'insertcolumnsbefore', img: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore'), lockUno: '.uno:InsertColumnsBefore', context: ['Table'],
					items: [
						{id: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore', 'presentation', true), img: 'insertcolumnsbefore', uno: '.uno:InsertColumnsBefore'},
						{id: 'insertcolumnsafter', hint: _UNO('.uno:InsertColumnsAfter', 'presentation', true), img: 'insertcolumnsafter', uno: '.uno:InsertColumnsAfter'},
						{id: 'deletecolumns', hint: _UNO('.uno:DeleteColumns', 'presentation', true), img: 'deletecolumns', uno: '.uno:DeleteColumns'},
						{type: 'break'},
						{id: 'entirecolumn', hint: _UNO('.uno:EntireColumn', 'presentation', true), img: 'entirecolumn', uno: '.uno:EntireColumn'},
						{id: 'selecttable', hint: _UNO('.uno:SelectTable', 'presentation', true), img: 'selecttable', uno: '.uno:SelectTable'},
						{type: 'break'},
						{id: 'setoptimalcolumnwidth', hint: _UNO('.uno:SetOptimalColumnWidth', 'presentation', true), img: 'setoptimalcolumnwidth', uno: '.uno:SetOptimalColumnWidth'},
					]},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'presentation', true), uno: '.uno:MergeCells', context: ['Table']},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'presentation', true), uno: '.uno:ToggleMergeCells', context: ['Table']},
				// context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']
				{type: 'menu', id: 'aligncenter', img: 'aligncenter', hint: _UNO('.uno:AlignCenter'), lockUno: '.uno:AlignCenter', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork'],
					items: [
						{id: 'objectalignleft', hint: _UNO('.uno:ObjectAlignLeft', '', true), img: 'objectalignleft', uno: '.uno:ObjectAlignLeft'},
						{id: 'aligncenter', hint: _UNO('.uno:AlignCenter', '', true), img: 'aligncenter', uno: '.uno:AlignCenter'},
						{id: 'objectalignright', hint: _UNO('.uno:ObjectAlignRight', '', true), img: 'objectalignright', uno: '.uno:ObjectAlignRight'},
						{type: 'break'},
						{id: 'alignup', hint: _UNO('.uno:AlignUp', '', true), img: 'alignup', uno: '.uno:AlignUp'},
						{id: 'alignmiddle', hint: _UNO('.uno:AlignMiddle', '', true), img: 'alignmiddle', uno: '.uno:AlignMiddle'},
						{id: 'aligndown', hint: _UNO('.uno:AlignDown', '', true), img: 'aligndown', uno: '.uno:AlignDown'},
					]},
				{type: 'menu', id: 'arrangemenu', img: 'arrangemenu', hint: _UNO('.uno:ArrangeMenu'), lockUno: '.uno:ArrangeMenu', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork'],
					items: [
						{id: 'bringtofront', hint: _UNO('.uno:BringToFront', '', true), img: 'bringtofront', uno: '.uno:BringToFront'},
						{type: 'break'},
						{id: 'objectforwardone', hint: _UNO('.uno:ObjectForwardOne', '', true), img: 'objectforwardone', uno: '.uno:ObjectForwardOne'},
						{id: 'objectbackone', hint: _UNO('.uno:ObjectBackOne', '', true), img: 'objectbackone', uno: '.uno:ObjectBackOne'},
						{type: 'break'},
						{id: 'sendtoback', hint: _UNO('.uno:SendToBack', '', true), img: 'sendtoback', uno: '.uno:SendToBack'},
					]},
				{type: 'button',  id: 'flipvertical',  img: 'flipvertical', hint: _UNO('.uno:FlipVertical', '', true), uno: '.uno:FlipVertical', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']},
				{type: 'button',  id: 'fliphorizontal',  img: 'fliphorizontal', hint: _UNO('.uno:FlipHorizontal', '', true), uno: '.uno:FlipHorizontal', context: ['Draw', 'DrawLine', '3DObject', 'MultiObject', 'Graphic', 'DrawFontwork']},
			];
		}
	},

	create: function() {
		var toolItems = this.getToolItems(this.options.docType);

		for (var i = 0; i < toolItems.length; i++) {
			if (toolItems[i].type === 'menu' && toolItems[i].items) {
				for (var j = 0; j < toolItems[i].items.length; j++) {
					toolItems[i].items[j].text = toolItems[i].items[j].text || toolItems[i].items[j].hint;
				}
			}
		}

		var toolbar = $('#toolbar-down');
		toolbar.w2toolbar({
			name: 'editbar',
			items: toolItems,
			onClick: function (e) {
				// use global handler
				window.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			},
		});
		this.map.uiManager.enableTooltip(toolbar);

		toolbar.bind('touchstart', function(e) {
			w2ui['editbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});

		if (this.map.isRestrictedUser()) {
			for (var i = 0; i < toolItems.length; i++) {
				var it = toolItems[i];
				this.map.hideRestrictedItems(it, $('#tb_editbar_item_'+ it.id)[0], $('#tb_editbar_item_'+ it.id)[0]);
			}
		}

		if (this.map.isLockedUser()) {
			for (var i = 0; i < toolItems.length; i++) {
				var it = toolItems[i];
				this.map.disableLockedItem(it, $('#tb_editbar_item_'+ it.id)[0], $('#tb_editbar_item_'+ it.id)[0]);
			}
		}

		this._updateToolbarsVisibility();
	},

	_updateToolbarsVisibility: function(context) {
		window.updateVisibilityForToolbar(w2ui['editbar'], context);
	},

	onContextChange: function(event) {
		this._updateToolbarsVisibility(event.context);
	},
});

L.control.mobileBottomBar = function (docType) {
	return new L.Control.MobileBottomBar(docType);
};
