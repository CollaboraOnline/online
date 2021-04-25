/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarCalc
 */

/* global _ _UNO */
L.Control.NotebookbarCalc = L.Control.NotebookbarWriter.extend({

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
				'context': 'default|Cell'
			},
			{
				'text': _('~Insert'),
				'id': '-4',
				'name': 'Insert'
			},
			{
				'text': _('~Sheet'),
				'id': '-3',
				'name': 'Sheet'
			},
			{
				'text': _('~Data'),
				'id': '-5',
				'name': 'Data'
			},
			{
				'text': _('~Review'),
				'id': '-6',
				'name': 'Review'
			},
			{
				'text': _('Format'),
				'id': '-7',
				'name': 'Format'
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
				this.getSheetTab(),
				this.getDataTab(),
				this.getReviewTab(),
				this.getFormatTab(),
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
					'text': _UNO('.uno:SaveAs', 'spreadsheet'),
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
					'text': _UNO('.uno:Print', 'spreadsheet'),
					'command': '.uno:Print'
				} : {},
			{
				'id': 'file-downloadas-ods-downloadas-csv',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-ods',
						'type': 'menubartoolitem',
						'text': _('ODF Spreadsheet (.ods)'),
						'command': ''
					},
					{
						'id': 'downloadas-csv',
						'type': 'menubartoolitem',
						'text': _('CSV File (.csv)'),
						'command': ''
					},
				],
				'vertical': 'true'
			},
			{
				'id': 'file-downloadas-xls-downloadas-xlsx',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-xls',
						'type': 'menubartoolitem',
						'text': _('Excel 2003 Spreadsheet (.xls)'),
						'command': ''
					},
					{
						'id': 'downloadas-xlsx',
						'type': 'menubartoolitem',
						'text': _('Excel Spreadsheet (.xlsx)'),
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
				'id': 'GroupB9',
				'type': 'container',
				'children': [
					{
						'id': 'LineA6',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Cut', true),
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
								'text': _UNO('.uno:Copy', true),
								'command': '.uno:Copy'
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
								'text': _UNO('.uno:ResetAttributes'),
								'command': '.uno:ResetAttributes'
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
								'id': 'fontsize',
								'type': 'combobox',
								'text': '10 pt',
								'entries': [
									'10 pt'
								],
								'selectedCount': '1',
								'selectedEntries': [
									'4'
								],
								'command': '.uno:FontHeight'
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
								'text': _UNO('.uno:SetBorderStyle'),
								'command': '.uno:SetBorderStyle'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:BackgroundColor'),
								'command': '.uno:BackgroundColor'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Color'),
								'command': '.uno:Color'
							}
						],
						'vertical': 'false'
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-Align',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB15',
						'type': 'container',
						'children': [
							{
								'id': 'first6',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignTop', 'spreadsheet'),
										'command': '.uno:AlignTop'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignVCenter', 'spreadsheet'),
										'command': '.uno:AlignVCenter'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignBottom', 'spreadsheet'),
										'command': '.uno:AlignBottom'
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
									}
								]
							}
						],
						'vertical': 'false'
					},
					{
						'id': 'GroupB16',
						'type': 'container',
						'children': [
							{
								'id': 'second6',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignLeft', 'spreadsheet'),
										'command': '.uno:AlignLeft'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignHorizontalCenter', 'spreadsheet'),
										'command': '.uno:AlignHorizontalCenter'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignRight', 'spreadsheet'),
										'command': '.uno:AlignRight'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AlignBlock', 'spreadsheet'),
										'command': '.uno:AlignBlock'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapText', 'spreadsheet'),
										'command': '.uno:WrapText'
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
				'id': 'Home-Section-Number',
				'type': 'container',
				'children': [
					{
						'id': 'numbertype',
						'type': 'listbox',
						'entries': [
							_('General'),
							_('Number'),
							_('Percent'),
							_('Currency'),
							_('Date'),
							_('Time'),
							_('Scientific'),
							_('Fraction'),
							_('Boolean Value'),
							_('Text')
						],
						'selectedCount': '1',
						'selectedEntries': [
							'0'
						]
					},
					{
						'id': 'GroupB22',
						'type': 'container',
						'children': [
							{
								'id': 'second9',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatCurrency', 'spreadsheet'),
										'command': '.uno:NumberFormatCurrency'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatPercent', 'spreadsheet'),
										'command': '.uno:NumberFormatPercent'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatDecimal', 'spreadsheet'),
										'command': '.uno:NumberFormatDecimal'
									}
								]
							},
							{
								'id': 'second2',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet'),
										'command': '.uno:NumberFormatIncDecimals'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet'),
										'command': '.uno:NumberFormatDecDecimals'
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
				'text': _UNO('.uno:MergeCells', 'spreadsheet'),
				'command': '.uno:ToggleMergeCells'
			},
			{
				'id': 'Home-Section-Cell1',
				'type': 'container',
				'children': [
					{
						'id': 'LineA10',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'spreadsheet'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'spreadsheet'),
								'command': '.uno:InsertRowsAfter'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteRows', 'spreadsheet'),
								'command': '.uno:DeleteRows'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:RowOperations', 'spreadsheet'),
								'command': '.uno:RowOperations'
							}
						]
					},
					{
						'id': 'LineB11',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'spreadsheet'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'spreadsheet'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteColumns', 'spreadsheet'),
								'command': '.uno:DeleteColumns'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ColumnOperations', 'spreadsheet'),
								'command': '.uno:ColumnOperations'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'),
				'command': '.uno:ConditionalFormatMenu'
			},
			{
				'id': 'Home-Section-Style2',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom102',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Default'),
								'command': '.uno:StyleApply?Style:string=Default&FamilyName:string=CellStyles'
							},
							{
								'type': 'toolitem',
								'text': _('Heading 1'),
								'command': '.uno:StyleApply?Style:string=Heading 1&FamilyName:string=CellStyles'
							},
							{
								'type': 'toolitem',
								'text': _('Heading 2'),
								'command': '.uno:StyleApply?Style:string=Heading 2&FamilyName:string=CellStyles'
							}
						]
					},
					{
						'id': 'SectionBottom7',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Good'),
								'command': '.uno:StyleApply?Style:string=Good&FamilyName:string=CellStyles'
							},
							{
								'type': 'toolitem',
								'text': _('Neutral'),
								'command': '.uno:StyleApply?Style:string=Neutral&FamilyName:string=CellStyles'
							},
							{
								'type': 'toolitem',
								'text': _('Bad'),
								'command': '.uno:StyleApply?Style:string=Bad&FamilyName:string=CellStyles'
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
			},
			{
				'id': 'Home-Section-Find',
				'type': 'container',
				'children': [
					{
						'id': 'LineA17',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataSort', 'spreadsheet'),
								'command': '.uno:DataSort'
							}
						]
					},
					{
						'id': 'LineB19',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataFilterAutoFilter', 'spreadsheet'),
								'command': '.uno:DataFilterAutoFilter'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('Home', content);
	},

	getSheetTab: function() {
		var content = [
			{
				'id': 'Sheet-Section',
				'type': 'container',
				'children': [
					{
						'id': 'break-Section',
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'id': 'Section7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Insert Row Break'),
										'command': '.uno:InsertRowBreak'
									}
								]
							},
							{
								'id': 'Section10',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Insert Column Break'),
										'command': '.uno:InsertColumnBreak'
									}
								]
							}
						]
					},
					{
						'id': 'deletebreak-Section',
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'id': 'Section7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Remove Row Break'),
										'command': '.uno:DeleteRowbreak'
									}
								]
							},
							{
								'id': 'Section10',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Remove Column Break'),
										'command': '.uno:DeleteColumnbreak'
									}
								]
							}
						]
					},
					{
						'id': 'rows-Section',
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'id': 'Section7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Insert Rows Above'),
										'command': '.uno:InsertRowsBefore'
									},
									{
										'type': 'toolitem',
										'text': _('Insert Columns Before'),
										'command': '.uno:InsertColumnsBefore'
									},
									{
										'type': 'toolitem',
										'text': _('Delete Rows'),
										'command': '.uno:DeleteRows'
									}
								]
							},
							{
								'id': 'Section10',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Insert Rows Below'),
										'command': '.uno:InsertRowsAfter'
									},
									{
										'type': 'toolitem',
										'text': _('Insert Columns After'),
										'command': '.uno:InsertColumnsAfter'
									},
									{
										'type': 'toolitem',
										'text': _('Delete Columns'),
										'command': '.uno:DeleteColumns'
									}
								]
							}
						]
					},
					{
						'id': 'freeze-section1',
						'type': 'container',
						'children': [
							{
								'id': 'Section7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'bigtoolitem',
										'text': _UNO('.uno:FreezePanes', 'spreadsheet', true),
										'command': '.uno:FreezePanes'
									}
								]
							}
						]
					},
					{
						'id': 'freeze-section2',
						'type': 'container',
						'vertical': 'true',
						'children': [
							{
								'id': 'Section7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text':_UNO('.uno:FreezePanesColumn', 'spreadsheet', true),
										'command': '.uno:FreezePanesColumn'
									}
								]
							},
							{
								'id': 'Section10',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:FreezePanesRow', 'spreadsheet', true),
										'command': '.uno:FreezePanesRow'
									}
								]
							}
						]
					}
				]
			}
		];

		return this.getTabPage('Sheet', content);
	},

	getInsertTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:DataDataPilotRun', 'spreadsheet'),
				'command': '.uno:DataDataPilotRun'
			},
			{
				'id': 'Insert-Section-PivotTable-Ext',
				'type': 'container',
				'children': [
					{
						'id': 'LineA152',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:RecalcPivotTable', 'spreadsheet'),
								'command': '.uno:RecalcPivotTable'
							}
						]
					},
					{
						'id': 'LineB162',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeletePivotTable', 'spreadsheet'),
								'command': '.uno:DeletePivotTable'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertObjectChart'),
				'command': '.uno:InsertObjectChart'
			},
			{
				'id': 'Insert-Section-PivotTable-Ext',
				'type': 'container',
				'children': [
					{
						'id': 'LineA152',
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
						'id': 'LineB162',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FunctionDialog', 'spreadsheet'),
								'command': '.uno:FunctionDialog'
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
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:AddName', 'spreadsheet'),
								'command': '.uno:AddName'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DefineName', 'spreadsheet'),
								'command': '.uno:DefineName'
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
				'id': 'Insert-BasicShapes-Shapes',
				'type': 'container',
				'children': [
					{
						'id': 'LineA153',
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
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Line', 'spreadsheet'),
								'command': '.uno:Line'
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
								'text': _UNO('.uno:VerticalText', 'spreadsheet'),
								'command': '.uno:VerticalText'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:EditHeaderAndFooter', 'spreadsheet'),
				'command': '.uno:EditHeaderAndFooter'
			},
			{
				'id': 'Insert-Charmap-Annotation',
				'type': 'container',
				'children': [
					{
						'id': 'LineA153',
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
						'id': 'LineB163',
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

	getDataTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:DataSort', 'spreadsheet'),
				'command': '.uno:DataSort'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SortAscending', 'spreadsheet'),
								'command': '.uno:SortAscending'
							},
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:SortDescending', 'spreadsheet'),
								'command': '.uno:SortDescending'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:DataFilterAutoFilter', 'spreadsheet'),
				'command': '.uno:DataFilterAutoFilter'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataFilterStandardFilter', 'spreadsheet'),
								'command': '.uno:DataFilterStandardFilter'
							},
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataFilterSpecialFilter', 'spreadsheet'),
								'command': '.uno:DataFilterSpecialFilter'
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
								'text': _UNO('.uno:DataFilterHideAutoFilter', 'spreadsheet'),
								'command': '.uno:DataFilterHideAutoFilter'
							},
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataFilterRemoveFilter', 'spreadsheet'),
								'command': '.uno:DataFilterRemoveFilter'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Group'),
				'command': '.uno:Group'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Ungroup'),
								'command': '.uno:Ungroup'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ClearOutline', 'spreadsheet'),
								'command': '.uno:ClearOutline'
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
								'text': _UNO('.uno:ShowDetail'),
								'command': '.uno:ShowDetail'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:HideDetail'),
								'command': '.uno:HideDetail'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Calculate', 'spreadsheet'),
				'command': '.uno:Calculate'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:GoalSeekDialog', 'spreadsheet'),
								'command': '.uno:GoalSeekDialog'
							},
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Validation', 'spreadsheet'),
								'command': '.uno:Validation'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Data-StatisticsMenu:Menu Statistic',
				'type': 'menubutton',
				'text': _UNO('.uno:StatisticsMenu', 'spreadsheet'),
				'enabled': 'true'
			},
		];

		return this.getTabPage('Data', content);
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
								'text': _UNO('.uno:Hyphenate', 'spreadsheet'),
								'command': '.uno:Hyphenate'
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
				'id': 'Review-Section-Annotation2',
				'type': 'container',
				'children': [
					{
						'id': 'LeftParaMargin17',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteAllNotes'),
								'command': '.uno:DeleteAllNotes'
							}
						]
					},
					{
						'id': 'belowspacing15',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteNote', 'spreadsheet'),
								'command': '.uno:DeleteNote'
							}
						]
					}
				],
				'vertical': 'true'
			},
		];

		return this.getTabPage('Review', content);
	},

	getFormatTab: function() {
		var content = [
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FontDialog'),
				'command': '.uno:FontDialog'
			},
			{
				'id': 'FormatMenu:FormatMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormatMenu', 'spreadsheet'),
				'command': '.uno:FormatMenu'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog'),
				'command': '.uno:ParagraphDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageFormatDialog', 'spreadsheet', true),
				'command': '.uno:PageFormatDialog'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatCellDialog', 'spreadsheet', true),
				'command': '.uno:FormatCellDialog'
			},
			{
				'id': 'ConditionalFormatMenu:ConditionalFormatMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'),
				'command': '.uno:ConditionalFormatMenu'
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
	}
});

L.control.notebookbarCalc = function (options) {
	return new L.Control.NotebookbarCalc(options);
};
