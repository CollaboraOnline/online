/*
* Control.Menubar
*/

/* global $ _ _UNO map vex revHistoryEnabled closebutton L */
L.Control.Menubar = L.Control.extend({
	// TODO: Some mechanism to stop the need to copy duplicate menus (eg. Help)
	options: {
		initial: [
			{name: _UNO('.uno:PickList'), disabled: true},
			{name: _UNO('.uno:EditMenu'), disabled: true},
			{name: _UNO('.uno:ViewMenu'), disabled: true},
			{name: _UNO('.uno:InsertMenu'), disabled: true},
			{name: _UNO('.uno:ToolsMenu'), disabled: true}
		],
		text:  [
			{name: _UNO('.uno:PickList', 'text'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'text'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'text'), id: 'saveas', type: 'action'},
				{name: _UNO('.uno:Print', 'text'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
					{name: _('Microsoft Word 2003 (.doc)'), id: 'downloadas-doc', type: 'action'},
					{name: _('Microsoft Word (.docx)'), id: 'downloadas-docx', type: 'action'}]}]
			},
			{name: _UNO('.uno:EditMenu', 'text'), type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'},
				{type: 'separator'},
				{name: _UNO('.uno:ChangesMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:TrackChanges'},
					{uno: '.uno:ShowTrackedChanges'},
					{type: 'separator'},
					{uno: '.uno:AcceptTrackedChanges'},
					{uno: '.uno:AcceptAllTrackedChanges'},
					{uno: '.uno:RejectAllTrackedChanges'},
					{uno: '.uno:PreviousTrackedChange'},
					{uno: '.uno:NextTrackedChange'}
				]},
				{uno: '.uno:EditStyle'}
			]},
			{name: _UNO('.uno:ViewMenu', 'text'), id: 'view', type: 'menu', menu: [
				{name: _UNO('.uno:FullScreen', 'text'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:ZoomPlus', 'text'), id: 'zoomin', type: 'action'},
				{name: _UNO('.uno:ZoomMinus', 'text'), id: 'zoomout', type: 'action'},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:ControlCodes'}
			]
			},
			{name: _UNO('.uno:InsertMenu', 'text'), type: 'menu', menu: [
				{name: _UNO('.uno:InsertGraphic', 'text'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertAnnotation', 'text'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:InsertHeaderFooterMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertPageHeader'},
					{uno: '.uno:InsertPageFooter'}]},
				{uno: '.uno:InsertFootnote'},
				{uno: '.uno:InsertEndnote'},
				{type: 'separator'},
				{uno: '.uno:InsertPagebreak'},
				{uno: '.uno:InsertColumnBreak'},
				{type: 'separator'},
				{uno: '.uno:HyperlinkDialog'},
				{uno: '.uno:InsertSymbol'},
				{name: _UNO('.uno:FormattingMarkMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertNonBreakingSpace'},
					{uno: '.uno:InsertHardHyphen'},
					{uno: '.uno:InsertSoftHyphen'},
					{uno: '.uno:InsertZWSP'},
					{uno: '.uno:InsertZWNBSP'},
					{uno: '.uno:InsertLRM'},
					{uno: '.uno:InsertRLM'}]},
				{uno: '.uno:InsertIndexesEntry'}
			]
			},
			{name: _UNO('.uno:FormatMenu', 'text'), type: 'menu', menu: [
				{name: _UNO('.uno:FormatTextMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:Bold'},
					{uno: '.uno:Italic'},
					{uno: '.uno:Underline'},
					{uno: '.uno:UnderlineDouble'},
					{uno: '.uno:Strikeout'},
					{uno: '.uno:Overline'},
					{type: 'separator'},
					{uno: '.uno:SuperScript'},
					{uno: '.uno:SubScript'},
					{uno: '.uno:SmallCaps'},
					{type: 'separator'},
					{uno: '.uno:Shadowed'},
					{uno: '.uno:OutlineFont'},
					{type: 'separator'},
					{uno: '.uno:Grow'},
					{uno: '.uno:Shrink'},
					{type: 'separator'},
					{uno: '.uno:ChangeCaseToUpper'},
					{uno: '.uno:ChangeCaseToLower'},
					{uno: '.uno:ChangeCaseRotateCase'},
					{type: 'separator'},
					{uno: '.uno:ChangeCaseToSentenceCase'},
					{uno: '.uno:ChangeCaseToTitleCase'},
					{uno: '.uno:ChangeCaseToToggleCase'}]},
				{name: _('Text orientation'), type: 'menu', menu: [
					{uno: '.uno:ParaLeftToRight'},
					{uno: '.uno:ParaRightToLeft'}]},
				{name: _UNO('.uno:FormatSpacingMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:SpacePara1'},
					{uno: '.uno:SpacePara15'},
					{uno: '.uno:SpacePara2'},
					{type: 'separator'},
					{uno: '.uno:ParaspaceIncrease'},
					{uno: '.uno:ParaspaceDecrease'},
					{type: 'separator'},
					{uno: '.uno:IncrementIndent'},
					{uno: '.uno:DecrementIndent'}]},
				{name: _UNO('.uno:TextAlign', 'text'), type: 'menu', menu: [
					{uno: '.uno:CommonAlignLeft'},
					{uno: '.uno:CommonAlignHorizontalCenter'},
					{uno: '.uno:CommonAlignRight'},
					{uno: '.uno:CommonAlignJustified'},
					{type: 'separator'},
					{uno: '.uno:CommonAlignTop'},
					{uno: '.uno:CommonAlignVerticalCenter'},
					{uno: '.uno:CommonAlignBottom'}]},
				{name: _UNO('.uno:FormatBulletsMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:DefaultBullet'},
					{uno: '.uno:DefaultNumbering'},
					{type: 'separator'},
					{uno: '.uno:DecrementLevel'},
					{uno: '.uno:IncrementLevel'},
					{uno: '.uno:DecrementSubLevels'},
					{uno: '.uno:IncrementSubLevels'},
					{type: 'separator'},
					{uno: '.uno:MoveDown'},
					{uno: '.uno:MoveUp'},
					{uno: '.uno:MoveDownSubItems'},
					{uno: '.uno:MoveUpSubItems'},
					{type: 'separator'},
					{uno: '.uno:InsertNeutralParagraph'},
					{uno: '.uno:NumberingStart'},
					{type: 'separator'},
					{uno: '.uno:JumpDownThisLevel'},
					{uno: '.uno:JumpUpThisLevel'},
					{uno: '.uno:ContinueNumbering'}]},
				{type: 'separator'},
				{uno: '.uno:FontDialog'},
				{uno: '.uno:ParagraphDialog'},
				{uno: '.uno:OutlineBullet'},
				{uno: '.uno:PageDialog'},
				{type: 'separator'},
				{uno: '.uno:ResetAttributes'}
			]},
			{name: _UNO('.uno:TableMenu', 'text'), type: 'menu', menu: [
				{name: _UNO('.uno:TableInsertMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{name: _UNO('.uno:TableDeleteMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:DeleteRows'},
					{uno: '.uno:DeleteColumns'},
					{uno: '.uno:DeleteTable'}]},
				{name: _UNO('.uno:TableSelectMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:SelectTable'},
					{uno: '.uno:EntireRow'},
					{uno: '.uno:EntireColumn'},
					{uno: '.uno:EntireCell'}]},
				{uno: '.uno:MergeCells'},
				{type: 'separator'},
				{uno: '.uno:TableDialog'}
			]},
			{name: _UNO('.uno:ToolsMenu', 'text'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellingAndGrammarDialog'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _UNO('.uno:SetLanguageSelectionMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'noneselection', uno: '.uno:LanguageStatus?Language:string=Current_LANGUAGE_NONE'}]},
					{name: _UNO('.uno:SetLanguageParagraphMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'noneparagraph', uno: '.uno:LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE'}]},
					{name: _UNO('.uno:SetLanguageAllTextMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
				]},
				{uno: '.uno:WordCountDialog'}
			]},
			{name: _UNO('.uno:HelpMenu', 'text'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		presentation: [
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'presentation'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: 'action'},
				{name: _UNO('.uno:Print', 'presentation'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
					{name: _('Microsoft Powerpoint 2003 (.ppt)'), id: 'downloadas-ppt', type: 'action'},
					{name: _('Microsoft Powerpoint (.pptx)'), id: 'downloadas-pptx', type: 'action'}]}]
			},
			{name: _UNO('.uno:EditMenu', 'presentation'), type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'}
			]},
			{name: _UNO('.uno:ViewMenu', 'presentation'), id: 'view', type: 'menu', menu: [
				{name: _UNO('.uno:FullScreen', 'presentation'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:ZoomPlus', 'presentation'), id: 'zoomin', type: 'action'},
				{name: _UNO('.uno:ZoomMinus', 'presentation'), id: 'zoomout', type: 'action'},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'}]
			},
			{name: _UNO('.uno:InsertMenu', 'presentation'), type: 'menu', menu: [
				{name: _UNO('.uno:InsertGraphic', 'presentation'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertAnnotation', 'presentation'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:InsertSymbol'}]
			},
			{name: _UNO('.uno:FormatMenu', 'presentation'), type: 'menu', menu: [
				{name: _UNO('.uno:FormatObjectMenu', 'presentation'), type: 'menu', menu: [
					{uno: '.uno:TransformDialog'},
					{uno: '.uno:FormatLine'},
					{uno: '.uno:FormatArea'}
				]}
			]},
			{name: _UNO('.uno:TableMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
				{name: _UNO('.uno:TableInsertMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{name: _UNO('.uno:TableDeleteMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
					{uno: '.uno:DeleteRows'},
					{uno: '.uno:DeleteColumns'}]},
				{uno: '.uno:MergeCells'}]
			},
			{name: _UNO('.uno:SlideMenu', 'presentation'), type: 'menu', menu: [
				{name: _UNO('.uno:InsertSlide', 'presentation'), id: 'insertpage', type: 'action'},
				{name: _UNO('.uno:DuplicateSlide', 'presentation'), id: 'duplicatepage', type: 'action'},
				{name: _UNO('.uno:DeleteSlide', 'presentation'), id: 'deletepage', type: 'action'},
				{type: 'separator', id: 'fullscreen-presentation-separator'},
				{name: _('Fullscreen presentation'), id: 'fullscreen-presentation', type: 'action'}]
			},
			{name: _UNO('.uno:ToolsMenu', 'presentation'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
			]},
			{name: _UNO('.uno:HelpMenu', 'presentation'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		spreadsheet: [
			{name: _UNO('.uno:PickList', 'spreadsheet'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'spreadsheet'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'spreadsheet'), id: 'saveas', type: 'action'},
				{name: _UNO('.uno:Print', 'spreadsheet'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id:'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF spreadsheet (.ods)'), id: 'downloadas-ods', type: 'action'},
					{name: _('Microsoft Excel 2003 (.xls)'), id: 'downloadas-xls', type: 'action'},
					{name: _('Microsoft Excel (.xlsx)'), id: 'downloadas-xlsx', type: 'action'}]}
			]},
			{name: _UNO('.uno:EditMenu', 'spreadsheet'), type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'}
			]},
			{name: _UNO('.uno:ViewMenu', 'spreadsheet'), id: 'view', type: 'menu', menu: [
				{name: _UNO('.uno:FullScreen', 'spreadsheet'), id: 'fullscreen', type: 'action'}
			]},
			{name: _UNO('.uno:InsertMenu', 'spreadsheet'), type: 'menu', menu: [
				{name: _UNO('.uno:InsertGraphic', 'spreadsheet'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertAnnotation', 'spreadsheet'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:InsertSymbol'}
			]},
			{name: _UNO('.uno:FormatMenu', 'spreadsheet'), type: 'menu', menu: [
				{uno: '.uno:ResetAttributes'},
				{uno: '.uno:FormatCellDialog'}
			]},
			{name: _UNO('.uno:SheetMenu', 'spreadsheet'), type: 'menu', menu: [
				{name: _UNO('.uno:InsertRowsMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'}]},
				{name: _UNO('.uno:InsertColumnsMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{name: _UNO('.uno:InsertBreakMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:InsertRowBreak'},
					{uno: '.uno:InsertColumnBreak'}]},
				{type: 'separator'},
				{uno: '.uno:DeleteRows'},
				{uno: '.uno:DeleteColumns'},
				{name: _UNO('.uno:DelBreakMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:DeleteRowbreak'},
					{uno: '.uno:DeleteColumnbreak'}]}
			]},
			{name: _UNO('.uno:DataMenu', 'spreadsheet'), type: 'menu', menu: [
				{uno: '.uno:DataSort'},
				{uno: '.uno:SortAscending'},
				{uno: '.uno:SortDescending'},
				{type: 'separator'},
				{uno: '.uno:DataFilterAutoFilter'},
				{name: _UNO('.uno:FilterMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:DataFilterStandardFilter'},
					{uno: '.uno:DataFilterSpecialFilter'},
					{type: 'separator'},
					{uno: '.uno:DataFilterRemoveFilter'},
					{uno: '.uno:DataFilterHideAutoFilter'}]},
				{type: 'separator'},
				{name: _UNO('.uno:GroupOutlineMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:Group'},
					{uno: '.uno:Ungroup'},
					{type: 'separator'},
					{uno: '.uno:ClearOutline'},
					{type: 'separator'},
					{uno: '.uno:HideDetail'},
					{uno: '.uno:ShowDetail'}]}
			]},
			{name: _UNO('.uno:ToolsMenu', 'spreadsheet'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
			]},
			{name: _UNO('.uno:HelpMenu', 'spreadsheet'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		commandStates: {},

		// Only these menu options will be visible in readonly mode
		allowedReadonlyMenus: ['file', 'downloadas', 'view', 'help'],

		allowedViewModeActions: [
			'downloadas-pdf', 'downloadas-odt', 'downloadas-doc', 'downloadas-docx', // file menu
			'downloadas-odp', 'downloadas-ppt', 'downloadas-pptx', // file menu
			'downloadas-ods', 'downloadas-xls', 'downloadas-xlsx', // file menu
			'fullscreen', 'zoomin', 'zoomout', 'zoomreset', // view menu
			'about', 'keyboard-shortcuts' // help menu
		]
	},

	onAdd: function (map) {
		this._initialized = false;
		this._menubarCont = L.DomUtil.get('main-menu');
		this._initializeMenu(this.options.initial);

		map.on('doclayerinit', this._onDocLayerInit, this);
		map.on('addmenu', this._addMenu, this);
		map.on('commandvalues', this._onInitMenu, this);
	},

	_addMenu: function (e) {
		var alreadyExists = L.DomUtil.get('menu-' + e.id);
		if (alreadyExists)
			return;

		var liItem = L.DomUtil.create('li', '');
		liItem.id = 'menu-' + e.id;
		if (map._permission === 'readonly') {
			L.DomUtil.addClass(liItem, 'readonly');
		}
		var aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(e.label);
		$(aItem).data('id', e.id);
		$(aItem).data('type', 'action');
		$(aItem).data('postmessage', 'true');
		this._menubarCont.insertBefore(liItem, this._menubarCont.firstChild);
	},

	_createLangMenuItem: function (lang, command) {
		var liItem, aItem;
		liItem = L.DomUtil.create('li', '');
		aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(lang);
		$(aItem).data('type', 'unocommand');
		$(aItem).data('uno', '.uno:LanguageStatus?Language:string=' + command);
		return liItem;
	},

	_onInitMenu: function (e) {
		if (e.commandName === '.uno:LanguageStatus' && L.Util.isArray(e.commandValues)) {
			var resetLang = _('Reset to Default Language'), translated, neutral;
			var languages  = [];

			e.commandValues.forEach(function(language) {
				languages.push({translated: _(language), neutral: language});
			});
			languages.sort(function(a, b) {
				return a.translated < b.translated ? -1 : a.translated > b.translated ? 1 : 0;
			});

			var $menuSelection = $('#menu-noneselection').parent();
			var $menuParagraph = $('#menu-noneparagraph').parent();
			var $menuDefault = $('#menu-nonelanguage').parent();
			for (var lang in languages) {
				translated = languages[lang].translated;
				neutral = languages[lang].neutral;
				$menuSelection.append(this._createLangMenuItem(translated, encodeURIComponent('Current_' + neutral)));
				$menuParagraph.append(this._createLangMenuItem(translated, encodeURIComponent('Paragraph_' + neutral)));
				$menuDefault.append(this._createLangMenuItem(translated, encodeURIComponent('Default_' + neutral)));
			}
			$menuSelection.append(this._createMenu([{type: 'separator'}]));
			$menuParagraph.append(this._createMenu([{type: 'separator'}]));
			$menuDefault.append(this._createMenu([{type: 'separator'}]));
			$menuSelection.append(this._createLangMenuItem(resetLang, 'Current_RESET_LANGUAGES'));
			$menuParagraph.append(this._createLangMenuItem(resetLang, 'Paragraph_RESET_LANGUAGES'));
			$menuDefault.append(this._createLangMenuItem(resetLang, 'Default_RESET_LANGUAGES'));
		}
	},

	_onDocLayerInit: function() {
		// clear initial menu
		while (this._menubarCont.hasChildNodes()) {
			this._menubarCont.removeChild(this._menubarCont.firstChild);
		}

		// Add document specific menu
		var docType = this._map.getDocType();
		if (docType === 'text') {
			this._initializeMenu(this.options.text);
		} else if (docType === 'spreadsheet') {
			this._initializeMenu(this.options.spreadsheet);
		} else if (docType === 'presentation' || docType === 'drawing') {
			this._initializeMenu(this.options.presentation);
		}

		// initialize menubar plugin
		$('#main-menu').smartmenus({
			hideOnClick: true,
			showOnClick: true,
			hideTimeout: 0,
			hideDuration: 0,
			showDuration: 0,
			showTimeout: 0,
			collapsibleHideDuration: 0,
			subIndicatorsPos: 'append',
			subIndicatorsText: '&#8250;'
		});
		$('#main-menu').attr('tabindex', 0);

		$('#main-menu').bind('select.smapi', {self: this}, this._onItemSelected);
		$('#main-menu').bind('beforeshow.smapi', {self: this}, this._beforeShow);
		$('#main-menu').bind('click.smapi', {self: this}, this._onClicked);

		// SmartMenus mobile menu toggle button
		$(function() {
			var $mainMenuState = $('#main-menu-state');
			if ($mainMenuState.length) {
				// animate mobile menu
				$mainMenuState.change(function() {
					var $menu = $('#main-menu');
					if (this.checked) {
						$menu.hide().slideDown(250, function() { $menu.css('display', ''); });
					} else {
						$menu.show().slideUp(250, function() { $menu.css('display', ''); });
					}
				});
				// hide mobile menu beforeunload
				$(window).bind('beforeunload unload', function() {
					if ($mainMenuState[0].checked) {
						$mainMenuState[0].click();
					}
				});
			}
		});

		this._initialized = true;
	},

	_onClicked: function(e, menu) {
		if ($(menu).hasClass('highlighted')) {
			$('#main-menu').smartmenus('menuHideAll');
		}

		var $mainMenuState = $('#main-menu-state');
		if (!$(menu).hasClass('has-submenu') && $mainMenuState[0].checked) {
			$mainMenuState[0].click();
		}
	},

	_beforeShow: function(e, menu) {
		var self = e.data.self;
		var items = $(menu).children().children('a').not('.has-submenu');
		$(items).each(function() {
			var aItem = this;
			var type = $(aItem).data('type');
			var id = $(aItem).data('id');
			if (map._permission === 'edit') {
				if (type === 'unocommand') { // enable all depending on stored commandStates
					var unoCommand = $(aItem).data('uno');
					var itemState = map['stateChangeHandler'].getItemValue(unoCommand);
					if (itemState === 'disabled') {
						$(aItem).addClass('disabled');
					} else {
						$(aItem).removeClass('disabled');
					}
					if (unoCommand.indexOf('.uno:LanguageStatus?Language:string=Current_') !== -1) {
						var lang = map['stateChangeHandler'].getItemValue('.uno:LanguageStatus');
						var data = decodeURIComponent($(aItem).data('uno'));
						if (data.indexOf(lang) !== -1) {
							$(aItem).addClass('lo-menu-item-checked');
						} else if (data.indexOf('LANGUAGE_NONE') !== -1 && lang === '[None]') {
							$(aItem).addClass('lo-menu-item-checked');
						} else {
							$(aItem).removeClass('lo-menu-item-checked');
						}
					}
					else if (itemState === 'true') {
						$(aItem).addClass('lo-menu-item-checked');
					} else {
						$(aItem).removeClass('lo-menu-item-checked');
					}
				} else if (type === 'action') { // enable all except fullscreen on windows
					if (id === 'fullscreen' && (L.Browser.ie || L.Browser.edge)) { // Full screen works weirdly on IE 11 and on Edge
						$(aItem).addClass('disabled');
						var index = self.options.allowedViewModeActions.indexOf('fullscreen');
						if (index > 0) {
							self.options.allowedViewModeActions.splice(index, 1);
						}
					} else {
						$(aItem).removeClass('disabled');
					}
				}
			} else { // eslint-disable-next-line no-lonely-if
				if (type === 'unocommand') { // disable all uno commands
					$(aItem).addClass('disabled');
				} else if (type === 'action') { // disable all except allowedViewModeActions
					var found = false;
					for (var i in self.options.allowedViewModeActions) {
						if (self.options.allowedViewModeActions[i] === id) {
							found = true;
							break;
						}
					}
					if (!found) {
						$(aItem).addClass('disabled');
					} else {
						$(aItem).removeClass('disabled');
					}
				}
			}
		});
	},

	_executeAction: function(item) {
		var id = $(item).data('id');
		if (id === 'save') {
			map.save(true, true);
		} else if (id === 'saveas') {
			map.fire('postMessage', {msgId: 'UI_SaveAs'});
		} else if (id === 'print') {
			map.print();
		} else if (id.startsWith('downloadas-')) {
			var format = id.substring('downloadas-'.length);
			var fileName = map['wopi'].BaseFileName;
			fileName = fileName.substr(0, fileName.lastIndexOf('.'));
			fileName = fileName === '' ? 'document' : fileName;
			map.downloadAs(fileName + '.' + format, format);
		} else if (id === 'insertcomment') {
			map.insertComment();
		} else if (id === 'insertgraphic') {
			L.DomUtil.get('insertgraphic').click();
		} else if (id === 'zoomin' && map.getZoom() < map.getMaxZoom()) {
			map.zoomIn(1);
		} else if (id === 'zoomout' && map.getZoom() > map.getMinZoom()) {
			map.zoomOut(1);
		} else if (id === 'zoomreset') {
			map.setZoom(map.options.zoom);
		} else if (id === 'fullscreen') {
			if (!document.fullscreenElement &&
				!document.mozFullscreenElement &&
				!document.msFullscreenElement &&
				!document.webkitFullscreenElement) {
				if (document.documentElement.requestFullscreen) {
					document.documentElement.requestFullscreen();
				} else if (document.documentElement.msRequestFullscreen) {
					document.documentElement.msRequestFullscreen();
				} else if (document.documentElement.mozRequestFullScreen) {
					document.documentElement.mozRequestFullScreen();
				} else if (document.documentElement.webkitRequestFullscreen) {
					document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
				}
			} else if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		} else if (id === 'fullscreen-presentation' && map.getDocType() === 'presentation') {
			map.fire('fullscreen');
		} else if (id === 'insertpage') {
			map.insertPage();
		} else if (id === 'duplicatepage') {
			map.duplicatePage();
		} else if (id === 'deletepage') {
			vex.dialog.confirm({
				message: _('Are you sure you want to delete this slide?'),
				callback: this._onDeleteSlide
			}, this);
		} else if (id === 'about') {
			map.showLOAboutDialog();
		} else if (id === 'keyboard-shortcuts') {
			map.showLOKeyboardHelp();
		} else if (id === 'rev-history') {
			// if we are being loaded inside an iframe, ask
			// our host to show revision history mode
			map.fire('postMessage', {msgId: 'rev-history', args: {Deprecated: true}});
			map.fire('postMessage', {msgId: 'UI_FileVersions'});
		} else if (id === 'closedocument') {
			map.fire('postMessage', {msgId: 'close', args: {EverModified: map._everModified, Deprecated: true}});
			map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: map._everModified}});
			map.remove();
		} else if (id === 'repair') {
			map._socket.sendMessage('commandvalues command=.uno:DocumentRepair');
		}
		// Inform the host if asked
		if ($(item).data('postmessage') === 'true') {
			map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: id} });
		}
	},

	_sendCommand: function (item) {
		var unoCommand = $(item).data('uno');
		if (unoCommand == '.uno:InsertPageHeader' || unoCommand == '.uno:InsertPageFooter') {
			if (map['stateChangeHandler'].getItemValue(unoCommand) === 'true') {
				vex.dialog.confirm({
					message: (unoCommand.endsWith('Header') ? _('Are you sure you want to delete the header?') :
						_('Are you sure you want to delete the footer?')),
					callback: function(value) {
						if (value) {
							map.sendUnoCommand(unoCommand + '?On:bool=false');
						}
					}
				});
			} else {
				map.sendUnoCommand(unoCommand + '?On:bool=true');
			}
		} else {
			map.sendUnoCommand(unoCommand);
		}
	},

	_onDeleteSlide: function(e) {
		if (e) {
			map.deletePage();
		}
	},

	_onItemSelected: function(e, item) {
		var self = e.data.self;
		var type = $(item).data('type');
		if (type === 'unocommand') {
			self._sendCommand(item);
		} else if (type === 'action') {
			self._executeAction(item);
		}

		if ($(item).data('id') !== 'insertcomment')
			map.focus();
	},

	_createMenu: function(menu) {
		var itemList = [];
		var docType = this._map.getDocType();
		for (var i in menu) {
			if (menu[i].id === 'about' && (L.DomUtil.get('about-dialog') === null)) {
				continue;
			}

			if (map._permission === 'readonly' && menu[i].type === 'menu') {
				var found = false;
				for (var j in this.options.allowedReadonlyMenus) {
					if (this.options.allowedReadonlyMenus[j] === menu[i].id) {
						found = true;
						break;
					}
				}
				if (!found)
					continue;
			}

			if (menu[i].type === 'action') {
				if ((menu[i].id === 'rev-history' && !revHistoryEnabled) ||
					(menu[i].id === 'closedocument' && !closebutton)) {
					continue;
				}
			}

			if (menu[i].id === 'print' && this._map['wopi'].HidePrintOption)
				continue;

			if (menu[i].id === 'save' && this._map['wopi'].HideSaveOption)
				continue;

			if (menu[i].id === 'saveas' && this._map['wopi'].UserCanNotWriteRelative)
				continue;

			if (menu[i].id && menu[i].id.startsWith('fullscreen-presentation') && this._map['wopi'].HideExportOption)
				continue;

			// Keep track of all 'downloadas-' options and register them as
			// export formats with docLayer which can then be publicly accessed unlike
			// this Menubar control for which there doesn't seem to be any easy way
			// to get access to.
			if (menu[i].id && menu[i].id.startsWith('downloadas-')) {
				var format = menu[i].id.substring('downloadas-'.length);
				this._map._docLayer.registerExportFormat(menu[i].name, format);

				if (this._map['wopi'].HideExportOption)
					continue;
			}

			var liItem = L.DomUtil.create('li', '');
			if (menu[i].id) {
				liItem.id = 'menu-' + menu[i].id;
				if (menu[i].id === 'closedocument' && map._permission === 'readonly') {
					// see corresponding css rule for readonly class usage
					L.DomUtil.addClass(liItem, 'readonly');
				}
			}
			var aItem = L.DomUtil.create('a', menu[i].disabled ? 'disabled' : '', liItem);
			if (menu[i].name !== undefined) {
				aItem.innerHTML = menu[i].name;
			} else if (menu[i].uno !== undefined) {
				aItem.innerHTML = _UNO(menu[i].uno, docType);
			} else {
				aItem.innerHTML = '';
			}

			if (menu[i].type === 'menu') {
				var ulItem = L.DomUtil.create('ul', '', liItem);
				var subitemList = this._createMenu(menu[i].menu);
				if (!subitemList.length) {
					continue;
				}
				for (var idx in subitemList) {
					ulItem.appendChild(subitemList[idx]);
				}
			} else if (menu[i].type === 'unocommand' || menu[i].uno !== undefined) {
				$(aItem).data('type', 'unocommand');
				$(aItem).data('uno', menu[i].uno);
			} else if (menu[i].type === 'separator') {
				$(aItem).addClass('separator');
			} else if (menu[i].type === 'action') {
				$(aItem).data('type', 'action');
				$(aItem).data('id', menu[i].id);
			}

			itemList.push(liItem);
		}

		return itemList;
	},

	_initializeMenu: function(menu) {
		var menuHtml = this._createMenu(menu);
		for (var i in menuHtml) {
			this._menubarCont.appendChild(menuHtml[i]);
		}
	}
});

L.control.menubar = function (options) {
	return new L.Control.Menubar(options);
};
