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
				{type: 'button',  id: 'insertrowsafter',  img: 'insertrowsafter', hint: _UNO('.uno:InsertRowsAfter'), uno: '.uno:InsertRowsAfter'},
				{type: 'button',  id: 'insertcolumnsafter',  img: 'insertcolumnsafter', hint: _UNO('.uno:InsertColumnsAfter'), uno: '.uno:InsertColumnsAfter'},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), uno: '.uno:ToggleMergeCells', disabled: true},
				// {type: 'break', id: 'breakmergecells'},
				/*			{type: 'button',  id: 'numberformatcurrency',  img: 'numberformatcurrency', hint: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), uno: 'NumberFormatCurrency', disabled: true},
				{type: 'button',  id: 'numberformatpercent',  img: 'numberformatpercent', hint: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), uno: 'NumberFormatPercent', disabled: true},
				{type: 'button',  id: 'numberformatdecdecimals',  img: 'numberformatdecdecimals', hint: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatDecDecimals', disabled: true},
				{type: 'button',  id: 'numberformatincdecimals',  img: 'numberformatincdecimals', hint: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatIncDecimals', disabled: true},
				{type: 'button',  id: 'sum',  img: 'autosum', hint: _('Sum')},
				{type: 'break',   id: 'break-number'}, */
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
