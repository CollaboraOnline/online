/* -*- js-indent-level: 8 -*- */
/*
* Control.Menubar
*/

/* global $ _ _UNO vex L */
L.Control.Menubar = L.Control.extend({
	// TODO: Some mechanism to stop the need to copy duplicate menus (eg. Help)
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
				{name: _UNO('.uno:Save', 'text'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'text'), id: 'saveas', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'text'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
					{name: _('Word 2003 Document (.doc)'), id: 'downloadas-doc', type: 'action'},
					{name: _('Word Document (.docx)'), id: 'downloadas-docx', type: 'action'},
					{name: _('Rich Text (.rtf)'), id: 'downloadas-rtf', type: 'action'},
					{name: _('EPUB (.epub)'), id: 'downloadas-epub', type: 'action'}]},
				{name: _('Sign document'), id: 'signdocument', type: 'action'},
				{type: 'separator'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'text'), id: 'editmenu', type: 'menu', menu: [
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
			{name: _UNO('.uno:ViewMenu', 'text'), id: 'view', type: 'menu', menu: [
				{name: _UNO('.uno:FullScreen', 'text'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:ZoomPlus', 'text'), id: 'zoomin', type: 'action'},
				{name: _UNO('.uno:ZoomMinus', 'text'), id: 'zoomout', type: 'action',},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				{name: _('Show Ruler'), id: 'showruler', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:ControlCodes'},
				{type: 'separator'},
				{name: _UNO('.uno:ShowResolvedAnnotations', 'text'), id: 'showresolved', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Sidebar'},
			]
			},
			{name: _UNO('.uno:InsertMenu', 'text'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'text'), id: 'insertgraphicremote', type: 'action'},
				{name: _UNO('.uno:InsertAnnotation', 'text'), id: 'insertcomment', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{type: 'separator'},
				{uno: '.uno:InsertSection', id: 'insertsection'},
				{name: _UNO('.uno:InsertField', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertPageNumberField'},
					{uno: '.uno:InsertPageCountField'},
					{uno: '.uno:InsertDateField'},
					{uno: '.uno:InsertTimeField'},
					{uno: '.uno:InsertTitleField'},
					{uno: '.uno:InsertAuthorField'},
					{uno: '.uno:InsertTopicField'}
				]},
				{name: _UNO('.uno:InsertHeaderFooterMenu', 'text'), type: 'menu', menu: [
					{name: _UNO('.uno:InsertPageHeader', 'text'), type: 'menu', menu: [
						{name: _('All'), disabled: true, id: 'insertheader', tag: '_ALL_', uno: '.uno:InsertPageHeader?'}]},
					{name: _UNO('.uno:InsertPageFooter', 'text'), type: 'menu', menu: [
						{name: _('All'), disabled: true, id: 'insertfooter', tag: '_ALL_', uno: '.uno:InsertPageFooter?'}]}
				]},
				{uno: '.uno:InsertFootnote'},
				{uno: '.uno:InsertEndnote'},
				{type: 'separator'},
				{uno: '.uno:InsertPagebreak'},
				{name: _UNO('.uno:InsertColumnBreak', 'spreadsheet'), uno: '.uno:InsertColumnBreak'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{uno: '.uno:InsertSymbol'},
				{name: _UNO('.uno:FormattingMarkMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertNonBreakingSpace'},
					{uno: '.uno:InsertHardHyphen'},
					{uno: '.uno:InsertSoftHyphen'},
					{uno: '.uno:InsertZWSP'},
					{uno: '.uno:InsertZWNBSP'},
					{uno: '.uno:InsertLRM'},
					{uno: '.uno:InsertRLM'}]},
				{name: _UNO('.uno:IndexesMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:InsertIndexesEntry'},
					{uno: '.uno:InsertAuthoritiesEntry'},
					{uno: '.uno:InsertMultiIndex'}]},
			]},
			{name: _UNO('.uno:FormatMenu', 'text'), id: 'format', type: 'menu', menu: [
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
				{uno: '.uno:EditRegion'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'},
				{type: 'separator'},
				{uno: '.uno:Watermark'},
				{type: 'separator'},
				{uno: '.uno:FormatColumns'},
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
				{uno: '.uno:ThesaurusDialog'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _UNO('.uno:SetLanguageSelectionMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'noneselection', uno: '.uno:LanguageStatus?Language:string=Current_LANGUAGE_NONE'}]},
					{name: _UNO('.uno:SetLanguageParagraphMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'noneparagraph', uno: '.uno:LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE'}]},
					{name: _UNO('.uno:SetLanguageAllTextMenu', 'text'), type: 'menu', menu: [
						{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
				]},
				{uno: '.uno:WordCountDialog'},
				{type: 'separator'},
				{name: _UNO('.uno:AutoFormatMenu', 'text'), type: 'menu', menu: [
					{uno: '.uno:OnlineAutoFormat'}]}
			]},
			{name: _UNO('.uno:HelpMenu', 'text'), id: 'help', type: 'menu', menu: [
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		presentation: [
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'presentation'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'presentation'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
					{name: _('PowerPoint 2003 Presentation (.ppt)'), id: 'downloadas-ppt', type: 'action'},
					{name: _('PowerPoint Presentation (.pptx)'), id: 'downloadas-pptx', type: 'action'}]},
				{type: 'separator'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'presentation'), id: 'editmenu', type: 'menu', menu: [
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
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:SlideMasterPage'},
				{type: 'separator'},
				{uno: '.uno:ModifyPage'},
				{uno: '.uno:SlideChangeWindow'},
				{uno: '.uno:CustomAnimation'},
				{uno: '.uno:MasterSlidesPanel'},
				{type: 'separator'},
				{uno: '.uno:Sidebar'}]
			},
			{name: _UNO('.uno:InsertMenu', 'presentation'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'presentation'), id: 'insertgraphicremote', type: 'action'},
				{name: _UNO('.uno:SelectBackground', 'presentation'), id: 'selectbackground', type: 'action'},
				{name: _UNO('.uno:InsertAnnotation', 'presentation'), id: 'insertcomment', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:InsertSymbol'},
				{type: 'separator'},
				{uno: '.uno:HeaderAndFooter'}]
			},
			{name: _UNO('.uno:FormatMenu', 'presentation'), id: 'format', type: 'menu', menu: [
				{uno: '.uno:FontDialog'},
				{uno: '.uno:ParagraphDialog'},
				{uno: '.uno:PageSetup'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'},
				{type: 'separator'},
				{uno: '.uno:OutlineBullet'}]
			},
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
				{uno: '.uno:SpellDialog'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
			]},
			{name: _UNO('.uno:HelpMenu', 'presentation'), id: 'help', type: 'menu', menu: [
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		spreadsheet: [
			{name: _UNO('.uno:PickList', 'spreadsheet'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'spreadsheet'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'spreadsheet'), id: 'saveas', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'spreadsheet'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF spreadsheet (.ods)'), id: 'downloadas-ods', type: 'action'},
					{name: _('Excel 2003 Spreadsheet (.xls)'), id: 'downloadas-xls', type: 'action'},
					{name: _('Excel Spreadsheet (.xlsx)'), id: 'downloadas-xlsx', type: 'action'}]},
				{type: 'separator'},
				{name: _('Close document'), id: 'closedocument', type: 'action'}
			]},
			{name: _UNO('.uno:EditMenu', 'spreadsheet'), id: 'editmenu', type: 'menu', menu: [
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
				{name: _UNO('.uno:FullScreen', 'spreadsheet'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{uno: '.uno:Sidebar'},
			]},
			{name: _UNO('.uno:InsertMenu', 'spreadsheet'), id: 'insert', type: 'menu', menu: [
				{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
				{name: _UNO('.uno:InsertGraphic', 'spreadsheet'), id: 'insertgraphicremote', type: 'action'},
				{uno: '.uno:InsertObjectChart'},
				{name: _UNO('.uno:InsertAnnotation', 'spreadsheet'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
				{uno: '.uno:InsertSymbol'},
				{uno: '.uno:EditHeaderAndFooter'}
			]},
			{name: _UNO('.uno:FormatMenu', 'spreadsheet'), id: 'format', type: 'menu', menu: [
				{uno: '.uno:ResetAttributes'},
				{uno: '.uno:FormatCellDialog'},
				{uno: '.uno:PageFormatDialog'},
				{type: 'separator'},
				{uno: '.uno:TransformDialog'},
				{uno: '.uno:FormatLine'},
				{uno: '.uno:FormatArea'},
				{type: 'separator'},
				{name: _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'), type: 'menu', menu: [
					{uno: '.uno:ConditionalFormatDialog'},
					{uno: '.uno:ColorScaleFormatDialog'},
					{uno: '.uno:DataBarFormatDialog'},
					{uno: '.uno:IconSetFormatDialog'},
					{uno: '.uno:CondDateFormatDialog'},
					{type: 'separator'},
					{uno: '.uno:ConditionalFormatManagerDialog'}]},
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
				{uno: '.uno:Validation'},
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
				{uno: '.uno:SpellDialog'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]},
				{uno: '.uno:GoalSeekDialog'}
			]},
			{name: _UNO('.uno:HelpMenu', 'spreadsheet'), id: 'help', type: 'menu', menu: [
				{name: _('Online Help'), id: 'online-help', type: 'action', iosapp: false},
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action', iosapp: false},
				{name: _('Report an issue'), id: 'report-an-issue', type: 'action', iosapp: false},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Last modification'), id: 'last-mod', type: 'action', tablet: false}
		],

		mobiletext:  [
			{name: _UNO('.uno:PickList', 'text'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'text'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'text'), id: 'saveas', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'text'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Sign document'), id: 'signdocument', type: 'action'}
			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id: 'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
				{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
				{name: _('Word 2003 Document (.doc)'), id: 'downloadas-doc', type: 'action'},
				{name: _('Word Document (.docx)'), id: 'downloadas-docx', type: 'action'},
				{name: _('Rich Text (.rtf)'), id: 'downloadas-rtf', type: 'action'},
				{name: _('EPUB (.epub)'), id: 'downloadas-epub', type: 'action'}
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
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:ChangesMenu', 'text'), id: 'changesmenu', type: 'menu', menu: [
				{uno: '.uno:TrackChanges'},
				{uno: '.uno:ShowTrackedChanges'},
				{type: 'separator'},
				{uno: '.uno:AcceptAllTrackedChanges'},
				{uno: '.uno:RejectAllTrackedChanges'},
				{uno: '.uno:PreviousTrackedChange'},
				{uno: '.uno:NextTrackedChange'}
			]},
			{name: _('Page Setup'), id: 'pagesetup', type: 'menu', menu: [
				{name: _('Portrait'), id: 'setportrait', uno: '.uno:ToggleOrientation'},
				{name: _('Landscape'), id: 'setlandscape', uno: '.uno:ToggleOrientation'}
			]},
			{name: _UNO('.uno:ViewMenu', 'text'), id: 'view', type: 'menu', menu: [
				{uno: '.uno:ControlCodes'},
				{uno: '.uno:SpellOnline'},
				{name: _UNO('.uno:ShowResolvedAnnotations', 'text'), id: 'showresolved', type: 'action'},
			]
			},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobilepresentation: [
			{name: _UNO('.uno:PickList', 'presentation'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'presentation'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'presentation'), id: 'saveas', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'presentation'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
				{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
				{name: _('PowerPoint 2003 Presentation (.ppt)'), id: 'downloadas-ppt', type: 'action'},
				{name: _('PowerPoint Presentation (.pptx)'), id: 'downloadas-pptx', type: 'action'},
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
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:TableMenu', 'text'/*HACK should be 'presentation', but not in xcu*/), id: 'tablemenu', type: 'menu', menu: [
				{uno: '.uno:InsertRowsBefore'},
				{uno: '.uno:InsertRowsAfter'},
				{type: 'separator'},
				{uno: '.uno:InsertColumnsBefore'},
				{uno: '.uno:InsertColumnsAfter'},
				{uno: '.uno:DeleteRows'},
				{uno: '.uno:DeleteColumns'},
				{uno: '.uno:MergeCells'}]
			},
			{name: _UNO('.uno:SlideMenu', 'presentation'), id: 'slidemenu', type: 'menu', menu: [
				{name: _UNO('.uno:InsertSlide', 'presentation'), id: 'insertpage', type: 'action'},
				{name: _UNO('.uno:DuplicateSlide', 'presentation'), id: 'duplicatepage', type: 'action'},
				{name: _UNO('.uno:DeleteSlide', 'presentation'), id: 'deletepage', type: 'action'}]
			},
			{name: _UNO('.uno:FullScreen', 'presentation'), id: 'fullscreen', type: 'action', mobileapp: false},
			{uno: '.uno:SpellOnline'},
			{name: _('Fullscreen presentation'), id: 'fullscreen-presentation', type: 'action'},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobilespreadsheet: [
			{name: _UNO('.uno:PickList', 'spreadsheet'), id: 'file', type: 'menu', menu: [
				{name: _UNO('.uno:Save', 'spreadsheet'), id: 'save', type: 'action'},
				{name: _UNO('.uno:SaveAs', 'spreadsheet'), id: 'saveas', type: 'action'},
				{name: _('Share...'), id:'shareas', type: 'action'},
				{name: _UNO('.uno:Print', 'spreadsheet'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
			]},
			{name: !window.ThisIsAMobileApp ? _('Download as') : _('Export as'), id:'downloadas', type: 'menu', menu: [
				{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
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
			{name: _('Search'), id: 'searchdialog', type: 'action'},
			{name: _UNO('.uno:SheetMenu', 'spreadsheet'), id: 'sheetmenu', type: 'menu', menu: [
				{name: _UNO('.uno:InsertRowsMenu', 'spreadsheet'), id: 'insertrowsmenu', type: 'menu', menu: [
					{uno: '.uno:InsertRowsBefore'},
					{uno: '.uno:InsertRowsAfter'}]},
				{name: _UNO('.uno:InsertColumnsMenu', 'spreadsheet'), id: 'insertcolumnsmenu', type: 'menu', menu: [
					{uno: '.uno:InsertColumnsBefore'},
					{uno: '.uno:InsertColumnsAfter'}]},
				{name: _UNO('.uno:InsertBreakMenu', 'spreadsheet'), id: 'insertbreakmenu', type: 'menu', menu: [
					{uno: '.uno:InsertRowBreak'},
					{uno: '.uno:InsertColumnBreak'}]},
				{type: 'separator'},
				{uno: '.uno:DeleteRows'},
				{uno: '.uno:DeleteColumns'},
				{name: _UNO('.uno:DelBreakMenu', 'spreadsheet'), id: 'delbreakmenu', type: 'menu', menu: [
					{uno: '.uno:DeleteRowbreak'},
					{uno: '.uno:DeleteColumnbreak'}]}
			]},
			{name: _UNO('.uno:DataMenu', 'spreadsheet'), id: 'datamenu', type: 'menu', menu: [
				{uno: '.uno:DataSort'},
				{uno: '.uno:SortAscending'},
				{uno: '.uno:SortDescending'},
				{type: 'separator'},
				{uno: '.uno:DataFilterAutoFilter'},
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
			{name: _UNO('.uno:FullScreen', 'spreadsheet'), id: 'fullscreen', type: 'action', mobileapp: false},
			{name: _('About'), id: 'about', type: 'action'},
		],

		mobileInsertMenu : {
			text : {
				name: _UNO('.uno:InsertMenu', 'text'), id: 'insert', type: 'menu', menu: [
					{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
					{name: _UNO('.uno:InsertGraphic', 'text'), id: 'insertgraphicremote', type: 'action'},
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
					{name: _UNO('.uno:FormattingMarkMenu', 'text'), id: 'formattingmark', type: 'menu', menu: [
						{uno: '.uno:InsertNonBreakingSpace'},
						{uno: '.uno:InsertHardHyphen'},
						{uno: '.uno:InsertSoftHyphen'},
						{uno: '.uno:InsertZWSP'},
						{uno: '.uno:InsertZWNBSP'},
						{uno: '.uno:InsertLRM'},
						{uno: '.uno:InsertRLM'}]},
				]
			},
			spreadsheet : {
				name: _UNO('.uno:InsertMenu', 'spreadsheet'), id: 'insert', type: 'menu', menu: [
					{name: _('Local Image...'), id: 'insertgraphic', type: 'action'},
					{name: _UNO('.uno:InsertGraphic', 'spreadsheet'), id: 'insertgraphicremote', type: 'action'},
					{uno: '.uno:InsertObjectChart'},
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
					{name: _UNO('.uno:InsertAnnotation', 'presentation'), id: 'insertcomment', type: 'action'},
					{name: _UNO('.uno:TableMenu'), id: 'inserttable', type: 'action'},
					{name: _UNO('.uno:HyperlinkDialog'), id: 'inserthyperlink', type: 'action'},
					{name: _UNO('.uno:ShapesMenu'), id: 'insertshape', type: 'action'},
					{uno: '.uno:Text'},
					{name: _UNO('.uno:InsertField', 'text'), id: 'insertfield', type: 'menu', menu: [
						{uno: '.uno:InsertDateFieldFix'},
						{uno: '.uno:InsertDateFieldVar'},
						{uno: '.uno:InsertTimeFieldFix'},
						{uno: '.uno:InsertTimeFieldVar'},
					]},
				]
			}
		},

		commandStates: {},

		// Only these menu options will be visible in readonly mode
		allowedReadonlyMenus: ['file', 'downloadas', 'view', 'help'],

		allowedViewModeActions: [
			'shareas', 'print', // file menu
			'downloadas-pdf', 'downloadas-odt', 'downloadas-doc', 'downloadas-docx', 'downloadas-rtf', 'downloadas-epub', // file menu
			'downloadas-odp', 'downloadas-ppt', 'downloadas-pptx', 'print', // file menu
			'downloadas-ods', 'downloadas-xls', 'downloadas-xlsx', 'closedocument', // file menu
			'fullscreen', 'zoomin', 'zoomout', 'zoomreset', 'showresolved', // view menu
			'about', 'keyboard-shortcuts', 'online-help', 'report-an-issue' // help menu
		]
	},

	onAdd: function (map) {
		this._initialized = false;
		this._hiddenItems = [];
		this._menubarCont = L.DomUtil.get('main-menu');
		this._initializeMenu(this.options.initial);

		map.on('doclayerinit', this._onDocLayerInit, this);
		map.on('updatepermission', this._onRefresh, this);
		map.on('addmenu', this._addMenu, this);
		map.on('commandvalues', this._onInitMenu, this);
		map.on('updatetoolbarcommandvalues', this._onStyleMenu, this);
	},

	_addMenu: function (e) {
		var alreadyExists = L.DomUtil.get('menu-' + e.id);
		if (alreadyExists)
			return;

		var liItem = L.DomUtil.create('li', '');
		liItem.id = 'menu-' + e.id;
		if (this._map._permission === 'readonly') {
			L.DomUtil.addClass(liItem, 'readonly');
		}
		var aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(e.label);
		$(aItem).data('id', e.id);
		$(aItem).data('type', 'action');
		$(aItem).data('postmessage', 'true');
		this._menubarCont.insertBefore(liItem, this._menubarCont.firstChild);
	},

	_createUnoMenuItem: function (caption, command, tag) {
		var liItem, aItem;
		liItem = L.DomUtil.create('li', '');
		aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(caption);
		$(aItem).data('type', 'unocommand');
		$(aItem).data('uno', command);
		$(aItem).data('tag', tag);
		return liItem;
	},


	_onInitMenu: function (e) {
		if (e.commandName === '.uno:LanguageStatus' && L.Util.isArray(e.commandValues)) {
			var translated, neutral;
			var constDefa = 'Default_RESET_LANGUAGES';
			var constCurr = 'Current_RESET_LANGUAGES';
			var constPara = 'Paragraph_RESET_LANGUAGES';
			var constLang = '.uno:LanguageStatus?Language:string=';
			var resetLang = _('Reset to Default Language');
			var languages  = [];

			e.commandValues.forEach(function(language) {
				var split = language.split(';');
				language = split[0];
				var isoCode = '';
				if (split.length > 1)
					isoCode = split[1];
				languages.push({translated: _(language), neutral: language, iso: isoCode});
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
				$menuSelection.append(this._createUnoMenuItem(translated, constLang + encodeURIComponent('Current_' + neutral)));
				$menuParagraph.append(this._createUnoMenuItem(translated, constLang + encodeURIComponent('Paragraph_' + neutral)));
				$menuDefault.append(this._createUnoMenuItem(translated, constLang + encodeURIComponent('Default_' + neutral)));
			}
			$menuSelection.append(this._createMenu([{type: 'separator'}]));
			$menuParagraph.append(this._createMenu([{type: 'separator'}]));
			$menuDefault.append(this._createMenu([{type: 'separator'}]));
			$menuSelection.append(this._createUnoMenuItem(resetLang, constLang + constCurr));
			$menuParagraph.append(this._createUnoMenuItem(resetLang, constLang + constPara));
			$menuDefault.append(this._createUnoMenuItem(resetLang, constLang + constDefa));
		}
	},

	_onRefresh: function() {
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

		// The _createFileIcon function shows the Collabora logo in the iOS app case, no
		// need to delay that until the document has been made editable.
		if (window.ThisIsTheiOSApp || this._map._permission !== 'readonly') {
			this._createFileIcon();
		}
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
		$('#main-menu').bind('mouseenter.smapi', {self: this}, this._onMouseEnter);
		$('#main-menu').bind('mouseleave.smapi', {self: this}, this._onMouseLeave);

		$('#main-menu').bind('beforeshow.smapi', {self: this}, this._beforeShow);
		$('#main-menu').bind('click.smapi', {self: this}, this._onClicked);

		$('#main-menu').bind('keydown', {self: this}, this._onKeyDown);

		if (window.mode.isMobile())
			$('#main-menu').parent().css('height', '0');

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
						self._map.fire('closesidebar');
						if (!window.mode.isMobile()) {
							// Surely this code, if it really is related only to the hamburger menu,
							// will never be invoked on non-mobile browsers? I might be wrong though.
							// If you notice this logging, please modify this comment to indicate what is
							// going on.
							console.log('======> Assertion failed!? Not window.mode.isMobile()? Control.Menubar.js #1');
							$nav.css({height: 'initial', bottom: '38px'});
							$menu.hide().slideDown(250, function() { $menu.css('display', ''); });
							$('#mobile-wizard-header').show();
						} else {
							window.mobileMenuWizard = true;
							var menuData = self._map.menubar.generateFullMenuStructure();
							self._map.fire('mobilewizard', menuData);
							$('#toolbar-hamburger').removeClass('menuwizard-closed').addClass('menuwizard-opened');
							$('#mobile-wizard-header').hide();
						}
					} else if (!window.mode.isMobile()) {
						// Ditto.
						console.log('======> Assertion failed!? Not window.mode.isMobile()? Control.Menubar.js #2');
						$menu.show().slideUp(250, function() { $menu.css('display', ''); });
						$nav.css({height:'', bottom: ''});
					} else {
						window.mobileMenuWizard = false;
						self._map.fire('closemobilewizard');
						$('#toolbar-hamburger').removeClass('menuwizard-opened').addClass('menuwizard-closed');
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
		var items = $(menu).children().children('a').not('.has-submenu');
		$(items).each(function() {
			var aItem = this;
			var type = $(aItem).data('type');
			var id = $(aItem).data('id');
			var constChecked = 'lo-menu-item-checked';
			if (self._map._permission === 'edit') {
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
							console.log('dont disable paste based on server side data');
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
					if (id === 'fullscreen' && (L.Browser.ie || L.Browser.edge)) { // Full screen works weirdly on IE 11 and on Edge
						$(aItem).addClass('disabled');
						var index = self.options.allowedViewModeActions.indexOf('fullscreen');
						if (index > 0) {
							self.options.allowedViewModeActions.splice(index, 1);
						}
					} else if (id === 'showruler') {
						if (self._map.isRulerVisible()) {
							$(aItem).addClass(constChecked);
						} else {
							$(aItem).removeClass(constChecked);
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
						if (self._map._docLayer._annotations._items.length === 0) {
							$(aItem).addClass('disabled');
						} else if (self._map._docLayer._annotations._showResolved) {
							$(aItem).removeClass('disabled');
							$(aItem).addClass(constChecked);
						} else {
							$(aItem).removeClass('disabled');
							$(aItem).removeClass(constChecked);
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

	_openInsertShapesWizard: function() {
		var content = window.createShapesPanel();
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
		var id, postmessage;
		if (itNode === undefined)
		{ // called from JSDialogBuilder
			id = itWizard.id;
			postmessage = false;
		}
		else
		{ // called from
			id = $(itNode).data('id');
			postmessage = ($(itNode).data('postmessage') === 'true');
		}

		if (id === 'save') {
			// Save only when not read-only.
			if (this._map._permission !== 'readonly') {
				this._map.fire('postMessage', {msgId: 'UI_Save'});
				if (!this._map._disableDefaultAction['UI_Save']) {
					this._map.save(false, false);
				}
			}
		} else if (id === 'saveas') {
			this._map.fire('postMessage', {msgId: 'UI_SaveAs'});
		} else if (id === 'shareas') {
			this._map.fire('postMessage', {msgId: 'UI_Share'});
		} else if (id === 'print') {
			this._map.print();
		} else if (id.startsWith('downloadas-')) {
			var format = id.substring('downloadas-'.length);
			var fileName = this._map['wopi'].BaseFileName;
			fileName = fileName.substr(0, fileName.lastIndexOf('.'));
			fileName = fileName === '' ? 'document' : fileName;
			this._map.downloadAs(fileName + '.' + format, format);
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
			this._map.zoomIn(1);
		} else if (id === 'showresolved') {
			this._map.showResolvedComments(!$(itNode).hasClass('lo-menu-item-checked'));
		} else if (id === 'zoomout' && this._map.getZoom() > this._map.getMinZoom()) {
			this._map.zoomOut(1);
		} else if (id === 'zoomreset') {
			this._map.setZoom(this._map.options.zoom);
		} else if (id === 'fullscreen') {
			L.toggleFullScreen();
		} else if (id === 'showruler') {
			this._map.toggleRuler();
		} else if (id === 'fullscreen-presentation' && this._map.getDocType() === 'presentation') {
			this._map.fire('fullscreen');
		} else if (id === 'insertpage') {
			this._map.insertPage();
		} else if (id === 'insertshape') {
			this._openInsertShapesWizard();
		} else if (id === 'duplicatepage') {
			this._map.duplicatePage();
		} else if (id === 'deletepage') {
			var map = this._map;
			vex.dialog.confirm({
				message: _('Are you sure you want to delete this slide?'),
				buttons: [
					$.extend({}, vex.dialog.buttons.YES, { text: _('OK') }),
					$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
				],
				callback: function(e) {
					if (e) {
						map.deletePage();
					}
				}
			});
		} else if (id === 'about') {
			this._map.showLOAboutDialog();
		} else if (id === 'report-an-issue') {
			window.open('https://bugs.documentfoundation.org/enter_bug.cgi?product=LibreOffice%20Online', '_blank');
		} else if (id === 'inserthyperlink') {
			this._map.showHyperlinkDialog();
		} else if (id === 'keyboard-shortcuts' || id === 'online-help') {
			this._map.showHelp(id);
		} else if (L.Params.revHistoryEnabled && (id === 'rev-history' || id === 'last-mod')) {
			// if we are being loaded inside an iframe, ask
			// our host to show revision history mode
			this._map.fire('postMessage', {msgId: 'rev-history', args: {Deprecated: true}});
			this._map.fire('postMessage', {msgId: 'UI_FileVersions'});
		} else if (id === 'closedocument') {
			if (window.ThisIsAMobileApp) {
				window.postMobileMessage('BYE');
			} else {
				this._map.fire('postMessage', {msgId: 'close', args: {EverModified: this._map._everModified, Deprecated: true}});
				this._map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: this._map._everModified}});
			}
			if (!this._map._disableDefaultAction['UI_Close']) {
				this._map.remove();
			}
		} else if (id === 'repair') {
			this._map._socket.sendMessage('commandvalues command=.uno:DocumentRepair');
		} else if (id === 'searchdialog') {
			$('#toolbar-down').hide();
			$('#toolbar-search').show();
			$('#mobile-edit-button').hide();
			L.DomUtil.get('search-input').focus();
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
		var self = e.data.self;
		var type = $(item).data('type');
		if (type === 'unocommand') {
			self._sendCommand(item);
		} else if (type === 'action') {
			self._executeAction(item);
		}

		if (!window.mode.isMobile() && $(item).data('id') !== 'insertcomment')
			self._map.focus();
	},

	_onMouseEnter: function(e, item) {
		var self = e.data.self;
		var type = $(item).data('type');
		if (type === 'unocommand') {
			var unoCommand = $(item).data('uno');
			self._map.setHelpTarget(unoCommand);
		} else if (type === 'action') {
			var id = $(item).data('id');
			self._map.setHelpTarget('modules/online/menu/' + id);
		}
	},

	_onMouseLeave: function(e) {
		var self = e.data.self;
		self._map.setHelpTarget(null);
	},

	_onKeyDown: function(e) {
		var self = e.data.self;

		// handle help - F1
		if (e.type === 'keydown' && !e.shiftKey && !e.ctrlKey && !e.altKey && e.keyCode == 112) {
			self._map.showHelp();
		}
	},

	_createFileIcon: function() {
		var iconClass = 'document-logo';
		var docType = this._map.getDocType();
		if (docType === 'text') {
			iconClass += ' writer-icon-img';
		} else if (docType === 'spreadsheet') {
			iconClass += ' calc-icon-img';
		} else if (docType === 'presentation' || docType === 'drawing') {
			iconClass += ' impress-icon-img';
		}
		$('.main-nav').addClass(docType + '-color-indicator');
		$('#document-container').addClass(docType + '-doctype');

		var liItem = L.DomUtil.create('li', '');
		liItem.id = 'document-header';
		var aItem = L.DomUtil.create('div', iconClass, liItem);
		$(aItem).data('id', 'document-logo');
		$(aItem).data('type', 'action');

		this._menubarCont.insertBefore(liItem, this._menubarCont.firstChild);

		var $docLogo = $(aItem);
		$docLogo.bind('click', {self: this}, this._createDocument);

	},

	_checkItemVisibility: function(menuItem) {
		if (window.ThisIsTheiOSApp && menuItem.iosapp === false) {
			return false;
		}
		if (menuItem.id === 'about' && (L.DomUtil.get('about-dialog') === null)) {
			return false;
		}
		if (menuItem.id === 'signdocument' && (L.DomUtil.get('document-signing-bar') === null)) {
			return false;
		}
		if (menuItem.id === 'setportrait' && this._map['stateChangeHandler'].getItemValue('.uno:Orientation') === 'IsPortrait') {
			return false;
		}
		else if (menuItem.id === 'setlandscape' && this._map['stateChangeHandler'].getItemValue('.uno:Orientation') === 'IsLandscape') {
			return false;
		}
		if (this._map._permission === 'readonly' && menuItem.type === 'menu') {
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
		if (this._map._permission === 'readonly') {
			switch (menuItem.id) {
			case 'last-mod':
			case 'save':
				return false;
			}
		}

		if (menuItem.type === 'action') {
			if ((menuItem.id === 'rev-history' && !L.Params.revHistoryEnabled) ||
				(menuItem.id === 'closedocument' && !window.closebutton)) {
				return false;
			}
		}

		if (menuItem.id === 'print' && this._map['wopi'].HidePrintOption)
			return false;

		if (menuItem.id === 'save' && this._map['wopi'].HideSaveOption)
			return false;

		if (menuItem.id === 'saveas' && this._map['wopi'].UserCanNotWriteRelative)
			return false;

		if (menuItem.id === 'shareas' && !this._map['wopi'].EnableShare)
			return false;

		if (menuItem.id === 'insertgraphicremote' && !this._map['wopi'].EnableInsertRemoteImage)
			return false;

		if (menuItem.id && menuItem.id.startsWith('fullscreen-presentation') && this._map['wopi'].HideExportOption)
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

		if (this._hiddenItems &&
		    $.inArray(menuItem.id, this._hiddenItems) !== -1)
			return false;

		return true;
	},

	_createMenu: function(menu) {
		var itemList = [];
		var docType = this._map.getDocType();
		for (var i in menu) {
			if (this._checkItemVisibility(menu[i]) === false)
				continue;

			var liItem = L.DomUtil.create('li', '');
			if (menu[i].id) {
				liItem.id = 'menu-' + menu[i].id;
				if (menu[i].id === 'closedocument' && this._map._permission === 'readonly') {
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
				$(aItem).data('tag', menu[i].tag);
			} else if (menu[i].type === 'separator') {
				$(aItem).addClass('separator');
			} else if (menu[i].type === 'action') {
				$(aItem).data('type', 'action');
				$(aItem).data('id', menu[i].id);
			}

			if (menu[i].tablet == false && window.mode.isTablet()) {
				$(aItem).css('display', 'none');
			}

			if (this._hiddenItems && $.inArray(menu[i].id, this._hiddenItems) !== -1) {
				$(aItem).css('display', 'none');
			}

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
		} else if (item.uno === '.uno:TrackChanges' || item.uno === '.uno:ShowTrackedChanges') {
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
