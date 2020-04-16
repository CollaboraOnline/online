/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.TopToolbar
 */

/* global $ w2ui _ _UNO w2utils */
L.Control.TopToolbar = L.Control.extend({
	options: {
		stylesSelectValue: null,
		fontsSelectValue: null
	},

	onAdd: function (map) {
		this.map = map;
		this.create();

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('updatepermission', this.onUpdatePermission, this);
		map.on('wopiprops', this.onWopiProps, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);

		if (!window.mode.isMobile()) {
			map.on('updatetoolbarcommandvalues', this.updateCommandValues, this);
		}
	},

	onFontSizeSelect: function(e) {
		this.map.applyFontSize(e.target.value);
		this.map.focus();
	},

	onFontSelect: function(e) {
		var font = e.target.value;
		this.map.applyFont(font);
		this.map.focus();
	},

	onStyleSelect: function(e) {
		var style = e.target.value;
		if (style.startsWith('.uno:')) {
			this.map.sendUnoCommand(style);
		}
		else if (this.map.getDocType() === 'text') {
			this.map.applyStyle(style, 'ParagraphStyles');
		}
		else if (this.map.getDocType() === 'spreadsheet') {
			this.map.applyStyle(style, 'CellStyles');
		}
		else if (this.map.getDocType() === 'presentation' || this.map.getDocType() === 'drawing') {
			this.map.applyLayout(style);
		}
		this.map.focus();
	},

	_updateVisibilityForToolbar: function(toolbar) {
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
	},

	// mobile:false means hide it both for normal Online used from a mobile phone browser, and in a mobile app on a mobile phone
	// mobilebrowser:false means hide it for normal Online used from a mobile browser, but don't hide it in a mobile app
	// tablet:true means show it in normal Online from a tablet browser, and in a mobile app on a tablet
	// tablet:false means hide it in normal Online used from a tablet browser, and in a mobile app on a tablet

	getToolItems: function() {
		return [
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
			{type: 'drop',  id: 'inserttable',  img: 'inserttable', hint: _('Insert table'), hidden: true, overlay: {onShow: window.insertTable},
			 html: '<div id="inserttable-wrapper"><div id="inserttable-popup" class="inserttable-pop ui-widget ui-corner-all"><div class="inserttable-grid"></div><div id="inserttable-status" class="loleaflet-font" style="padding: 5px;"><br/></div></div></div>'},
			{type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true)},
			{type: 'menu', id: 'menugraphic', img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true), hidden: true,
				items: [
					{id: 'localgraphic', text: _('Insert Local Image')},
					{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true)},
				]},
			{type: 'button',  id: 'insertobjectchart',  img: 'insertobjectchart', hint: _UNO('.uno:InsertObjectChart', '', true), uno: 'InsertObjectChart'},
			{type: 'drop',  id: 'insertshapes',  img: 'basicshapes_ellipse', hint: _('Insert shapes'), overlay: {onShow: window.insertShapes},
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
	},

	create: function() {
		var toolbar = $('#toolbar-up');
		toolbar.w2toolbar({
			name: 'editbar',
			tooltip: 'bottom',
			items: this.getToolItems(),
			onClick: function (e) {
				window.onClick(e, e.target);
				window.hideTooltip(this, e.target);
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
					window.insertTable();

				if (event.target === 'insertshapes')
					window.insertShapes();
			}
		});
	
		toolbar.bind('touchstart', function() {
			w2ui['editbar'].touchStarted = true;
		});
	},

	onDocLayerInit: function() {
		var toolbarUp = w2ui['editbar'];
		var docType = this.map.getDocType();
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
				$('.styles-select').on('select2:select', this.onStyleSelect, this);
			}

			if (toolbarUp) {
				toolbarUp.show('breaksidebar', 'modifypage');
			}

			// FALLTHROUGH intended
		case 'drawing':
			if (toolbarUp)
				toolbarUp.show('leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
				'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'inserttextbox', 'inserttable', 'backcolor',
				'breaksidebar', 'modifypage', 'slidechangewindow', 'customanimation', 'masterslidespanel');
			break;
		}

		this._updateVisibilityForToolbar(w2ui['editbar']);

		if (toolbarUp)
			toolbarUp.refresh();

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
		$('.fontsizes-select').off('select2:select', this.onFontSizeSelect.bind(this)).on('select2:select', this.onFontSizeSelect.bind(this));
	},

	onUpdatePermission: function(e) {
		if (e.perm === 'edit') {
			// Enable list boxes
			$('.styles-select').prop('disabled', false);
			$('.fonts-select').prop('disabled', false);
			$('.fontsizes-select').prop('disabled', false);
		} else {
			// Disable list boxes
			$('.styles-select').prop('disabled', true);
			$('.fonts-select').prop('disabled', true);
			$('.fontsizes-select').prop('disabled', true);
		}
	},

	onWopiProps: function(e) {
		if (e.HideSaveOption) {
			w2ui['editbar'].hide('save');
		}
		if (e.HidePrintOption) {
			w2ui['editbar'].hide('print');
		}
		if (e.EnableInsertRemoteImage === true && w2ui['editbar']) {
			w2ui['editbar'].hide('insertgraphic');
			w2ui['editbar'].show('menugraphic');
		}
	},

	updateCommandValues: function(e) {
		var data = [];
		var commandValues;
		// 1) For .uno:StyleApply
		// we need an empty option for the place holder to work
		if (e.commandName === '.uno:StyleApply') {
			var styles = [];
			var topStyles = [];
			commandValues = this.map.getToolbarCommandValues(e.commandName);
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

			if (this.map.getDocType() === 'text') {
				styles = commandValues.ParagraphStyles.slice(7, 19);
				topStyles = commandValues.ParagraphStyles.slice(0, 7);
			}
			else if (this.map.getDocType() === 'spreadsheet') {
				styles = commandValues.CellStyles;
			}
			else if (this.map.getDocType() === 'presentation') {
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
			$('.styles-select').val(this.options.stylesSelectValue).trigger('change');
			$('.styles-select').on('select2:select', this.onStyleSelect.bind(this));
			w2ui['editbar'].resize();
		} else if (e.commandName === '.uno:CharFontName') {
			// 2) For .uno:CharFontName
			commandValues = this.map.getToolbarCommandValues(e.commandName);
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
			$('.fonts-select').on('select2:select', this.onFontSelect.bind(this));
			$('.fonts-select').val(this.options.fontsSelectValue).trigger('change');
			w2ui['editbar'].resize();
		}
	},

	onCommandStateChanged: function(e) {
		var commandName = e.commandName;
		var state = e.state;
		var found = false;
		var value;

		if (commandName === '.uno:StyleApply') {
			if (!state) {
				return;
			}

			// For impress documents, no styles is supported.
			if (this.map.getDocType() === 'presentation') {
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

			this.options.stylesSelectValue = state;
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
			this.options.fontsSelectValue = state;
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
	}
});

L.control.topToolbar = function () {
	return new L.Control.TopToolbar();
};
