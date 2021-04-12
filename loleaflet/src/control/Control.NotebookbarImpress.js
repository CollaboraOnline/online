/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarImpress
 */

/* global _ _UNO */
L.Control.NotebookbarImpress = L.Control.NotebookbarWriter.extend({

	getShortcutsBarData: function() {
		return [
			{
				'id': 'shortcutstoolbox',
				'type': 'toolbox',
				'children': [
					{
						'id': 'menu',
						'type': 'toolitem',
						'text': _('Menu'),
						'command': '.uno:Menubar'
					},
					{
						'id': 'save',
						'type': 'toolitem',
						'text': _('Save'),
						'command': '.uno:Save'
					},
					{
						'id': 'presentation',
						'type': 'toolitem',
						'text': _('Start Presentation'),
						'command': '.uno:Presentation'
					},
					{
						'id': 'undo',
						'type': 'toolitem',
						'text': _('Undo'),
						'command': '.uno:Undo'
					},
					{
						'id': 'redo',
						'type': 'toolitem',
						'text': _('Redo'),
						'command': '.uno:Redo'
					}
				]
			}
		];
	},

	getOptionsSectionData: function() {
		return [
			{
				'id': 'optionscontainer',
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
						'id': 'optionstoolboxdown',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ModifyPage', 'presentation', true),
								'command': '.uno:ModifyPage'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SlideChangeWindow', 'presentation', true),
								'command': '.uno:SlideChangeWindow'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:CustomAnimation', 'presentation', true),
								'command': '.uno:CustomAnimation'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:MasterSlidesPanel', 'presentation', true),
								'command': '.uno:MasterSlidesPanel'
							}
						]
					}
				]
			}
		];
	},

	getTabs: function() {
		return [
			{
				'text': _('~File'),
				'id': '-1',
				'name': 'File',
			},
			{
				'text': _('~Home'),
				'id': '-11',
				'name': 'Home',
				'context': 'default|DrawText'
			},
			{
				'text': _('~Insert'),
				'id': '-4',
				'name': 'Insert'
			},
			{
				'text': _('~Review'),
				'id': '-5',
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
				'text': '~Draw',
				'id': '-10',
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

		case 'Home':
			this.loadTab(this.getHomeTab());
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

		case 'Review':
			this.loadTab(this.getReviewTab());
			break;

		case 'Table':
			this.loadTab(this.getTableTab());
			break;

		case 'Draw':
			this.loadTab(this.getDrawTab());
			break;
		}
	},

	getFileTab: function() {
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hasShare = this._map['wopi'].EnableShare;

		var content = [
			{
				'id': 'File-Section',
				'type': 'container',
				'text': '',
				'enabled': 'true',
				'children': [
					hasSaveAs ?
					{
						'id': 'Section2',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'id': 'saveas',
								'type': 'bigtoolitem',
								'text': _UNO('.uno:SaveAs', 'presentation'),
								'command': '.uno:SaveAs'
							}
						]
					} : {},
					hasShare ?
					{
						'id': 'Section3',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
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
						'id': 'Section4',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'id': 'print',
								'type': 'bigtoolitem',
								'text': _UNO('.uno:Print', 'presentation'),
								'command': '.uno:Print'
							}
						]
					} : {},
					hasRevisionHistory ?
					{
						'id': 'Section5',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
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
						'id': 'saveas-Section',
						'type': 'container',
						'text': '',
						'enabled': 'true',
						'vertical': 'true',
						'children': [
							{
								'id': 'saveas-Section1',
								'type': 'container',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'Section7',
										'type': 'toolbox',
										'text': '',
										'enabled': 'true',
										'children': [
											{
												'id': 'downloadas-odp',
												'type': 'menubartoolitem',
												'text': _('ODF presentation (.odp)'),
												'command': ''
											}
										]
									}
								]
							},
							{
								'id': 'saveas-Section2',
								'type': 'container',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'Section10',
										'type': 'toolbox',
										'text': '',
										'enabled': 'true',
										'children': [
											{
												'id': 'downloadas-odg',
												'type': 'menubartoolitem',
												'text': _('ODF Drawing (.odg)'),
												'command': ''
											}
										]
									}
								]
							}
						]
					},
					{
						'id': 'saveas-Section',
						'type': 'container',
						'text': '',
						'enabled': 'true',
						'vertical': 'true',
						'children': [
							{
								'id': 'saveas-Section1',
								'type': 'container',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'Section8',
										'type': 'toolbox',
										'text': '',
										'enabled': 'true',
										'children': [
											{
												'id': 'downloadas-ppt',
												'type': 'menubartoolitem',
												'text': _('PowerPoint 2003 Presentation (.ppt)'),
												'command': ''
											}
										]
									}
								]
							},
							{
								'id': 'saveas-Section2',
								'type': 'container',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'Section9',
										'type': 'toolbox',
										'text': '',
										'enabled': 'true',
										'children': [
											{
												'id': 'downloadas-pptx',
												'type': 'menubartoolitem',
												'text': _('PowerPoint Presentation (.pptx)'),
												'command': ''
											}
										]
									}
								]
							}
						]
					},
					{
						'id': 'saveas-Section',
						'type': 'container',
						'text': '',
						'enabled': 'true',
						'vertical': 'true',
						'children': [
							{
								'id': 'saveas-Section1',
								'type': 'container',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'Section6',
										'type': 'toolbox',
										'text': '',
										'enabled': 'true',
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
								'id': 'saveas-Section2',
								'type': 'container',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'Section11',
										'type': 'toolbox',
										'text': '',
										'enabled': 'true',
										'children': [
											{
												'type': 'menubartoolitem',
												'text': '',
												'command': ''
											}
										]
									}
								]
							}
						]
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('File', content)], '-1');
	},

	getHomeTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Paste'),
				'command': '.uno:Paste'
			},
			{
				'id': 'GroupB9',
				'type': 'container',
				'children': [
					{
						'id': 'LineA6',
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
						'id': 'LineB7',
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
				'id': 'Home-Section-Slide',
				'type': 'container',
				'children': [
					{
						'id': 'LineA8',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPage', 'presentation'),
								'command': '.uno:InsertPage'
							}
						]
					},
					{
						'id': 'LineB9',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicatePage', 'presentation'),
								'command': '.uno:DuplicatePage'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeletePage', 'presentation'),
								'command': '.uno:DeletePage'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-Style',
				'type': 'container',
				'children': [
					{
						'id': 'LineA7',
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
						'id': 'LineB8',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SetDefault'),
								'command': '.uno:SetDefault'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-Format',
				'type': 'container',
				'children': [
					{
						'id': 'box76',
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
									'71'
								],
								'command': '.uno:CharFontName'
							},
							{
								'id': 'fontheight',
								'type': 'toolbox',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'id': 'fontsize',
										'type': 'combobox',
										'text': '18 pt',
										'entries': [
											'18 pt'
										],
										'selectedCount': '1',
										'selectedEntries': [
											'12'
										],
										'command': '.uno:FontHeight'
									}
								]
							},
							{
								'id': 'ExtTop6',
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
						],
						'vertical': 'false'
					},
					{
						'id': 'GroupB11',
						'type': 'container',
						'children': [
							{
								'id': 'ExtTop4',
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
										'text': _UNO('.uno:Shadowed'),
										'command': '.uno:Shadowed'
									}
								]
							},
							{
								'id': 'ExtTop2',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Spacing', 'presentation'),
										'command': '.uno:Spacing'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:CharBackColor'),
										'command': '.uno:CharBackColor'
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
				'id': 'Home-Section-Paragraph',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB16',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom9',
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
							}
						],
						'vertical': 'false'
					},
					{
						'id': 'GroupB15',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom13',
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
				'id': 'Home-Section-Paragraph2',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB95',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom98',
								'type': 'toolbox',
								'enabled': 'true',
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
									}
								]
							}
						],
						'vertical': 'false'
					},
					{
						'id': 'GroupB97',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom143',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:JustifyPara'),
										'command': '.uno:JustifyPara'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:LineSpacing'),
										'command': '.uno:LineSpacing'
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
				'id': 'Home-Section-Paragraph3',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom145',
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
								'text': _UNO('.uno:ParaLeftToRight'),
								'command': '.uno:ParaLeftToRight'
							}
						]
					},
					{
						'id': 'SectionBottom146',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ParaspaceIncrease'),
								'command': '.uno:ParaspaceIncrease'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ParaspaceDecrease'),
								'command': '.uno:ParaspaceDecrease'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ParaRightToLeft'),
								'command': '.uno:ParaRightToLeft'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:BasicShapes'),
				'command': '.uno:BasicShapes'
			},
			{
				'id': 'Home-Section-DrawSection',
				'type': 'container',
				'children': [
					{
						'id': 'shapes121',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Text'),
								'command': '.uno:Text'
							}
						]
					},
					{
						'id': 'LineA282',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText'),
								'command': '.uno:VerticalText'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-DrawSection1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB12',
						'type': 'container',
						'children': [
							{
								'id': 'shapes12',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Line'),
										'command': '.uno:Line'
									},
								]
							}
						],
						'vertical': 'false'
					},
					{
						'id': 'GroupB38',
						'type': 'container',
						'children': [
							{
								'id': 'shapes15',
								'type': 'toolbox',
								'children': [
									{
										'id': 'shapes1',
										'type': 'toolbox',
										'children': [
											{
												'type': 'toolitem',
												'text': _UNO('.uno:ConnectorToolbox', 'presentation'),
												'command': '.uno:ConnectorToolbox'
											}
										]
									},
								]
							}
						],
						'vertical': 'false'
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-DrawSection2',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB93',
						'type': 'container',
						'children': [
							{
								'id': 'LineA28',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:XLineColor'),
										'command': '.uno:XLineColor'
									}
								]
							}
						],
						'vertical': 'false'
					},
					{
						'id': 'GroupB94',
						'type': 'container',
						'children': [
							{
								'id': 'LineB29',
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
						'vertical': 'false'
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Presentation', 'presentation'),
				'command': '.uno:Presentation'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SearchDialog'),
				'command': '.uno:SearchDialog'
			},
		];

		return this.getNotebookbar([this.getTabPage('Home', content)], '-11');
	},

	getFormatTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FontDialog'),
				'command': '.uno:FontDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog'),
				'command': '.uno:ParagraphDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageSetup', 'presentation'),
				'command': '.uno:PageSetup'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:OutlineBullet'),
				'command': '.uno:OutlineBullet'
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
			}
		];

		return this.getNotebookbar([this.getTabPage('Format', content)], '-3');
	},

	getInsertTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertPage', 'presentation'),
				'command': '.uno:InsertPage'
			},
			{
				'id': 'Insert-Section-Pages',
				'type': 'container',
				'children': [
					{
						'id': 'LineA15',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicatePage', 'presentation'),
								'command': '.uno:DuplicatePage'
							}
						]
					},
					{
						'id': 'LineB16',
						'type': 'toolbox',
						'children': [
							{
								'id': 'selectbackground',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:SelectBackground', 'presentation'),
								'command': ''
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
				'id': 'Insert-Section-Table',
				'type': 'container',
				'children': [
					{
						'id': 'LineA15',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTable', 'presentation'),
								'command': '.uno:InsertTable'
							}
						]
					},
					{
						'id': 'LineB16',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart', 'presentation'),
								'command': '.uno:InsertObjectChart'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FontworkGalleryFloater'),
				'command': '.uno:FontworkGalleryFloater'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': '.uno:HyperlinkDialog'
			},
			{
				'id': 'Insert-Text',
				'type': 'container',
				'children': [
					{
						'id': 'LineA153',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateFieldFix', 'presentation'),
								'command': '.uno:InsertDateFieldFix'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateFieldVar', 'presentation'),
								'command': '.uno:InsertDateFieldVar'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlideField', 'presentation'),
								'command': '.uno:InsertSlideField'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlidesField', 'presentation'),
								'command': '.uno:InsertSlidesField'
							}
						]
					},
					{
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTimeFieldFix', 'presentation'),
								'command': '.uno:InsertTimeFieldFix'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTimeFieldVar', 'presentation'),
								'command': '.uno:InsertTimeFieldVar'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlideTitleField', 'presentation'),
								'command': '.uno:InsertSlideTitleField'
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
				'id': 'Insert-Text',
				'type': 'container',
				'children': [
					{
						'id': 'LineA153',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:BasicShapes', 'presentation'),
								'command': '.uno:BasicShapes'
							}
						]
					},
					{
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText', 'presentation'),
								'command': '.uno:VerticalText'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:CharmapControl'),
				'command': '.uno:CharmapControl'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Line', 'text'),
				'command': '.uno:Line'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
				'command': '.uno:HeaderAndFooter'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertAnnotation', 'presentation'),
				'command': '.uno:InsertAnnotation'
			}
		];

		return this.getNotebookbar([this.getTabPage('Insert', content)], '-4');
	},

	getReviewTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SpellDialog'),
				'command': '.uno:SpellDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ThesaurusDialog'),
				'command': '.uno:ThesaurusDialog'
			},
			{
				'id': 'Review-Section-Language1',
				'type': 'container',
				'children': [
					{
						'id': 'LineA19',
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
						'id': 'LineB20',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Hyphenation', 'presentation'),
								'command': '.uno:Hyphenation'
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:DeleteAllAnnotation', 'presentation'),
				'command': '.uno:DeleteAllAnnotation'
			}
		];

		return this.getNotebookbar([this.getTabPage('Review', content)], '-5');
	},

	getTableTab: function() {
		var content = [
			{
				'id': 'Table-Section-Layout1',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom55',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'presentation'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'presentation'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteColumns', 'presentation'),
								'command': '.uno:DeleteColumns'
							}
						]
					},
					{
						'id': 'SectionBottom57',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'presentation'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'presentation'),
								'command': '.uno:InsertRowsAfter'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteRows', 'presentation'),
								'command': '.uno:DeleteRows'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatArea'),
				'command': '.uno:FormatArea'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FillColor'),
				'command': '.uno:FillColor'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:MergeCells', 'presentation'),
				'command': '.uno:MergeCells'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SplitCell', 'presentation'),
				'command': '.uno:SplitCell'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SelectTable', 'presentation'),
				'command': '.uno:SelectTable'
			},
			{
				'id': 'Table-Section-Select1',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom40',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:EntireColumn', 'presentation'),
								'command': '.uno:EntireColumn'
							}
						]
					},
					{
						'id': 'SectionBottom62',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:EntireRow', 'presentation'),
								'command': '.uno:EntireRow'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Table-Section-Optimize1',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom84',
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
						'id': 'SectionBottom85',
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
				'text': _UNO('.uno:TableDialog', 'presentation'),
				'command': '.uno:TableDialog'
			}
		];

		return this.getNotebookbar([this.getTabPage('Table', content)], '-8');
	},

	getDrawTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FlipVertical'),
				'command': '.uno:FlipVertical'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FlipHorizontal'),
				'command': '.uno:FlipHorizontal'
			},
			{
				'id': 'Draw-Section-FormatLineArea1',
				'type': 'container',
				'children': [
					{
						'id': 'third10',
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
						'id': 'third13',
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
				'id': 'Draw-Section-FormatLineArea3',
				'type': 'container',
				'children': [
					{
						'id': 'box6',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom38',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:XLineColor'),
										'command': '.uno:XLineColor'
									}
								]
							}
						],
						'vertical': 'false'
					},
					{
						'id': 'SectionBottom50',
						'type': 'toolbox',
						'children': [
							{
								'id': '',
								'type': 'window',
								'children': [
									{
										'id': 'colortoolbox',
										'type': 'toolbox',
										'children': [
											{
												'type': 'toolitem',
												'text': _UNO('.uno:FillColor'),
												'command': '.uno:FillColor'
											}
										]
									}
								]
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Draw-Section-ObjectAlign1',
				'type': 'container',
				'children': [
					{
						'id': 'AlignGroup1',
						'type': 'container',
						'children': [
							{
								'id': 'Align1',
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
								'id': 'Align2',
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
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Draw-Section-Arrange',
				'type': 'container',
				'children': [
					{
						'id': 'grid2',
						'type': 'grid',
						'children': [
							{
								'id': 'first8',
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
								'id': 'first9',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Forward'),
										'command': '.uno:Forward'
									}
								],
								'left': '1',
								'top': '0'
							},
							{
								'id': 'second1',
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
								'id': 'Second1',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Backward'),
										'command': '.uno:Backward'
									}
								],
								'left': '1',
								'top': '1'
							}
						]
					}
				]
			},
			{
				'id': 'Draw-Section-MergeCombine',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom147',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Combine', 'presentation'),
								'command': '.uno:Combine'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Dismantle', 'presentation'),
								'command': '.uno:Dismantle'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DistributeSelection', 'presentation'),
								'command': '.uno:DistributeSelection'
							}
						]
					},
					{
						'id': 'SectionBottom148',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Merge', 'presentation'),
								'command': '.uno:Merge'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Substract', 'presentation'),
								'command': '.uno:Substract'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Intersect', 'presentation'),
								'command': '.uno:Intersect'
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
				'id': 'Draw-Section-Group1',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom52',
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
						'id': 'SectionBottom53',
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
				'text': _UNO('.uno:FontworkGalleryFloater'),
				'command': '.uno:FontworkGalleryFloater'
			}
		];

		return this.getNotebookbar([this.getTabPage('Draw', content)], '-10');
	},
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
