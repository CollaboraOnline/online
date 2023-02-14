/* -*- js-indent-level: 8 -*- */
/*
* Control.Menubar
*/

/* global app $ _ _UNO L */
L.Control.MenubarShortcuts = {
	shortcuts: {
		SAVE: 'Ctrl + S',
		UNDO: 'Ctrl + Z',
		REDO: 'Ctrl + Y',
		PRINT: 'Ctrl + P',
		CUT: 'Ctrl + X',
		COPY: 'Ctrl + C',
		PASTE: 'Ctrl + V',
		PASTE_SPECIAL: 'Ctrl + Shift + Alt + V',
		SELECT_ALL: 'Ctrl + A',
		COMMENT: 'Ctrl + Alt + C',
		FOOTNOTE: 'Ctrl + Alt + F',
		ENDNOTE: 'Ctrl + Alt + D',
		BOLD: 'Ctrl + B',
		ITALIC: 'Ctrl + I',
		UNDERLINE: 'Ctrl + U',
		DOUBLE_UNDERLINE: 'Ctrl + D',
		STRIKETHROUGH: 'Ctrl + Alt + 5',
		SUPERSCRIPT: 'Ctrl + Shift + P',
		SUBSCRIPT: 'Ctrl + Shift + B',
		LEFT: 'Ctrl + L',
		CENTERED: 'Ctrl + E',
		RIGHT: 'Ctrl + R',
		JUSTIFIED: 'Ctrl + J',
		KEYBOARD_SHORTCUTS: 'Ctrl + Shift + ?'
	},

	addShortcut: function (text, shortcut) {
		// localize shortcut
		if (String.locale.startsWith('de') || String.locale.startsWith('dsb') || String.locale.startsWith('hsb')) {
			shortcut = shortcut.replace('Ctrl', 'Strg');
		}
		if (String.locale.startsWith('lt')) {
			shortcut = shortcut.replace('Ctrl', 'Vald');
		}
		if (String.locale.startsWith('sl')) {
			shortcut = shortcut.replace('Ctrl', 'Krmilka').replace('Alt', 'izmenjalka').replace('Shift', 'dvigalka');
		}

		var newText = _(text).replace('~', '') + ' (' + L.Util.replaceCtrlAltInMac(shortcut) + ')';

		return newText;
	}
};

