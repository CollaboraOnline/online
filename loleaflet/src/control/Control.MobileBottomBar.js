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
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: '.uno:Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'break'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), freemiumUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), freemiumUno: '.uno:BackgroundColor'},
				{type: 'break'},
				{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), freemiumUno: '.uno:TextAlign',
					items: [                
						{id: 'leftpara', text: _UNO('.uno:LeftPara', 'text', true), img: 'alignleft', uno: '.uno:LeftPara'},
						{id: 'centerpara', text: _UNO('.uno:CenterPara', 'text', true), img: 'alignhorizontal', uno: '.uno:CenterPara'},
						{id: 'rightpara', text: _UNO('.uno:RightPara', 'text', true), img: 'alignright', uno: '.uno:RightPara'},
						{id: 'justifypara', text: _UNO('.uno:JustifyPara', 'text', true), img: 'alignblock', uno: '.uno:JustifyPara'},
						{type: 'break'},
						{id: 'cellverttop', text: _UNO('.uno:CellVertTop', 'text', true), img: 'cellverttop', uno: '.uno:CellVertTop', context: ['Table']},
						{id: 'cellvertcenter', text: _UNO('.uno:CellVertCenter', 'text', true), img: 'cellvertcenter', uno: '.uno:CellVertCenter', context: ['Table']},
						{id: 'cellvertbottom', text: _UNO('.uno:CellVertBottom', 'text', true), img: 'cellvertbottom', uno: '.uno:CellVertBottom', context: ['Table']},
					]},
				{type: 'break', id: 'breakspacing'},
				{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true),uno: '.uno:DefaultNumbering', disabled: true},
				{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: '.uno:DefaultBullet', disabled: true},
				{type: 'break', id: 'breakbullet', hidden: true},
				{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: '.uno:IncrementIndent', disabled: true},
				{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: '.uno:DecrementIndent', disabled: true},
				{type: 'break', context: ['Table']},
				{type: 'button',  id: 'insertcolumnsbefore', img: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore'), uno: '.uno:InsertColumnsBefore', context: ['Table']},
				{type: 'button',  id: 'insertrowsbefore', img: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore'), uno: '.uno:InsertRowsBefore', context: ['Table']},
			];
		} else if (docType == 'spreadsheet') {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: '.uno:Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'break'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), freemiumUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), freemiumUno: '.uno:BackgroundColor'},
				{type: 'break'},
				{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), freemiumUno: '.uno:TextAlign',
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
				{type: 'menu', id: 'insertrowsbefore', img: 'insertrowsbefore', hint: _UNO('.uno:InsertRowsBefore'), freemiumUno: '.uno:InsertRowsBefore',
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
				{type: 'menu', id: 'insertcolumnsbefore', img: 'insertcolumnsbefore', hint: _UNO('.uno:InsertColumnsBefore'), freemiumUno: '.uno:InsertColumnsBefore',
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
				{type: 'menu', id: 'numberformatstandard', img: 'numberformatstandard', hint: _UNO('.uno:NumberFormatStandard'), freemiumUno: '.uno:NumberFormatStandard',
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
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'break'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), freemiumUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), freemiumUno: '.uno:BackgroundColor'},
				{type: 'break'},
				{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), freemiumUno: '.uno:TextAlign',
					items: [                
						{id: 'leftpara', hint: _UNO('.uno:LeftPara', '', true), img: 'alignleft',
							uno: {textCommand: '.uno:LeftPara', objectCommand: '.uno:ObjectAlignLeft'}},
						{id: 'centerpara', hint: _UNO('.uno:CenterPara', '', true), img: 'alignhorizontal',
							uno: {textCommand: '.uno:CenterPara', objectCommand: '.uno:AlignCenter'}},
						{id: 'rightpara', hint: _UNO('.uno:RightPara', '', true), img: 'alignright',
							uno: {textCommand: '.uno:RightPara', objectCommand: '.uno:ObjectAlignRight'}},
						{id: 'justifypara', hint: _UNO('.uno:JustifyPara', '', true), img: 'alignblock', uno: '.uno:JustifyPara'},
						{type: 'break'},
						{id: 'cellverttop', hint: _UNO('.uno:CellVertTop', '', true), img: 'cellverttop', uno: '.uno:CellVertTop', context: ['Table']},
						{id: 'cellvertcenter', hint: _UNO('.uno:CellVertCenter', '', true), img: 'cellvertcenter', uno: '.uno:CellVertCenter', context: ['Table']},
						{id: 'cellvertbottom', hint: _UNO('.uno:CellVertBottom', '', true), img: 'cellvertbottom', uno: '.uno:CellVertBottom', context: ['Table']},
					]},
				{type: 'break'},
				{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: '.uno:DefaultBullet', disabled: true},
			];
		}
	},

	create: function() {
		var toolItems = this.getToolItems(this.options.docType);

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

		toolbar.bind('touchstart', function(e) {
			w2ui['editbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});

		if (this.map.isFreemiumUser()) {
			for (var i = 0; i < toolItems.length; i++) {
				var it = toolItems[i];
				this.map.disableFreemiumItem(it, $('#tb_editbar_item_'+ it.id)[0], $('#tb_editbar_item_'+ it.id)[0]);
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
