/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * JSDialog.TopToolbar - component of top toolbar in compact mode
 */

/* global $ JSDialog _ _UNO app */
class TopToolbar extends JSDialog.Toolbar {
	constructor(map) {
		super(map, 'toolbar-up');
		this.stylesSelectValue = null;

		map.on('doclayerinit', this.onDocLayerInit, this);
		app.events.on('updatepermission', this.onUpdatePermission.bind(this));
		map.on('wopiprops', this.onWopiProps, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);
		app.events.on('contextchange', this.onContextChange.bind(this));

		if (!window.mode.isMobile()) {
			map.on('updatetoolbarcommandvalues', this.updateCommandValues, this);
		}
	}

	onRemove() {
		if (this.parentContainer) {
			this.parentContainer.outerHTML = '';
			this.parentContainer = null;
		}

		this.map.off('doclayerinit', this.onDocLayerInit, this);
		// TODO: app.events.off('updatepermission', this.onUpdatePermission.bind(this));
		this.map.off('wopiprops', this.onWopiProps, this);
		this.map.off('commandstatechanged', this.onCommandStateChanged, this);

		if (!window.mode.isMobile()) {
			this.map.off('updatetoolbarcommandvalues', this.updateCommandValues, this);
		}
	}

	reset() {
		this.parentContainer = L.DomUtil.get('toolbar-up');

		// In case it contains garbage
		if (this.parentContainer) {
			this.parentContainer.outerHTML = '';
			this.parentContainer = null;
		}

		// Use original template as provided by server
		$('#toolbar-logo').after(this.map.toolbarUpTemplate.cloneNode(true));
		this.parentContainer = L.DomUtil.get('toolbar-up');
		L.DomUtil.addClass(this.parentContainer, 'ui-toolbar');
	}

	callback(objectType, eventType, object, data, builder) {
		if (object.id === 'fontnamecombobox' || object.id === 'fontsizecombobox' || object.id === 'styles') {
			// managed by non-JSDialog code
			return;
		}

		this.builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
	}

	onStyleSelect(e) {
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
	}

	onContextChange(event) {
		this.updateVisibilityForToolbar(event.detail.context);
	}

	// mobile:false means hide it both for normal Online used from a mobile phone browser, and in a mobile app on a mobile phone
	// mobilebrowser:false means hide it for normal Online used from a mobile browser, but don't hide it in a mobile app
	// tablet:true means show it in normal Online from a tablet browser, and in a mobile app on a tablet
	// tablet:false means hide it in normal Online used from a tablet browser, and in a mobile app on a tablet

	// hidden means display:none
	// invisible means visibility:hidden

