/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarWriter
 */

/* global _ _UNO */
L.Control.NotebookbarWriter = L.Control.Notebookbar.extend({

	getTabs: function() {
		return [
			{
				'text': _('~File'),
				'id': '-1',
				'name': 'File',
			},
			{
				'text': _('Hom~e'),
				'id': this.HOME_TAB_ID,
				'name': 'Home',
				'context': 'default|Text|DrawText'
			},
			{
				'text': _('~Insert'),
				'id': '-4',
				'name': 'Insert'
			},
			{
				'text': _('~Layout'),
				'id': '-5',
				'name': 'Layout'
			},
			{
				'text': _('Reference~s'),
				'id': '-6',
				'name': 'References'
			},
			{
				'text': _('~Review'),
				'id': '-7',
				'name': 'Review'
			},
			{
				'text': _('F~ormat'),
				'id': '-3',
				'name': 'Format',
			},
			{
				'text': _('For~m'),
				'id': 'Form',
				'name': 'Form',
			},
			{
				'text': _('~Table'),
				'id': '-8',
				'name': 'Table',
				'context': 'Table'
			},
			{
				'text': _('Dra~w'),
				'id': '-9',
				'name': 'Draw',
				'context': 'Draw|DrawLine|3DObject|MultiObject|Graphic|DrawFontwork'
			},
			{
				'text': _('~View'),
				'id': 'View',
				'name': 'View',
			},
			{
				'text': _('~Help'),
				'id': '-2',
				'name': 'Help',
			}
		];
	},

	getFullJSON: function(selectedId) {
		return this.getNotebookbar(
			[
				this.getFileTab(),
				this.getHomeTab(),
				this.getInsertTab(),
				this.getLayoutTab(),
				this.getReferencesTab(),
				this.getReviewTab(),
				this.getFormatTab(),
				this.getFormTab(),
				this.getTableTab(),
				this.getDrawTab(),
				this.getViewTab(),
				this.getHelpTab()
			 ], selectedId);
	},

	getFileTab: function() {
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasRepair = !this._map['wopi'].HideRepairOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hasShare = this._map['wopi'].EnableShare;
		var hideDownload = this._map['wopi'].HideExportOption;
		var hasGroupedDownloadAs = !!window.groupDownloadAsForNb;
		var hasGroupedSaveAs = window.uiDefaults && window.uiDefaults.saveAsMode === 'group';
		var hasRunMacro = !(window.enableMacrosExecution  === 'false');
		var hasSave = !this._map['wopi'].HideSaveOption;
		var content = [];

		if (hasSave) {
			content.push({
				'type': 'toolbox',
				'children': [
					{
						'id': 'file-file-save',
						'type': 'bigtoolitem',
						'text': _('Save'),
						'command': '.uno:Save'
					}
				]
			});
		}

		if (hasSaveAs) {
			if (hasGroupedSaveAs) {
				content.push({
					'id': 'file-saveas',
					'type': 'bigmenubartoolitem',
					'text': _('Save As'),
				});
			} else {
				content.push({
					'id': 'file-file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'text'),
					'command': '.uno:SaveAs'
				});
			}
		}

		if (hasSaveAs) {
			content.push({
				'id': 'file-exportas',
				'type': 'bigmenubartoolitem',
				'text': _('Export As'),
			});
		}

		content = content.concat([
			{
				'type': 'container',
				'children': [
					hasShare ?
						{
							'id': 'file-ShareAs',
							'type': 'customtoolitem',
							'text': _('Share'),
							'command': 'shareas',
							'inlineLabel': true
						} : {},
					hasRevisionHistory ?
						{
							'id': 'file-Rev-History',
							'type': 'customtoolitem',
							'text': _('See history'),
							'command': 'rev-history',
							'inlineLabel': true
						} : {},
				],
				'vertical': 'true'
			},
			hasPrint ?
				{
					'id': 'file-print',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:Print', 'text'),
					'command': '.uno:Print'
				} : {},
			hasRunMacro ?
				{
					'type': 'toolbox',
					'children': [
						{
							'id': 'file-runmacro',
							'type': 'bigtoolitem',
							'text': _UNO('.uno:RunMacro', 'text'),
							'command': '.uno:RunMacro'
						}
					]
				} : {}
		]);

		if (hasGroupedDownloadAs && !hideDownload) {
			content.push({
				'id': 'downloadas',
				'type': 'bigmenubartoolitem',
				'text': _('Download')
			});
		} else if (!hideDownload) {
			content = content.concat([
				{
					'type': 'container',
					'children': [
						{
							'id': 'file-downloadas-odt',
							'type': 'menubartoolitem',
							'text': _('ODF Text Document (.odt)'),
							'command': ''
						},
						{
							'id': 'file-downloadas-rtf',
							'type': 'menubartoolitem',
							'text': _('Rich Text (.rtf)'),
							'command': ''
						},
					],
					'vertical': 'true'
				},
				{
					'type': 'container',
					'children': [
						{
							'id': 'file-downloadas-doc',
							'type': 'menubartoolitem',
							'text': _('Word 2003 Document (.doc)'),
							'command': ''
						},
						{
							'id': 'file-downloadas-docx',
							'type': 'menubartoolitem',
							'text': _('Word Document (.docx)'),
							'command': ''
						},
					],
					'vertical': 'true'
				},
				{
					'type': 'container',
					'children': [
						{
							'id': !window.ThisIsAMobileApp ? 'file-exportpdf' : 'file-downloadas-pdf',
							'type': 'customtoolitem',
							'text': _('PDF Document (.pdf)'),
							'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'inlineLabel': true
						},
						{
							'id': !window.ThisIsAMobileApp ? 'file-exportepub' : 'file-downloadas-epub',
							'type': 'customtoolitem',
							'text': _('EPUB Document (.epub)'),
							'command': !window.ThisIsAMobileApp ? 'exportepub' : 'downloadas-epub',
							'inlineLabel': true
						},
					],
					'vertical': 'true'
				}
			]);
		}

		content.push({
			'type': 'container',
			'children': [
				hasRepair? {
					'id': 'file-repair',
					'type': 'bigmenubartoolitem',
					'text': _('Repair'),
					'command': _('Repair')
				} : {},
			],
			'vertical': 'true'
		});

		content.push({
			'type': 'container',
			'children': [
				{
					'id': 'file-properties',
					'type': 'bigtoolitem',
					'text': _('Properties'),
					'command': '.uno:SetDocumentProperties'
				}
			]
		});

		return this.getTabPage('File', content);
	},

	getHelpTab: function() {
		var hasLatestUpdates = window.enableWelcomeMessage;
		var hasFeedback = this._map.feedback;
		var hasAccessibilityCheck = this._map.getDocType() === 'text';
		var hasAbout = L.DomUtil.get('about-dialog') !== null;

		var content = [
			{
				'id': 'Help-container',
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'help-forum',
								'type': 'bigtoolitem',
								'text': _('Forum'),
								'command': '.uno:ForumHelp'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'help-online-help',
								'type': 'bigtoolitem',
								'text': _('Online Help'),
								'command': '.uno:OnlineHelp'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'help-keyboard-shortcuts',
								'type': 'bigtoolitem',
								'text': _('Keyboard shortcuts'),
								'command': '.uno:KeyboardShortcuts'
							}
						]
					},
					hasAccessibilityCheck ?
						{
							'id': 'help-accessibility-check',
							'type': 'bigtoolitem',
							'text': _UNO('.uno:AccessibilityCheck', 'text'),
							'command': '.uno:AccessibilityCheck'
						} : {},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'help-report-an-issue',
								'type': 'bigtoolitem',
								'text': _('Report an issue'),
								'command': '.uno:ReportIssue'
							}
						]
					},
					hasLatestUpdates ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'help-latestupdates',
									'type': 'bigtoolitem',
									'text': _('Latest Updates'),
									'command': '.uno:LatestUpdates'
								}
							]
						} : {},
					hasFeedback ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'help-feedback',
									'type': 'bigtoolitem',
									'text': _('Send Feedback'),
									'command': '.uno:Feedback'
								}
							]
						} : {},
					hasAbout ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'help-about',
									'type': 'bigtoolitem',
									'text': _('About'),
									'command': '.uno:About'
								}
							]
						} : {}
				]
			}
		];

		return this.getTabPage('Help', content);
	},

	getHomeTab: function() {
		var content = [
			{
				'id': 'home-undo-redo',
				'type': 'container',
				'children': [
					{
						'id': 'home-undo',
						'type': 'toolitem',
						'text': _UNO('.uno:Undo'),
						'command': '.uno:Undo'
					},
					{
						'id': 'home-redo',
						'type': 'toolitem',
						'text': _UNO('.uno:Redo'),
						'command': '.uno:Redo'
					},
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Paste'),
				'command': '.uno:Paste'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-cut',
								'type': 'toolitem',
								'text': _UNO('.uno:Cut'),
								'command': '.uno:Cut'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FormatPaintbrush'),
								'command': '.uno:FormatPaintbrush'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-copy',
								'type': 'toolitem',
								'text': _UNO('.uno:Copy'),
								'command': '.uno:Copy'
							},
							{
								'id': 'home-resetattributes',
								'type': 'toolitem',
								'text': _UNO('.uno:ResetAttributes'),
								'command': '.uno:ResetAttributes'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'container',
						'children': [
							{
								'id': 'home-fontnamecombobox',
								'type': 'combobox',
								'text': 'Carlito',
								'entries': [
									'Carlito'
								],
								'selectedCount': '1',
								'selectedEntries': [
									'0'
								],
								'command': '.uno:CharFontName'
							},
							{
								'id': 'home-fontsize',
								'type': 'combobox',
								'text': '12 pt',
								'entries': [
									'12 pt'
								],
								'selectedCount': '1',
								'selectedEntries': [
									'0'
								],
								'command': '.uno:FontHeight'
							},
							{
								'id': 'home-grow',
								'type': 'toolitem',
								'text': _UNO('.uno:Grow'),
								'command': '.uno:Grow'
							},
							{
								'id': 'home-shrink',
								'type': 'toolitem',
								'text': _UNO('.uno:Shrink'),
								'command': '.uno:Shrink'
							}
						],
						'vertical': 'false'
					},
					{
						'type': 'container',
						'children': [
							{
								'type': 'toolbox',
								'children': [
									{
										'id': 'home-bold',
										'type': 'toolitem',
										'text': _UNO('.uno:Bold'),
										'command': '.uno:Bold'
									},
									{
										'id': 'home-italic',
										'type': 'toolitem',
										'text': _UNO('.uno:Italic'),
										'command': '.uno:Italic'
									},
									{
										'id': 'home-underline',
										'type': 'toolitem',
										'text': _UNO('.uno:Underline'),
										'command': '.uno:Underline'
									},
									{
										'id': 'home-strikeout',
										'type': 'toolitem',
										'text': _UNO('.uno:Strikeout'),
										'command': '.uno:Strikeout'
									},
									{
										'id': 'home-subscript',
										'type': 'toolitem',
										'text': _UNO('.uno:SubScript'),
										'command': '.uno:SubScript'
									},
									{
										'id': 'home-superscript',
										'type': 'toolitem',
										'text': _UNO('.uno:SuperScript'),
										'command': '.uno:SuperScript'
									},
									{
										'id': 'home-spacing',
										'type': 'toolitem',
										'text': _UNO('.uno:Spacing'),
										'command': '.uno:CharSpacing'
									},
									{
										'id': 'home-backcolor',
										'type': 'toolitem',
										'text': _UNO('.uno:BackColor', 'text'),
										'command': '.uno:BackColor'
									},
									{
										'id': 'home-color',
										'type': 'toolitem',
										'text': _UNO('.uno:Color'),
										'command': '.uno:Color'
									}
								]
							}
						],
						'vertical': 'false'
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'container',
						'children': [
							{
								'type': 'toolbox',
								'children': [
									{
										'id': 'home-defaultbullet',
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultBullet'),
										'command': '.uno:DefaultBullet'
									},
									{
										'id': 'home-defaultnumbering',
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultNumbering'),
										'command': '.uno:DefaultNumbering'
									},
									{
										'id': 'home-incrementindent',
										'type': 'toolitem',
										'text': _UNO('.uno:IncrementIndent'),
										'command': '.uno:IncrementIndent'
									},
									{
										'id': 'home-decrementindent',
										'type': 'toolitem',
										'text': _UNO('.uno:DecrementIndent'),
										'command': '.uno:DecrementIndent'
									},
									{
										'id': 'home-controlcodes',
										'type': 'toolitem',
										'text': _UNO('.uno:ControlCodes', 'text'),
										'command': '.uno:ControlCodes'
									},
									{
										'id': 'home-paralefttoright',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaLeftToRight'),
										'command': '.uno:ParaLeftToRight'
									},
									{
										'id': 'home-pararighttoleft',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaRightToLeft'),
										'command': '.uno:ParaRightToLeft'
									}
								]
							},
						],
						'vertical': 'false'
					},
					{
						'type': 'container',
						'children': [
							{
								'type': 'toolbox',
								'children': [
									{
										'id': 'home-leftpara',
										'type': 'toolitem',
										'text': _UNO('.uno:LeftPara'),
										'command': '.uno:LeftPara'
									},
									{
										'id': 'home-centerpara',
										'type': 'toolitem',
										'text': _UNO('.uno:CenterPara'),
										'command': '.uno:CenterPara'
									},
									{
										'id': 'home-rightpara',
										'type': 'toolitem',
										'text': _UNO('.uno:RightPara'),
										'command': '.uno:RightPara'
									},
									{
										'id': 'home-justifypara',
										'type': 'toolitem',
										'text': _UNO('.uno:JustifyPara'),
										'command': '.uno:JustifyPara'
									},
									{
										'id': 'home-linespacing',
										'type': 'toolitem',
										'text': _UNO('.uno:LineSpacing'),
										'command': '.uno:LineSpacing'
									},
									{
										'id': 'home-backgroundcolor',
										'type': 'toolitem',
										'text': _UNO('.uno:BackgroundColor'),
										'command': '.uno:BackgroundColor'
									}
								]
							},
						],
						'vertical': 'false'
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'stylesview',
				'type': 'iconview',
				'entries': [],
				'vertical': 'false'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-inserttable',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTable', 'text'),
								'command': '.uno:InsertTable'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-insertgraphic',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertGraphic'),
								'command': '.uno:InsertGraphic'
							},
							{
								'id': 'home-insertpagebreak',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPagebreak', 'text'),
								'command': '.uno:InsertPagebreak'
							},
							{
								'id': 'CharmapControl',
								'type': 'customtoolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': 'charmapcontrol'
							},
							{
								'id': 'home-insertannotation',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertAnnotation'),
								'command': '.uno:InsertAnnotation'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'home-searchdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SearchDialog'),
				'command': '.uno:SearchDialog'
			}
		];

		return this.getTabPage('Home', content);
	},

	getFormatTab: function() {
		var content = [
			{
				'id': 'format-fontdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FontDialog', 'text'),
				'command': '.uno:FontDialog'
			},
			{
				'id': 'FormatMenu:FormatMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormatMenu', 'text'),
				'command': '.uno:FormatMenu'
			},
			{
				'id': 'format-paragraphdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog', 'text'),
				'command': '.uno:ParagraphDialog'
			},
			{
				'id': 'FormatBulletsMenu:FormatBulletsMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormatBulletsMenu', 'text'),
				'command': '.uno:FormatBulletsMenu'
			},
			{
				'id': 'format-outlinebullet',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:OutlineBullet', 'text'),
				'command': '.uno:OutlineBullet'
			},
			{
				'id': 'format-pagedialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageDialog', 'text'),
				'command': '.uno:PageDialog'
			},
			{
				'id': 'format-formatcolumns',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatColumns', 'text'),
				'command': '.uno:FormatColumns'
			},
			{
				'id': 'format-editregion',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:EditRegion', 'text'),
				'command': '.uno:EditRegion'
			},
			{
				'id': 'format-formatline',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatLine'),
				'command': '.uno:FormatLine'
			},
			{
				'id': 'format-formatarea',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatArea'),
				'command': '.uno:FormatArea'
			},
			{
				'id': 'format-transformdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TransformDialog'),
				'command': '.uno:TransformDialog'
			},
			{
				'id': 'format-chapternumberingdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ChapterNumberingDialog', 'text'),
				'command': '.uno:ChapterNumberingDialog'
			},
			{
				'id': 'format-themedialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ThemeDialog'),
				'command': '.uno:ThemeDialog'
			}
		];

		return this.getTabPage('Format', content);
	},

	getInsertTab: function() {
		var isODF = L.LOUtil.isFileODF(this._map);
		var content = [
			{
				'id': 'insert-insertpagebreak',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertPagebreak', 'text'),
				'command': '.uno:InsertPagebreak'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertTable', 'text'),
				'command': '.uno:InsertTable'
			},
			{
				'id': 'insert-insertgraphic',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertGraphic'),
				'command': '.uno:InsertGraphic'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-inserttable',
								'type': 'toolitem',
								'text': _('Shapes'),
								'command': '.uno:BasicShapes'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insertobjectchart',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart'),
								'command': '.uno:InsertObjectChart'
							}
						]
					}
				],
				'vertical': 'true'
			},
			(this._map['wopi'].EnableRemoteLinkPicker) ? {
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'HyperlinkDialog',
								'type': 'customtoolitem',
								'text': _UNO('.uno:HyperlinkDialog'),
								'command': 'hyperlinkdialog'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-smartpicker',
								'type': 'customtoolitem',
								'text': _('Smart Picker'),
								'command': 'remotelink'
							}
						]
					}
				],
				'vertical': 'true'
			} : {
				'id': 'HyperlinkDialog',
				'type': 'bigcustomtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': 'hyperlinkdialog'
			},
			{
				'id': 'insert-pagenumberwizard',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertAnnotation', 'text'),
				'command': '.uno:InsertAnnotation'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insertpageheader',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageHeader', 'text'),
								'command': '.uno:InsertPageHeader'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insertpagefooter',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageFooter', 'text'),
								'command': '.uno:InsertPageFooter'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-pagenumberwizard',
								'type': 'toolitem',
								'text': _UNO('.uno:PageNumberWizard', 'text'),
								'command': '.uno:PageNumberWizard'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insertfieldctrl',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertFieldCtrl', 'text'),
								'command': '.uno:InsertFieldCtrl'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-shapes',
								'type': 'toolitem',
								'text': _UNO('.uno:TitlePageDialog', 'text'),
								'command': '.uno:TitlePageDialog'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSection', 'text'),
								'command': '.uno:InsertSection'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:DrawText'),
				'command': '.uno:DrawText'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText', 'text'),
								'command': '.uno:VerticalText'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-line',
								'type': 'toolitem',
								'text': _UNO('.uno:Line', 'text'),
								'command': '.uno:Line'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'insert-fontworkgalleryfloater',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FontworkGalleryFloater'),
				'command': '.uno:FontworkGalleryFloater',
				// Fontwork export/import not supported in other formats.
				'visible': isODF ? 'true' : 'false',
			},
			{
				'id': 'FormattingMarkMenu:FormattingMarkMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormattingMarkMenu', 'text'),
				'command': '.uno:FormattingMarkMenu'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-CharmapControl',
								'type': 'customtoolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': 'charmapcontrol'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insertannotation',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectStarMath', 'text'),
								'command': '.uno:InsertObjectStarMath'
							}
						]
					}
				],
				'vertical': 'true'
			},
		];

		return this.getTabPage('Insert', content);
	},

	getFormTab: function() {
		var content = [
			{
				'id': 'form-insertcontentcontrol',
				'type': 'bigtoolitem',
				'text':  _('Rich Text'),
				'command': '.uno:InsertContentControl'
			},
			{
				'id': 'form-insertcheckboxcontentcontrol',
				'type': 'bigtoolitem',
				'text': _('Checkbox'),
				'command': '.uno:InsertCheckboxContentControl'
			},
			{
				'id': 'form-insertdropdowncontentcontrol',
				'type': 'bigtoolitem',
				'text':  _('Dropdown'),
				'command': '.uno:InsertDropdownContentControl'
			},
			{
				'id': 'form-insertpicturecontentcontrol',
				'type': 'bigtoolitem',
				'text': _('Picture'),
				'command': '.uno:InsertPictureContentControl'
			},
			{
				'id': 'form-insertdatecontentcontrol',
				'type': 'bigtoolitem',
				'text': _('Date'),
				'command': '.uno:InsertDateContentControl'
			},
			{
				'id': 'form-contentcontrolproperties',
				'type': 'bigtoolitem',
				'text': _('Properties'),
				'command': '.uno:ContentControlProperties'
			}
		];

		return this.getTabPage('Form', content);
	},

	getViewTab: function() {
		var isTablet = window.mode.isTablet();
		var content = [
			isTablet ?
				{
					'id': 'view-closemobile',
					'type': 'bigcustomtoolitem',
					'text': _('Read mode'),
					'command': 'closetablet',
				} : {},
			{
				'id': 'view-controlcodes',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ControlCodes', 'text'),
				'command': '.uno:ControlCodes'
			},
			{
				'id': 'view-fullscreen',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FullScreen'),
				'command': '.uno:FullScreen'
			},
			{
				'id': 'view-zoomreset',
				'type': 'menubartoolitem',
				'text': _('Reset zoom'),
				'command': _('Reset zoom')
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'view-zoomout',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:ZoomMinus'),
								'command': '.uno:ZoomMinus'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'view-zoomin',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:ZoomPlus'),
								'command': '.uno:ZoomPlus'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'view-toggleuimode',
				'type': 'bigmenubartoolitem',
				'text': _('Compact view'),
				'command': _('Toggle UI Mode')
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'view-showruler',
								'type': 'menubartoolitem',
								'text': _('Ruler'),
								'command': _('Show Ruler')
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'view-showstatusbar',
								'type': 'menubartoolitem',
								'text': _('Status Bar'),
								'command': _('Show Status Bar')
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id':'view-toggledarktheme',
				'type': 'bigcustomtoolitem',
				'text': _('Dark Mode')
			},
			{
				'id': 'view-sidebar',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Sidebar'),
				'command': '.uno:SidebarDeck.PropertyDeck'
			},
			{
				'id': 'view-navigator',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator'
			},
		];

		return this.getTabPage('View', content);
	},

	getLayoutTab: function() {
		var content = [
			{
				'id': 'layout-pagedialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageDialog'),
				'command': '.uno:PageDialog'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-insertpagebreak',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPagebreak', 'text'),
								'command': '.uno:InsertPagebreak'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-insertbreak',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertBreak', 'text'),
								'command': '.uno:InsertBreak'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'layout-titlepagedialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TitlePageDialog', 'text'),
				'command': '.uno:TitlePageDialog'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-formatcolumns',
								'type': 'toolitem',
								'text': _UNO('.uno:FormatColumns', 'text'),
								'command': '.uno:FormatColumns'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-watermark',
								'type': 'toolitem',
								'text': _UNO('.uno:Watermark', 'text'),
								'command': '.uno:Watermark'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-hyphenate',
								'type': 'toolitem',
								'text':  _UNO('.uno:Hyphenate', 'text'),
								'command': '.uno:Hyphenate'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-linenumberingdialog',
								'type': 'toolitem',
								'text': _UNO('.uno:LineNumberingDialog', 'text'),
								'command': '.uno:LineNumberingDialog'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'layout-selectall',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SelectAll'),
				'command': '.uno:SelectAll'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-wrapoff',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOff', 'text'),
								'command': '.uno:WrapOff'
							},
							{
								'id': 'layout-wrapon',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOn', 'text'),
								'command': '.uno:WrapOn'
							},
							{
								'id': 'layout-wrapideal',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapIdeal', 'text'),
								'command': '.uno:WrapIdeal'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-wrapleft',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapLeft', 'text'),
								'command': '.uno:WrapLeft'
							},
							{
								'id': 'layout-wrapthrough',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapThrough', 'text'),
								'command': '.uno:WrapThrough'
							},
							{
								'id': 'layout-wrapright',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapRight', 'text'),
								'command': '.uno:WrapRight'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-contourdialog',
								'type': 'toolitem',
								'text': _UNO('.uno:ContourDialog'),
								'command': '.uno:ContourDialog'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-textwrap',
								'type': 'toolitem',
								'text': _UNO('.uno:TextWrap'),
								'command': '.uno:TextWrap'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-objectalignleft',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft', 'text'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'id': 'layout-aligncenter',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter', 'text'),
								'command': '.uno:AlignCenter'
							},
							{
								'id': 'layout-objectalignright',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignRight', 'text'),
								'command': '.uno:ObjectAlignRight'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-alignup',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp', 'text'),
								'command': '.uno:AlignUp'
							},
							{
								'id': 'layout-alignmiddle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle', 'text'),
								'command': '.uno:AlignMiddle'
							},
							{
								'id': 'layout-aligndown',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignDown', 'text'),
								'command': '.uno:AlignDown'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-objectforwardone',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne', 'text'),
								'command': '.uno:ObjectForwardOne'
							},
							{
								'id': 'layout-bringtofront',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront', 'text'),
								'command': '.uno:BringToFront'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-objectbackone',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne', 'text'),
								'command': '.uno:ObjectBackOne'
							},
							{
								'id': 'layout-sendtoback',
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack', 'text'),
								'command': '.uno:SendToBack'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('Layout', content);
	},

	getReferencesTab: function() {
		var content = [
			{
				'id': 'references-indexesmenu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:IndexesMenu', 'text'),
				'command': '.uno:InsertMultiIndex'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-insertindexesentry',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertIndexesEntry', 'text'),
								'command': '.uno:InsertIndexesEntry'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-updatecurrentindex',
								'type': 'toolitem',
								'text': _('Update Index'),
								'command': '.uno:UpdateCurIndex'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'references-insertfootnote',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertFootnote', 'text'),
				'command': '.uno:InsertFootnote'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-insertendnote',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertEndnote', 'text'),
								'command': '.uno:InsertEndnote'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-footnotedialog',
								'type': 'toolitem',
								'text': _UNO('.uno:FootnoteDialog', 'text'),
								'command': '.uno:FootnoteDialog'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-insertbookmark',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertBookmark', 'text'),
								'command': '.uno:InsertBookmark'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-insertreferencefield',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertReferenceField', 'text'),
								'command': '.uno:InsertReferenceField'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];
		if (this._map.zotero) {
			content.push(
				{
					'id': 'zoteroaddeditbibliography',
					'type': 'bigmenubartoolitem',
					'text': _('Add Bibliography'),
					'command': 'zoteroeditbibliography'
				},
				{
					'type': 'container',
					'children': [
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'references-zoteroAddEditCitation',
									'type': 'customtoolitem',
									'text': _('Add Citation'),
									'command': 'zoteroaddeditcitation'
								}
							]
						},
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'references-zoteroaddnote',
									'type': 'customtoolitem',
									'text': _('Add Citation Note'),
									'command': 'zoteroaddnote'
								}
							]
						}
					],
					'vertical': 'true'
				},
				{
					'type': 'container',
					'children': [
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'references-zoterorefresh',
									'type': 'customtoolitem',
									'text': _('Refresh Citations'),
									'command': 'zoterorefresh'
								}
							]
						},
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'references-zoterounlink',
									'type': 'customtoolitem',
									'text': _('Unlink Citations'),
									'command': 'zoterounlink'
								}
							]
						}
					],
					'vertical': 'true'
				},
				{
					'id': 'references-zoteroSetDocPrefs',
					'type': 'bigcustomtoolitem',
					'text': _('Citation Preferences'),
					'command': 'zoterosetdocprefs'
				}
			);
		}

		content.push(
			{
				'id': 'references-insertfieldctrl',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertFieldCtrl', 'text'),
				'command': '.uno:InsertFieldCtrl'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-insertpagenumberfield',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageNumberField'),
								'command': '.uno:InsertPageNumberField'
							},
							{
								'id': 'references-insertpagecountfield',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageCountField', 'text'),
								'command': '.uno:InsertPageCountField'
							},
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'references-insertdatefield',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateField', 'text'),
								'command': '.uno:InsertDateField'
							},
							{
								'id': 'references-inserttitlefield',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTitleField', 'text'),
								'command': '.uno:InsertTitleField'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'references-updateall',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:UpdateAll', 'text'),
				'command': '.uno:UpdateAll'
			}
		);

		return this.getTabPage('References', content);
	},

	 getReviewTab: function() {
		var content = [
			{
				'id': 'review-spellingandgrammardialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SpellingAndGrammarDialog'),
				'command': '.uno:SpellingAndGrammarDialog'
			},
			{
				'id': 'review-thesaurusdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ThesaurusDialog'),
				'command': '.uno:ThesaurusDialog'
			},
			{
				'id': 'review-languagemenu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:LanguageMenu'),
				'command': '.uno:LanguageMenu'
			},
			window.deeplEnabled ?
				{
					'id': 'review-translate',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:Translate', 'text'),
					'command': '.uno:Translate'
				}: {},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-spellonline',
								'type': 'toolitem',
								'text': _UNO('.uno:SpellOnline'),
								'command': '.uno:SpellOnline'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-wordcountdialog',
								'type': 'toolitem',
								'text': _UNO('.uno:WordCountDialog', 'text'),
								'command': '.uno:WordCountDialog'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'review-insertannotation',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertAnnotation'),
				'command': '.uno:InsertAnnotation'
			},
			{
				'id': 'review-showresolvedannotations',
				'type': 'bigcustomtoolitem',
				'text': _UNO('.uno:ShowResolvedAnnotations', 'text'),
				'command': 'showresolvedannotations'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-replycomment',
								'type': 'toolitem',
								'text': _UNO('.uno:ReplyComment'),
								'command': '.uno:ReplyComment'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-deletecomment',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteComment'),
								'command': '.uno:DeleteComment'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'review-trackchanges',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TrackChanges', 'text'),
				'command': '.uno:TrackChanges'
			},
			{
				'id': 'review-showtrackedchanges',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ShowTrackedChanges', 'text'),
				'command': '.uno:ShowTrackedChanges'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-nexttrackedchange',
								'type': 'toolitem',
								'text': _UNO('.uno:NextTrackedChange', 'text'),
								'command': '.uno:NextTrackedChange'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-previoustrackedchange',
								'type': 'toolitem',
								'text': _UNO('.uno:PreviousTrackedChange', 'text'),
								'command': '.uno:PreviousTrackedChange'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-accepttrackedchange',
								'type': 'toolitem',
								'text': _UNO('.uno:AcceptTrackedChange', 'text'),
								'command': '.uno:AcceptTrackedChange'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-rejecttrackedchange',
								'type': 'toolitem',
								'text': _UNO('.uno:RejectTrackedChange', 'text'),
								'command': '.uno:RejectTrackedChange'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-accepttrackedchangetonext',
								'type': 'toolitem',
								'text': _UNO('.uno:AcceptTrackedChangeToNext', 'text'),
								'command': '.uno:AcceptTrackedChangeToNext'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-rejecttrackedchangetonext',
								'type': 'toolitem',
								'text': _UNO('.uno:RejectTrackedChangeToNext', 'text'),
								'command': '.uno:RejectTrackedChangeToNext'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-acceptalltrackedchanges',
								'type': 'toolitem',
								'text': _UNO('.uno:AcceptAllTrackedChanges', 'text'),
								'command': '.uno:AcceptAllTrackedChanges'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'review-rejectalltrackedchanges',
								'type': 'toolitem',
								'text': _UNO('.uno:RejectAllTrackedChanges', 'text'),
								'command': '.uno:RejectAllTrackedChanges'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'review-accepttrackedchanges',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:AcceptTrackedChanges', 'text'),
				'command': '.uno:AcceptTrackedChanges'
			},
			{
				'id': 'review-accessibilitycheck',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:AccessibilityCheck', 'text'),
				'command': '.uno:AccessibilityCheck'
			}
		];

		return this.getTabPage('Review', content);
	},

	getTableTab: function() {
		var content = [
			{
				'id': 'table-tabledialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TableDialog', 'text'),
				'command': '.uno:TableDialog'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-insertcolumnsbefore',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'text'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'id': 'table-insertcolumnsafter',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'text'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
								'id': 'table-deletecolumns',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteColumns', 'text'),
								'command': '.uno:DeleteColumns'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-insertrowsbefore',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'text'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'id': 'table-insertrowsafter',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'text'),
								'command': '.uno:InsertRowsAfter'
							},
							{
								'id': 'table-deleterows',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteRows', 'text'),
								'command': '.uno:DeleteRows'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'table-mergecells',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:MergeCells', 'text'),
				'command': '.uno:MergeCells'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-splitcell',
								'type': 'toolitem',
								'text': _UNO('.uno:SplitCell', 'text'),
								'command': '.uno:SplitCell'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-splittable',
								'type': 'toolitem',
								'text': _UNO('.uno:SplitTable', 'text'),
								'command': '.uno:SplitTable'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-protect',
								'type': 'toolitem',
								'text': _UNO('.uno:Protect', 'text'),
								'command': '.uno:Protect'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-unsetcellsreadonly',
								'type': 'toolitem',
								'text': _UNO('.uno:UnsetCellsReadOnly', 'text'),
								'command': '.uno:UnsetCellsReadOnly'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'table-entirecell',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:EntireCell', 'text'),
				'command': '.uno:EntireCell'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-entirecolumn',
								'type': 'toolitem',
								'text': _UNO('.uno:EntireColumn', 'text'),
								'command': '.uno:EntireColumn'
							},
							{
								'id': 'table-selecttable',
								'type': 'toolitem',
								'text': _UNO('.uno:SelectTable', 'text'),
								'command': '.uno:SelectTable'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-entirerow',
								'type': 'toolitem',
								'text': _UNO('.uno:EntireRow', 'text'),
								'command': '.uno:EntireRow'
							},
							{
								'id': 'table-deletetable',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteTable', 'text'),
								'command': '.uno:DeleteTable'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-cellverttop',
								'type': 'toolitem',
								'text': _UNO('.uno:CellVertTop'),
								'command': '.uno:CellVertTop'
							},
							{
								'id': 'table-cellvertcenter',
								'type': 'toolitem',
								'text': _UNO('.uno:CellVertCenter'),
								'command': '.uno:CellVertCenter'
							},
							{
								'id': 'table-cellvertbottom',
								'type': 'toolitem',
								'text': _UNO('.uno:CellVertBottom'),
								'command': '.uno:CellVertBottom'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-leftpara',
								'type': 'toolitem',
								'text': _UNO('.uno:LeftPara'),
								'command': '.uno:LeftPara'
							},
							{
								'id': 'table-centerpara',
								'type': 'toolitem',
								'text': _UNO('.uno:CenterPara'),
								'command': '.uno:CenterPara'
							},
							{
								'id': 'table-rightpara',
								'type': 'toolitem',
								'text': _UNO('.uno:RightPara'),
								'command': '.uno:RightPara'
							},
							{
								'id': 'table-justifypara',
								'type': 'toolitem',
								'text': _UNO('.uno:JustifyPara'),
								'command': '.uno:JustifyPara'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'table-tablesort',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TableSort', 'text'),
				'command': '.uno:TableSort'
			},
			{
				'id': 'table-tablenumberformatdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TableNumberFormatDialog', 'text'),
				'command': '.uno:TableNumberFormatDialog'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-numberformatcurrency',
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatCurrency', 'text'),
								'command': '.uno:NumberFormatCurrency'
							},
							{
								'id': 'table-numberformatdate',
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatDate', 'text'),
								'command': '.uno:NumberFormatDate'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'table-numberformatdecimal',
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatDecimal', 'text'),
								'command': '.uno:NumberFormatDecimal'
							},
							{
								'id': 'table-numberformatpercent',
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatPercent', 'text'),
								'command': '.uno:NumberFormatPercent'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'table-insertcaptiondialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertCaptionDialog', 'text'),
				'command': '.uno:InsertCaptionDialog'
			},
		];

		return this.getTabPage('Table', content);
	},

	getDrawTab: function() {
		var isODF = L.LOUtil.isFileODF(this._map);
		var content = [
			{
				'id': 'draw-transformdialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TransformDialog', 'text'),
				'command': '.uno:TransformDialog'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-flipvertical',
								'type': 'toolitem',
								'text': _UNO('.uno:FlipVertical'),
								'command': '.uno:FlipVertical'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-fliphorizontal',
								'type': 'toolitem',
								'text': _UNO('.uno:FlipHorizontal'),
								'command': '.uno:FlipHorizontal'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-xlinecolor',
								'type': 'toolitem',
								'text': _UNO('.uno:XLineColor'),
								'command': '.uno:XLineColor'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-fillcolor',
								'type': 'toolitem',
								'text': _UNO('.uno:FillColor'),
								'command': '.uno:FillColor'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-wrapoff',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOff', 'text'),
								'command': '.uno:WrapOff'
							},
							{
								'id': 'draw-wrapon',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOn', 'text'),
								'command': '.uno:WrapOn'
							},
							{
								'id': 'draw-wrapideal',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapIdeal', 'text'),
								'command': '.uno:WrapIdeal'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-wrapleft',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapLeft', 'text'),
								'command': '.uno:WrapLeft'
							},
							{
								'id': 'draw-wrapthrough',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapThrough', 'text'),
								'command': '.uno:WrapThrough'
							},
							{
								'id': 'draw-wrapright',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapRight', 'text'),
								'command': '.uno:WrapRight'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-objectalignleft',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'id': 'draw-aligncenter',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter'
							},
							{
								'id': 'draw-objectalignright',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignRight'),
								'command': '.uno:ObjectAlignRight'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-alignup',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp'),
								'command': '.uno:AlignUp'
							},
							{
								'id': 'draw-alignmiddle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle'
							},
							{
								'id': 'draw-aligndown',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignDown'),
								'command': '.uno:AlignDown'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-bringtofront',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront'
							},
							{
								'id': 'draw-sendtoback',
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack'),
								'command': '.uno:SendToBack'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-objectforwardone',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							},
							{
								'id': 'draw-objectbackone',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'draw-formatgroup',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatGroup'),
				'command': '.uno:FormatGroup'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-entergroup',
								'type': 'toolitem',
								'text': _UNO('.uno:EnterGroup'),
								'command': '.uno:EnterGroup'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-leavegroup',
								'type': 'toolitem',
								'text': _UNO('.uno:LeaveGroup'),
								'command': '.uno:LeaveGroup'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'draw-text',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Text'),
				'command': '.uno:Text'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-shapes',
								'type': 'toolitem',
								'text': _('Shapes'),
								'command': '.uno:BasicShapes'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-line',
								'type': 'toolitem',
								'text': _UNO('.uno:Line', 'text'),
								'command': '.uno:Line'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-fontworkgalleryfloater',
								'type': 'toolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater',
								// Fontwork export/import not supported in other formats.
								'visible': isODF ? 'true' : 'false',
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-verticaltext',
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText', 'text'),
								'command': '.uno:VerticalText'
							}
						]
					}
				],
				'vertical': 'true'
			},
		];

		return this.getTabPage('Draw', content);
	},

	getNotebookbar: function(tabPages, selectedPage) {
		return {
			'id': '',
			'type': 'control',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': '',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'box',
									'type': 'container',
									'text': '',
									'enabled': 'true',
									'children': [
										{
											'id': 'ContextContainer',
											'type': 'tabcontrol',
											'text': '',
											'enabled': 'true',
											'selected': selectedPage,
											'children': tabPages
										}
									]
								}
							]
						}
					]
				}
			]
		};
	},

	// filter out empty children options so that the HTML isn't cluttered
	// and individual items missaligned
	cleanOpts: function(children) {
		var that = this;

		return children.map(function(c) {
			if (!c.type) { return null; }

			var opts = Object.assign(c, {});

			if (c.children && c.children.length) {
				opts.children = that.cleanOpts(c.children);
			}

			return opts;
		}).filter(function(c) {
			return c !== null;
		});
	},

	getTabPage: function(tabName, content) {
		return {
			'id': '',
			'type': 'tabpage',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': tabName + '-Tab',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': tabName + '-container',
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': this.cleanOpts(content)
						}
					]
				}
			]
		};
	}
});

L.control.notebookbarWriter = function (options) {
	return new L.Control.NotebookbarWriter(options);
};
