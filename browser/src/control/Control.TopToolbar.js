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
		map.on('contextchange', this.onContextChange, this);

		if (!window.mode.isMobile()) {
			map.on('updatetoolbarcommandvalues', this.updateCommandValues, this);
		}

		$(window).resize(function() {
			if ($(window).width() !== map.getSize().x) {
				var toolbar = w2ui['editbar'];
				if (toolbar)
					toolbar.resize();
			}
		});
	},

	onRemove: function() {
		$().w2destroy('editbar');
		L.DomUtil.get('toolbar-up').remove();

		this.map.off('doclayerinit', this.onDocLayerInit, this);
		this.map.off('updatepermission', this.onUpdatePermission, this);
		this.map.off('wopiprops', this.onWopiProps, this);
		this.map.off('commandstatechanged', this.onCommandStateChanged, this);

		if (!window.mode.isMobile()) {
			this.map.off('updatetoolbarcommandvalues', this.updateCommandValues, this);
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

	onContextChange: function(event) {
		window.updateVisibilityForToolbar(w2ui['editbar'], event.context);
	},

	// mobile:false means hide it both for normal Online used from a mobile phone browser, and in a mobile app on a mobile phone
	// mobilebrowser:false means hide it for normal Online used from a mobile browser, but don't hide it in a mobile app
	// tablet:true means show it in normal Online from a tablet browser, and in a mobile app on a tablet
	// tablet:false means hide it in normal Online used from a tablet browser, and in a mobile app on a tablet

	// hidden means display:none
	// invisible means visibility:hidden

	getToolItems: function() {
		var that = this;
		return [
			{type: 'button',  id: 'closemobile',  img: 'closemobile', desktop: false, mobile: false, tablet: true, hidden: true},
			{type: 'button',  id: 'save', img: 'save', hint: _UNO('.uno:Save'), lockUno: '.uno:Save'},
			{type: 'button',  id: 'print', img: 'print', hint: _UNO('.uno:Print', 'text'), mobile: false, tablet: false, lockUno: '.uno:Print'},
			{type: 'break', id: 'savebreak', mobile: false},
			{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true, mobile: false},
			{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true, mobile: false},
			{type: 'break', id: 'redobreak', mobile: false, tablet: false,},
			{type: 'button',  id: 'formatpaintbrush',  img: 'copyformat', hint: _UNO('.uno:FormatPaintbrush'), uno: 'FormatPaintbrush', mobile: false},
			{type: 'button',  id: 'reset',  img: 'deleteformat', hint: _UNO('.uno:ResetAttributes', 'text'), hidden: true, uno: 'ResetAttributes', mobile: false},
			{type: 'button',  id: 'resetimpress',  img: 'deleteformat', hint: _UNO('.uno:SetDefault', 'presentation', 'true'), hidden: true, uno: 'SetDefault', mobile: false},
			{type: 'break', id: 'breakreset', invisible: true, mobile: false, tablet: false,},
			{type: 'html', id: 'styles',
				html: '<select id="styles-select" class="styles-select"><option>' + _('Default Style') + '</option></select>',
				onRefresh: function (edata) {
					if (!edata.item.html) {
						edata.isCancelled = true;
					} else {
						$.extend(edata, { onComplete: function (e) {
							$('#styles-select').select2();
							e.item.html = undefined;
						}});
					}
				}, hidden: true, desktop: true, mobile: false, tablet: false},
			{type: 'html', id: 'fonts',
				html: '<select id="fonts-select" class="fonts-select"><option>Carlito</option></select>',
				onRefresh: function (edata) {
					if (!edata.item.html) {
						edata.isCancelled = true;
					} else {
						$.extend(edata, { onComplete: function (e) {
							e.item.html = undefined;
						}});
					}
				}, mobile: false},
			{type: 'html',   id: 'fontsizes',
				html: '<select id="fontsizes-select" class="fontsizes-select">',
				onRefresh: function (edata) {
					if (!edata.item.html) {
						edata.isCancelled = true;
					} else {
						$.extend(edata, { onComplete: function (e) {
							e.item.html = undefined;
						}});
					}
				}, mobile: false},
			{type: 'break', id: 'breakfontsizes', invisible: true, mobile: false, tablet: false,},
			{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: 'Bold'},
			{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic'},
			{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: 'Underline'},
			{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: 'Strikeout'},
			{type: 'break', id: 'breakformatting'},
			{type: 'drop',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor'), overlay: { onShow : function() { window.showColorPicker('fontcolor'); }} , html: window.getColorPickerHTML('fontcolor'), lockUno: '.uno:FontColor'},
			{type: 'drop',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackColor', 'text'), hidden: true,  overlay: { onShow : function() { window.showColorPicker('backcolor'); }} , html: window.getColorPickerHTML('backcolor'), lockUno: '.uno:BackColor'},
			{type: 'drop',  id: 'backgroundcolor', img: 'backgroundcolor', hint: _UNO('.uno:BackgroundColor'), hidden: true,  overlay: { onShow : function() { window.showColorPicker('backgroundcolor'); }} , html: window.getColorPickerHTML('backcolor'), lockUno: '.uno:BackgroundColor'},
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
			{type: 'drop',  id: 'setborderstyle',  img: 'setborderstyle', hint: _('Borders'), hidden: true, html: window.getBorderStyleMenuHtml()},
			{type: 'button',  id: 'togglemergecells',  img: 'togglemergecells', hint: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), hidden: true, uno: 'ToggleMergeCells', disabled: true},
			{type: 'break', id: 'breakmergecells', hidden: true},
			{type: 'menu', id: 'textalign', img: 'alignblock', hint: _UNO('.uno:TextAlign'), hidden: true, lockUno: '.uno:TextAlign',
				items: [
					{id: 'alignleft', text: _UNO('.uno:AlignLeft', 'spreadsheet', true), icon: 'alignleft', uno: 'AlignLeft'},
					{id: 'alignhorizontalcenter', text: _UNO('.uno:AlignHorizontalCenter', 'spreadsheet', true), icon: 'alignhorizontal', uno: 'AlignHorizontalCenter'},
					{id: 'alignright', text: _UNO('.uno:AlignRight', 'spreadsheet', true), icon: 'alignright', uno: 'AlignRight'},
					{id: 'alignblock', text: _UNO('.uno:AlignBlock', 'spreadsheet', true), icon: 'alignblock', uno: 'AlignBlock'},
					{type: 'break'},
					{id: 'aligntop', text: _UNO('.uno:AlignTop', 'spreadsheet', true), icon: 'aligntop', uno: 'AlignTop'},
					{id: 'alignvcenter', text: _UNO('.uno:AlignVCenter', 'spreadsheet', true), icon: 'alignvcenter', uno: 'AlignVCenter'},
					{id: 'alignbottom', text: _UNO('.uno:AlignBottom', 'spreadsheet', true), icon: 'alignbottom', uno: 'AlignBottom'},
				]},
			{type: 'menu',  id: 'linespacing',  img: 'linespacing', hint: _UNO('.uno:FormatSpacingMenu'), hidden: true, lockUno: '.uno:FormatSpacingMenu',
				items: [
					{id: 'spacepara1', img: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: 'SpacePara1'},
					{id: 'spacepara15', img: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: 'SpacePara15'},
					{id: 'spacepara2', img: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: 'SpacePara2'},
					{type: 'break'},
					{id: 'paraspaceincrease', img: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: 'ParaspaceIncrease'},
					{id: 'paraspacedecrease', img: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: 'ParaspaceDecrease'}
				],
				onRefresh: function (event) {
					var isChecked = function(command) {
						var items = that.map['stateChangeHandler'];
						var val = items.getItemValue(command);
						if (val && (val === 'true' || val === true))
							return true;
						else
							return false;
					};

					event.item.selected = null;

					for (var i in event.item.items) {
						var item = event.item.items[i];
						item.checked = false;

						if (item.id && item.id.indexOf('spacepara') !== -1) {
							item.checked = isChecked('.uno:' + item.uno);
							if (item.checked)
								event.item.selected = item.id;
						}
					}
				}},
			{type: 'button',  id: 'wraptext',  img: 'wraptext', hint: _UNO('.uno:WrapText', 'spreadsheet', true), hidden: true, uno: 'WrapText', disabled: true},
			{type: 'break', id: 'breakspacing', hidden: true},
			{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true), hidden: true, uno: 'DefaultNumbering', disabled: true},
			{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), hidden: true, uno: 'DefaultBullet', disabled: true},
			{type: 'break', id: 'breakbullet', hidden: true},
			{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: 'IncrementIndent', hidden: true, disabled: true},
			{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: 'DecrementIndent', hidden: true, disabled: true},
			{type: 'break', id: 'breakindent', hidden: true},
			{type: 'drop', id: 'conditionalformaticonset',  img: 'conditionalformatdialog', hint: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet', true), hidden: true, html: window.getConditionalFormatMenuHtml(), lockUno: '.uno:ConditionalFormatMenu'},
			{type: 'button',  id: 'sortascending',  img: 'sortascending', hint: _UNO('.uno:SortAscending', 'spreadsheet', true), uno: 'SortAscending', disabled: true, hidden: true},
			{type: 'button',  id: 'sortdescending',  img: 'sortdescending', hint: _UNO('.uno:SortDescending', 'spreadsheet', true), uno: 'SortDescending', disabled: true, hidden: true},
			{type: 'break', id: 'breaksorting', hidden: true},
			{type: 'button',  id: 'numberformatcurrency',  img: 'numberformatcurrency', hint: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), hidden: true, uno: 'NumberFormatCurrency', disabled: true},
			{type: 'button',  id: 'numberformatpercent',  img: 'numberformatpercent', hint: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), hidden: true, uno: 'NumberFormatPercent', disabled: true},
			{type: 'button',  id: 'numberformatdecdecimals',  img: 'numberformatdecdecimals', hint: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatDecDecimals', disabled: true},
			{type: 'button',  id: 'numberformatincdecimals',  img: 'numberformatincdecimals', hint: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), hidden: true, uno: 'NumberFormatIncDecimals', disabled: true},
			{type: 'break',   id: 'break-number', hidden: true},
			{type: 'drop',  id: 'inserttable',  img: 'inserttable', hint: _('Insert table'), hidden: true, overlay: {onShow: window.insertTable}, html: window.getInsertTablePopupHtml(), lockUno: '.uno:InsertTable'},
			{type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true), lockUno: '.uno:InsertGraphic'},
			{type: 'menu', id: 'menugraphic', img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true), hidden: true, lockUno: '.uno:InsertGraphic',
				items: [
					{id: 'localgraphic', text: _('Insert Local Image')},
					{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true)},
				]},
			{type: 'button',  id: 'insertobjectchart',  img: 'insertobjectchart', hint: _UNO('.uno:InsertObjectChart', '', true), uno: 'InsertObjectChart'},
			{type: 'drop',  id: 'insertshapes',  img: 'basicshapes_ellipse', hint: _('Insert shapes'), overlay: {onShow: function() {window.insertShapes('insertshapes'); }}, html: window.getShapesPopupHtml()},
			{type: 'button',  id: 'insertline', img: 'line', hint: _UNO('.uno:Line', '', true), uno: 'Line'},
			{type: 'drop',  id: 'insertconnectors',  img: 'connectors_connector', hint: _('Insert connectors'), overlay: {onShow: function() {window.insertShapes('insertconnectors'); }}, html: window.getShapesPopupHtml(), hidden: true},
			{type: 'break',   id: 'breakinsert', desktop: true},
			{type: 'button',  id: 'inserttextbox', img: 'text', hint: _UNO('.uno:Text', '', true), uno: 'Text?CreateDirectly:bool=true', hidden: true},
			{type: 'button',  id: 'insertannotation', img: 'annotation', hint: _UNO('.uno:InsertAnnotation', '', true), hidden: true, lockUno: '.uno:InsertAnnotation'},
			{type: 'button',  id: 'link',  img: 'link', hint: _UNO('.uno:HyperlinkDialog', '', true), disabled: true, lockUno: '.uno:HyperlinkDialog'},
			{type: 'button',  id: 'insertsymbol', img: 'insertsymbol', hint: _UNO('.uno:InsertSymbol', '', true), uno: 'InsertSymbol'},
			{type: 'spacer'},
			{type: 'break', id: 'breaksidebar', hidden: true},
			{type: 'button',  id: 'edit',  img: 'edit'},
			{type: 'button',  id: 'sidebar', img: 'sidebar_modify_page', hint: _UNO('.uno:Sidebar', '', true), uno: '.uno:SidebarDeck.PropertyDeck', hidden: true},
			{type: 'button',  id: 'modifypage', img: 'sidebar_modify_page', hint: _UNO('.uno:ModifyPage', 'presentation', true), uno: '.uno:ModifyPage', hidden: true},
			{type: 'button',  id: 'sidebarmodifypage', img: 'sidebar_modify_page',  hint: _UNO('.uno:ModifyPage', 'drawing', true), uno: '.uno:SidebarDeck.PropertyDeck', hidden: true},
			{type: 'button',  id: 'slidechangewindow', img: 'sidebar_slide_change', hint: _UNO('.uno:SlideChangeWindow', 'presentation', true), uno: '.uno:SlideChangeWindow', hidden: true},
			{type: 'button',  id: 'customanimation', img: 'sidebar_custom_animation', hint: _UNO('.uno:CustomAnimation', 'presentation', true), uno: '.uno:CustomAnimation', hidden: true},
			{type: 'button',  id: 'masterslidespanel', img: 'sidebar_master_slides', hint: _UNO('.uno:MasterSlidesPanel', 'presentation', true), uno: '.uno:MasterSlidesPanel', hidden: true},
			{type: 'button',  id: 'navigator', img: 'navigator', hint: _UNO('.uno:Navigator'), uno: '.uno:Navigator', hidden: true},
			{type: 'button',  id: 'fold',  img: 'fold', desktop: true, mobile: false, hidden: true},
			{type: 'button',  id: 'hamburger-tablet',  img: 'fold', desktop: false, mobile: false, tablet: true, iosapptablet: false, hidden: true},
		];
	},

	updateControlsState: function() {
		if (this.map['stateChangeHandler']) {
			var items = this.map['stateChangeHandler'].getItems();
			if (items) {
				for (var item in items) {
					this.processStateChangedCommand(item, items[item]);
				}
			}
		}
	},

	create: function() {
		$().w2destroy('editbar');
		var toolbar = L.DomUtil.get('toolbar-up');
		// In case it contains garbage
		if (toolbar)
			toolbar.remove();
		// Use original template as provided by server
		$('#toolbar-logo').after(this.map.toolbarUpTemplate.cloneNode(true));
		toolbar = $('#toolbar-up');
		var that = this;
		toolbar.w2toolbar({
			name: 'editbar',
			items: this.getToolItems(),
			onClick: function (e) {
				window.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			},
			onRefresh: function(event) {
				if (event.item && (event.target === 'styles' || event.target === 'fonts' || event.target === 'fontsizes'
					|| event.item.invisible)) {
					var toolItem = $(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(event.item.id));

					if (event.item.invisible === true) {
						toolItem.css('visibility', 'hidden');
					}
					else if ((window.mode.isDesktop() && event.item.desktop == false)
							|| (window.mode.isTablet() && event.item.tablet == false)) {
						toolItem.css('display', 'none');
					} else {
						toolItem.css('display', '');
					}
				}

				if (event.target === 'inserttable')
					window.insertTable();

				if (event.target === 'insertshapes' || event.target === 'insertconnectors')
					window.insertShapes(event.target);

				if (that.map.isRestrictedUser()) {
					for (var i = 0; i < this.items.length; i++) {
						var it = this.items[i];
						that.map.hideRestrictedItems(it, $('#tb_editbar_item_'+ it.id)[0], $('#tb_editbar_item_'+ it.id)[0]);
					}
				}

				if (that.map.isLockedUser()) {
					for (var i = 0; i < this.items.length; i++) {
						var it = this.items[i];
						that.map.disableLockedItem(it, $('#tb_editbar_item_'+ it.id)[0], $('#tb_editbar_item_'+ it.id)[0]);
					}
				}
			}
		});
		this.map.uiManager.enableTooltip(toolbar);

		toolbar.bind('touchstart', function() {
			w2ui['editbar'].touchStarted = true;
		});

		this.map.createFontSelector('#fonts-select');
		w2ui['editbar'].resize();
	},

	onDocLayerInit: function() {
		var toolbarUp = w2ui['editbar'];
		var docType = this.map.getDocType();
		var data;

		switch (docType) {
		case 'spreadsheet':
			if (toolbarUp) {
				toolbarUp.show('reset', 'textalign', 'wraptext', 'breakspacing', 'insertannotation', 'conditionalformaticonset',
					'numberformatcurrency', 'numberformatpercent',
					'numberformatincdecimals', 'numberformatdecdecimals', 'break-number', 'togglemergecells', 'breakmergecells',
					'setborderstyle', 'sortascending', 'sortdescending', 'breaksorting', 'backgroundcolor', 'breaksidebar', 'sidebar');
				toolbarUp.remove('styles');
			}

			$('#toolbar-wrapper').addClass('spreadsheet');
			if (window.mode.isTablet()) {
				$(this.map.options.documentContainer).addClass('tablet');
				$('#toolbar-wrapper').addClass('tablet');
			}

			break;
		case 'text':
			if (toolbarUp)
				toolbarUp.show('reset', 'leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
					'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'incrementindent', 'decrementindent',
					'breakindent', 'inserttable', 'insertannotation', 'backcolor', 'breaksidebar', 'sidebar');

			break;
		case 'presentation':
			// Fill the style select box if not yet filled
			if ($('#styles-select')[0] && $('#styles-select')[0].length === 1) {
				data = [''];
				// Inserts a separator element
				data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', disabled: true});

				L.Styles.impressLayout.forEach(function(layout) {
					data = data.concat({id: layout.id, text: _(layout.text)});
				}, this);

				$('#styles-select').select2({
					data: data,
					placeholder: _UNO('.uno:LayoutStatus', 'presentation')
				});
				$('#styles-select').on('select2:select', this.onStyleSelect.bind(this));
			}

			if (toolbarUp) {
				toolbarUp.show('resetimpress', 'breaksidebar', 'modifypage',
					'leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
					'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'inserttextbox', 'inserttable',  'insertannotation', 'backcolor',
					'breaksidebar', 'modifypage', 'slidechangewindow', 'customanimation', 'masterslidespanel', 'navigator');
			}
			break;
		case 'drawing':
			if (toolbarUp) {
				toolbarUp.show('leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
					'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'inserttextbox', 'inserttable', 'backcolor',
					'breaksidebar', 'sidebarmodifypage', 'insertconnectors');
			}
			break;
		}

		window.updateVisibilityForToolbar(w2ui['editbar']);

		if (toolbarUp)
			toolbarUp.refresh();

		this.map.createFontSizeSelector('#fontsizes-select');
	},

	onUpdatePermission: function(e) {
		if (e.perm === 'edit') {
			// Enable list boxes
			$('#styles-select').prop('disabled', false);
			$('#fonts-select').prop('disabled', false);
			$('#fontsizes-select').prop('disabled', false);
		} else {
			// Disable list boxes
			$('#styles-select').prop('disabled', true);
			$('#fonts-select').prop('disabled', true);
			$('#fontsizes-select').prop('disabled', true);
		}
	},

	onWopiProps: function(e) {
		if (e.HideSaveOption) {
			w2ui['editbar'].hide('save');
		}
		if (e.HidePrintOption) {
			w2ui['editbar'].hide('print');
		}

		// On desktop we only have Save and Print buttons before the first
		// splitter/break. Hide the splitter if we hid both save and print.
		// TODO: Apply the same logic to mobile/tablet to avoid beginning with a splitter.
		if (window.mode.isDesktop() && e.HideSaveOption && e.HidePrintOption) {
			w2ui['editbar'].hide('savebreak');
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
				styles = commandValues.ParagraphStyles.slice(7);
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

			$('#styles-select').select2({
				data: data,
				placeholder: _('Style')
			});
			$('#styles-select').val(this.options.stylesSelectValue).trigger('change');
			$('#styles-select').on('select2:select', this.onStyleSelect.bind(this));
		}

		if (w2ui['editbar'])
			w2ui['editbar'].resize();
	},

	processStateChangedCommand: function(commandName, state) {
		var found = false;

		if (commandName === '.uno:StyleApply') {
			if (!state) {
				return;
			}

			// For impress documents, no styles is supported.
			if (this.map.getDocType() === 'presentation') {
				return;
			}

			$('#styles-select option').each(function () {
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
				$('#styles-select')
					.append($('<option></option>')
						.text(state));
			}

			this.options.stylesSelectValue = state;
			$('#styles-select').val(state).trigger('change');
		}
		else if (commandName === '.uno:CharFontName') {
			this.options.fontsSelectValue = state;
		}

		window.processStateChangedCommand(commandName, state);
	},

	onCommandStateChanged: function(e) {
		this.processStateChangedCommand(e.commandName, e.state);
	}
});

L.control.topToolbar = function () {
	return new L.Control.TopToolbar();
};
