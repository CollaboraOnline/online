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
				'id': this.HOME_TAB_ID,
				'name': 'Home',
				'context': 'default|DrawText'
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
				'text': '~Draw',
				'id': '-11',
				'name': 'Draw',
				'context': 'Draw|DrawLine|3DObject|MultiObject|Graphic|DrawFontwork'
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
				this.getReviewTab(),
				this.getFormatTab(),
				this.getTableTab(),
				this.getDrawTab(),
				this.getHelpTab()
			], selectedId);
	},

	getFileTab: function() {
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hasShare = this._map['wopi'].EnableShare;

		var content = [
			hasSaveAs ?
				{
					'id': 'file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'presentation'),
					'command': '.uno:SaveAs'
				} : {},
			{
				'id': 'file-shareas-rev-history',
				'type': 'container',
				'children': [
					hasShare ?
						{
							'id': 'shareas',
							'type': 'menubartoolitem',
							'text': _('Share'),
							'command': '.uno:shareas'
						} : {},
					hasRevisionHistory ?
						{
							'id': 'rev-history',
							'type': 'menubartoolitem',
							'text': _('See history'),
							'command': '.uno:rev-history'
						} : {},
				],
				'vertical': 'true'
			},
			hasPrint ?
				{
					'id': 'print',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:Print', 'presentation'),
					'command': '.uno:Print'
				} : {},
			{
				'id': 'file-downloadas-odp-downloadas-odg',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-odp',
						'type': 'menubartoolitem',
						'text': _('ODF Presentation (.odp)'),
						'command': ''
					},
					{
						'id': 'downloadas-odg',
						'type': 'menubartoolitem',
						'text': _('ODF Drawing (.odg)'),
						'command': ''
					},
				],
				'vertical': 'true'
			},
			{
				'id': 'file-downloadas-ppt-downloadas-pptx',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-ppt',
						'type': 'menubartoolitem',
						'text': _('PowerPoint 2003 Presentation (.ppt)'),
						'command': ''
					},
					{
						'id': 'downloadas-pptx',
						'type': 'menubartoolitem',
						'text': _('PowerPoint Presentation (.pptx)'),
						'command': ''
					},
				],
				'vertical': 'true'
			},
			{
				'id': 'file-downloadas-pdf',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-pdf',
						'type': 'menubartoolitem',
						'text': _('PDF Document (.pdf)'),
						'command': ''
					},
					{
						'id': 'repair',
						'type': 'menubartoolitem',
						'text': _('Repair'),
						'command': _('Repair')
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('File', content);
	},

	getHomeTab: function() {
		var content = [
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
								'text': _UNO('.uno:SetDefault'),
								'command': '.uno:SetDefault'
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
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:FontworkGalleryFloater'),
										'command': '.uno:FontworkGalleryFloater'
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
						],
						'vertical': 'false'
					},
					{
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
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:JustifyPara'),
										'command': '.uno:JustifyPara'
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
										'text': _UNO('.uno:ParaLeftToRight'),
										'command': '.uno:ParaLeftToRight'
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
								'id': 'SectionBottom13',
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
										'text': _UNO('.uno:LineSpacing'),
										'command': '.uno:LineSpacing'
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
						'id': 'LineA6',
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
						'id': 'LineB7',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ConnectorToolbox', 'presentation'),
								'command': '.uno:ConnectorToolbox'
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
								'text': _UNO('.uno:InsertGraphic'),
								'command': '.uno:InsertGraphic'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlide', 'presentation'),
								'command': '.uno:InsertPage'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicateSlide', 'presentation'),
								'command': '.uno:DuplicatePage'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart'),
								'command': '.uno:InsertObjectChart'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTable', 'presentation'),
								'command': '.uno:InsertTable'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _('Presentation'),
				'command': '.uno:Presentation'
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
				'text': _UNO('.uno:OutlineBullet'),
				'command': '.uno:OutlineBullet'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SlideSetup', 'presentation'),
				'command': '.uno:PageSetup'
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

		return this.getTabPage('Format', content);
	},

	getInsertTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertSlide', 'presentation'),
				'command': '.uno:InsertPage'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicateSlide', 'presentation'),
								'command': '.uno:DuplicatePage'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteSlide', 'presentation'),
								'command': '.uno:DeletePage'
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
								'text': _UNO('.uno:InsertTable', 'presentation'),
								'command': '.uno:InsertTable'
							}
						]
					},
					{
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
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': '.uno:HyperlinkDialog'
			},
			{
				'type': 'container',
				'children': [
					{
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
								'text': _UNO('.uno:Line', 'presentation'),
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
								'command': '.uno:FontworkGalleryFloater'
							}
						]
					},
					{
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
				'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
				'command': '.uno:HeaderAndFooter'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': '.uno:CharmapControl'
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
			}
		];

		return this.getTabPage('Insert', content);
	},

	getLayoutTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SlideSetup', 'presentation'),
				'command': '.uno:PageSetup'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
				'command': '.uno:HeaderAndFooter'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertSlide', 'presentation'),
				'command': '.uno:InsertPage'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicateSlide', 'presentation'),
								'command': '.uno:DuplicatePage'
							}
						]
					},
					{
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
				'text': _UNO('.uno:ModifyPage', 'presentation'),
				'command': '.uno:ModifyPage'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'fullscreen',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:FullScreen'),
								'command': '.uno:FullScreen'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'zoomreset',
								'type': 'menubartoolitem',
								'text': _('Reset Zoom'),
								'command': _('Reset zoom')
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:MasterSlidesPanel', 'presentation'),
				'command': '.uno:MasterSlidesPanel'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SlideChangeWindow', 'presentation'),
								'command': '.uno:SlideChangeWindow'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:CustomAnimation', 'presentation'),
								'command': '.uno:CustomAnimation'
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
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							},
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
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack'),
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

	getReviewTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SpellDialog'),
				'command': '.uno:SpellDialog'
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

		return this.getTabPage('Review', content);
	},

	getTableTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TableDialog', 'presentation'),
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
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:MergeCells', 'presentation'),
								'command': '.uno:MergeCells'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SplitCell', 'presentation'),
								'command': '.uno:SplitCell'
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
								'text': _UNO('.uno:SelectTable', 'presentation'),
								'command': '.uno:SelectTable'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteTable', 'presentation'),
								'command': '.uno:DeleteTable'
							}
						]
					}
				],
				'vertical': 'true',
			},
			{
				'type': 'container',
				'children': [
					{
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
						],
						'vertical': 'false'
					},
					{
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
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:JustifyPara'),
										'command': '.uno:JustifyPara'
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
			}

		];

		return this.getTabPage('Table', content);
	},

	getDrawTab: function() {
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
						'id': 'LineA6',
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
						'id': 'LineB7',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ConnectorToolbox', 'presentation'),
								'command': '.uno:ConnectorToolbox'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Insert-Text-Fontwork',
				'type': 'container',
				'children': [
					{
						'id': 'LineA153',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater'
							}
						]
					},
					{
						'id': 'LineB163',
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
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
