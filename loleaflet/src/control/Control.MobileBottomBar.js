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
	},

	getToolItems: function(docType) {
		if (docType == 'text') {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: '.uno:Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: '.uno:Strikeout'},
				{type: 'break'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), freemiumUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), freemiumUno: '.uno:BackgroundColor'},
				{type: 'button',  id: 'leftpara',  img: 'alignleft', hint: _UNO('.uno:LeftPara', '', true),
					uno: {textCommand: '.uno:LeftPara', objectCommand: '.uno:ObjectAlignLeft'},
					unosheet: '.uno:AlignLeft', disabled: true},
				{type: 'button',  id: 'centerpara',  img: 'alignhorizontal', hint: _UNO('.uno:CenterPara', '', true),
					uno: {textCommand: '.uno:CenterPara', objectCommand: '.uno:AlignCenter'},
					unosheet: '.uno:AlignHorizontalCenter', disabled: true},
				{type: 'button',  id: 'rightpara',  img: 'alignright', hint: _UNO('.uno:RightPara', '', true),
					uno: {textCommand: '.uno:RightPara', objectCommand: '.uno:ObjectAlignRight'},
					unosheet: '.uno:AlignRight', disabled: true},
				{type: 'button',  id: 'justifypara',  img: 'alignblock', hint: _UNO('.uno:JustifyPara', '', true), uno: '.uno:JustifyPara', unosheet: '', disabled: true},
				{type: 'break', id: 'breakspacing'},
				{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true),uno: '.uno:DefaultNumbering', disabled: true},
				{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: '.uno:DefaultBullet', disabled: true},
				{type: 'break', id: 'breakbullet', hidden: true},
				{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: '.uno:IncrementIndent', disabled: true},
				{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: '.uno:DecrementIndent', disabled: true},
			];
		} else if (docType == 'spreadsheet') {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
				{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: '.uno:Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: '.uno:Strikeout'},
				{type: 'break'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), freemiumUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), freemiumUno: '.uno:BackgroundColor'},
				{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), uno: '.uno:ToggleMergeCells', disabled: true},
	//			{type: 'break', id: 'breakmergecells'},
				{type: 'break'},
				{type: 'button', id: 'alignleft', img: 'alignleft', hint: _UNO('.uno:AlignLeft', 'spreadsheet', true), uno: '.uno:AlignLeft'},
				{type: 'button', id: 'alignhorizontalcenter', img: 'alignhorizontal', hint: _UNO('.uno:AlignHorizontalCenter', 'spreadsheet', true), uno: '.uno:AlignHorizontalCenter'},
				{type: 'button', id: 'alignright', img: 'alignright', hint: _UNO('.uno:AlignRight', 'spreadsheet', true), uno: '.uno:AlignRight'},
				{type: 'button', id: 'alignblock', img: 'alignblock', hint: _UNO('.uno:AlignBlock', 'spreadsheet', true), uno: '.uno:AlignBlock'},
				{type: 'break'},
				{type: 'button',  id: 'wraptext',  img: 'wraptext', hint: _UNO('.uno:WrapText', 'spreadsheet', true), uno: '.uno:WrapText', disabled: true},
				{type: 'button',  id: 'insertrowsafter',  img: 'insertrowsafter', hint: _UNO('.uno:InsertRowsAfter'), uno: '.uno:InsertRowsAfter'},
				{type: 'button',  id: 'insertcolumnsafter',  img: 'insertcolumnsafter', hint: _UNO('.uno:InsertColumnsAfter'), uno: '.uno:InsertColumnsAfter'},
	/*			{type: 'button',  id: 'numberformatcurrency',  img: 'numberformatcurrency', hint: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), uno: 'NumberFormatCurrency', disabled: true},
				{type: 'button',  id: 'numberformatpercent',  img: 'numberformatpercent', hint: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), uno: 'NumberFormatPercent', disabled: true},
				{type: 'button',  id: 'numberformatdecdecimals',  img: 'numberformatdecdecimals', hint: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatDecDecimals', disabled: true},
				{type: 'button',  id: 'numberformatincdecimals',  img: 'numberformatincdecimals', hint: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatIncDecimals', disabled: true},
				{type: 'button',  id: 'sum',  img: 'autosum', hint: _('Sum')},
				{type: 'break',   id: 'break-number'}, */
			];
		} else if (docType == 'presentation') {
			return [
				{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
				{type: 'break'},
				{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: '.uno:Bold'},
	//			{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic'},
				{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: '.uno:Underline'},
				{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: '.uno:Strikeout'},
				{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), freemiumUno: '.uno:FontColor'},
				{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor'), freemiumUno: '.uno:BackgroundColor'},
				{type: 'break'},
				{type: 'button', id: 'leftpara', img: 'alignleft', hint: _UNO('.uno:LeftPara', '', true),
					uno: {textCommand: '.uno:LeftPara', objectCommand: '.uno:ObjectAlignLeft'}},
				{type: 'button', id: 'centerpara', img: 'alignhorizontal', hint: _UNO('.uno:CenterPara', '', true),
					uno: {textCommand: '.uno:CenterPara', objectCommand: '.uno:AlignCenter'}},
				{type: 'button', id: 'rightpara', img: 'alignright', hint: _UNO('.uno:RightPara', '', true),
					uno: {textCommand: '.uno:RightPara', objectCommand: '.uno:ObjectAlignRight'}},
				{type: 'button', id: 'justifypara', img: 'alignblock', hint: _UNO('.uno:JustifyPara', '', true), uno: '.uno:JustifyPara'},
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
		this.map.uiManager.enableTooltip(toolbar);

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
	}
});

L.control.mobileBottomBar = function (docType) {
	return new L.Control.MobileBottomBar(docType);
};