L.Control.Menubar = L.Control.extend({
	// TODO: Some mechanism to stop the need to copy duplicate menus (eg. Help, eg: mobiledrawing)
	options: {
		initial: [
			{name: _UNO('.uno:PickList')},
			{name: _UNO('.uno:EditMenu')},
			{name: _UNO('.uno:ViewMenu')},
			{name: _UNO('.uno:InsertMenu')},
			{name: _UNO('.uno:ToolsMenu')}
		],
		text:  [
			{name: _UNO('.uno:PickList', 'text'), id: 'file', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Save', 'text'), L.Control.MenubarShortcuts.shortcuts.SAVE), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'text'), id: 'saveas', type: window.uiDefaults && window.uiDefaults.saveAsMode === 'group' ? 'menu' : 'action', menu: [
					{name: _('ODF text document (.odt)'), id: 'saveas-odt', type: 'action'},
					{name: _('Word 2003 Document (.doc)'), id: 'saveas-doc', type: 'action'},
					{name: _('Word Document (.docx)'), id: 'saveas-docx', type: 'action'},
					{name: _('Rich Text (.rtf)'), id: 'saveas-rtf', type: 'action'},
				]},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'},
					{name: _('EPUB (.epub)'), id: 'exportas-epub', type: 'action'}
				]},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id:'exportpdf', type: 'action'},
					{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
					{name: _('Word 2003 Document (.doc)'), id: 'downloadas-doc', type: 'action'},
					{name: _('Word Document (.docx)'), id: 'downloadas-docx', type: 'action'},
					{name: _('Rich Text (.rtf)'), id: 'downloadas-rtf', type: 'action'},
					{name: _('EPUB (.epub)'), id:'exportepub', type: 'action'}]},
				{name: _('Sign document'), id: 'signdocument', type: 'action'},
				{name: _UNO('.uno:SetDocumentProperties', 'text'), uno: '.uno:SetDocumentProperties', id: 'properties'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Print', 'text'), L.Control.MenubarShortcuts.shortcuts.PRINT), id: 'print', type: 'action'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'text'), id: 'editmenu', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Undo', 'text'), L.Control.MenubarShortcuts.shortcuts.UNDO), uno: '.uno:Undo'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Redo', 'text'), L.Control.MenubarShortcuts.shortcuts.REDO), uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Cut', 'text'), L.Control.MenubarShortcuts.shortcuts.CUT), uno: '.uno:Cut'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Copy', 'text'), L.Control.MenubarShortcuts.shortcuts.COPY), uno: '.uno:Copy'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Paste', 'text'), L.Control.MenubarShortcuts.shortcuts.PASTE), uno: '.uno:Paste'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:PasteSpecial', 'text'), L.Control.MenubarShortcuts.shortcuts.PASTE_SPECIAL), uno: '.uno:PasteSpecial'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SelectAll', 'text'), L.Control.MenubarShortcuts.shortcuts.SELECT_ALL), uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'},
				{type: 'separator'},
				{name: _UNO('.uno:ChangesMenu', 'text'), id: 'changesmenu', type: 'menu', menu: [
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
			{name: _UNO('.uno:ViewMenu', 'text'), id: 'view', type: 'menu',
			 menu: (window.mode.isTablet() ? [
					{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				] : [
					{name: _UNO('.uno:FullScreen', 'text'), id: 'fullscreen', type: 'action'},
					{type: 'separator'},
					{name: _UNO('.uno:ZoomPlus', 'text'), id: 'zoomin', type: 'action'},
					{name: _UNO('.uno:ZoomMinus', 'text'), id: 'zoomout', type: 'action',},
					{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				]).concat([
					{type: 'separator'},
					{name: _('Toggle UI Mode'), id: 'toggleuimode', type: 'action'},
					{name: _('Show Ruler'), id: 'showruler', type: 'action'},
					{name: _('Show Status Bar'), id: 'showstatusbar', type: 'action'},
					{uno: '.uno:Sidebar'},
					{type: 'separator'},
					{name: _UNO('.uno:ShowResolvedAnnotations', 'text'), id: 'showresolved', type: 'action'},
					{uno: '.uno:ControlCodes'},
				])},
			{name: _UNO('.uno:InsertMenu', 'text'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'text'), id: 'insertgraphicremote', type: 'action'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:InsertAnnotation', 'text'), L.Control.MenubarShortcuts.shortcuts.COMMENT), id: 'insertcomment', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{name: _UNO('.uno:FontworkGalleryFloater'), uno: '.uno:FontworkGalleryFloater', id: 'fontworkgalleryfloater'},
				{name: _UNO('.uno:DrawText'), uno: '.uno:DrawText'},
				{name: _UNO('.uno:VerticalText'), uno: '.uno:VerticalText'},
				{type: 'separator'},
				{uno: '.uno:InsertSection', id: 'insertsection'},
				{uno: '.uno:PageNumberWizard', id: 'pagenumberwizard'},
				{name: _UNO('.uno:InsertFieldCtrl', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertPageNumberField'},
					{uno: '.uno:InsertPageCountField'},
					{uno: '.uno:InsertDateField'},
					{uno: '.uno:InsertTimeField'},
					{uno: '.uno:InsertTitleField'},
					{uno: '.uno:InsertAuthorField'},
					{uno: '.uno:InsertTopicField'},
					{type: 'separator'},
					{uno: '.uno:InsertField'},
				]},
				{name: _UNO('.uno:InsertHeaderFooterMenu', 'text'), type: 'menu', menu: [
					{name: _UNO('.uno:InsertPageHeader', 'text'), type: 'menu', menu: [
						{name: _('All'), disabled: true, id: 'insertheader', tag: '_ALL_', uno: '.uno:InsertPageHeader?'}]},
					{name: _UNO('.uno:InsertPageFooter', 'text'), type: 'menu', menu: [
						{name: _('All'), disabled: true, id: 'insertfooter', tag: '_ALL_', uno: '.uno:InsertPageFooter?'}]}
				]},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:InsertFootnote', 'text'), L.Control.MenubarShortcuts.shortcuts.FOOTNOTE), uno: '.uno:InsertFootnote'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:InsertEndnote', 'text'), L.Control.MenubarShortcuts.shortcuts.ENDNOTE), uno: '.uno:InsertEndnote'},
				{type: 'separator'},
				{uno: '.uno:InsertPagebreak'},
				{name: _UNO('.uno:InsertColumnBreak', 'spreadsheet'), uno: '.uno:InsertColumnBreak'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{name: _('Pick Link'), id: 'remotelink', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:InsertSymbol'},
				{name: _UNO('.uno:FormattingMarkMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertNonBreakingSpace'},
					{uno: '.uno:InsertHardHyphen'},
					{uno: '.uno:InsertSoftHyphen'},
					{uno: '.uno:InsertZWSP'},
					{uno: '.uno:InsertWJ'},
					{uno: '.uno:InsertLRM'},
					{uno: '.uno:InsertRLM'}]},
			]},
			{name: _UNO('.uno:FormatMenu', 'text'), id: 'format', type: 'menu', menu: [
				{name: _UNO('.uno:FormatTextMenu', 'text'), type: 'menu', menu: [
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Bold', 'text'), L.Control.MenubarShortcuts.shortcuts.BOLD), uno: '.uno:Bold'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Italic', 'text'), L.Control.MenubarShortcuts.shortcuts.ITALIC), uno: '.uno:Italic'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Underline', 'text'), L.Control.MenubarShortcuts.shortcuts.UNDERLINE), uno: '.uno:Underline'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:UnderlineDouble', 'text'), L.Control.MenubarShortcuts.shortcuts.DOUBLE_UNDERLINE), uno: '.uno:UnderlineDouble'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Strikeout', 'text'), L.Control.MenubarShortcuts.shortcuts.STRIKETHROUGH), uno: '.uno:Strikeout'},
					{uno: '.uno:Overline'},
					{type: 'separator'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SuperScript', 'text'), L.Control.MenubarShortcuts.shortcuts.SUPERSCRIPT), uno: '.uno:SuperScript'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SubScript', 'text'), L.Control.MenubarShortcuts.shortcuts.SUBSCRIPT), uno: '.uno:SubScript'},
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
					{uno: '.uno:ChangeCaseToToggleCase'},
					{type: 'separator'},
					{uno: '.uno:SmallCaps'}]},
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
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:CommonAlignLeft', 'text'), L.Control.MenubarShortcuts.shortcuts.LEFT), uno: '.uno:CommonAlignLeft'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:CommonAlignHorizontalCenter', 'text'), L.Control.MenubarShortcuts.shortcuts.CENTERED), uno: '.uno:CommonAlignHorizontalCenter'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:CommonAlignRight', 'text'), L.Control.MenubarShortcuts.shortcuts.RIGHT), uno: '.uno:CommonAlignRight'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:CommonAlignJustified', 'text'), L.Control.MenubarShortcuts.shortcuts.JUSTIFIED), uno: '.uno:CommonAlignJustified'},
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
					{uno: '.uno:RemoveBullets'},
					{type: 'separator'},
					{uno: '.uno:JumpDownThisLevel'},
					{uno: '.uno:JumpUpThisLevel'},
					{uno: '.uno:ContinueNumbering'}]},
				{type: 'separator'},
				{uno: '.uno:FormatPaintbrush'},
				{uno: '.uno:ResetAttributes'},
				{type: 'separator'},
				{uno: '.uno:FontDialog'},
				{uno: '.uno:ParagraphDialog'},
				{uno: '.uno:OutlineBullet'},
				{type: 'separator'},
				{uno: '.uno:PageDialog'},
				{uno: '.uno:TitlePageDialog'},
				{uno: '.uno:FormatColumns'},
				{uno: '.uno:Watermark'},
				{uno: '.uno:EditRegion'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'}
			]},
			{name: _('References'), id: 'references', type: 'menu', menu: [
				{name: _UNO('.uno:IndexesMenu', 'text'), uno: '.uno:InsertMultiIndex'},
				{uno: '.uno:InsertIndexesEntry'},
				{name: _('Update Index'), uno: '.uno:UpdateCurIndex'},
				{type: 'separator'},
				{uno: '.uno:InsertFootnote'},
				{uno: '.uno:InsertEndnote'},
				{uno: '.uno:FootnoteDialog'},
				{type: 'separator'},
				{uno: '.uno:InsertBookmark'},
				{uno: '.uno:InsertReferenceField'},
				{id: 'zoteroseparator', type: 'separator', hidden: !window.zoteroEnabled},
				{name: _('Add Citation'), id: 'zoteroaddeditcitation', type: 'action', hidden: !window.zoteroEnabled},
				{name: _('Add Citation Note'), id: 'zoteroaddnote', type: 'action', hidden: !window.zoteroEnabled},
				{name: _('Add Bibliography'), id: 'zoteroaddeditbibliography', type: 'action', hidden: !window.zoteroEnabled},
				{is: 'zoteroseparator2', type: 'separator', hidden: !window.zoteroEnabled},
				{name: _('Refresh Citations'), id: 'zoterorefresh', type: 'action', hidden: !window.zoteroEnabled},
				{name: _('Unlink Citations'), id: 'zoterounlink', type: 'action', hidden: !window.zoteroEnabled},
				{name: _('Citation Preferences'), id: 'zoterosetdocprefs', type: 'action', iosapp: false, hidden: !window.zoteroEnabled}]
			},
			{name: _UNO('.uno:TableMenu', 'text'), type: 'menu', id: 'table', menu: [
				{uno: '.uno:InsertTable'},
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
				{uno: '.uno:SplitCell'},
				{uno: '.uno:MergeCells'},
				{type: 'separator'},
				{uno: '.uno:Protect'},
				{uno: '.uno:UnsetCellsReadOnly'},
				{type: 'separator'},
				{uno: '.uno:TableDialog'}
			]},
			{name: _UNO('.uno:FormatFormMenu', 'text'), id: 'form', type: 'menu', menu: [
				{name: _('Insert Rich Text'), uno: '.uno:InsertContentControl'},
				{name: _('Insert Checkbox'), uno: '.uno:InsertCheckboxContentControl'},
				{name: _('Insert Dropdown'), uno: '.uno:InsertDropdownContentControl'},
				{name: _('Insert Picture'), uno: '.uno:InsertPictureContentControl'},
				{name: _('Insert Date'), uno: '.uno:InsertDateContentControl'},
				{name: _('Properties'), uno: '.uno:ContentControlProperties'},
			]},
			{name: _UNO('.uno:ToolsMenu', 'text'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellingAndGrammarDialog'},
				{uno: '.uno:SpellOnline'},
				window.deeplEnabled ?
					{
						uno: '.uno:Translate'
					}: {},
				{uno: '.uno:ThesaurusDialog'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _UNO('.uno:SetLanguageSelectionMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'noneselection', uno: '.uno:LanguageStatus?Language:string=Current_LANGUAGE_NONE'} ]},
					{name: _UNO('.uno:SetLanguageParagraphMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'noneparagraph', uno: '.uno:LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE'} ]},
					{name: _UNO('.uno:SetLanguageAllTextMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
				]},
				{uno: '.uno:WordCountDialog'},
				{uno: '.uno:AccessibilityCheck'},
				{type: 'separator'},
				{name: _UNO('.uno:AutoFormatMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:OnlineAutoFormat'}]},
				{type: 'separator'},
				{uno: '.uno:ChapterNumberingDialog'},
				{uno: '.uno:LineNumberingDialog'},
				{uno: '.uno:FootnoteDialog'},
				{type: 'separator'},
				{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'}
			]},
			{name: _UNO('.uno:HelpMenu', 'text'), id: 'help', type: 'menu', menu: [
				{name: _('Forum'), id: 'forum', type: 'action'},
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: L.Control.MenubarShortcuts.addShortcut(_('Keyboard shortcuts'), L.Control.MenubarShortcuts.shortcuts.KEYBOARD_SHORTCUTS), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
				{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		presentation: [
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Save', 'presentation'), L.Control.MenubarShortcuts.shortcuts.SAVE), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: window.uiDefaults && window.uiDefaults.saveAsMode === 'group' ? 'menu' : 'action', menu: [
					{name: _('ODF presentation (.odp)'), id: 'saveas-odp', type: 'action'},
					{name: _('PowerPoint 2003 Presentation (.ppt)'), id: 'saveas-ppt', type: 'action'},
					{name: _('PowerPoint Presentation (.pptx)'), id: 'saveas-pptx', type: 'action'},
				]},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'}
				]},
				{name: _('Save Comments'), id: 'savecomments', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
					{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
					{name: _('PowerPoint 2003 Presentation (.ppt)'), id: 'downloadas-ppt', type: 'action'},
					{name: _('PowerPoint Presentation (.pptx)'), id: 'downloadas-pptx', type: 'action'},
				]},
				{name: _UNO('.uno:SetDocumentProperties', 'presentation'), uno: '.uno:SetDocumentProperties', id: 'properties'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Print', 'presentation'), L.Control.MenubarShortcuts.shortcuts.PRINT), id: 'print', type: 'action'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'presentation'), id: 'editmenu', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Undo', 'presentation'), L.Control.MenubarShortcuts.shortcuts.UNDO), uno: '.uno:Undo'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Redo', 'presentation'), L.Control.MenubarShortcuts.shortcuts.REDO), uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Cut', 'presentation'), L.Control.MenubarShortcuts.shortcuts.CUT), uno: '.uno:Cut'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Copy', 'presentation'), L.Control.MenubarShortcuts.shortcuts.COPY), uno: '.uno:Copy'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Paste', 'presentation'), L.Control.MenubarShortcuts.shortcuts.PASTE), uno: '.uno:Paste'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:PasteSpecial', 'presentation'), L.Control.MenubarShortcuts.shortcuts.PASTE_SPECIAL), uno: '.uno:PasteSpecial'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SelectAll', 'presentation'), L.Control.MenubarShortcuts.shortcuts.SELECT_ALL), uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'}
			]},
			{name: _UNO('.uno:ViewMenu', 'presentation'), id: 'view', type: 'menu',
			 menu: (window.mode.isTablet() ? [
					{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				] : [
				   {name: _UNO('.uno:FullScreen', 'presentation'), id: 'fullscreen', type: 'action'},
				   {type: 'separator'},
				   {name: _UNO('.uno:ZoomPlus', 'presentation'), id: 'zoomin', type: 'action'},
				   {name: _UNO('.uno:ZoomMinus', 'presentation'), id: 'zoomout', type: 'action'},
				   {name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				]).concat([
				   {type: 'separator'},
				   {name: _('Toggle UI Mode'), id: 'toggleuimode', type: 'action'},
				   {name: _('Show Ruler'), id: 'showruler', type: 'action'},
				   {name: _('Show Status Bar'), id: 'showstatusbar', type: 'action'},
				   {uno: '.uno:Sidebar'},
				   {type: 'separator'},
				   {uno: '.uno:SlideMasterPage'},
				   {uno: '.uno:ModifyPage'},
				   {uno: '.uno:SlideChangeWindow'},
				   {uno: '.uno:CustomAnimation'},
				   {uno: '.uno:MasterSlidesPanel'},
				])},
			{name: _UNO('.uno:InsertMenu', 'presentation'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'presentation'), id: 'insertgraphicremote', type: 'action'},
				{name: _UNO('.uno:SelectBackground', 'presentation'), id: 'selectbackground', type: 'action'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:InsertAnnotation', 'presentation'), L.Control.MenubarShortcuts.shortcuts.COMMENT), id: 'insertcomment', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{name: _UNO('.uno:FontworkGalleryFloater'), uno: '.uno:FontworkGalleryFloater', id: 'fontworkgalleryfloater'},
				{name: _UNO('.uno:DrawText'), uno: '.uno:DrawText'},
				{name: _UNO('.uno:VerticalText'), uno: '.uno:VerticalText'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{name: _('Pick Link'), id: 'remotelink', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:InsertSymbol'},
				{type: 'separator'},
				{uno: '.uno:HeaderAndFooter'},
				{type: 'separator'},
				{name: _UNO('.uno:InsertField', 'text'), id: 'insertfield', type: 'menu', menu: [
					{uno: '.uno:InsertDateFieldFix'},
					{uno: '.uno:InsertDateFieldVar'},
					{uno: '.uno:InsertTimeFieldFix'},
					{uno: '.uno:InsertTimeFieldVar'},
					{type: 'separator'},
					{name: _UNO('.uno:InsertSlideField', 'presentation'), uno: '.uno:InsertPageField'},
					{name: _UNO('.uno:InsertSlideTitleField', 'presentation'), uno: '.uno:InsertPageTitleField'},
					{name: _UNO('.uno:InsertSlidesField', 'presentation'), uno: '.uno:InsertPagesField'},
				]},
			]},
			{name: _UNO('.uno:FormatMenu', 'presentation'), id: 'format', type: 'menu', menu: [
				{uno: '.uno:FontDialog'},
				{uno: '.uno:ParagraphDialog'},
				{name: _UNO('.uno:SlideSetup', 'presentation'), uno: '.uno:PageSetup'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'},
				{type: 'separator'},
				{uno: '.uno:OutlineBullet'}]
			},
			{name: _UNO('.uno:TableMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), id:'table', type: 'menu', menu: [
				{name: _UNO('.uno:InsertTable', 'text'), uno: '.uno:InsertTable'},
				{name: _UNO('.uno:TableInsertMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{name: _UNO('.uno:TableDeleteMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
					{uno: '.uno:DeleteRows'},
					{uno: '.uno:DeleteColumns'},
					{uno: '.uno:DeleteTable'}]},
				{name: _UNO('.uno:TableSelectMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:SelectTable'},
					{uno: '.uno:EntireRow'},
					{uno: '.uno:EntireColumn'}]},
				{uno: '.uno:MergeCells'},
				{uno: '.uno:TableDialog'}]
			},
			{name: _UNO('.uno:SlideMenu', 'presentation'), id: 'slide', type: 'menu', menu: [
				{name: _UNO('.uno:InsertSlide', 'presentation'), id: 'insertpage', type: 'action'},
				{name: _UNO('.uno:DuplicateSlide', 'presentation'), id: 'duplicatepage', type: 'action'},
				{name: _UNO('.uno:DeleteSlide', 'presentation'), id: 'deletepage', type: 'action'},
				{type: 'separator', id: 'fullscreen-presentation-separator'},
				{name: _('Fullscreen presentation'), id: 'fullscreen-presentation', type: 'action'},
				{name: _('Present current slide'), id: 'presentation-currentslide', type: 'action'}]
			},
			{name: _UNO('.uno:ToolsMenu', 'presentation'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellDialog'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]},
				{type: 'separator'},
				{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'}

			]},
			{name: _UNO('.uno:HelpMenu', 'presentation'), id: 'help', type: 'menu', menu: [
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: L.Control.MenubarShortcuts.addShortcut(_('Keyboard shortcuts'), L.Control.MenubarShortcuts.shortcuts.KEYBOARD_SHORTCUTS), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
				{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		drawing: [
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Save', 'presentation'), L.Control.MenubarShortcuts.shortcuts.SAVE), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: 'action'},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'}
				]},
				{name: _('Save Comments'), id: 'savecomments', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'presentation'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
					{name: _('ODF Drawing (.odg)'), id: 'downloadas-odg', type: 'action'}
				]},
				{name: _UNO('.uno:SetDocumentProperties', 'presentation'), uno: '.uno:SetDocumentProperties', id: 'properties'},
				{type: 'separator'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'presentation'), id: 'editmenu', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Undo', 'presentation'), L.Control.MenubarShortcuts.shortcuts.UNDO), uno: '.uno:Undo'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Redo', 'presentation'), L.Control.MenubarShortcuts.shortcuts.REDO), uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Cut', 'presentation'), L.Control.MenubarShortcuts.shortcuts.CUT), uno: '.uno:Cut'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Copy', 'presentation'), L.Control.MenubarShortcuts.shortcuts.COPY), uno: '.uno:Copy'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Paste', 'presentation'), L.Control.MenubarShortcuts.shortcuts.PASTE), uno: '.uno:Paste'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:PasteSpecial', 'presentation'), L.Control.MenubarShortcuts.shortcuts.PASTE_SPECIAL), uno: '.uno:PasteSpecial'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SelectAll', 'presentation'), L.Control.MenubarShortcuts.shortcuts.SELECT_ALL), uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'}
			]},
			{name: _UNO('.uno:ViewMenu', 'presentation'), id: 'view', type: 'menu',
			 menu: (window.mode.isTablet() ? [
					{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				] : [
					{name: _UNO('.uno:FullScreen', 'presentation'), id: 'fullscreen', type: 'action'},
					{type: 'separator'},
					{name: _UNO('.uno:ZoomPlus', 'presentation'), id: 'zoomin', type: 'action'},
					{name: _UNO('.uno:ZoomMinus', 'presentation'), id: 'zoomout', type: 'action'},
					{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				]).concat([
					{type: 'separator'},
					{name: _('Toggle UI Mode'), id: 'toggleuimode', type: 'action'},
					{uno: '.uno:Sidebar'},
					{name: _('Show Status Bar'), id: 'showstatusbar', type: 'action'}
				])},
			{name: _UNO('.uno:InsertMenu', 'presentation'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'presentation'), id: 'insertgraphicremote', type: 'action'},
				{name: _UNO('.uno:SelectBackground', 'presentation'), id: 'selectbackground', type: 'action'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:InsertAnnotation', 'presentation'), L.Control.MenubarShortcuts.shortcuts.COMMENT), id: 'insertcomment', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{name: _('Pick Link'), id: 'remotelink', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:InsertSymbol'},
				{type: 'separator'},
				{name: _UNO('.uno:InsertField', 'text'), id: 'insertfield', type: 'menu', menu: [
					{name: _UNO('.uno:InsertDateFieldFix', 'presentation'), uno: '.uno:InsertDateFieldFix'},
					{name: _UNO('.uno:InsertDateFieldVar', 'presentation'), uno: '.uno:InsertDateFieldVar'},
					{name: _UNO('.uno:InsertTimeFieldFix', 'presentation'), uno: '.uno:InsertTimeFieldFix'},
					{name: _UNO('.uno:InsertTimeFieldVar', 'presentation'), uno: '.uno:InsertTimeFieldVar'},
					{type: 'separator'},
					{name: _UNO('.uno:InsertPageField', 'presentation'), uno: '.uno:InsertPageField'},
					{name: _UNO('.uno:InsertPageTitleField', 'presentation'), uno: '.uno:InsertPageTitleField'},
					{name: _UNO('.uno:InsertPagesField', 'presentation'), uno: '.uno:InsertPagesField'},
				]},
			]},
			{name: _UNO('.uno:FormatMenu', 'presentation'), id: 'format', type: 'menu', menu: [
				{uno: '.uno:FontDialog'},
				{uno: '.uno:ParagraphDialog'},
				{name: _UNO('.uno:PageSetup', 'presentation'), uno: '.uno:PageSetup'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'},
				{type: 'separator'},
				{uno: '.uno:OutlineBullet'}]
			},
			{name: _UNO('.uno:TableMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
				{name: _UNO('.uno:InsertTable', 'text'), uno: '.uno:InsertTable'},
				{name: _UNO('.uno:TableInsertMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
					{name: _UNO('.uno:InsertRowsBefore', 'presentation'), uno: '.uno:InsertRowsBefore'},
					{name: _UNO('.uno:InsertRowsAfter', 'presentation'), uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{name: _UNO('.uno:InsertColumnsBefore', 'presentation'), uno: '.uno:InsertColumnsBefore'},
					{name: _UNO('.uno:InsertColumnsAfter', 'presentation'), uno: '.uno:InsertColumnsAfter'}]},
				{name: _UNO('.uno:TableDeleteMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), type: 'menu', menu: [
					{name: _UNO('.uno:DeleteRows', 'presentation'), uno: '.uno:DeleteRows'},
					{name: _UNO('.uno:DeleteColumns', 'presentation'), uno: '.uno:DeleteColumns'},
					{name: _UNO('.uno:DeleteTable', 'presentation'), uno: '.uno:DeleteTable'}]},
				{name: _UNO('.uno:TableSelectMenu', 'text'), type: 'menu', menu: [
					{name: _UNO('.uno:SelectTable', 'presentation'), uno: '.uno:SelectTable'},
					{name: _UNO('.uno:EntireRow', 'presentation'), uno: '.uno:EntireRow'},
					{name: _UNO('.uno:EntireColumn', 'presentation'), uno: '.uno:EntireColumn'}]},
				{name: _UNO('.uno:MergeCells', 'presentation'), uno: '.uno:MergeCells'},
				{name: _UNO('.uno:TableDialog', 'presentation'), uno: '.uno:TableDialog'}]
			},
			{name: _UNO('.uno:PageMenu', 'presentation'), type: 'menu', menu: [
				{name: _UNO('.uno:InsertPage', 'presentation'), id: 'insertpage', type: 'action'},
				{name: _UNO('.uno:DuplicatePage', 'presentation'), id: 'duplicatepage', type: 'action'},
				{name: _UNO('.uno:DeletePage', 'presentation'), id: 'deletepage', type: 'action'}]
			},
			{name: _UNO('.uno:ToolsMenu', 'presentation'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellDialog'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
			]},
			{name: _UNO('.uno:HelpMenu', 'presentation'), id: 'help', type: 'menu', menu: [
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: L.Control.MenubarShortcuts.addShortcut(_('Keyboard shortcuts'), L.Control.MenubarShortcuts.shortcuts.KEYBOARD_SHORTCUTS), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
				{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		spreadsheet: [
			{name: _UNO('.uno:PickList', 'spreadsheet'), id: 'file', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Save', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.SAVE), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'spreadsheet'), id: 'saveas', type: window.uiDefaults && window.uiDefaults.saveAsMode === 'group' ? 'menu' : 'action', menu: [
					{name: _('ODF spreadsheet (.ods)'), id: 'saveas-ods', type: 'action'},
					{name: _('Excel 2003 Spreadsheet (.xls)'), id: 'saveas-xls', type: 'action'},
					{name: _('Excel Spreadsheet (.xlsx)'), id: 'saveas-xlsx', type: 'action'},
				]},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'}
				]},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
					{name: _('ODF spreadsheet (.ods)'), id: 'downloadas-ods', type: 'action'},
					{name: _('Excel 2003 Spreadsheet (.xls)'), id: 'downloadas-xls', type: 'action'},
					{name: _('Excel Spreadsheet (.xlsx)'), id: 'downloadas-xlsx', type: 'action'},
					{name: _('CSV file (.csv)'), id: 'downloadas-csv', type: 'action'}]},
				{name: _UNO('.uno:SetDocumentProperties', 'spreadsheet'), uno: '.uno:SetDocumentProperties', id: 'properties'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Print', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.PRINT), id: 'print', type: 'action'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'spreadsheet'), id: 'editmenu', type: 'menu', menu: [
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Undo', 'text'), L.Control.MenubarShortcuts.shortcuts.UNDO), uno: '.uno:Undo'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Redo', 'text'), L.Control.MenubarShortcuts.shortcuts.REDO), uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Cut', 'text'), L.Control.MenubarShortcuts.shortcuts.CUT), uno: '.uno:Cut'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Copy', 'text'), L.Control.MenubarShortcuts.shortcuts.COPY), uno: '.uno:Copy'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Paste', 'text'), L.Control.MenubarShortcuts.shortcuts.PASTE), uno: '.uno:Paste'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:PasteSpecial', 'text'), L.Control.MenubarShortcuts.shortcuts.PASTE_SPECIAL), uno: '.uno:PasteSpecial'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SelectAll', 'text'), L.Control.MenubarShortcuts.shortcuts.SELECT_ALL), uno: '.uno:SelectAll'},
				{type: 'separator'},
				{uno: '.uno:SearchDialog'}
			]},
			{name: _UNO('.uno:ViewMenu', 'spreadsheet'), id: 'view', type: 'menu',
			 menu: (window.mode.isTablet() ? [
					{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				] : [
				   {name: _UNO('.uno:FullScreen', 'spreadsheet'), id: 'fullscreen', type: 'action'},
				   {type: 'separator'},
				   {name: _UNO('.uno:ZoomPlus', 'text'), id: 'zoomin', type: 'action'},
				   {name: _UNO('.uno:ZoomMinus', 'text'), id: 'zoomout', type: 'action',},
				   {name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				]).concat([
				   {type: 'separator'},
				   {name: _('Toggle UI Mode'), id: 'toggleuimode', type: 'action'},
				   {name: _('Show Status Bar'), id: 'showstatusbar', type: 'action'},
				   {uno: '.uno:Sidebar'},
				   {name: _UNO('.uno:FreezePanes', 'spreadsheet', true), id: 'FreezePanes', type: 'action', uno: '.uno:FreezePanes'},
				   {name: _UNO('.uno:FreezeCellsMenu', 'spreadsheet', true), id: 'FreezeCellsMenu', type: 'menu', uno: '.uno:FreezeCellsMenu', menu: [
					   {name: _UNO('.uno:FreezePanesColumn', 'spreadsheet', true), id: 'FreezePanesColumn', type: 'action', uno: '.uno:FreezePanesColumn'},
					   {name: _UNO('.uno:FreezePanesRow', 'spreadsheet', true), id: 'FreezePanesRow', type: 'action', uno: '.uno:FreezePanesRow'}
				   ]},
				])},
			{name: _UNO('.uno:InsertMenu', 'spreadsheet'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'spreadsheet'), id: 'insertgraphicremote', type: 'action'},
				{name: _UNO('.uno:DataDataPilotRun', 'spreadsheet'), uno: '.uno:DataDataPilotRun'},
				{name: _UNO('.uno:InsertSparkline', 'spreadsheet'), uno: '.uno:InsertSparkline'},
				{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:InsertAnnotation', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.COMMENT), id: 'insertcomment', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{name: _UNO('.uno:FontworkGalleryFloater'), uno: '.uno:FontworkGalleryFloater', id: 'fontworkgalleryfloater'},
				{name: _UNO('.uno:DrawText'), uno: '.uno:DrawText'},
				{name: _UNO('.uno:VerticalText'), uno: '.uno:VerticalText'},
				{uno: '.uno:FunctionDialog'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{name: _('Pick Link'), id: 'remotelink', type: 'action'},
				{uno: '.uno:InsertSymbol'},
				{type: 'separator'},
				{name: _UNO('.uno:InsertField', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertCurrentDate'},
					{uno: '.uno:InsertCurrentTime'}
				]},
				{uno: '.uno:EditHeaderAndFooter'} /*todo: add to Control.Notebookbar.Calc.js (as Insert tab)*/
			]},
			{name: _UNO('.uno:FormatMenu', 'spreadsheet'), id: 'format', type: 'menu', menu: [
				{name: _UNO('.uno:FormatTextMenu', 'spreadsheet'), type: 'menu', menu: [
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Bold', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.BOLD), uno: '.uno:Bold'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Italic', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.ITALIC), uno: '.uno:Italic'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Underline', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.UNDERLINE), uno: '.uno:Underline'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:UnderlineDouble', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.DOUBLE_UNDERLINE), uno: '.uno:UnderlineDouble'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:Strikeout', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.STRIKETHROUGH), uno: '.uno:Strikeout'},
					{uno: '.uno:Overline'},
					{type: 'separator'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SuperScript', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.SUPERSCRIPT), uno: '.uno:SuperScript'},
					{name: L.Control.MenubarShortcuts.addShortcut(_UNO('.uno:SubScript', 'spreadsheet'), L.Control.MenubarShortcuts.shortcuts.SUBSCRIPT), uno: '.uno:SubScript'},
					{type: 'separator'},
					{uno: '.uno:Shadowed'},
					{uno: '.uno:OutlineFont'},
					{type: 'separator'},
					{uno: '.uno:WrapText'},
					{type: 'separator'},
					{uno: '.uno:ChangeCaseToUpper'},
					{uno: '.uno:ChangeCaseToLower'},
					{uno: '.uno:ChangeCaseRotateCase'},
					{type: 'separator'},
					{uno: '.uno:ChangeCaseToSentenceCase'},
					{uno: '.uno:ChangeCaseToTitleCase'},
					{uno: '.uno:ChangeCaseToToggleCase'}]},
				{name: _UNO('.uno:TextAlign', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:CommonAlignLeft'},
					{uno: '.uno:CommonAlignHorizontalCenter'},
					{uno: '.uno:CommonAlignRight'},
					{uno: '.uno:CommonAlignJustified'},
					{type: 'separator'},
					{uno: '.uno:CommonAlignTop'},
					{uno: '.uno:CommonAlignVerticalCenter'},
					{uno: '.uno:CommonAlignBottom'},
					{type: 'separator'},
					{uno: '.uno:ParaLeftToRight'},
					{uno: '.uno:ParaRightToLeft'}]},
				{name: _UNO('.uno:NumberFormatMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:NumberFormatStandard'},
					{uno: '.uno:NumberFormatDecimal'},
					{uno: '.uno:NumberFormatPercent'},
					{uno: '.uno:NumberFormatCurrency'},
					{uno: '.uno:NumberFormatDate'},
					{uno: '.uno:NumberFormatTime'},
					{uno: '.uno:NumberFormatScientific'},
					{type: 'separator'},
					{uno: '.uno:NumberFormatThousands'}]},
				{type: 'separator'},
				{uno: '.uno:FormatPaintbrush'},
				{uno: '.uno:ResetAttributes'},
				{name: _UNO('.uno:PrintRangesMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:DefinePrintArea'},
					{uno: '.uno:AddPrintArea'},
					{uno: '.uno:EditPrintArea'},
					{uno: '.uno:DeletePrintArea'}]},
				{name: _UNO('.uno:FormatSparklineMenu', 'spreadsheet'), type: 'menu', menu: [
				    {uno: '.uno:InsertSparkline'},
				    {uno: '.uno:DeleteSparkline'},
				    {uno: '.uno:DeleteSparklineGroup'},
				    {uno: '.uno:EditSparklineGroup'},
				    {uno: '.uno:EditSparkline'},
				    {uno: '.uno:GroupSparklines'},
				    {uno: '.uno:UngroupSparklines'}
				]},
				{name: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:ConditionalFormatDialog'},
					{uno: '.uno:ColorScaleFormatDialog'},
					{uno: '.uno:DataBarFormatDialog'},
					{uno: '.uno:IconSetFormatDialog'},
					{uno: '.uno:CondDateFormatDialog'},
					{type: 'separator'},
					{uno: '.uno:ConditionalFormatManagerDialog'}]},
				{type: 'separator'},
				{uno: '.uno:FormatCellDialog'},
				{name: _('Rows'), type: 'menu', menu: [
					{uno: '.uno:RowHeight'},
					{uno: '.uno:SetOptimalRowHeight'}]},
				{name: _('Columns'), type: 'menu', menu: [
					{uno: '.uno:ColumnWidth'},
					{uno: '.uno:SetOptimalColumnWidth'}]},
				{uno: '.uno:FontDialog'},
				{uno: '.uno:ParagraphDialog'},
				{uno: '.uno:PageFormatDialog'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'}
			]},
			{name: _UNO('.uno:SheetMenu', 'spreadsheet'), id: 'sheet', type: 'menu', menu: [
				{uno: '.uno:InsertCell'},
				{name: _UNO('.uno:InsertRowsMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'}]},
				{name: _UNO('.uno:InsertColumnsMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{type: 'separator'},
				{uno: '.uno:DeleteCell'},
				{uno: '.uno:DeleteRows'},
				{uno: '.uno:DeleteColumns'},
				{uno: '.uno:SheetRightToLeft'},
			]},
			{name: _UNO('.uno:DataMenu', 'spreadsheet'), id: 'data', type: 'menu', menu: [
				{uno: '.uno:DataSort'},
				{uno: '.uno:SortAscending'},
				{uno: '.uno:SortDescending'},
				{uno: '.uno:Validation'},
				{uno: '.uno:Calculate'},
				{type: 'separator'},
				{uno: '.uno:DataFilterAutoFilter'},
				{name: _UNO('.uno:FilterMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:DataFilterStandardFilter'},
					{uno: '.uno:DataFilterSpecialFilter'},
					{type: 'separator'},
					{uno: '.uno:DataFilterRemoveFilter'},
					{uno: '.uno:DataFilterHideAutoFilter'}]},
				{type: 'separator'},
				{name: _UNO('.uno:DataPilotMenu', 'spreadsheet'), type: 'menu', menu: [
					{name: _UNO('.uno:InsertPivotTable', 'spreadsheet'), uno: '.uno:DataDataPilotRun'},
					{name: _UNO('.uno:RecalcPivotTable', 'spreadsheet'), uno: '.uno:RecalcPivotTable'},
					{name: _UNO('.uno:DeletePivotTable', 'spreadsheet'), uno: '.uno:DeletePivotTable'}]},
				{type: 'separator'},
				{name: _UNO('.uno:NamesMenu', 'spreadsheet'), type: 'menu', menu: [
					{name: _UNO('.uno:AddName', 'spreadsheet'), uno: '.uno:AddName'},
					{name: _UNO('.uno:DefineName', 'spreadsheet'), uno: '.uno:DefineName'}]},
				{type: 'separator'},
				{name: _UNO('.uno:GroupOutlineMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:Group'},
					{uno: '.uno:Ungroup'},
					{type: 'separator'},
					{uno: '.uno:ClearOutline'},
					{type: 'separator'},
					{uno: '.uno:HideDetail'},
					{uno: '.uno:ShowDetail'}]},
				{type: 'separator'},
				{name: _UNO('.uno:StatisticsMenu', 'spreadsheet'), type: 'menu', menu: [
					{name: _UNO('.uno:SamplingDialog', 'spreadsheet'), uno: '.uno:SamplingDialog'},
					{name: _UNO('.uno:DescriptiveStatisticsDialog', 'spreadsheet'), uno: '.uno:DescriptiveStatisticsDialog'},
					{name: _UNO('.uno:AnalysisOfVarianceDialog', 'spreadsheet'), uno: '.uno:AnalysisOfVarianceDialog'},
					{name: _UNO('.uno:CorrelationDialog', 'spreadsheet'), uno: '.uno:CorrelationDialog'},
					{name: _UNO('.uno:CovarianceDialog', 'spreadsheet'), uno: '.uno:CovarianceDialog'},
					{name: _UNO('.uno:ExponentialSmoothingDialog', 'spreadsheet'), uno: '.uno:ExponentialSmoothingDialog'},
					{name: _UNO('.uno:MovingAverageDialog', 'spreadsheet'), uno: '.uno:MovingAverageDialog'},
					{name: _UNO('.uno:RegressionDialog', 'spreadsheet'), uno: '.uno:RegressionDialog'},
					{name: _UNO('.uno:TTestDialog', 'spreadsheet'), uno: '.uno:TTestDialog'},
					{name: _UNO('.uno:FTestDialog', 'spreadsheet'), uno: '.uno:FTestDialog'},
					{name: _UNO('.uno:ZTestDialog', 'spreadsheet'), uno: '.uno:ZTestDialog'},
					{name: _UNO('.uno:ChiSquareTestDialog', 'spreadsheet'), uno: '.uno:ChiSquareTestDialog'},
					{name: _UNO('.uno:FourierAnalysisDialog', 'spreadsheet'), uno: '.uno:FourierAnalysisDialog'}]},
			]},
			{name: _UNO('.uno:ToolsMenu', 'spreadsheet'), id: 'tools', type: 'menu', menu: [
				{uno: '.uno:SpellDialog'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]},
				{uno: '.uno:GoalSeekDialog'},
				{type: 'separator'},
				{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'}
			]},
			{name: _UNO('.uno:HelpMenu', 'spreadsheet'), id: 'help', type: 'menu', menu: [
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: L.Control.MenubarShortcuts.addShortcut(_('Keyboard shortcuts'), L.Control.MenubarShortcuts.shortcuts.KEYBOARD_SHORTCUTS), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
				{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		mobiletext:  [
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:PickList', 'text'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'text'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'text'), id: 'saveas', type: 'action'},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'},
					{name: _('EPUB (.epub)'), id: 'exportas-epub', type: 'action'}
				]},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Sign document'), id: 'signdocument', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:Print', 'text'), id: 'print', type: 'action'},
				{name: _UNO('.uno:SetDocumentProperties', 'text'), uno: '.uno:SetDocumentProperties', id: 'properties'}

			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
				{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
				{name: _('Word 2003 Document (.doc)'), id: 'downloadas-doc', type: 'action'},
				{name: _('Word Document (.docx)'), id: 'downloadas-docx', type: 'action'},
				{name: _('Rich Text (.rtf)'), id: 'downloadas-rtf', type: 'action'},
				{name: _('EPUB (.epub)'), id: 'exportepub', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'text'), id: 'editmenu', type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'}
			]},
			{name: _UNO('.uno:ChangesMenu', 'text'), id: 'changesmenu', type: 'menu', menu: [
				{uno: '.uno:TrackChanges'},
				{uno: '.uno:ShowTrackedChanges'},
				{type: 'separator'},
				{uno: '.uno:AcceptAllTrackedChanges'},
				{uno: '.uno:RejectAllTrackedChanges'},
				{uno: '.uno:PreviousTrackedChange'},
				{uno: '.uno:NextTrackedChange'}
			]},
			{name: _UNO('.uno:ViewMenu', 'text'), id: 'view', type: 'menu', menu: [
				{name: _UNO('.uno:FullScreen', 'text'), id: 'fullscreen', type: 'action', mobileapp: false},
				{uno: '.uno:ControlCodes', id: 'formattingmarks'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:ShowResolvedAnnotations', 'text'), id: 'showresolved', type: 'action', uno: '.uno:ShowResolvedAnnotations'},
			]
			},
			{id: 'watermark', uno: '.uno:Watermark'},
			{name: _('Page Setup'), id: 'pagesetup', type: 'action'},
			{uno: '.uno:WordCountDialog'},
			{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'},
			{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
			{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobilepresentation: [
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'presentation'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: 'action'},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'}
				]},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:Print', 'presentation'), id: 'print', type: 'action'},
				{name: _UNO('.uno:SetDocumentProperties', 'presentation'), uno: '.uno:SetDocumentProperties', id: 'properties'}
			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
				{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
				{name: _('PowerPoint 2003 Presentation (.ppt)'), id: 'downloadas-ppt', type: 'action'},
				{name: _('PowerPoint Presentation (.pptx)'), id: 'downloadas-pptx', type: 'action'},
				{name: _('ODF Drawing (.odg)'), id: 'downloadas-odg', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'presentation'), id: 'editmenu', type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'}
			]},
			{name: _UNO('.uno:TableMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), id: 'tablemenu', type: 'menu', menu: [
				{uno: '.uno:InsertRowsBefore'},
				{uno: '.uno:InsertRowsAfter'},
				{type: 'separator'},
				{uno: '.uno:InsertColumnsBefore'},
				{uno: '.uno:InsertColumnsAfter'},
				{uno: '.uno:SelectTable'},
				{uno: '.uno:EntireRow'},
				{uno: '.uno:EntireColumn'},
				{uno: '.uno:MergeCells'},
				{uno: '.uno:DeleteRows'},
				{uno: '.uno:DeleteColumns'},
				{uno: '.uno:DeleteTable'},
			]
			},
			{name: _UNO('.uno:SlideMenu', 'presentation'), id: 'slidemenu', type: 'menu', menu: [
				{name: _UNO('.uno:InsertSlide', 'presentation'), id: 'insertpage', type: 'action'},
				{name: _UNO('.uno:DuplicateSlide', 'presentation'), id: 'duplicatepage', type: 'action'},
				{name: _UNO('.uno:DeleteSlide', 'presentation'), id: 'deletepage', type: 'action'}]
			},
			{uno: '.uno:SpellOnline'},
			{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'},
			{name: _('Fullscreen presentation'), id: 'fullscreen-presentation', type: 'action'},
			{name: _UNO('.uno:FullScreen', 'presentation'), id: 'fullscreen', type: 'action', mobileapp: false},
			{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
			{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobiledrawing: [
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'presentation'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: 'action'},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'}
				]},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'presentation'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _UNO('.uno:SetDocumentProperties', 'presentation'), uno: '.uno:SetDocumentProperties', id: 'properties'}
			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
				{name: _('ODF Drawing (.odg)'), id: 'downloadas-odg', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'presentation'), id: 'editmenu', type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'}
			]},
			{name: _UNO('.uno:TableMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), id: 'tablemenu', type: 'menu', menu: [
				{name: _UNO('.uno:InsertRowsBefore', 'presentation'), uno: '.uno:InsertRowsBefore'},
				{name: _UNO('.uno:InsertRowsAfter', 'presentation'), uno: '.uno:InsertRowsAfter'},
				{type: 'separator'},
				{name: _UNO('.uno:InsertColumnsBefore', 'presentation'), uno: '.uno:InsertColumnsBefore'},
				{name: _UNO('.uno:InsertColumnsAfter', 'presentation'), uno: '.uno:InsertColumnsAfter'},
				{name: _UNO('.uno:DeleteRows', 'presentation'), uno: '.uno:DeleteRows'},
				{name: _UNO('.uno:DeleteColumns', 'presentation'), uno: '.uno:DeleteColumns'},
				{name: _UNO('.uno:MergeCells', 'presentation'), uno: '.uno:MergeCells'}]
			},
			{name: _UNO('.uno:PageMenu', 'presentation'), id: 'pagemenu', type: 'menu', menu: [
				{name: _UNO('.uno:InsertPage', 'presentation'), id: 'insertpage', type: 'action'},
				{name: _UNO('.uno:DuplicatePage', 'presentation'), id: 'duplicatepage', type: 'action'},
				{name: _UNO('.uno:DeletePage', 'presentation'), id: 'deletepage', type: 'action'}]
			},
			{uno: '.uno:SpellOnline'},
			{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'},
			{name: _UNO('.uno:FullScreen', 'presentation'), id: 'fullscreen', type: 'action', mobileapp: false},
			{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
			{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobilespreadsheet: [
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:PickList', 'spreadsheet'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'spreadsheet'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'spreadsheet'), id: 'saveas', type: 'action'},
				{name: _('Export as'), id: 'exportas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'exportas-pdf', type: 'action'}
				]},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:Print', 'spreadsheet'), id: 'print', type: 'action'},
				{name: _('Define print area', 'spreadsheet'), uno: '.uno:DefinePrintArea' },
				{name: _('Remove print area', 'spreadsheet'), uno: '.uno:DeletePrintArea' },
				{name: _UNO('.uno:SetDocumentProperties', 'spreadsheet'), uno: '.uno:SetDocumentProperties', id: 'properties'}
			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'exportpdf', type: 'action'},
				{name: _('ODF spreadsheet (.ods)'), id: 'downloadas-ods', type: 'action'},
				{name: _('Excel 2003 Spreadsheet (.xls)'), id: 'downloadas-xls', type: 'action'},
				{name: _('Excel Spreadsheet (.xlsx)'), id: 'downloadas-xlsx', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'spreadsheet'), id: 'editmenu', type: 'menu', menu: [
				{uno: '.uno:Undo'},
				{uno: '.uno:Redo'},
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Cut'},
				{uno: '.uno:Copy'},
				{uno: '.uno:Paste'},
				{uno: '.uno:SelectAll'}
			]},
			{name: _UNO('.uno:SheetMenu', 'spreadsheet'), id: 'sheetmenu', type: 'menu', menu: [
				{name: _UNO('.uno:InsertRowsMenu', 'spreadsheet'), id: 'insertrowsmenu', type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'}]},
				{name: _UNO('.uno:InsertColumnsMenu', 'spreadsheet'), id: 'insertcolumnsmenu', type: 'menu', menu: [
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{type: 'separator'},
				{uno: '.uno:DeleteRows'},
				{uno: '.uno:DeleteColumns'},
				{type: 'separator'},
				{name: _UNO('.uno:FreezePanes', 'spreadsheet'), uno: '.uno:FreezePanes'},
				{name: _UNO('.uno:FreezePanesColumn', 'spreadsheet'), uno: '.uno:FreezePanesColumn'},
				{name: _UNO('.uno:FreezePanesRow', 'spreadsheet'), uno: '.uno:FreezePanesRow'}
			]},
			{name: _UNO('.uno:DataMenu', 'spreadsheet'), id: 'datamenu', type: 'menu', menu: [
				{uno: '.uno:Validation'},
				{type: 'separator'},
				{uno: '.uno:SortAscending'},
				{uno: '.uno:SortDescending'},
				{type: 'separator'},
				{name: _UNO('.uno:GroupOutlineMenu', 'spreadsheet'), id: 'groupoutlinemenu', type: 'menu', menu: [
					{uno: '.uno:Group'},
					{uno: '.uno:Ungroup'},
					{type: 'separator'},
					{uno: '.uno:ClearOutline'},
					{type: 'separator'},
					{uno: '.uno:HideDetail'},
					{uno: '.uno:ShowDetail'}]}
			]},
			{uno: '.uno:SpellOnline'},
			{name: _UNO('.uno:RunMacro'), id: 'runmacro', uno: '.uno:RunMacro'},
			{name: _UNO('.uno:FullScreen', 'spreadsheet'), id: 'fullscreen', type: 'action', mobileapp: false},
			{name: _('Latest Updates'), id: 'latestupdates', type: 'action', iosapp: false},
			{name: _('Send Feedback'), id: 'feedback', type: 'action', mobileapp: false},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobileInsertMenu : {
			text : {
				name: _UNO('.uno:InsertMenu', 'text'), id: 'insert', type: 'menu', menu: [
					{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
					{name: _UNO('.uno:InsertGraphic', 'text'), id: 'insertgraphicremote', type: 'action'},
					{uno: '.uno:InsertObjectChart'},
					{name: _UNO('.uno:InsertAnnotation', 'text'), id: 'insertcomment', type: 'action'},
					{name: _UNO('.uno:TableMenu'), id: 'inserttable', type: 'action'},
					{type: 'separator'},
					{name: _UNO('.uno:InsertField', 'text'), id: 'insertfield', type: 'menu', menu: [
						{uno: '.uno:InsertPageNumberField'},
						{uno: '.uno:InsertPageCountField'},
						{uno: '.uno:InsertDateField'},
						{uno: '.uno:InsertTimeField'},
						{uno: '.uno:InsertTitleField'},
						{uno: '.uno:InsertAuthorField'},
						{uno: '.uno:InsertTopicField'}
					]},
					{name: _UNO('.uno:InsertHeaderFooterMenu', 'text'), id: 'insertheaderfooter', type: 'menu', menu: [
						{name: _UNO('.uno:InsertPageHeader', 'text'), id: 'insertpageheader', type: 'menu', menu: [
							{name: _('All'), disabled: true, id: 'insertheader', tag: '_ALL_', uno: '.uno:InsertPageHeader?On:bool=true'}]},
						{name: _UNO('.uno:InsertPageFooter', 'text'), id: 'insertpagefooter', type: 'menu', menu: [
							{name: _('All'), disabled: true, id: 'insertfooter', tag: '_ALL_', uno: '.uno:InsertPageFooter?On:bool=true'}]}
					]},
					{uno: '.uno:InsertFootnote'},
					{uno: '.uno:InsertEndnote'},
					{type: 'separator'},
					{uno: '.uno:InsertPagebreak'},
					{name: _UNO('.uno:InsertColumnBreak', 'spreadsheet'), uno: '.uno:InsertColumnBreak'},
					{type: 'separator'},
					{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
					{name: _UNO('.uno:ShapesMenu'), id: 'insertshape', type: 'action'},
					{name: _UNO('.uno:FontworkGalleryFloater'), uno: '.uno:FontworkGalleryFloater', id: 'fontworkgalleryfloater'},
					{name: _UNO('.uno:FormattingMarkMenu', 'text'), id: 'formattingmark', type: 'menu', menu: [
						{uno: '.uno:InsertNonBreakingSpace'},
						{uno: '.uno:InsertHardHyphen'},
						{uno: '.uno:InsertSoftHyphen'},
						{uno: '.uno:InsertZWSP'},
						{uno: '.uno:InsertWJ'},
						{uno: '.uno:InsertLRM'},
						{uno: '.uno:InsertRLM'}]},
					{name: _UNO('.uno:FormatFormMenu', 'text'), id: 'formatformmenu', type: 'menu', menu: [
						{name: _('Insert Rich Text'), uno: '.uno:InsertContentControl'},
						{name: _('Insert Checkbox'), uno: '.uno:InsertCheckboxContentControl'},
						{name: _('Insert Dropdown'), uno: '.uno:InsertDropdownContentControl'},
						{name: _('Insert Picture'), uno: '.uno:InsertPictureContentControl'},
						{name: _('Insert Date'), uno: '.uno:InsertDateContentControl'},
						{name: _('Properties'), uno: '.uno:ContentControlProperties'},
					]},
				]
			},
			spreadsheet : {
				name: _UNO('.uno:InsertMenu', 'spreadsheet'), id: 'insert', type: 'menu', menu: [
					{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
					{name: _UNO('.uno:InsertGraphic', 'spreadsheet'), id: 'insertgraphicremote', type: 'action'},
					{uno: '.uno:InsertObjectChart'},
					{name: _UNO('.uno:InsertAnnotation', 'spreadsheet'), id: 'insertcomment', type: 'action'},
					{type: 'separator'},
					{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
					{name: _UNO('.uno:ShapesMenu'), id: 'insertshape', type: 'action'},
					{uno: '.uno:InsertCurrentDate'},
					{uno: '.uno:InsertCurrentTime'},
					// other fields need EditEngine context & can't be disabled in the menu.
				]
			},
			presentation : {
				name: _UNO('.uno:InsertMenu', 'presentation'), id: 'insert', type: 'menu', menu: [
					{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
					{name: _UNO('.uno:InsertGraphic', 'presentation'), id: 'insertgraphicremote', type: 'action'},
					{uno: '.uno:InsertObjectChart'},
					{name: _UNO('.uno:InsertAnnotation', 'presentation'), id: 'insertcomment', type: 'action'},
					{name: _UNO('.uno:TableMenu'), id: 'inserttable', type: 'action'},
					{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
					{name: _UNO('.uno:ShapesMenu'), id: 'insertshape', type: 'action'},
					{name: _UNO('.uno:FontworkGalleryFloater'), uno: '.uno:FontworkGalleryFloater', id: 'fontworkgalleryfloater'},
					{name: _UNO('.uno:Text', 'presentation'), id: 'inserttextbox', type: 'action'},
					{name: _UNO('.uno:InsertField', 'text'), id: 'insertfield', type: 'menu', menu: [
						{uno: '.uno:InsertDateFieldFix'},
						{uno: '.uno:InsertDateFieldVar'},
						{uno: '.uno:InsertTimeFieldFix'},
						{uno: '.uno:InsertTimeFieldVar'},
						{type: 'separator'},
						{name: _UNO('.uno:InsertSlideField', 'presentation'), uno: '.uno:InsertPageField'},
						{name: _UNO('.uno:InsertSlideTitleField', 'presentation'), uno: '.uno:InsertPageTitleField'},
						{name: _UNO('.uno:InsertSlidesField', 'presentation'), uno: '.uno:InsertPagesField'},
					]},
				]
			},
			drawing : {
				name: _UNO('.uno:InsertMenu', 'presentation'), id: 'insert', type: 'menu', menu: [
					{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
					{name: _UNO('.uno:InsertGraphic', 'presentation'), id: 'insertgraphicremote', type: 'action'},
					{uno: '.uno:InsertObjectChart'},
					{name: _UNO('.uno:InsertAnnotation', 'presentation'), id: 'insertcomment', type: 'action'},
					{name: _UNO('.uno:TableMenu'), id: 'inserttable', type: 'action'},
					{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
					{name: _UNO('.uno:ShapesMenu'), id: 'insertshape', type: 'action'},
					{name: _UNO('.uno:FontworkGalleryFloater'), uno: '.uno:FontworkGalleryFloater', id: 'fontworkgalleryfloater'},
					{name: _UNO('.uno:Text', 'presentation'), id: 'inserttextbox', type: 'action'},
					{name: _UNO('.uno:InsertField', 'text'), id: 'insertfield', type: 'menu', menu: [
						{name: _UNO('.uno:InsertDateFieldFix', 'presentation'), uno: '.uno:InsertDateFieldFix'},
						{name: _UNO('.uno:InsertDateFieldVar', 'presentation'), uno: '.uno:InsertDateFieldVar'},
						{name: _UNO('.uno:InsertTimeFieldFix', 'presentation'), uno: '.uno:InsertTimeFieldFix'},
						{name: _UNO('.uno:InsertTimeFieldVar', 'presentation'), uno: '.uno:InsertTimeFieldVar'},
						{type: 'separator'},
						{name: _UNO('.uno:InsertPageField', 'presentation'), uno: '.uno:InsertPageField'},
						{name: _UNO('.uno:InsertPageTitleField', 'presentation'), uno: '.uno:InsertPageTitleField'},
						{name: _UNO('.uno:InsertPagesField', 'presentation'), uno: '.uno:InsertPagesField'},
					]},
				]
			}
		},

		commandStates: {},

		// Only these menu options will be visible in readonly mode
		allowedReadonlyMenus: ['file', 'downloadas', 'view', 'insert', 'help'],

		allowedViewModeActions: [
			'savecomments', 'shareas', 'print', // file menu
			'downloadas-odt', 'downloadas-doc', 'downloadas-docx', 'downloadas-rtf', // file menu
			'downloadas-odp', 'downloadas-ppt', 'downloadas-pptx', 'downloadas-odg', 'exportpdf', 'exportepub', // file menu
			'downloadas-ods', 'downloadas-xls', 'downloadas-xlsx', 'downloadas-csv', 'closedocument', // file menu
			'fullscreen', 'zoomin', 'zoomout', 'zoomreset', 'showstatusbar', 'showresolved', // view menu
			'about', 'keyboard-shortcuts', 'latestupdates', 'feedback', 'online-help', 'report-an-issue', // help menu
			'insertcomment'
		]
	},

	onAdd: function (map) {
		this._initialized = false;
		this._hiddenItems = [];
		this._menubarCont = L.DomUtil.get('main-menu');
		this._isFileODF = true;
		// In case it contains garbage
		if (this._menubarCont)
			this._menubarCont.remove();
		// Use original template as provided by server
		this._menubarCont = map.mainMenuTemplate.cloneNode(true);
		$('#main-menu-state').after(this._menubarCont);
		this._initializeMenu(this.options.initial);

		map.on('doclayerinit', this._onDocLayerInit, this);
		map.on('updatepermission', this._onRefresh, this);
		map.on('addmenu', this._addMenu, this);
		map.on('languagesupdated', this._onInitLanguagesMenu, this);
		map.on('updatetoolbarcommandvalues', this._onStyleMenu, this);

		this._resetOverflow();
	},

	onRemove: function() {

		this._map.off('doclayerinit', this._onDocLayerInit, this);
		this._map.off('updatepermission', this._onRefresh, this);
		this._map.off('addmenu', this._addMenu, this);
		this._map.off('languagesupdated', this._onInitLanguagesMenu, this);
		this._map.off('updatetoolbarcommandvalues', this._onStyleMenu, this);

		this._menubarCont.remove();
		this._menubarCont = null;

		this._resetOverflow();
	},

	_addMenu: function (e) {
		var alreadyExists = L.DomUtil.get('menu-' + e.id);
		if (alreadyExists)
			return;

		var liItem = L.DomUtil.create('li', '');
		liItem.setAttribute('role', 'menuitem');
		liItem.id = 'menu-' + e.id;
		if (this._map.isReadOnlyMode()) {
			L.DomUtil.addClass(liItem, 'readonly');
		}
		var aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(e.label);
		$(aItem).data('id', e.id);
		$(aItem).data('type', 'action');
		$(aItem).data('postmessage', 'true');
		aItem.tabIndex = 0;
		this._menubarCont.insertBefore(liItem, this._menubarCont.firstChild);
	},

	_createUnoMenuItem: function (caption, command, tag) {
		var liItem, aItem;
		liItem = L.DomUtil.create('li', '');
		liItem.setAttribute('role', 'menuitem');
		aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(caption);
		$(aItem).data('type', 'unocommand');
		$(aItem).data('uno', command);
		$(aItem).data('tag', tag);
		aItem.tabIndex = 0;
		return liItem;
	},

	_createActionMenuItem: function (caption, id) {
		var liItem, aItem;
		liItem = L.DomUtil.create('li', '');
		liItem.setAttribute('role', 'menuitem');
		aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(caption);
		$(aItem).data('type', 'action');
		$(aItem).data('id', id);
		aItem.tabIndex = 0;
		return liItem;
	},

	_onInitLanguagesMenu: function () {
		var translated, neutral;
		var constDefa = 'Default_RESET_LANGUAGES';
		var constCurr = 'Current_RESET_LANGUAGES';
		var constPara = 'Paragraph_RESET_LANGUAGES';
		var constLang = '.uno:LanguageStatus?Language:string=';
		var resetLang = _('Reset to Default Language');
		var languages  = app.languages;

		var $menuSelection = $('#menu-noneselection').parent();
		var $menuParagraph = $('#menu-noneparagraph').parent();
		var $menuDefault = $('#menu-nonelanguage').parent();

		var noneselection = $('#menu-noneselection').detach();
		var fontlanguage = $('#menu-fontlanguage').detach();
		var noneparagraph = $('#menu-noneparagraph').detach();
		var paragraphlanguage = $('#menu-paragraphlanguage').detach();
		var nonelanguage = $('#menu-nonelanguage').detach();

		// clear old entries

		$menuSelection.empty();
		$menuParagraph.empty();
		$menuDefault.empty();

		for (var lang in languages) {
			if (languages.length > 10 && app.favouriteLanguages.indexOf(languages[lang].iso) < 0)
				continue;

			translated = languages[lang].translated;
			neutral = languages[lang].neutral;

			$menuSelection.append(this._createUnoMenuItem(translated, constLang + encodeURIComponent('Current_' + neutral)));
			$menuParagraph.append(this._createUnoMenuItem(translated, constLang + encodeURIComponent('Paragraph_' + neutral)));
			$menuDefault.append(this._createUnoMenuItem(translated, constLang + encodeURIComponent('Default_' + neutral)));
		}

		$menuSelection.append(this._createActionMenuItem(_('More...'), 'morelanguages-selection'));
		$menuParagraph.append(this._createActionMenuItem(_('More...'), 'morelanguages-paragraph'));
		$menuDefault.append(this._createActionMenuItem(_('More...'), 'morelanguages-all'));

		$menuSelection.append(this._createMenu([{type: 'separator'}]));
		$menuParagraph.append(this._createMenu([{type: 'separator'}]));
		$menuDefault.append(this._createMenu([{type: 'separator'}]));

		$menuSelection.append(this._createUnoMenuItem(resetLang, constLang + constCurr));
		$menuParagraph.append(this._createUnoMenuItem(resetLang, constLang + constPara));
		$menuDefault.append(this._createUnoMenuItem(resetLang, constLang + constDefa));

		$menuSelection.append(noneselection);
		$menuSelection.append(fontlanguage);
		$menuParagraph.append(noneparagraph);
		$menuParagraph.append(paragraphlanguage);
		$menuDefault.append(nonelanguage);
	},

	_addTabIndexPropsToMainMenu: function () {
		var mainMenu = document.getElementById('main-menu');
		for (var i = 0; i < mainMenu.children.length; i++) {
			if (mainMenu.children[i].children[0].getAttribute('aria-haspopup') === 'true') {
				mainMenu.children[i].children[0].tabIndex = 0;
			}
		}
	},

	_onRefresh: function() {
		// clear initial menu
		L.DomUtil.removeChildNodes(this._menubarCont);

		// Add document specific menu
		var docType = this._map.getDocType();
		if (docType === 'text') {
			this._initializeMenu(this.options.text);
		} else if (docType === 'spreadsheet') {
			this._initializeMenu(this.options.spreadsheet);
		} else if (docType === 'presentation') {
			this._initializeMenu(this.options.presentation);
		} else if (docType === 'drawing') {
			this._initializeMenu(this.options.drawing);
		}

		// initialize menubar plugin
		$('#main-menu').smartmenus({
			hideOnClick: true,
			showOnClick: true,
			hideTimeout: 0,
			hideDuration: 0,
			hideFunction: null,
			showDuration: 0,
			showFunction: null,
			showTimeout: 0,
			collapsibleHideDuration: 0,
			collapsibleHideFunction: null,
			subIndicatorsPos: 'append',
			subIndicatorsText: '&#8250;'
		});
		$('#main-menu').attr('tabindex', 0);

		document.getElementById('main-menu').setAttribute('role', 'menubar');
		this._addTabIndexPropsToMainMenu();
		this._createFileIcon();
	},

	_onStyleMenu: function (e) {
		if (e.commandName === '.uno:StyleApply') {
			var style;
			var constArg = '&';
			var constHeader = '.uno:InsertPageHeader?PageStyle:string=';
			var constFooter = '.uno:InsertPageFooter?PageStyle:string=';
			var $menuHeader = $('#menu-insertheader').parent();
			var $menuFooter = $('#menu-insertfooter').parent();
			var pageStyles = e.commandValues['HeaderFooter'];
			for (var iterator in pageStyles) {
				style = pageStyles[iterator];
				if (!window.mode.isMobile()) {
					$menuHeader.append(this._createUnoMenuItem(_(style), constHeader + encodeURIComponent(style) + constArg, style));
					$menuFooter.append(this._createUnoMenuItem(_(style), constFooter + encodeURIComponent(style) + constArg, style));
				} else {
					var docType = this._map.getDocType();
					var target = this.options['mobileInsertMenu'][docType];

					var findFunction = function(item) {
						return item.name === _(style);
					};

					var foundMenu = this._findSubMenuByName(target, _UNO('.uno:InsertPageHeader', 'text'));
					if (foundMenu && foundMenu.menu.find(findFunction) === undefined)
						foundMenu.menu.push({name: _(style), tag: style, uno: constHeader + encodeURIComponent(style) + constArg});

					foundMenu = this._findSubMenuByName(target, _UNO('.uno:InsertPageFooter', 'text'));
					if (foundMenu && foundMenu.menu.find(findFunction) === undefined)
						foundMenu.menu.push({name: _(style), tag: style, uno: constFooter + encodeURIComponent(style) + constArg});
				}
			}
		}
	},

	_createDocument: function(e) {
		var self = e.data.self;
		var docType = self._map.getDocType();
		self._map.fire('postMessage', {msgId: 'UI_CreateFile', args: {DocumentType: docType}});
	},

	_onDocLayerInit: function() {
		this._onRefresh();

		$('#main-menu').bind('select.smapi', {self: this}, this._onItemSelected);

		$('#main-menu').bind('beforeshow.smapi', {self: this}, this._beforeShow);
		$('#main-menu').bind('click.smapi', {self: this}, this._onClicked);

		$('#main-menu').bind('keydown', {self: this}, this._onKeyDown);

		if (window.mode.isMobile()) {
			$('#main-menu').parent().css('height', '0');
			$('#toolbar-wrapper').addClass('mobile');
		}

		var self = this;
		// Also the vertical menu displayed when tapping the hamburger button is produced by SmartMenus
		$(function() {
			var $mainMenuState = $('#main-menu-state');
			if ($mainMenuState.length) {
				// animate mobile menu
				$mainMenuState.change(function() {
					// This code is invoked when the hamburger menu is opened or closed
					var $menu = $('#main-menu');
					var $nav = $menu.parent();
					if (this.checked) {
						if (!window.mode.isMobile()) {
							// Surely this code, if it really is related only to the hamburger menu,
							// will never be invoked on non-mobile browsers? I might be wrong though.
							// If you notice this logging, please modify this comment to indicate what is
							// going on.
							window.app.console.log('======> Assertion failed!? Not window.mode.isMobile()? Control.Menubar.js #1');
							$nav.css({height: 'initial', bottom: '38px'});
							$menu.hide().slideDown(250, function() { $menu.css('display', ''); });
							$('#mobile-wizard-header').show();
						} else {
							window.mobileMenuWizard = true;
							var menuData = self._map.menubar.generateFullMenuStructure();
							self._map.fire('mobilewizard', {data: menuData});
							$('#toolbar-hamburger').removeClass('menuwizard-closed').addClass('menuwizard-opened');
							$('#mobile-wizard-header').hide();
							$('#toolbar-mobile-back').hide();
							$('#formulabar').hide();
						}
					} else if (!window.mode.isMobile()) {
						// Ditto.
						window.app.console.log('======> Assertion failed!? Not window.mode.isMobile()? Control.Menubar.js #2');
						$menu.show().slideUp(250, function() { $menu.css('display', ''); });
						$nav.css({height:'', bottom: ''});
					} else {
						window.mobileMenuWizard = false;
						self._map.fire('closemobilewizard');
						$('#toolbar-hamburger').removeClass('menuwizard-opened').addClass('menuwizard-closed');
						$('#toolbar-mobile-back').show();
						if (self._map.getDocType() === 'spreadsheet')
							$('#formulabar').show();
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

	// needed for smartmenus to work inside notebookbar
	_setupOverflow: function() {
		$('.main-nav.hasnotebookbar').css('overflow', 'visible');
		$('.notebookbar-scroll-wrapper').css('overflow', 'visible');
	},

	_resetOverflow: function() {
		$('.main-nav').css('overflow', '');
		$('.notebookbar-scroll-wrapper').css('overflow', '');
	},

	_onMouseOut: function(e) {
		var self = e.data.self;
		self._resetOverflow();
	},

	_checkedMenu: function(uno, item) {
		var constChecked = 'lo-menu-item-checked';
		var state = this._map['stateChangeHandler'].getItemValue(uno);
		var data = $(item).data('tag');
		state = state[data] || false;
		if (state) {
			$(item).addClass(constChecked);
		} else {
			$(item).removeClass(constChecked);
		}
	},

	_beforeShow: function(e, menu) {
		var self = e.data.self;
		self._setupOverflow();
		var items = $(menu).children().children('a').not('.has-submenu');
		$(items).each(function() {
			var aItem = this;
			var type = $(aItem).data('type');
			var id = $(aItem).data('id');
			var constChecked = 'lo-menu-item-checked';
			if (self._map.isEditMode()) {
				if (type === 'unocommand') { // enable all depending on stored commandStates
					var data, lang, languageAndCode;
					var constUno = 'uno';
					var constState = 'stateChangeHandler';
					var constLanguage = '.uno:LanguageStatus';
					var constPageHeader = '.uno:InsertPageHeader';
					var constPageFooter = '.uno:InsertPageFooter';
					var unoCommand = $(aItem).data(constUno);
					var itemState = self._map[constState].getItemValue(unoCommand);
					if (itemState === 'disabled') {
						if (unoCommand.startsWith('.uno:Paste')) {
							window.app.console.log('do not disable paste based on server side data');
						} else {
							$(aItem).addClass('disabled');
						}
					} else {
						$(aItem).removeClass('disabled');
					}
					if (unoCommand.startsWith(constLanguage)) {
						unoCommand = constLanguage;
						languageAndCode = self._map[constState].getItemValue(unoCommand);
						lang = languageAndCode.split(';')[0];
						data = decodeURIComponent($(aItem).data(constUno));
						if (data.indexOf(lang) !== -1) {
							$(aItem).addClass(constChecked);
						} else if (data.indexOf('LANGUAGE_NONE') !== -1 && lang === '[None]') {
							$(aItem).addClass(constChecked);
						} else {
							$(aItem).removeClass(constChecked);
						}
					}
					else if (unoCommand.startsWith(constPageHeader)) {
						unoCommand = constPageHeader;
						self._checkedMenu(unoCommand, this);
					}
					else if (unoCommand.startsWith(constPageFooter)) {
						unoCommand = constPageFooter;
						self._checkedMenu(unoCommand, this);
					}
					else if (itemState === 'true') {
						$(aItem).addClass(constChecked);
					} else {
						$(aItem).removeClass(constChecked);
					}
				} else if (type === 'action') { // enable all except fullscreen on windows
					if (id === 'fullscreen') { // Full screen works weirdly on IE 11 and on Edge
						if (L.Browser.ie || L.Browser.edge) {
							$(aItem).addClass('disabled');
							var index = self.options.allowedViewModeActions.indexOf('fullscreen');
							if (index > 0) {
								self.options.allowedViewModeActions.splice(index, 1);
							}
						} else if (self._map.uiManager.isFullscreen()) {
							$(aItem).addClass(constChecked);
						} else {
							$(aItem).removeClass(constChecked);
						}
					} else if (id === 'showruler') {
						if (self._map.uiManager.isRulerVisible()) {
							$(aItem).addClass(constChecked);
						} else {
							$(aItem).removeClass(constChecked);
						}

					} else if (id === 'showstatusbar') {
						if (self._map.uiManager.isStatusBarVisible()) {
							$(aItem).addClass(constChecked);
						} else {
							$(aItem).removeClass(constChecked);
						}

					} else if (id === 'toggleuimode') {
						if (self._map.uiManager.shouldUseNotebookbarMode()) {
							$(aItem).text(_('Use Compact view'));
						} else {
							$(aItem).text(_('Use Tabbed view'));
						}

					} else if (self._map.getDocType() === 'presentation' && (id === 'deletepage' || id === 'insertpage' || id === 'duplicatepage')) {
						if (id === 'deletepage') {
							itemState = self._map['stateChangeHandler'].getItemValue('.uno:DeletePage');
						} else if (id === 'insertpage') {
							itemState = self._map['stateChangeHandler'].getItemValue('.uno:InsertPage');
						} else {
							itemState = self._map['stateChangeHandler'].getItemValue('.uno:DuplicatePage');
						}
						if (itemState === 'disabled') {
							$(aItem).addClass('disabled');
						} else {
							$(aItem).removeClass('disabled');
						}
					} else if (id === 'showresolved') {
						var section = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name);
						if (section) {
							if (section.sectionProperties.commentList.length === 0) {
								$(aItem).addClass('disabled');
							} else if (section.sectionProperties.showResolved) {
								$(aItem).removeClass('disabled');
								$(aItem).addClass(constChecked);
							} else {
								$(aItem).removeClass('disabled');
								$(aItem).removeClass(constChecked);
							}
						}
					} else {
						$(aItem).removeClass('disabled');
					}
				}
				if (id && id.indexOf('zotero') >= 0) {
					if (window.zoteroEnabled && self._map.zotero)
						$(aItem).show();
					else
						$(aItem).hide();
				}
			} else { // eslint-disable-next-line no-lonely-if
				if (type === 'unocommand') { // disable all uno commands
					$(aItem).addClass('disabled');
					aItem.title = _('Read-only mode');
				} else if (type === 'action') { // disable all except allowedViewModeActions
					var found = false;
					for (var i in self.options.allowedViewModeActions) {
						if (self.options.allowedViewModeActions[i] === id) {
							found = true;
							break;
						}
					}
					if (id === 'insertcomment' && self._map.getDocType() !== 'drawing')
						found = false;
					if (!found) {
						$(aItem).addClass('disabled');
						aItem.title = _('Read-only mode');
					} else {
						$(aItem).removeClass('disabled');
					}
				}
			}
		});
	},

	_openInsertShapesWizard: function() {
		var content = window.createShapesPanel('insertshapes');
		var data = {
			id: 'insertshape',
			type: '',
			text: _('Insert Shape'),
			enabled: true,
			children: []
		};

		var container = {
			id: '',
			type: 'htmlcontrol',
			content: content,
			enabled: true
		};

		data.children.push(container);
		this._map._docLayer._openMobileWizard(data);
	},

	_executeAction: function(itNode, itWizard) {
		var id, postmessage, type;
		if (itNode === undefined)
		{ // called from JSDialogBuilder
			id = itWizard.id;
			postmessage = false;
		}
		else
		{ // called from
			id = $(itNode).data('id');
			type = $(itNode).data('type');
			postmessage = ($(itNode).data('postmessage') === 'true');
		}

		if (id === 'save') {
			// Save only when not read-only.
			if (!this._map.isReadOnlyMode()) {
				this._map.fire('postMessage', {msgId: 'UI_Save', args: { source: 'filemenu' }});

				if (!this._map._disableDefaultAction['UI_Save']) {
					this._map.save(false, false);
				}
			}
		} else if (id === 'saveas' && type !== 'menu') { // jsdialog has no type='action'
			this._map.openSaveAs();
		} else if (id === 'savecomments') {
			if (this._map.isPermissionEditForComments()) {
				this._map.fire('postMessage', {msgId: 'UI_Save'});
				if (!this._map._disableDefaultAction['UI_Save']) {
					this._map.save(false, false);
				}
			}
		} else if (id === 'shareas' || id === 'ShareAs') {
			this._map.dispatch('shareas');
		} else if (id === 'print') {
			this._map.print();
		} else if (id.startsWith('downloadas-')
			|| id.startsWith('saveas-')
			|| id.startsWith('export')
			|| id.startsWith('zotero')
			|| id === 'deletepage'
			|| id === 'remotelink') {
			this._map.dispatch(id);
		} else if (id === 'signdocument') {
			this._map.showSignDocument();
		} else if (id === 'insertcomment') {
			this._map.insertComment();
		} else if (id === 'insertgraphic') {
			L.DomUtil.get('insertgraphic').click();
		} else if (id === 'insertgraphicremote') {
			this._map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
		} else if (id === 'selectbackground') {
			L.DomUtil.get('selectbackground').click();
		} else if (id === 'zoomin' && this._map.getZoom() < this._map.getMaxZoom()) {
			this._map.zoomIn(1, null, true /* animate? */);
		} else if (id === 'showresolved') {
			this._map.showResolvedComments(!$(itNode).hasClass('lo-menu-item-checked'));
		} else if (id === 'zoomout' && this._map.getZoom() > this._map.getMinZoom()) {
			this._map.zoomOut(1, null, true /* animate? */);
		} else if (id === 'zoomreset') {
			this._map.setZoom(this._map.options.zoom);
		} else if (id === 'fullscreen') {
			L.toggleFullScreen();
		} else if (id === 'showruler') {
			this._map.uiManager.toggleRuler();
		} else if (id === 'toggleuimode') {
			if (this._map.uiManager.shouldUseNotebookbarMode()) {
				this._map.uiManager.onChangeUIMode({mode: 'classic', force: true});
			} else {
				this._map.uiManager.onChangeUIMode({mode: 'notebookbar', force: true});
			}
		} else if (id === 'showstatusbar') {
			this._map.uiManager.toggleStatusBar();
		} else if (id === 'fullscreen-presentation' && this._map.getDocType() === 'presentation') {
			this._map.fire('fullscreen');
		} else if (id === 'presentation-currentslide' && this._map.getDocType() === 'presentation') {
			this._map.fire('fullscreen', {startSlideNumber: this._map.getCurrentPartNumber()});
		} else if (id === 'insertpage') {
			this._map.insertPage();
		} else if (id === 'insertshape') {
			this._openInsertShapesWizard();
		} else if (id === 'duplicatepage') {
			this._map.duplicatePage();
		} else if (id === 'about') {
			this._map.showLOAboutDialog();
		} else if (id === 'latestupdates' && this._map.welcome) {
			this._map.welcome.showWelcomeDialog();
		} else if (id === 'feedback' && this._map.feedback) {
			this._map.feedback.showFeedbackDialog();
		} else if (id === 'report-an-issue') {
			window.open('https://github.com/CollaboraOnline/online/issues', '_blank');
		} else if (id === 'forum') {
			window.open('https://forum.collaboraonline.com', '_blank');
		} else if (id === 'inserthyperlink') {
			this._map.dispatch('hyperlinkdialog');
		} else if (id === 'keyboard-shortcuts' || id === 'online-help') {
			this._map.showHelp(id);
		} else if (L.Params.revHistoryEnabled && (id === 'rev-history' || id === 'Rev-History' || id === 'last-mod')) {
			this._map.dispatch('rev-history');
		} else if (id === 'closedocument') {
			window.onClose();
		} else if (id === 'repair') {
			app.socket.sendMessage('commandvalues command=.uno:DocumentRepair');
		} else if (id === 'searchdialog') {
			if (this._map.isReadOnlyMode()) {
				$('#toolbar-down').hide();
				$('#toolbar-search').show();
				$('#mobile-edit-button').hide();
				L.DomUtil.get('search-input').focus();
			} else {
				this._map.sendUnoCommand('.uno:SearchDialog');
			}
		} else if (id === 'inserttextbox') {
			this._map.sendUnoCommand('.uno:Text?CreateDirectly:bool=true');
		} else if (id === 'pagesetup') {
			this._map.sendUnoCommand('.uno:SidebarShow');
			this._map.sendUnoCommand('.uno:LOKSidebarWriterPage');
			this._map.fire('showwizardsidebar', {noRefresh: true});
			window.pageMobileWizard = true;
		} else if (id.indexOf('morelanguages-') != -1) {
			this._map.fire('morelanguages', { applyto: id.substr('morelanguages-'.length) });
		}
		// Inform the host if asked
		if (postmessage)
			this._map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: id} });
	},

	_sendCommand: function (item) {
		var unoCommand = $(item).data('uno');
		if (unoCommand.startsWith('.uno:InsertPageHeader') || unoCommand.startsWith('.uno:InsertPageFooter')) {
			unoCommand = unoCommand + ($(item).hasClass('lo-menu-item-checked') ? 'On:bool=false' : 'On:bool=true');
		}
		else if (unoCommand.startsWith('.uno:SlideMasterPage')) {
			// Toggle between showing master page and closing it.
			unoCommand = ($(item).hasClass('lo-menu-item-checked') ? '.uno:CloseMasterView' : '.uno:SlideMasterPage');
		}
		else if (this._map._clip && this._map._clip.filterExecCopyPaste(unoCommand)) {
			return;
		}

		this._map.sendUnoCommand(unoCommand);
	},

	_onItemSelected: function(e, item) {
		// TODO: Find a way to disable click/select events for locked elements in disableLockedItem
		if ($(item).data('locked') === true)
			return;

		var self = e.data.self;
		var type = $(item).data('type');
		if (type === 'unocommand') {
			self._sendCommand(item);
		} else if (type === 'action') {
			self._executeAction(item);
		}

		if (!window.mode.isMobile() && $(item).data('id') !== 'insertcomment' && self && self._map)
			self._map.focus();
	},

	_onKeyDown: function(e) {
		var self = e.data.self;

		// handle help - F1
		if (e.type === 'keydown' && !e.shiftKey && !e.ctrlKey && !e.altKey && e.keyCode == 112) {
			self._map.showHelp('online-help');
		}
	},

	_createFileIcon: function() {
		var iconClass = 'document-logo';
		var docType = this._map.getDocType();
		if (docType === 'text') {
			iconClass += ' writer-icon-img';
		} else if (docType === 'spreadsheet') {
			iconClass += ' calc-icon-img';
		} else if (docType === 'presentation') {
			iconClass += ' impress-icon-img';
		} else if (docType === 'drawing') {
			iconClass += ' draw-icon-img';
		}
		$('.main-nav').addClass(docType + '-color-indicator');

		var liItem = L.DomUtil.create('li', '');
		liItem.id = 'document-header';
		liItem.setAttribute('role', 'menuitem');
		var aItem = L.DomUtil.create('div', iconClass, liItem);
		$(aItem).data('id', 'document-logo');
		$(aItem).data('type', 'action');
		aItem.setAttribute('role', 'img');
		aItem.setAttribute('aria-label', _('file type icon'));

		this._menubarCont.insertBefore(liItem, this._menubarCont.firstChild);

		var $docLogo = $(aItem);
		$docLogo.bind('click', {self: this}, this._createDocument);

	},

	_checkItemVisibility: function(menuItem) {
		if (window.ThisIsAMobileApp && menuItem.mobileapp === false) {
			return false;
		}
		if (window.ThisIsTheiOSApp && menuItem.iosapp === false) {
			return false;
		}
		if (menuItem.id === 'about' && (L.DomUtil.get('about-dialog') === null)) {
			return false;
		}
		if (menuItem.id === 'signdocument' && (L.DomUtil.get('document-signing-bar') === null)) {
			return false;
		}
		if (menuItem.id === 'fontworkgalleryfloater' && !this._isFileODF) {
			return false;
		}
		if (this._map.isReadOnlyMode() && menuItem.type === 'menu') {
			var found = false;
			for (var j in this.options.allowedReadonlyMenus) {
				if (this.options.allowedReadonlyMenus[j] === menuItem.id) {
					found = true;
					break;
				}
			}
			if (!found)
				return false;
		}
		if (this._map.isReadOnlyMode()) {
			switch (menuItem.id) {
			case 'last-mod':
			case 'save':
			case 'runmacro':
			case 'pagesetup':
			case 'watermark':
			case 'properties':
			case 'formattingmarks':
				return false;
			case 'insertcomment':
			case 'savecomments':
				if (!this._map.isPermissionEditForComments()) {
					return false;
				}
			}
		}

		if (this._map.isEditMode()) {
			switch (menuItem.id) {
			case 'savecomments':
				return false;
			}
		}

		if (menuItem.id === 'runmacro' && window.enableMacrosExecution === 'false')
			return false;

		if (menuItem.type === 'action') {
			if (((menuItem.id === 'rev-history' || menuItem.id === 'Rev-History') && !L.Params.revHistoryEnabled) ||
				(menuItem.id === 'closedocument' && !L.Params.closeButtonEnabled) ||
				(menuItem.id === 'latestupdates' && !window.enableWelcomeMessage)) {
				return false;
			}
		}

		if (menuItem.id === 'print' && this._map['wopi'].HidePrintOption)
			return false;

		if (menuItem.id === 'save' && this._map['wopi'].HideSaveOption)
			return false;

		if (menuItem.id && (menuItem.id === 'saveas' || menuItem.id.startsWith('saveas-')) && this._map['wopi'].UserCanNotWriteRelative)
			return false;

		if (menuItem.id && (menuItem.id.startsWith('exportas')) && this._map['wopi'].UserCanNotWriteRelative)
			return false;

		if ((menuItem.id === 'shareas' || menuItem.id === 'ShareAs') && !this._map['wopi'].EnableShare)
			return false;

		if (menuItem.id === 'insertgraphicremote' && !this._map['wopi'].EnableInsertRemoteImage)
			return false;

		if (menuItem.id && menuItem.id.startsWith('fullscreen-presentation') && this._map['wopi'].HideExportOption)
			return false;

		if (menuItem.id === 'repair' && this._map['wopi'].HideRepairOption)
			return false;

		if (menuItem.id === 'changesmenu' && this._map['wopi'].HideChangeTrackingControls)
			return false;


		// Keep track of all 'downloadas-' options and register them as
		// export formats with docLayer which can then be publicly accessed unlike
		// this Menubar control for which there doesn't seem to be any easy way
		// to get access to.
		if (menuItem.id && menuItem.id.startsWith('downloadas-')) {
			var format = menuItem.id.substring('downloadas-'.length);
			this._map._docLayer.registerExportFormat(menuItem.name, format);

			if (this._map['wopi'].HideExportOption)
				return false;
		}

		if (menuItem.id && menuItem.id.startsWith('export')) {
			if (!menuItem.id.startsWith('exportas-')) {
				var format = menuItem.id.substring('export'.length);
				this._map._docLayer.registerExportFormat(menuItem.name, format);
			}

			if (this._map['wopi'].HideExportOption)
				return false;
		}

		if (this._hiddenItems &&
		    $.inArray(menuItem.id, this._hiddenItems) !== -1)
			return false;

		return true;
	},

	_createMenu: function(menu) {
		var itemList = [];
		var docType = this._map.getDocType();
		var isReadOnly = this._map.isReadOnlyMode();

		if (isReadOnly && !app.file.editComment) {
			this._hiddenItems.push('insert');
		}
		for (var i in menu) {
			if (this._checkItemVisibility(menu[i]) === false)
				continue;

			var liItem = L.DomUtil.create('li', '');
			liItem.setAttribute('role', 'menuitem');
			if (menu[i].id) {
				liItem.id = 'menu-' + menu[i].id;
				if (menu[i].id === 'closedocument' && this._map.isReadOnlyMode()) {
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
				aItem.tabIndex = 0;
			} else if (menu[i].type === 'unocommand' || menu[i].uno !== undefined) {
				$(aItem).data('type', 'unocommand');
				$(aItem).data('uno', menu[i].uno);
				$(aItem).data('tag', menu[i].tag);
				aItem.tabIndex = 0;
			} else if (menu[i].type === 'separator') {
				$(aItem).addClass('separator');
				aItem.tabIndex = -1;
			} else if (menu[i].type === 'action') {
				if (menu[i].id == 'feedback' && !this._map.feedback)
					continue;
				$(aItem).data('type', 'action');
				$(aItem).data('id', menu[i].id);
				aItem.tabIndex = 0;
			}

			if (menu[i].hidden == true)
				$(aItem).css('display', 'none');

			if (menu[i].tablet == false && window.mode.isTablet()) {
				$(aItem).css('display', 'none');
			}

			if (this._hiddenItems && $.inArray(menu[i].id, this._hiddenItems) !== -1) {
				$(aItem).css('display', 'none');
			}

			this._map.hideRestrictedItems(menu[i], aItem, aItem);
			this._map.disableLockedItem(menu[i], aItem, aItem);
			itemList.push(liItem);
		}

		return itemList;
	},

	_getItems: function() {
		return $(this._menubarCont).children().children('ul').children('li').add($(this._menubarCont).children('li'));
	},

	_getItem: function(targetId) {
		var items = this._getItems();
		var found = $(items).filter(function() {
			var item = this;
			var id = $(item).attr('id');
			if (id && id == 'menu-' + targetId) {
				return true;
			}
			return false;
		});
		return found.length ? found : null;
	},

	hasItem: function(targetId) {
		return this._getItem(targetId) != null;
	},

	hideItem: function(targetId) {
		var item = this._getItem(targetId);
		if (item) {
			if ($.inArray(targetId, this._hiddenItems) == -1)
				this._hiddenItems.push(targetId);
			$(item).css('display', 'none');
		}
	},

	showItem: function(targetId) {
		var item = this._getItem(targetId);
		if (item) {
			if ($.inArray(targetId, this._hiddenItems) !== -1)
				this._hiddenItems.splice(this._hiddenItems.indexOf(targetId), 1);
			$(item).css('display', '');
		}
	},

	_initializeMenu: function(menu) {
		this._isFileODF = L.LOUtil.isFileODF(this._map);
		var menuHtml = this._createMenu(menu);
		for (var i in menuHtml) {
			this._menubarCont.appendChild(menuHtml[i]);
		}
	},

	generateFullMenuStructure: function() {
		var topMenu = {
			type : 'menubar',
			enabled : true,
			id : 'menubar',
			children : []
		};
		var docType = this._map.getDocType();
		var items = this.options['mobile' + docType];

		for (var i = 0; i < items.length; i++) {
			if (this._checkItemVisibility(items[i]) === true) {
				var item = this._generateMenuStructure(items[i], docType, false);
				if (item)
					topMenu.children.push(item);
			}
		}
		return topMenu;
	},

	generateInsertMenuStructure: function() {
		var docType = this._map.getDocType();
		var target = this.options['mobileInsertMenu'][docType];

		var menuStructure = this._generateMenuStructure(target, docType, true);
		return menuStructure;
	},

	_generateMenuStructure: function(item, docType, mainMenu) {
		var itemType;
		if (mainMenu) {
			itemType = 'mainmenu';
		} else {
			if (item.mobileapp == true && !window.ThisIsAMobileApp)
				return undefined;
			if (item.mobileapp === false && window.ThisIsAMobileApp)
				return undefined;
			if (!item.menu) {
				itemType = 'menuitem';
			} else {
				itemType = 'submenu';
			}
		}

		if (item.id === 'feedback' && !this._map.feedback)
			return undefined;

		var itemName;
		if (item.name)
			itemName = item.name;
		else if (item.uno)
			itemName = _UNO(item.uno, docType);
		else
			return undefined; // separator

		var menuStructure = {
			id : item.id,
			type : itemType,
			enabled : !item.disabled,
			text : itemName,
			command : item.uno,
			executionType : item.type,
			data : item,
			children : []
		};

		// Checked state for insert header / footer
		var insertHeaderString = '.uno:InsertPageHeader?PageStyle:string=';
		var insertFooterString = '.uno:InsertPageFooter?PageStyle:string=';
		if (item.uno && (item.uno.startsWith(insertHeaderString) || item.uno.startsWith(insertFooterString))) {
			var style = decodeURIComponent(item.uno.slice(item.uno.search('=') + 1));
			style = style.slice(0, style.length - 1);
			var shortUno = item.uno.slice(0, item.uno.search('\\?'));
			var state = this._map['stateChangeHandler'].getItemValue(shortUno);
			if (state && state[style]) {
				menuStructure['checked'] = true;
			}
		} else if (item.uno === '.uno:TrackChanges' ||
			item.uno === '.uno:ShowTrackedChanges' ||
			item.uno === '.uno:ControlCodes' ||
			item.uno === '.uno:SpellOnline' ||
			item.uno === '.uno:ShowResolvedAnnotations' ||
			item.uno === '.uno:FreezePanes') {
			if (this._map['stateChangeHandler'].getItemValue(item.uno) === 'true') {
				menuStructure['checked'] = true;
			}
		}

		if (item.menu)
		{
			for (var i = 0; i < item.menu.length; i++) {
				if (this._checkItemVisibility(item.menu[i]) === true) {
					var element = this._generateMenuStructure(item.menu[i], docType, false);
					if (element)
						menuStructure['children'].push(element);
				}
			}
		}
		return menuStructure;
	},

	_findSubMenuByName: function(menuTarget, nameString) {
		if (menuTarget.name === nameString)
			return menuTarget;

		if (menuTarget.menu)
		{
			for (var i = 0; i < menuTarget.menu.length; i++) {
				var foundItem = this._findSubMenuByName(menuTarget.menu[i], nameString);
				if (foundItem)
					return foundItem;
			}
		}
		return null;
	},
});

L.control.menubar = function (options) {
	return new L.Control.Menubar(options);
};
