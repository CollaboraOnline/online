/*
* Control.Menubar
*/

/* global $ _ map title vex revHistoryEnabled closebutton */
L.Control.Menubar = L.Control.extend({
	// TODO: Some mechanism to stop the need to copy duplicate menus (eg. Help)
	options: {
		text:  [
			{name: _('File'), id: 'file', type: 'menu', menu: [
				{name: _('Save'), id: 'save', type: 'unocommand', uno: '.uno:Save'},
				{name: _('Print'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
					{name: _('Microsoft Word 2003 (.doc)'), id: 'downloadas-doc', type: 'action'},
					{name: _('Microsoft Word (.docx)'), id: 'downloadas-docx', type: 'action'}]}]
			},
			{name: _('Edit'), type: 'menu', menu: [
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{name: _('Undo'), type: 'unocommand', uno: '.uno:Undo'},
				{name: _('Redo'), type: 'unocommand', uno: '.uno:Redo'},
				{type: 'separator'},
				{name: _('Cut'), type: 'unocommand', uno: '.uno:Cut'},
				{name: _('Copy'), type: 'unocommand', uno: '.uno:Copy'},
				{name: _('Paste'), type: 'unocommand', uno: '.uno:Paste'},
				{type: 'separator'},
				{name: _('Select all'), type: 'unocommand', uno: '.uno:SelectAll'},
				{type: 'separator'},
				{name: _('Track Changes'), type: 'menu', menu: [
					{name: _('Record'), type: 'unocommand', uno: '.uno:TrackChanges'},
					{name: _('Show'), type: 'unocommand', uno: '.uno:ShowTrackedChanges'},
					{type: 'separator'},
					{name: _('Previous'), type: 'unocommand', uno: '.uno:PreviousTrackedChange'},
					{name: _('Next'), type: 'unocommand', uno: '.uno:NextTrackedChange'}
				]}
			]},
			{name: _('View'), id: 'view', type: 'menu', menu: [
				{name: _('Full screen'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _('Zoom in'), id: 'zoomin', type: 'action'},
				{name: _('Zoom out'), id: 'zoomout', type: 'action'},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				{type: 'separator'},
				{name: _('Formatting Marks'), type: 'unocommand', uno: '.uno:ControlCodes'},
			]
			},
			{name: _('Insert'), type: 'menu', menu: [
				{name: _('Image'), id: 'insertgraphic', type: 'action'},
				{name: _('Comment...'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _('Footnote'), type: 'unocommand', uno: '.uno:InsertFootnote'},
				{name: _('Endnote'), type: 'unocommand', uno: '.uno:InsertEndnote'},
				{type: 'separator'},
				{name: _('Page break'), type: 'unocommand', uno: '.uno:InsertPageBreak'},
				{name: _('Column break'), type: 'unocommand', uno: '.uno:InsertColumnBreak'},
				{type: 'separator'},
				{name: _('Special character...'), id: 'specialcharacter', type: 'action'},
				{name: _('Formatting mark'), type: 'menu', menu: [
					{name: _('Non-breaking space'), type: 'unocommand', uno: '.uno:InsertNonBreakingSpace'},
					{name: _('Non-breaking hyphen'), type: 'unocommand', uno: '.uno:InsertHardHyphen'},
					{name: _('Soft hyphen'), type: 'unocommand', uno: '.uno:InsertSoftHyphen'},
					{name: _('No-width optional break'), type: 'unocommand', uno: '.uno:InsertZWSP'},
					{name: _('No-width no break'), type: 'unocommand', uno: '.uno:InsertZWNBSP'},
					{name: _('Left-to-right mark'), type: 'unocommand', uno: '.uno:InsertLRM'},
					{name: _('Right-to-left mark'), type: 'unocommand', uno: '.uno:InsertRLM'}]}]
			},
			{name: _('Format'), type: 'menu', menu: [
				{name: _('Text'), type: 'menu', menu: [
					{name: _('Bold'), type: 'unocommand', uno: '.uno:Bold'},
					{name: _('Italic'), type: 'unocommand', uno: '.uno:Italic'},
					{name: _('Underline'), type: 'unocommand', uno: '.uno:Underline'},
					{name: _('Double underline'), type: 'unocommand', uno: '.uno:UnderlineDouble'},
					{name: _('Strikethrough'), type: 'unocommand', uno: '.uno:Strikeout'},
					{name: _('Overline'), type: 'unocommand', uno: '.uno:Overline'},
					{type: 'separator'},
					{name: _('Superscript'), type: 'unocommand', uno: '.uno:SuperScript'},
					{name: _('Subscript'), type: 'unocommand', uno: '.uno:SubScript'},
					{name: _('ꜱᴍᴀʟʟ ᴄᴀᴘꜱ'), type: 'unocommand', uno: '.uno:SmallCaps'},
					{type: 'separator'},
					{name: _('Shadow'), type: 'unocommand', uno: '.uno:Shadowed'},
					{name: _('Outline'), type: 'unocommand', uno: '.uno:OutlineFont'},
					{type: 'separator'},
					{name: _('Increase size'), type: 'unocommand', uno: '.uno:Grow'},
					{name: _('Decrease size'), type: 'unocommand', uno: '.uno:Shrink'},
					{type: 'separator'},
					{name: _('UPPERCASE'), type: 'unocommand', uno: '.uno:ChangeCaseToUpper'},
					{name: _('lowercase'), type: 'unocommand', uno: '.uno:ChangeCaseToLower'},
					{name: _('Cycle case'), type: 'unocommand', uno: '.uno:ChangeCaseRotateCase'},
					{type: 'separator'},
					{name: _('Sentence case'), type: 'unocommand', uno: '.uno:ChangeCaseToSentenceCase'},
					{name: _('Capitalize Every Word'), type: 'unocommand', uno: '.uno:ChangeCaseToTitleCase'},
					{name: _('tOGGLE cASE'), type: 'unocommand', uno: '.uno:ChangeCaseToToggleCase'}]},
				{name: _('Text orientation'), type: 'menu', menu: [
					{name: _('Set paragraph left-to-right'), type: 'unocommand', uno: '.uno:ParaLeftToRight'},
					{name: _('Set paragraph right-to-left'), type: 'unocommand', uno: '.uno:ParaRightToLeft'}]},
				{name: _('Spacing'), type: 'menu', menu: [
					{name: _('Line spacing: 1'), type: 'unocommand', uno: '.uno:SpacePara1'},
					{name: _('Line spacing: 1.5'), type: 'unocommand', uno: '.uno:SpacePara15'},
					{name: _('Line spacing: 2'), type: 'unocommand', uno: '.uno:SpacePara2'},
					{type: 'separator'},
					{name: _('Increase paragraph spacing'), type: 'unocommand', uno: '.uno:ParaspaceIncrease'},
					{name: _('Decrease paragraph spacing'), type: 'unocommand', uno: '.uno:ParaspaceDecrease'},
					{type: 'separator'},
					{name: _('Increase indent'), type: 'unocommand', uno: '.uno:IncrementIndent'},
					{name: _('Decrease indent'), type: 'unocommand', uno: '.uno:DecrementIndent'}]},
				{name: _('Align'), type: 'menu', menu: [
					{name: _('Left'), type: 'unocommand', uno: '.uno:CommonAlignLeft'},
					{name: _('Centered'), type: 'unocommand', uno: '.uno:CommonAlignHorizontalCenter'},
					{name: _('Right'), type: 'unocommand', uno: '.uno:CommonAlignRight'},
					{name: _('Justified'), type: 'unocommand', uno: '.uno:CommonAlignJustified'},
					{type: 'separator'},
					{name: _('Top'), type: 'unocommand', uno: '.uno:CommonAlignTop'},
					{name: _('Center'), type: 'unocommand', uno: '.uno:CommonAlignVerticalcenter'},
					{name: _('Bottom'), type: 'unocommand', uno: '.uno:CommonAlignBottom'}]},
				{name: _('Lists'), type: 'menu', menu: [
					{name: _('Bullets on/off'), type: 'unocommand', uno: '.uno:DefaultBullet'},
					{name: _('Numbering on/off'), type: 'unocommand', uno: '.uno:DefaultNumbering'},
					{type: 'separator'},
					{name: _('Demote one level'), type: 'unocommand', uno: '.uno:DecrementLevel'},
					{name: _('Promote one level'), type: 'unocommand', uno: '.uno:IncrementLevel'},
					{name: _('Demote one level with subpoints'), type: 'unocommand', uno: '.uno:DecrementSublevels'},
					{name: _('Promote one level with subpoints'), type: 'unocommand', uno: '.uno:IncrementSubLevels'},
					{type: 'separator'},
					{name: _('Move down'), type: 'unocommand', uno: '.uno:MoveDown'},
					{name: _('Move up'), type: 'unocommand', uno: '.uno:MoveUp'},
					{name: _('Move down with subpoints'), type: 'unocommand', uno: '.uno:MoveDownSubItems'},
					{name: _('Move up with subpoints'), type: 'unocommand', uno: '.uno:MoveUpSubItems'},
					{type: 'separator'},
					{name: _('Insert unnumbered entry'), type: 'unocommand', uno: '.uno:InsertNeutralParagraph'},
					{name: _('Restart numbering'), type: 'unocommand', uno: '.uno:NumberingStart'},
					{type: 'separator'},
					{name: _('To next paragraph in level'), type: 'unocommand', uno: '.uno:JumpDownThisLevel'},
					{name: _('To previous paragraph in level'), type: 'unocommand', uno: '.uno:JumpUpThisLevel'},
					{name: _('Continue previous numbering'), type: 'unocommand', uno: '.uno:ContinueNumbering'}]},
				{name: _('Clear direct formatting'), type: 'unocommand', uno: '.uno:ResetAttributes'},
				{name: _('Page'), type: 'menu', menu: [
					{name: 'A4, ' + _('Portrait'), type: 'action', id: 'a4portrait'},
					{name: 'A4, ' + _('Landscape'), type: 'action', id: 'a4landscape'},
					{name: 'A5, ' + _('Portrait'), type: 'action', id: 'a5portrait'},
					{name: 'A5, ' + _('Landscape'), type: 'action', id: 'a5landscape'},
					{name: 'Letter, ' + _('Portrait'), type: 'action', id: 'letterportrait'},
					{name: 'Letter, ' + _('Landscape'), type: 'action', id: 'letterlandscape'},
					{name: 'Legal, ' + _('Portrait'), type: 'action', id: 'legalportrait'},
					{name: 'Legal, ' + _('Landscape'), type: 'action', id: 'legallandscape'}]}]
			},
			{name: _('Tables'), type: 'menu', menu: [
				{name: _('Insert'), type: 'menu', menu: [
					{name: _('Rows before'), type: 'unocommand', uno: '.uno:InsertRowsBefore'},
					{name: _('Rows after'), type: 'unocommand', uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{name: _('Columns left'), type: 'unocommand', uno: '.uno:InsertColumnsBefore'},
					{name: _('Columns right'), type: 'unocommand', uno: '.uno:InsertColumnsAfter'}]},
				{name: _('Delete'), type: 'menu', menu: [
					{name: _('Rows'), type: 'unocommand', uno: '.uno:DeleteRows'},
					{name: _('Columns'), type: 'unocommand', uno: '.uno:DeleteColumns'},
					{name: _('Table'), type: 'unocommand', uno: '.uno:DeleteTable'}]},
				{name: _('Select'), type: 'menu', menu: [
					{name: _('Table'), type: 'unocommand', uno: '.uno:SelectTable'},
					{name: _('Row'), type: 'unocommand', uno: '.uno:EntireRow'},
					{name: _('Column'), type: 'unocommand', uno: '.uno:EntireColumn'},
					{name: _('Cell'), type: 'unocommand', uno: '.uno:EntireCell'}]},
					{name: _('Merge cells'), type: 'unocommand', uno: '.uno:MergeCells'}]
			},
			{name: _('Help'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		presentation: [
			{name: _('File'), id: 'file', type: 'menu', menu: [
				{name: _('Save'), id: 'save', type: 'unocommand', uno: '.uno:Save'},
				{name: _('Print'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
					{name: _('Microsoft Powerpoint 2003 (.ppt)'), id: 'downloadas-ppt', type: 'action'},
					{name: _('Microsoft Powerpoint (.pptx)'), id: 'downloadas-pptx', type: 'action'}]}]
			},
			{name: _('Edit'), type: 'menu', menu: [
				{name: _('Undo'), type: 'unocommand', uno: '.uno:Undo'},
				{name: _('Redo'), type: 'unocommand', uno: '.uno:Redo'},
				{type: 'separator'},
				{name: _('Cut'), type: 'unocommand', uno: '.uno:Cut'},
				{name: _('Copy'), type: 'unocommand', uno: '.uno:Copy'},
				{name: _('Paste'), type: 'unocommand', uno: '.uno:Paste'},
				{type: 'separator'},
				{name: _('Select all'), type: 'unocommand', uno: '.uno:SelectAll'}]
			},
			{name: _('View'), id: 'view', type: 'menu', menu: [
				{name: _('Full screen'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _('Zoom in'), id: 'zoomin', type: 'action'},
				{name: _('Zoom out'), id: 'zoomout', type: 'action'},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'}]
			},
			{name: _('Insert'), type: 'menu', menu: [
				{name: _('Image'), id: 'insertgraphic', type: 'action'},
				{name: _('Comment...'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _('Special character...'), id: 'specialcharacter', type: 'action'}]
			},
			{name: _('Tables'), type: 'menu', menu: [
				{name: _('Insert'), type: 'menu', menu: [
					{name: _('Rows before'), type: 'unocommand', uno: '.uno:InsertRowsBefore'},
					{name: _('Rows after'), type: 'unocommand', uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{name: _('Columns left'), type: 'unocommand', uno: '.uno:InsertColumnsBefore'},
					{name: _('Columns right'), type: 'unocommand', uno: '.uno:InsertColumnsAfter'}]},
				{name: _('Delete'), type: 'menu', menu: [
					{name: _('Rows'), type: 'unocommand', uno: '.uno:DeleteRows'},
					{name: _('Columns'), type: 'unocommand', uno: '.uno:DeleteColumns'}]},
				{name: _('Merge cells'), type: 'unocommand', uno: '.uno:MergeCells'}]
			},
			{name: _('Slide'), type: 'menu', menu: [
				{name: _('New slide'), id: 'insertpage', type: 'action'},
				{name: _('Duplicate slide'), id: 'duplicatepage', type: 'action'},
				{name: _('Delete slide'), id: 'deletepage', type: 'action'},
				{type: 'separator'},
				{name: _('Fullscreen presentation'), id: 'fullscreen-presentation', type: 'action'}]
			},
			{name: _('Help'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		spreadsheet: [
			{name: _('File'), id: 'file', type: 'menu', menu: [
				{name: _('Save'), id: 'save', type: 'unocommand', uno: '.uno:Save'},
				{name: _('Print'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id:'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF spreadsheet (.ods)'), id: 'downloadas-ods', type: 'action'},
					{name: _('Microsoft Excel 2003 (.xls)'), id: 'downloadas-xls', type: 'action'},
					{name: _('Microsoft Excel (.xlsx)'), id: 'downloadas-xlsx', type: 'action'}]}]
			},
			{name: _('Edit'), type: 'menu', menu: [
				{name: _('Undo'), type: 'unocommand', uno: '.uno:Undo'},
				{name: _('Redo'), type: 'unocommand', uno: '.uno:Redo'},
				{type: 'separator'},
				{name: _('Cut'), type: 'unocommand', uno: '.uno:Cut'},
				{name: _('Copy'), type: 'unocommand', uno: '.uno:Copy'},
				{name: _('Paste'), type: 'unocommand', uno: '.uno:Paste'},
				{type: 'separator'},
				{name: _('Select all'), type: 'unocommand', uno: '.uno:SelectAll'}]
			},
			{name: _('View'), id: 'view', type: 'menu', menu: [
				{name: _('Full screen'), id: 'fullscreen', type: 'action'}]
			},
			{name: _('Insert'), type: 'menu', menu: [
				{name: _('Image'), id: 'insertgraphic', type: 'action'},
				{name: _('Comment...'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _('Row'), type: 'unocommand', uno: '.uno:InsertRows'},
				{name: _('Column'), type: 'unocommand', uno: '.uno:InsertColumns'},
				{type: 'separator'},
				{name: _('Special character...'), id: 'specialcharacter', type: 'action'}]
			},
			{name: _('Cells'), type: 'menu', menu: [
				{name: _('Insert row'), type: 'unocommand', uno: '.uno:InsertRows'},
				{name: _('Insert column'), type: 'unocommand', uno: '.uno:InsertColumns'},
				{type: 'separator'},
				{name: _('Delete row'), type: 'unocommand', uno: '.uno:DeleteRows'},
				{name: _('Delete column'), type: 'unocommand', uno: '.uno:DeleteColumns'}]
			},
			{name: _('Help'), id: 'help', type: 'menu', menu: [
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

		map.on('doclayerinit', this._onDocLayerInit, this);
		map.on('commandstatechanged', this._onCommandStateChanged, this);
	},

	_onCommandStateChanged: function(e) {
		// Store information about enabled/disabled commands
		// Used later just before showing menu to enable/disable menu items
		if (e.state === 'enabled' || e.state === 'disabled') {
			this.options.commandStates[e.commandName] = e.state;
		}
	},

	_onDocLayerInit: function() {
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
				$mainMenuState.change(function(e) {
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
					if (self.options.commandStates[unoCommand] === 'disabled') {
						$(aItem).addClass('disabled');
					} else {
						$(aItem).removeClass('disabled');
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

	_executeAction: function(id) {
		if (id === 'print') {
			map.print();
		} else if (id.startsWith('downloadas-')) {
			var format = id.substring('downloadas-'.length);
			// remove the extension if any
			var fileName = title.substr(0, title.lastIndexOf('.')) || title;
			// check if it is empty
			fileName = fileName === '' ? 'document' : fileName;
			map.downloadAs(fileName + '.' + format, format);
		} else if (id === 'insertcomment') {
			map.insertComment();
		} else if (id === 'insertgraphic') {
			L.DomUtil.get('insertgraphic').click();
		} else if (id === 'specialcharacter') {
			var fontList = $('.fonts-select option');
			var selectedIndex = $('.fonts-select').prop('selectedIndex');
			map._docLayer._onSpecialChar(fontList, selectedIndex);
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
			map.fire('postMessage', {msgId: 'rev-history'});
		} else if (id === 'closedocument') {
			map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: map._everModified}});
			map.remove();
		}
		else if (id === 'repair') {
			map._socket.sendMessage('commandvalues command=.uno:DocumentRepair');
		} else if (id === 'a4portrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "21000"},"AttributePageSize.Height":{"type":"long", "value": "29700"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'a4landscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "21000"},"AttributePageSize.Width":{"type":"long", "value": "29700"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		} else if (id === 'a5portrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "14800"},"AttributePageSize.Height":{"type":"long", "value": "21000"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'a5landscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "14800"},"AttributePageSize.Width":{"type":"long", "value": "21000"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		} else if (id === 'letterportrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "21950"},"AttributePageSize.Height":{"type":"long", "value": "27940"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'letterlandscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "21950"},"AttributePageSize.Width":{"type":"long", "value": "27940"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		} else if (id === 'legalportrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "21590"},"AttributePageSize.Height":{"type":"long", "value": "35560"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'legallandscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "21590"},"AttributePageSize.Width":{"type":"long", "value": "35560"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
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
			var unoCommand = $(item).data('uno');
			map.sendUnoCommand(unoCommand);
		} else if (type === 'action') {
			var id = $(item).data('id');
			self._executeAction(id);
		}

		if (id !== 'insertcomment')
			map.focus();
	},

	_createMenu: function(menu) {
		var itemList = [];
		for (var i in menu) {
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
			var aItem = L.DomUtil.create('a', '', liItem);
			aItem.innerHTML = menu[i].name;

			if (menu[i].type === 'menu') {
				var ulItem = L.DomUtil.create('ul', '', liItem);
				var subitemList = this._createMenu(menu[i].menu);
				if (!subitemList.length) {
					continue;
				}
				for (var j in subitemList) {
					ulItem.appendChild(subitemList[j]);
				}
			} else if (menu[i].type === 'unocommand') {
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
