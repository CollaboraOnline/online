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
						'id': 'file-save',
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
					'id': 'saveas',
					'type': 'bigmenubartoolitem',
					'text': _('Save As'),
				});
			} else {
				content.push({
					'id': 'file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'text'),
					'command': '.uno:SaveAs'
				});
			}
		}

		if (hasSaveAs) {
			content.push({
				'id': 'exportas',
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
							'id': 'ShareAs',
							'type': 'customtoolitem',
							'text': _('Share'),
							'command': 'shareas',
							'inlineLabel': true
						} : {},
					hasRevisionHistory ?
						{
							'id': 'Rev-History',
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
					'id': 'print',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:Print', 'text'),
					'command': '.uno:Print'
				} : {},
			hasRunMacro ?
				{
					'type': 'toolbox',
					'children': [
						{
							'id': 'runmacro',
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
							'id': 'downloadas-odt',
							'type': 'menubartoolitem',
							'text': _('ODF Text Document (.odt)'),
							'command': ''
						},
						{
							'id': 'downloadas-rtf',
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
							'id': 'downloadas-doc',
							'type': 'menubartoolitem',
							'text': _('Word 2003 Document (.doc)'),
							'command': ''
						},
						{
							'id': 'downloadas-docx',
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
							'id': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'type': 'customtoolitem',
							'text': _('PDF Document (.pdf)'),
							'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'inlineLabel': true
						},
						{
							'id': !window.ThisIsAMobileApp ? 'exportepub' : 'downloadas-epub',
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
					'id': 'repair',
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
					'id': 'properties',
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
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'forum',
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
								'id': 'online-help',
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
								'id': 'keyboard-shortcuts',
								'type': 'bigtoolitem',
								'text': _('Keyboard shortcuts'),
								'command': '.uno:KeyboardShortcuts'
							}
						]
					},
					hasAccessibilityCheck ?
						{
							'type': 'bigtoolitem',
							'text': _UNO('.uno:AccessibilityCheck', 'text'),
							'command': '.uno:AccessibilityCheck'
						} : {},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'report-an-issue',
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
									'id': 'latestupdates',
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
									'id': 'feedback',
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
									'id': 'about',
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
						'type': 'toolitem',
						'text': _UNO('.uno:Undo'),
						'command': '.uno:Undo'
					},
					{
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
								'type': 'toolitem',
								'text': _UNO('.uno:Copy'),
								'command': '.uno:Copy'
							},
							{
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
								'id': 'fontnamecombobox',
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
								'id': 'fontsize',
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
								'type': 'toolitem',
								'text': _UNO('.uno:Grow'),
								'command': '.uno:Grow'
							},
							{
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
										'type': 'toolitem',
										'text': _UNO('.uno:Bold'),
										'command': '.uno:Bold'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Italic'),
										'command': '.uno:Italic'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Underline'),
										'command': '.uno:Underline'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Strikeout'),
										'command': '.uno:Strikeout'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SubScript'),
										'command': '.uno:SubScript'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SuperScript'),
										'command': '.uno:SuperScript'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Spacing'),
										'command': '.uno:CharSpacing'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:BackColor', 'text'),
										'command': '.uno:BackColor'
									},
									{
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
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultBullet'),
										'command': '.uno:DefaultBullet'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultNumbering'),
										'command': '.uno:DefaultNumbering'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:IncrementIndent'),
										'command': '.uno:IncrementIndent'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:DecrementIndent'),
										'command': '.uno:DecrementIndent'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ControlCodes', 'text'),
										'command': '.uno:ControlCodes'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ParaLeftToRight'),
										'command': '.uno:ParaLeftToRight'
									},
									{
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
										'type': 'toolitem',
										'text': _UNO('.uno:LeftPara'),
										'command': '.uno:LeftPara'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:CenterPara'),
										'command': '.uno:CenterPara'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:RightPara'),
										'command': '.uno:RightPara'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:JustifyPara'),
										'command': '.uno:JustifyPara'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:LineSpacing'),
										'command': '.uno:LineSpacing'
									},
									{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertGraphic'),
								'command': '.uno:InsertGraphic'
							},
							{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:OutlineBullet', 'text'),
				'command': '.uno:OutlineBullet'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageDialog', 'text'),
				'command': '.uno:PageDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatColumns', 'text'),
				'command': '.uno:FormatColumns'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:EditRegion', 'text'),
				'command': '.uno:EditRegion'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatLine'),
				'command': '.uno:FormatLine'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatArea'),
				'command': '.uno:FormatArea'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TransformDialog'),
				'command': '.uno:TransformDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ChapterNumberingDialog', 'text'),
				'command': '.uno:ChapterNumberingDialog'
			},
			{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertPagebreak', 'text'),
				'command': '.uno:InsertPagebreak'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart'),
								'command': '.uno:InsertObjectChart'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'HyperlinkDialog',
				'type': 'bigcustomtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': 'hyperlinkdialog'
			},
			(this._map['wopi'].EnableRemoteLinkPicker) ? {
				'type': 'bigcustomtoolitem',
				'text': _('Smart Picker'),
				'command': 'remotelink'
			} : {},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertReferenceField', 'text'),
								'command': '.uno:InsertReferenceField'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageNumberWizard', 'text'),
				'command': '.uno:PageNumberWizard'
			},
			{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:DrawText'),
				'command': '.uno:DrawText'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertObjectStarMath', 'text'),
				'command': '.uno:InsertObjectStarMath'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText', 'text'),
								'command': '.uno:VerticalText'
							}
						]
					}
				],
				'vertical': 'true'
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
								'id': 'CharmapControl',
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertAnnotation', 'text'),
								'command': '.uno:InsertAnnotation'
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
				'type': 'bigtoolitem',
				'text':  _('Rich Text'),
				'command': '.uno:InsertContentControl'
			},
			{
				'type': 'bigtoolitem',
				'text': _('Checkbox'),
				'command': '.uno:InsertCheckboxContentControl'
			},
			{
				'type': 'bigtoolitem',
				'text':  _('Dropdown'),
				'command': '.uno:InsertDropdownContentControl'
			},
			{
				'type': 'bigtoolitem',
				'text': _('Picture'),
				'command': '.uno:InsertPictureContentControl'
			},
			{
				'type': 'bigtoolitem',
				'text': _('Date'),
				'command': '.uno:InsertDateContentControl'
			},
			{
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
					'id': 'closemobile',
					'type': 'bigcustomtoolitem',
					'text': _('Read mode'),
					'command': 'closetablet',
				} : {},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ControlCodes', 'text'),
				'command': '.uno:ControlCodes'
			},
			{
				'id': 'fullscreen',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FullScreen'),
				'command': '.uno:FullScreen'
			},
			{
				'id': 'zoomreset',
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
								'id': 'zoomout',
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
								'id': 'zoomin',
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
				'id': 'toggleuimode',
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
								'id': 'showruler',
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
								'id': 'showstatusbar',
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
				'id':'toggledarktheme',
				'type': 'bigcustomtoolitem',
				'text': _('Dark Mode')
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Sidebar'),
				'command': '.uno:SidebarDeck.PropertyDeck'
			},
			{
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
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOff', 'text'),
								'command': '.uno:WrapOff'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOn', 'text'),
								'command': '.uno:WrapOn'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:WrapLeft', 'text'),
								'command': '.uno:WrapLeft'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:WrapThrough', 'text'),
								'command': '.uno:WrapThrough'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft', 'text'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter', 'text'),
								'command': '.uno:AlignCenter'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp', 'text'),
								'command': '.uno:AlignUp'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle', 'text'),
								'command': '.uno:AlignMiddle'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne', 'text'),
								'command': '.uno:ObjectForwardOne'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne', 'text'),
								'command': '.uno:ObjectBackOne'
							},
							{
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
									'id': 'zoteroAddEditCitation',
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
									'id': 'zoteroaddnote',
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
									'id': 'zoterorefresh',
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
									'id': 'zoterounlink',
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
					'id': 'zoteroSetDocPrefs',
					'type': 'bigcustomtoolitem',
					'text': _('Citation Preferences'),
					'command': 'zoterosetdocprefs'
				}
			);
		}

		content.push(
			{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageNumberField'),
								'command': '.uno:InsertPageNumberField'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateField', 'text'),
								'command': '.uno:InsertDateField'
							},
							{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SpellingAndGrammarDialog'),
				'command': '.uno:SpellingAndGrammarDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ThesaurusDialog'),
				'command': '.uno:ThesaurusDialog'
			},
			{
				'id': 'LanguageMenu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:LanguageMenu'),
				'command': '.uno:LanguageMenu'
			},
			window.deeplEnabled ?
				{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertAnnotation'),
				'command': '.uno:InsertAnnotation'
			},
			{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TrackChanges', 'text'),
				'command': '.uno:TrackChanges'
			},
			{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:AcceptTrackedChanges', 'text'),
				'command': '.uno:AcceptTrackedChanges'
			},
			{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'text'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'text'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'text'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'text'),
								'command': '.uno:InsertRowsAfter'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:EntireColumn', 'text'),
								'command': '.uno:EntireColumn'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:EntireRow', 'text'),
								'command': '.uno:EntireRow'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:CellVertTop'),
								'command': '.uno:CellVertTop'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:CellVertCenter'),
								'command': '.uno:CellVertCenter'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:LeftPara'),
								'command': '.uno:LeftPara'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:CenterPara'),
								'command': '.uno:CenterPara'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:RightPara'),
								'command': '.uno:RightPara'
							},
							{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TableSort', 'text'),
				'command': '.uno:TableSort'
			},
			{
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
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatCurrency', 'text'),
								'command': '.uno:NumberFormatCurrency'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatDecimal', 'text'),
								'command': '.uno:NumberFormatDecimal'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOff', 'text'),
								'command': '.uno:WrapOff'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOn', 'text'),
								'command': '.uno:WrapOn'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:WrapLeft', 'text'),
								'command': '.uno:WrapLeft'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:WrapThrough', 'text'),
								'command': '.uno:WrapThrough'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp'),
								'command': '.uno:AlignUp'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront'
							},
							{
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
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							},
							{
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
