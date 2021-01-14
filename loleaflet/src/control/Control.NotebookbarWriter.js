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
				'text': _('~Home'),
				'id': '-10',
				'name': 'Home',
				'context': 'default|Text'
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
				'text': _('Format'),
				'id': '-3',
				'name': 'Format',
			},
			{
				'text': _('~Table'),
				'id': '-8',
				'name': 'Table',
				'context': 'Table'
			},
			{
				'text': _('~Draw'),
				'id': '-9',
				'name': 'Draw',
				'context': 'Draw'
			},
			{
				'text': _('~Help'),
				'id': '-2',
				'name': 'Help',
			}
		];
	},

	selectedTab: function(tabName) {

		switch (tabName) {
		case 'File':
			this.loadTab(this.getFileTab());
			break;
		case 'Help':
			this.loadTab(this.getHelpTab());
			break;
		case 'Format':
			this.loadTab(this.getFormatTab());
			break;
		case 'Insert':
			this.loadTab(this.getInsertTab());
			break;
		case 'Layout':
			this.loadTab(this.getLayoutTab());
			break;
		case 'References':
			this.loadTab(this.getReferencesTab());
			break;
		case 'Review':
			this.loadTab(this.getReviewTab());
			break;
		case 'Table':
			this.loadTab(this.getTableTab());
			break;
		case 'Draw':
			this.loadTab(this.getDrawTab());
			break;
		case 'Home':
			this.loadTab(this.getHomeTab());
			break;
		}
	},

	getFileTab: function() {
		var hasSigning = L.DomUtil.get('document-signing-bar') !== null;
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hasShare = this._map['wopi'].EnableShare;
		var content = [
			{
				'type': 'container',
				'children': [
					hasSaveAs ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'saveas',
									'type': 'bigtoolitem',
									'text': _UNO('.uno:SaveAs', 'text'),
									'command': '.uno:SaveAs'
								}
							]
						} : {},
					hasShare ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'shareas',
									'type': 'bigtoolitem',
									'text': _('Share'),
									'command': '.uno:shareas'
								}
							]
						} : {},
					hasPrint ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'print',
									'type': 'bigtoolitem',
									'text': _UNO('.uno:Print', 'text'),
									'command': '.uno:Print'
								}
							]
						} : {},
					hasRevisionHistory ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'rev-history',
									'type': 'bigtoolitem',
									'text': _('See history'),
									'command': '.uno:rev-history'
								}
							]
						} : {},
					{
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'type': 'container',
								'children': [
									{
										'type': 'toolbox',
										'children': [
											{
												'id': 'downloadas-odt',
												'type': 'menubartoolitem',
												'text': _('ODF text document (.odt)'),
												'command': ''
											}
										]
									}
								]
							},
							{
								'type': 'container',
								'children': [
									{
										'id': 'Section10',
										'type': 'toolbox',
										'children': [
											{
												'id': 'downloadas-rtf',
												'type': 'menubartoolitem',
												'text': _('Rich Text (.rtf)'),
												'command': ''
											}
										]
									}
								]
							}
						]
					},
					{
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'type': 'container',
								'children': [
									{
										'type': 'toolbox',
										'children': [
											{
												'id': 'downloadas-doc',
												'type': 'menubartoolitem',
												'text': _('Word 2003 Document (.doc)'),
												'command': ''
											}
										]
									}
								]
							},
							{
								'type': 'container',
								'children': [
									{
										'type': 'toolbox',
										'children': [
											{
												'id': 'downloadas-docx',
												'type': 'menubartoolitem',
												'text': _('Word Document (.docx)'),
												'command': ''
											}
										]
									}
								]
							}
						]
					},
					{
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'type': 'container',
								'children': [
									{
										'id': 'Section6',
										'type': 'toolbox',
										'children': [
											{
												'id': 'downloadas-pdf',
												'type': 'menubartoolitem',
												'text': _('PDF Document (.pdf)'),
												'command': ''
											}
										]
									}
								]
							},
							{
								'type': 'container',
								'children': [
									{
										'type': 'toolbox',
										'children': [
											{
												'id': 'downloadas-epub',
												'type': 'menubartoolitem',
												'text': _('EPUB (.epub)'),
												'command': ''
											}
										]
									}
								]
							}
						]
					},
					hasSigning ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'signdocument',
									'type': 'menubartoolitem',
									'text': _('Sign document'),
									'command': ''
								}
							]
						} : {}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('File', content)], '-1');
	},

	getHelpTab: function() {
		var hasLatestUpdates = window.enableWelcomeMessage;
		var content = [
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'online-help',
								'type': 'menubartoolitem',
								'text': _('Online Help'),
								'command': ''
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'keyboard-shortcuts',
								'type': 'menubartoolitem',
								'text': _('Keyboard shortcuts'),
								'command': ''
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'report-an-issue',
								'type': 'menubartoolitem',
								'text': _('Report an issue'),
								'command': ''
							}
						]
					},
					hasLatestUpdates ?
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'latest-updates',
									'type': 'menubartoolitem',
									'text': _('Latest Updates'),
									'command': ''
								}
							]
						} : {},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'about',
								'type': 'menubartoolitem',
								'text': _('About'),
								'command': ''
							}
						]
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Help', content)], '-2');
	},

	getHomeTab: function() {
		var content = [
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:Paste'),
						'command': '.uno:Paste'
					}
				]
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
								'text': 'Liberation Sans',
								'entries': [],
								'selectedCount': '0',
								'selectedEntries': [],
								'command': '.uno:CharFontName'
							},
							{
								'id': 'fontsize',
								'type': 'combobox',
								'text': '12 pt',
								'entries': [],
								'selectedCount': '0',
								'selectedEntries': [],
								'command': '.uno:FontHeight'
							},
							{
								'type': 'toolbox',
								'children': [
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
								]
							}
						]
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
									}
								]
							},
							{
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SubScript'),
										'command': '.uno:SubScript'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SuperScript'),
										'command': '.uno:SuperScript'
									}
								]
							},
							{
								'type': 'toolbox',
								'children': [
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
								'text': _UNO('.uno:SetOutline'),
								'command': '.uno:SetOutline'
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
									}
								]
							},
							{
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ParaLeftToRight'),
										'command': '.uno:ParaLeftToRight'
									}
								]
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
							{
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ParaRightToLeft'),
										'command': '.uno:ParaRightToLeft'
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
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:DesignerDialog'),
						'command': '.uno:DesignerDialog'
					}
				]
			},
			{
				'type': 'container',
				'children': [
					{
						'id': 'stylescontainer',
						'type': 'container',
						'children': [
							{
								'id': 'style1',
								'type': 'drawingarea',
								'text': _('Default Style'),
								'placeholderText': 'true',
								'loading': 'false',
								'image': 'data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABACAYAAADs39J0AAAAr0lEQVR4nO3RMREAIBDAMIb3bxlYUUCHREHvOvtaZMzvAF6GxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgScwDMKAT9P9vfmAAAAABJRU5ErkJggg=='
							},
							{
								'id': 'style2',
								'type': 'drawingarea',
								'text': _('Text Body'),
								'placeholderText': 'true',
								'loading': 'false',
								'image': 'data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABACAYAAADs39J0AAAAr0lEQVR4nO3RMREAIBDAMIb3bxlYUUCHREHvOvtaZMzvAF6GxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgScwDMKAT9P9vfmAAAAABJRU5ErkJggg=='
							},
							{
								'id': 'style3',
								'type': 'drawingarea',
								'text': _('Title'),
								'placeholderText': 'true',
								'loading': 'false',
								'image': 'data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABACAYAAADs39J0AAAAr0lEQVR4nO3RMREAIBDAMIb3bxlYUUCHREHvOvtaZMzvAF6GxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgScwDMKAT9P9vfmAAAAABJRU5ErkJggg=='
							},
							{
								'id': 'style4',
								'type': 'drawingarea',
								'text': _('Subtitle'),
								'placeholderText': 'true',
								'loading': 'false',
								'image': 'data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABACAYAAADs39J0AAAAr0lEQVR4nO3RMREAIBDAMIb3bxlYUUCHREHvOvtaZMzvAF6GxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgScwDMKAT9P9vfmAAAAABJRU5ErkJggg=='
							}
						],
						'vertical': 'false'
					},
					{
						'type': 'container',
						'children': [
							{
								'id': 'uptoolbar',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Previous'),
										'command': 'up'
									}
								]
							},
							{
								'id': 'downtoolbar',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Next'),
										'command': 'down'
									}
								]
							}
						],
						'vertical': 'true'
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
								'text': _UNO('.uno:StyleUpdateByExample'),
								'command': '.uno:StyleUpdateByExample'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:EditStyle'),
								'command': '.uno:EditStyle'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Emphasis'),
								'command': '.uno:StyleApply?Style:string=Emphasis&FamilyName:string=CharacterStyles'
							},
							{
								'type': 'toolitem',
								'text': _('Strong Emphasis'),
								'command': '.uno:StyleApply?Style:string=Strong Emphasis&FamilyName:string=CharacterStyles'
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
								'text':  _UNO('.uno:InsertGraphic'),
								'command': '.uno:InsertGraphic'
							},
							{
								'type': 'toolitem',
								'text':  _UNO('.uno:InsertPagebreak', 'text'),
								'command': '.uno:InsertPagebreak'
							},
							{
								'type': 'toolitem',
								'text':  _UNO('.uno:CharmapControl'),
								'command': '.uno:CharmapControl'
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
								'text': _UNO('.uno:Zoom'),
								'command': '.uno:Zoom'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertAnnotation'),
								'command': '.uno:InsertAnnotation'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:PrintPreview'),
								'command': '.uno:PrintPreview'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Navigator'),
								'command': '.uno:Navigator'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getNotebookbar([this.getTabPage('Home', content)], '-10');
	},

	getFormatTab: function() {
		var content = [
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FontDialog'),
								'command': '.uno:FontDialog'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:ParagraphDialog'),
								'command': '.uno:ParagraphDialog'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:OutlineBullet'),
								'command': '.uno:OutlineBullet'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FormatLine'),
								'command': '.uno:FormatLine'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FormatArea'),
								'command': '.uno:FormatArea'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:TransformDialog'),
								'command': '.uno:TransformDialog'
							}
						]
					},
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Format', content)], '-3');
	},

	getInsertTab: function() {
		var content = [
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'bigtoolitem',
						'text': _UNO('.uno:InsertPagebreak', 'text'),
						'command': '.uno:InsertPagebreak'
					}
				]
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
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertGraphic'),
								'command': '.uno:InsertGraphic'
							}
						]
					}
				],
				'vertical': 'false'
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
										'text': 'Table',
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
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater'
							}
						]
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
								'type': 'bigtoolitem',
								'text': _UNO('.uno:HyperlinkDialog'),
								'command': '.uno:HyperlinkDialog'
							}
						]
					}
				],
				'vertical': 'false'
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
				],
				'vertical': 'false'
			},
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'bigtoolitem',
						'text': _UNO('.uno:InsertFieldCtrl', 'text'),
						'command': '.uno:InsertFieldCtrl'
					}
				]
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
								'type': 'bigtoolitem',
								'text': _UNO('.uno:DrawText'),
								'command': '.uno:DrawText'
							}
						]
					}
				],
				'vertical': 'false'
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
										'text': _UNO('.uno:BasicShapes'),
										'command': '.uno:BasicShapes'
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
								'type': 'bigtoolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': '.uno:CharmapControl'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'bigtoolitem',
						'text': _UNO('.uno:Line', 'text'),
						'command': '.uno:Line'
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Insert', content)], '-4');
	},

	getLayoutTab: function() {
		var content = [
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
								'text':  _UNO('.uno:Watermark', 'text'),
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
								'text': _UNO('.uno:Hyphenate', 'text'),
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
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SelectObject'),
								'command': '.uno:SelectObject'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FormatGroup'),
								'command': '.uno:FormatGroup'
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
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack'),
								'command': '.uno:SendToBack'
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
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getNotebookbar([this.getTabPage('Layout', content)], '-5');
	},

	getReferencesTab: function() {
		var content = [
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:InsertMultiIndex', 'text'),
						'command': '.uno:InsertMultiIndex'
					}
				]
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
								'text': _UNO('.uno:UpdateCurIndex', 'text'),
								'command': '.uno:UpdateCurIndex'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:InsertFootnote', 'text'),
						'command': '.uno:InsertFootnote'
					}
				]
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
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:InsertReferenceField', 'text'),
						'command': '.uno:InsertReferenceField'
					}
				]
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
								'text': _UNO('.uno:InsertCaptionDialog', 'text'),
								'command': '.uno:InsertCaptionDialog'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:InsertFieldCtrl', 'text'),
						'command': '.uno:InsertFieldCtrl'
					}
				]
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
										'text': _UNO('.uno:InsertField', 'text'),
										'command': '.uno:InsertField'
									}
								]
							},
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
					}
				],
				'vertical': 'false'
			},
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:InsertAuthoritiesEntry', 'text'),
						'command': '.uno:InsertAuthoritiesEntry'
					}
				]
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:BibliographyComponent', 'text'),
								'command': '.uno:BibliographyComponent'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ViewDataSourceBrowser', 'text'),
								'command': '.uno:ViewDataSourceBrowser'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getNotebookbar([this.getTabPage('References', content)], '-6');
	},

	getReviewTab: function() {
		var content = [
			{
				'type': 'toolitem',
				'text': _UNO('.uno:SpellingAndGrammarDialog'),
				'command': '.uno:SpellingAndGrammarDialog'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:ThesaurusDialog'),
				'command': '.uno:ThesaurusDialog'
			},
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
				'type': 'toolitem',
				'text': _UNO('.uno:InsertAnnotation'),
				'command': '.uno:InsertAnnotation'
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
				'type': 'toolitem',
				'text': _UNO('.uno:TrackChanges', 'text'),
				'command': '.uno:TrackChanges'
			},
			{
				'type': 'toolitem',
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
				'type': 'container',
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
				'type': 'container',
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
			}
		];

		return this.getNotebookbar([this.getTabPage('Review', content)], '-7');
	},

	getTableTab: function() {
		var content = [
			{
				'type': 'toolitem',
				'text': _UNO('.uno:InsertCaptionDialog', 'text'),
				'command': '.uno:InsertCaptionDialog'
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
				'type': 'toolitem',
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
				'type': 'toolitem',
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
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ParaRightToLeft'),
								'command': '.uno:ParaRightToLeft'
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
				'type': 'toolitem',
				'text': _UNO('.uno:TableSort', 'text'),
				'command': '.uno:TableSort'
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
								'text': _UNO('.uno:NumberFormatDecimal', 'text'),
								'command': '.uno:NumberFormatDecimal'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatPercent', 'text'),
								'command': '.uno:NumberFormatPercent'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:NumberFormatDate', 'text'),
								'command': '.uno:NumberFormatDate'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getNotebookbar([this.getTabPage('Table', content)], '-8');
	},

	getDrawTab: function() {
		var content = [
			{
				'type': 'toolitem',
				'text': _UNO('.uno:InsertCaptionDialog'),
				'command': '.uno:InsertCaptionDialog'
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
							},
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
								'text': _UNO('.uno:FormatLine'),
								'command': '.uno:FormatLine'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FormatArea'),
								'command': '.uno:FormatArea'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:XLineColor'),
				'command': '.uno:XLineColor'
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
				'type': 'toolitem',
				'text': _UNO('.uno:TextWrap'),
				'command': '.uno:TextWrap'
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
				'type': 'grid',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront'
							}
						],
						'left': '0',
						'top': '0'
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							}
						],
						'left': '1',
						'top': '0'
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack'),
								'command': '.uno:SendToBack'
							}
						],
						'left': '0',
						'top': '1'
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne'
							}
						],
						'left': '1',
						'top': '1'
					}
				]
			},
			{
				'type': 'toolitem',
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
				'type': 'toolitem',
				'text': _UNO('.uno:FontworkGalleryFloater'),
				'command': '.uno:FontworkGalleryFloater'
			}
		];

		return this.getNotebookbar([this.getTabPage('Draw', content)], '-9');
	},

	getNotebookbar: function(tabPages, selectedPage) {
		return {
			'type': 'control',
			'children': [
				{
					'type': 'container',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'container',
							'children': [
								{
									'id': 'box',
									'type': 'container',
									'children': [
										{
											'id': 'ContextContainer',
											'type': 'tabcontrol',
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

	getTabPage: function(tabName, content) {
		return {
			'id': '',
			'type': 'tabpage',
			'children': [
				{
					'id': tabName + 'Tab',
					'type': 'container',
					'children': [
						{
							'id': tabName,
							'type': 'container',
							'children': content
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