	getToolItems() {
		var items = [
			{type: 'customtoolitem',  id: 'closemobile', desktop: false, mobile: false, tablet: true, visible: false},
			{type: 'customtoolitem',  id: 'save', command: 'save', text: _UNO('.uno:Save'), lockUno: '.uno:Save'},
			{type: 'customtoolitem',  id: 'print', command: 'print', text: _UNO('.uno:Print', 'text'), mobile: false, tablet: false, lockUno: '.uno:Print'},
			{type: 'menubutton',  id: 'printoptions',  command: 'printoptions', noLabel: true, text: _UNO('.uno:Print', 'text'), mobile: false, tablet: false, lockUno: '.uno:Print',
				menu: [
					{id: 'print-active-sheet', action: 'print-active-sheet', text: _('Active Sheet')},
					{id: 'print-all-sheets', action: 'print-all-sheets', text: _('All Sheets')},
				]
			},
			{type: 'separator', orientation: 'vertical', id: 'savebreak', mobile: false},
			{type: 'toolitem',  id: 'undo', text: _UNO('.uno:Undo'), command: '.uno:Undo', mobile: false},
			{type: 'toolitem',  id: 'redo', text: _UNO('.uno:Redo'), command: '.uno:Redo', mobile: false},
			{type: 'separator', orientation: 'vertical', id: 'redobreak', mobile: false, tablet: false,},
			{type: 'toolitem',  id: 'formatpaintbrush', text: _UNO('.uno:FormatPaintbrush'), command: '.uno:FormatPaintbrush', mobile: false},
			{type: 'toolitem',  id: 'reset', text: _UNO('.uno:ResetAttributes', 'text'), visible: false, command: '.uno:ResetAttributes', mobile: false},
			{type: 'toolitem',  id: 'resetimpress', class: 'unoResetAttributes', text: _UNO('.uno:SetDefault', 'presentation', 'true'), visible: false, command: '.uno:SetDefault', mobile: false},
			{type: 'separator', orientation: 'vertical', id: 'breakreset', invisible: true, mobile: false, tablet: false,},
			{type: 'listbox', id: 'styles', text: _('Default Style'), desktop: true, mobile: false, tablet: false},
			{type: 'listbox', id: 'fontnamecombobox', text: 'Carlito', command: '.uno:CharFontName', mobile: false},
			{type: 'listbox', id: 'fontsizecombobox', text: '12 pt', command: '.uno:FontHeight', mobile: false,},
			{type: 'separator', orientation: 'vertical', id: 'breakfontsizes', invisible: true, mobile: false, tablet: false},
			{type: 'toolitem',  id: 'bold', text: _UNO('.uno:Bold'), command: '.uno:Bold'},
			{type: 'toolitem',  id: 'italic', text: _UNO('.uno:Italic'), command: '.uno:Italic'},
			{type: 'toolitem',  id: 'underline', text: _UNO('.uno:Underline'), command: '.uno:Underline'},
			{type: 'toolitem',  id: 'strikeout', text: _UNO('.uno:Strikeout'), command: '.uno:Strikeout'},
			{type: 'separator', orientation: 'vertical', id: 'breakformatting'},
			{type: 'colorlistbox',  id: 'fontcolorwriter:ColorPickerMenu', command: '.uno:FontColor', text: _UNO('.uno:FontColor'), visible: false, lockUno: '.uno:FontColor'},
			{type: 'colorlistbox',  id: 'fontcolor:ColorPickerMenu', command: '.uno:Color', text: _UNO('.uno:FontColor'), lockUno: '.uno:FontColor'},
			{type: 'colorlistbox',  id: 'backcolor:ColorPickerMenu', command: '.uno:CharBackColor', text: _UNO('.uno:CharBackColor', 'text'), visible: false, lockUno: '.uno:CharBackColor'},
			{type: 'colorlistbox',  id: 'backgroundcolor:ColorPickerMenu', command: '.uno:BackgroundColor', text: _UNO('.uno:BackgroundColor'), visible: false, lockUno: '.uno:BackgroundColor'},
			{type: 'separator', orientation: 'vertical' , id: 'breakcolor', mobile:false},
			{type: 'toolitem',  id: 'leftpara',  command: '.uno:LeftPara', text: _UNO('.uno:LeftPara', '', true), visible: false},
			{type: 'toolitem',  id: 'centerpara',  command: '.uno:CenterPara', text: _UNO('.uno:CenterPara', '', true), visible: false},
			{type: 'toolitem',  id: 'rightpara',  command: '.uno:RightPara', text: _UNO('.uno:RightPara', '', true), visible: false},
			{type: 'toolitem',  id: 'justifypara', command: '.uno:JustifyPara', text: _UNO('.uno:JustifyPara', '', true), visible: false, unosheet: ''},
			{type: 'separator', orientation: 'vertical', id: 'breakpara', visible: false},
			{type: 'menubutton',  id: 'setborderstyle:BorderStyleMenu', noLabel: true, command: '.uno:SetBorderStyle', text: _('Borders'), visible: false},
			{type: 'toolitem',  id: 'togglemergecells', text: _UNO('.uno:ToggleMergeCells', 'spreadsheet', true), visible: false, command: '.uno:ToggleMergeCells'},
			{type: 'separator', orientation: 'vertical', id: 'breakmergecells', visible: false},
			{type: 'menubutton', id: 'textalign', command: 'justifypara', noLabel: true, text: _UNO('.uno:TextAlign'), visible: false, lockUno: '.uno:TextAlign',
				menu: [
					{id: 'alignleft', text: _UNO('.uno:AlignLeft', 'spreadsheet', true), icon: 'alignleft', uno: '.uno:AlignLeft'},
					{id: 'alignhorizontalcenter', text: _UNO('.uno:AlignHorizontalCenter', 'spreadsheet', true), icon: 'alignhorizontal', uno: '.uno:AlignHorizontalCenter'},
					{id: 'alignright', text: _UNO('.uno:AlignRight', 'spreadsheet', true), icon: 'alignright', uno: '.uno:AlignRight'},
					{id: 'alignblock', text: _UNO('.uno:AlignBlock', 'spreadsheet', true), icon: 'alignblock', uno: '.uno:AlignBlock'},
					{type: 'separator'},
					{id: 'aligntop', text: _UNO('.uno:AlignTop', 'spreadsheet', true), icon: 'aligntop', uno: '.uno:AlignTop'},
					{id: 'alignvcenter', text: _UNO('.uno:AlignVCenter', 'spreadsheet', true), icon: 'alignvcenter', uno: '.uno:AlignVCenter'},
					{id: 'alignbottom', text: _UNO('.uno:AlignBottom', 'spreadsheet', true), icon: 'alignbottom', uno: '.uno:AlignBottom'},
				]},
			{type: 'menubutton',  id: 'linespacing',  command: 'linespacing', noLabel: true, text: _UNO('.uno:FormatSpacingMenu'), visible: false, lockUno: '.uno:FormatSpacingMenu',
				menu: [
					{id: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: '.uno:SpacePara1'},
					{id: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: '.uno:SpacePara15'},
					{id: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: '.uno:SpacePara2'},
					{type: 'separator'},
					{id: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: '.uno:ParaspaceIncrease'},
					{id: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: '.uno:ParaspaceDecrease'}
				],
			},
			{type: 'toolitem',  id: 'wraptextbutton', text: _UNO('.uno:WrapText', 'spreadsheet', true), visible: false, command: '.uno:WrapText'},
			{type: 'separator', orientation: 'vertical', id: 'breakspacing', visible: false},
			{type: 'toolitem',  id: 'defaultnumbering', text: _UNO('.uno:DefaultNumbering', '', true), visible: false, command: '.uno:DefaultNumbering'},
			{type: 'toolitem',  id: 'defaultbullet', text: _UNO('.uno:DefaultBullet', '', true), visible: false, command: '.uno:DefaultBullet'},
			{type: 'separator', orientation: 'vertical', id: 'breakbullet', visible: false},
			{type: 'toolitem',  id: 'incrementindent', text: _UNO('.uno:IncrementIndent', '', true), command: '.uno:IncrementIndent', visible: false},
			{type: 'toolitem',  id: 'decrementindent', text: _UNO('.uno:DecrementIndent', '', true), command: '.uno:DecrementIndent', visible: false},
			{type: 'separator', orientation: 'vertical', id: 'breakindent', visible: false},
			{type: 'menubutton', id: 'conditionalformatdialog:ConditionalFormatMenu', noLabel: true, text: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet', true), visible: false, lockUno: '.uno:ConditionalFormatMenu'},
			{type: 'toolitem',  id: 'sortascending', text: _UNO('.uno:SortAscending', 'spreadsheet', true), command: '.uno:SortAscending', visible: false},
			{type: 'toolitem',  id: 'sortdescending', text: _UNO('.uno:SortDescending', 'spreadsheet', true), command: '.uno:SortDescending', visible: false},
			{type: 'separator', orientation: 'vertical', id: 'breaksorting', visible: false},
			{type: 'toolitem',  id: 'numberformatcurrency', text: _UNO('.uno:NumberFormatCurrency', 'spreadsheet', true), visible: false, command: '.uno:NumberFormatCurrency'},
			{type: 'toolitem',  id: 'numberformatpercent', text: _UNO('.uno:NumberFormatPercent', 'spreadsheet', true), visible: false, command: '.uno:NumberFormatPercent'},
			{type: 'toolitem',  id: 'numberformatdecdecimals', text: _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet', true), visible: false, command: '.uno:NumberFormatDecDecimals'},
			{type: 'toolitem',  id: 'numberformatincdecimals', text: _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet', true), visible: false, command: '.uno:NumberFormatIncDecimals'},
			{type: 'separator', orientation: 'vertical',   id: 'break-number', visible: false},
			{type: 'menubutton',  id: 'inserttable:InsertTableMenu', command: 'inserttable', noLabel: true, text: _('Insert table'), visible: false, lockUno: '.uno:InsertTable'},
			{type: 'menubutton', id: 'menugraphic:InsertImageMenu', noLabel: true, command: '.uno:InsertGraphic', text: _UNO('.uno:InsertGraphic', '', true), visible: false, lockUno: '.uno:InsertGraphic'},
			{type: 'toolitem',  id: 'insertobjectchart', text: _UNO('.uno:InsertObjectChart', '', true), command: '.uno:InsertObjectChart'},
			{type: 'menubutton',  id: 'insertshapes:InsertShapesMenu', command: '.uno:BasicShapes', noLabel: true, text: _('Insert shapes')},
			{type: 'toolitem',  id: 'insertline', text: _UNO('.uno:Line', '', true), command: '.uno:Line'},
			{type: 'menubutton',  id: 'insertconnectors:InsertConnectorsMenu', command: 'connector', noLabel: true, text: _('Insert connectors'), visible: false},
			{type: 'separator', orientation: 'vertical',   id: 'breakinsert', desktop: true},
			{type: 'customtoolitem',  id: 'inserttextbox', text: _UNO('.uno:Text', '', true), command: 'inserttextbox', visible: false},
			{type: 'customtoolitem',  id: 'insertannotation', text: _UNO('.uno:InsertAnnotation', '', true), visible: false, lockUno: '.uno:InsertAnnotation'},
			{type: 'customtoolitem',  id: 'inserthyperlink',  command: 'inserthyperlink', text: _UNO('.uno:HyperlinkDialog', '', true), lockUno: '.uno:HyperlinkDialog'},
			{type: 'toolitem',  id: 'insertsymbol', text: _UNO('.uno:InsertSymbol', '', true), command: '.uno:InsertSymbol'},
			{type: 'customtoolitem', id: 'menuoverflow', text: _('More'), desktop: true, mobile: false, visible: true},
			{type: 'spacer', id: 'topspacer'},
			{type: 'separator', orientation: 'vertical', id: 'breaksidebar', visible: false},
			{type: 'toolitem',  id: 'sidebar', text: _UNO('.uno:Sidebar', '', true), command: '.uno:SidebarDeck.PropertyDeck', visible: false},
			{type: 'toolitem',  id: 'modifypage', text: _UNO('.uno:ModifyPage', 'presentation', true), command: '.uno:ModifyPage', visible: false},
			{type: 'toolitem',  id: 'slidechangewindow', text: _UNO('.uno:SlideChangeWindow', 'presentation', true), command: '.uno:SlideChangeWindow', visible: false},
			{type: 'toolitem',  id: 'customanimation', text: _UNO('.uno:CustomAnimation', 'presentation', true), command: '.uno:CustomAnimation', visible: false},
			{type: 'toolitem',  id: 'masterslidespanel', text: _UNO('.uno:MasterSlidesPanel', 'presentation', true), command: '.uno:MasterSlidesPanel', visible: false},
			{type: 'toolitem',  id: 'navigator', text: _UNO('.uno:Navigator'), command: '.uno:Navigator', visible: false},
			{type: 'customtoolitem',  id: 'fold', text: _('Hide Menu'), desktop: true, mobile: false, visible: true},
			{type: 'customtoolitem',  id: 'hamburger-tablet', desktop: false, mobile: false, tablet: true, iosapptablet: false, visible: false},
		];

		this.customItems.forEach((customButton) => {
			var found = items.find((item) => {
				return item.id.toLowerCase() === customButton.beforeId.toLowerCase();
			});

			var position = items.indexOf(found);

			customButton.items.forEach((item) => {
				items.splice(position, 0, item);
			});
		});

		return items;
	}

	updateControlsState() {
		if (this.map['stateChangeHandler']) {
			var items = this.map['stateChangeHandler'].getItems();
			if (items) {
				for (var item in items) {
					this.processStateChangedCommand(item, items[item]);
				}
			}
		}
	}

	createOverflowMenu() {
		const topBarMenu = this.parentContainer.querySelector(
			'.root-container .vertical',
		);

		const overflowMenu = L.DomUtil.create(
			'div',
			'menu-overflow-wrapper',
			this.parentContainer,
		);

		const overflowMenuButton =
			this.parentContainer.querySelector('#menuoverflow');

		const showOverflowMenu = () => {
			overflowMenu.style.opacity = 1;
			overflowMenu.style.pointerEvents = 'revert';
			L.DomUtil.addClass(overflowMenuButton, 'selected');
		};
		
		const hideOverflowMenu = () => {
			overflowMenu.style.opacity = 0;
			overflowMenu.style.pointerEvents = 'none';
			L.DomUtil.removeClass(overflowMenuButton, 'selected');
		};

		overflowMenuButton.addEventListener('click', () => {
			if (
				overflowMenu.style.opacity === '0' ||
				overflowMenu.style.opacity === ''
			) {
				showOverflowMenu();
			} else {
				hideOverflowMenu();
			}
		});

		const breakSidebar = this.parentContainer.querySelector('#breaksidebar');
		const foldButton = this.parentContainer.querySelector('#fold');

		const getMenuWidth = () => {
			const splitPosition = 
				foldButton.offsetLeft + 
				foldButton.offsetWidth * 2 - 
				breakSidebar.offsetLeft;
			return window.innerWidth - splitPosition;
		};

		let overflowMenuDebounced = 0;
		const originalTopbar = topBarMenu.querySelectorAll('.jsdialog');

		const overflowMenuHandler = () => {
			overflowMenuDebounced && clearTimeout(overflowMenuDebounced);

			hideOverflowMenu();

			overflowMenuDebounced = setTimeout(() => {
				topBarMenu.replaceChildren(...originalTopbar);

				const topBarButtons = topBarMenu.querySelectorAll('.jsdialog:not(.hidden)');
				const menuWidth = getMenuWidth();

				const overflowMenuOffscreen = document.createElement('div');
				overflowMenuOffscreen.className = 'menu-overfow-vertical';

				let section = [];
				let overflow = false;

				const appendSection = () => {
					for (const element of section) {
						overflowMenuOffscreen.appendChild(element);
					}
					section.length = 0;
				};

				for (const button of topBarButtons) {
					if (button.id === 'topspacer' || button.id === 'menuoverflow') {
						break;
					}

					if (button.offsetLeft > menuWidth || overflow) {
						overflow = true;
						appendSection();
						overflowMenuOffscreen.appendChild(button);
					} else if (button.className.includes('vertical')) {
						section = [button];
					} else {
						section.push(button);
					}
				}

				overflowMenu.replaceChildren(overflowMenuOffscreen);

				if (overflowMenuOffscreen.children.length <= 0) {
					overflowMenuButton.style.display = 'none';
				} else {
					overflowMenuButton.style.display = 'revert';
				}

				overflowMenu.style.left =
					overflowMenuButton.offsetLeft -
					overflowMenu.clientWidth +
					overflowMenuButton.offsetWidth +
					'px';
			}, 250);
		};

		window.addEventListener('resize', overflowMenuHandler);
	}

	create() {
		this.reset();

		var items = this.getToolItems();
		this.builder.build(this.parentContainer, items);

		this.createOverflowMenu();

		if (this.map.isRestrictedUser()) {
			for (var i = 0; i < items.length; i++) {
				var it = items[i];
				var item = $('#' + it.id)[0];
				this.map.hideRestrictedItems(it, item, item);
			}
		}

		if (this.map.isLockedUser()) {
			for (var i = 0; i < items.length; i++) {
				var it = items[i];
				var item = $('#' + it.id)[0];
				this.map.disableLockedItem(it, item, item);
			}
		}

		this.map.createFontSelector('#fontnamecombobox-input');

		// on mode switch NB -> Compact
		if (this.map._docLoadedOnce) this.onDocLayerInit();
	}

	onDocLayerInit() {
		var docType = this.map.getDocType();

		switch (docType) {
		case 'spreadsheet':
			if (this.parentContainer) {
				['reset', 'textalign', 'wraptextbutton', 'breakspacing', 'insertannotation', 'conditionalformatdialog',
					'numberformatcurrency', 'numberformatpercent',
					'numberformatincdecimals', 'numberformatdecdecimals', 'break-number', 'togglemergecells', 'breakmergecells',
					'setborderstyle', 'sortascending', 'sortdescending', 'breaksorting', 'backgroundcolor', 'breaksidebar', 'sidebar', 'printoptions'
				].forEach((id) => {
					this.showItem(id, true);
				});

				this.showItem('print', false);
				this.showItem('styles', false);
			}

			$('#toolbar-wrapper').addClass('spreadsheet');
			if (window.mode.isTablet()) {
				$(this.map.options.documentContainer).addClass('tablet');
				$('#toolbar-wrapper').addClass('tablet');
			}

			break;
		case 'text':
			if (this.parentContainer) {
				['fontcolorwriter', 'reset', 'leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
					'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'incrementindent', 'decrementindent',
					'breakindent', 'inserttable', 'insertannotation', 'backcolor', 'breaksidebar', 'sidebar'
				].forEach((id) => {
					this.showItem(id, true);
				});

				this.showItem('printoptions', false);
				this.showItem('fontcolor', false);
			}
			break;
		case 'presentation':
			// Fill the style select box if not yet filled
			if ($('#styles-input')[0] && $('#styles-input')[0].length === 1) {
				var data = [''];
				// Inserts a separator element
				data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', enabled: false});

				L.Styles.impressLayout.forEach(function(layout) {
					data = data.concat({id: layout.id, text: _(layout.text)});
				}, this);

				$('#styles-input').select2({
					data: data,
					placeholder: _UNO('.uno:LayoutStatus', 'presentation')
				});
				$('#styles-input').on('select2:select', this.onStyleSelect.bind(this));
			}

			if (this.parentContainer) {
				['resetimpress', 'breaksidebar', 'modifypage',
					'leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
					'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'inserttextbox', 'inserttable',  'insertannotation', 'backcolor',
					'breaksidebar', 'modifypage', 'slidechangewindow', 'customanimation', 'masterslidespanel', 'navigator'
				].forEach((id) => {
					this.showItem(id, true);
				});

				this.showItem('printoptions', false);
			}
			break;
		case 'drawing':
			if (this.parentContainer) {
				['leftpara', 'centerpara', 'rightpara', 'justifypara', 'breakpara', 'linespacing',
					'breakspacing', 'defaultbullet', 'defaultnumbering', 'breakbullet', 'inserttextbox', 'inserttable', 'backcolor',
					'breaksidebar', 'sidebar', 'insertconnectors'
				].forEach((id) => {
					this.showItem(id, true);
				});

				this.showItem('printoptions', false);
			}
			break;
		}

		this.updateVisibilityForToolbar();

		this.map.createFontSizeSelector('#fontsizecombobox-input');

		JSDialog.RefreshScrollables();
	}

	onUpdatePermission(e) {
		if (e.detail.perm === 'edit') {
			// Enable list boxes
			$('#styles-input').prop('disabled', false);
			$('#fontnamecombobox-input').prop('disabled', false);
			$('#fontsizecombobox-input').prop('disabled', false);
		} else {
			// Disable list boxes
			$('#styles-input').prop('disabled', true);
			$('#fontnamecombobox-input').prop('disabled', true);
			$('#fontsizecombobox-input').prop('disabled', true);
		}
	}

	onWopiProps(e) {
		if (e.HideSaveOption) {
			this.showItem('save', false);
		}
		if (e.HidePrintOption) {
			this.showItem('print', false);
		}

		// On desktop we only have Save and Print buttons before the first
		// splitter/break. Hide the splitter if we hid both save and print.
		// TODO: Apply the same logic to mobile/tablet to avoid beginning with a splitter.
		if (window.mode.isDesktop() && e.HideSaveOption && e.HidePrintOption) {
			this.showItem('savebreak', false);
		}

		if (this.parentContainer) {
			if (e.EnableInsertRemoteImage || !e.DisableInsertLocalImage) {
				this.showItem('menugraphic', true);
			} else {
				this.showItem('menugraphic', false);
			}
		}
	}

	// TODO: create dedicated widget for styles listbox
	updateCommandValues(e) {
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
				data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', enabled: false});

				topStyles.forEach(function (style) {
					data = data.concat({id: style, text: L.Styles.styleMappings[style].toLocaleString()});
				}, this);
			}

			if (styles !== undefined && styles.length > 0) {
				// Inserts a separator element
				data = data.concat({text: '\u2500\u2500\u2500\u2500\u2500\u2500', enabled: false});

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

			$('#styles-input').select2({
				data: data,
				placeholder: _('Style')
			});
			$('#styles-input').val(this.stylesSelectValue).trigger('change');
			$('#styles-input').on('select2:select', this.onStyleSelect.bind(this));
		}
	}

	processStateChangedCommand(commandName, state) {
		var found = false;

		if (commandName === '.uno:StyleApply') {
			if (!state) {
				return;
			}

			// For impress documents, no styles is supported.
			if (this.map.getDocType() === 'presentation') {
				return;
			}

			$('#styles-input option').each(function () {
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
				$('#styles-input')
					.append($('<option></option>')
						.text(state));
			}

			this.stylesSelectValue = state;
			$('#styles-input').val(state).trigger('change');
		}

		window.processStateChangedCommand(commandName, state);
	}

	onCommandStateChanged(e) {
		this.processStateChangedCommand(e.commandName, e.state);
	}
};

JSDialog.TopToolbar = function (map) {
	return new TopToolbar(map);
};
