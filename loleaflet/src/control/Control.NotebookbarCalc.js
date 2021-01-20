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
				'id': '-10',
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
				this.getHelpTab()
			], selectedId);
	},

	getFileTab: function() {
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
									'text': _UNO('.uno:SaveAs', 'spreadsheet'),
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
									'text': _UNO('.uno:Print', 'spreadsheet'),
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
												'id': 'downloadas-ods',
												'type': 'menubartoolitem',
												'text': _('ODF spreadsheet (.ods)'),
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
												'id': 'downloadas-pdf',
												'type': 'menubartoolitem',
												'text': _('PDF Document (.pdf)'),
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
												'id': 'downloadas-xls',
												'type': 'menubartoolitem',
												'text': _('Excel 2003 Spreadsheet (.xls)'),
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
												'id': 'downloadas-xlsx',
												'type': 'menubartoolitem',
												'text': _('Excel Spreadsheet (.xlsx)'),
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

		return this.getTabPage('File', content);
	},

	getHomeTab: function() {
		var content = [
			{
				'type': 'container',
				'children': [
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
					}
				]
			},
			{
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
								]
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
									}
								]
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
										'text': _UNO('.uno:AlignBlock', 'spreadsheet'),
										'command': '.uno:AlignBlock'
									}
								]
							},
							{
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapText', 'spreadsheet'),
										'command': '.uno:WrapText'
									}
								]
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
						'id': 'numbertype',
						'type': 'listbox',
						'children': [],
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
						'type': 'container',
						'children': [
							{
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
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:ToggleMergeCells', 'spreadsheet'),
				'command': '.uno:ToggleMergeCells'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'spreadsheet'),
								'command': '.uno:InsertRowsBefore'
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
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'spreadsheet'),
								'command': '.uno:InsertColumnsBefore'
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
				'type': 'container',
				'children': [
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
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _('Default'),
										'command': '.uno:StyleApply?Style:string=Default&FamilyName:string=CellStyles'
									}
								]
							},
							{
								'type': 'toolbox',
								'children': [
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
						]
					}
				],
				'vertical': 'true'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'),
				'command': '.uno:ConditionalFormatMenu'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:SearchDialog'),
				'command': '.uno:SearchDialog'
			},
			{
				'type': 'container',
				'children': [
					{
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
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageFormatDialog', 'spreadsheet', true),
				'command': '.uno:PageFormatDialog'
			},
			{
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Insert Rows Above'),
								'command': '.uno:InsertRowsBefore'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Insert Rows Below'),
								'command': '.uno:InsertRowsAfter'
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
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Insert Columns Before'),
								'command': '.uno:InsertColumnsBefore'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Insert Columns After'),
								'command': '.uno:InsertColumnsAfter'
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
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _('Delete Rows'),
								'command': '.uno:DeleteRows'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
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
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
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
			window.mode.isDesktop()? {
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FreezePanes', 'spreadsheet', true),
								'command': '.uno:FreezePanes'
							}
						]
					}
				]
			} : {},
			window.mode.isDesktop()? {
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
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
			} : {}
		];

		return this.getTabPage('Sheet', content);
	},

	getInsertTab: function() {
		var content = [
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:DataDataPilotRun', 'spreadsheet'),
								'command': '.uno:DataDataPilotRun'
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
								'text': _UNO('.uno:RecalcPivotTable', 'spreadsheet'),
								'command': '.uno:RecalcPivotTable'
							}
						]
					},
					{
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
				'text': _UNO('.uno:FontworkGalleryFloater'),
				'command': '.uno:FontworkGalleryFloater'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': '.uno:HyperlinkDialog'
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
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:CharmapControl'),
				'command': '.uno:CharmapControl'
			},
			{
				'type': 'bigtoolitem',
				'text': _UNO('.uno:EditHeaderAndFooter', 'spreadsheet'),
				'command': '.uno:EditHeaderAndFooter'
			}
		];

		return this.getTabPage('Insert', content);
	},

	getDataTab: function() {
		var content = [
			{
				'type': 'toolitem',
				'text': _UNO('.uno:Calculate', 'spreadsheet'),
				'command': '.uno:Calculate'
			},
			{
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:DataDataPilotRun', 'spreadsheet'),
						'command': '.uno:DataDataPilotRun'
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
								'text': _UNO('.uno:RecalcPivotTable', 'spreadsheet'),
								'command': '.uno:RecalcPivotTable'
							}
						]
					},
					{
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
				'type': 'toolitem',
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
							}
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
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataFilterAutoFilter', 'spreadsheet'),
								'command': '.uno:DataFilterAutoFilter'
							}
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
								'text': _UNO('.uno:DataFilterStandardFilter', 'spreadsheet'),
								'command': '.uno:DataFilterStandardFilter'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:DataFilterHideAutoFilter', 'spreadsheet'),
								'command': '.uno:DataFilterHideAutoFilter'
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
								'text': _UNO('.uno:Group'),
								'command': '.uno:Group'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Ungroup'),
								'command': '.uno:Ungroup'
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
								'text': _UNO('.uno:HideDetail'),
								'command': '.uno:HideDetail'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ShowDetail'),
								'command': '.uno:ShowDetail'
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
				'type': 'toolitem',
				'text': _UNO('.uno:Validation', 'spreadsheet'),
				'command': '.uno:Validation'
			},
			{
				'id': 'Data-StatisticsMenu:Menu Statistic',
				'type': 'menubutton',
				'text': _UNO('.uno:StatisticsMenu', 'spreadsheet'),
				'enabled': 'true'
			}
		];

		return this.getTabPage('Data', content);
	},

	getReviewTab: function() {
		var content = [
			{
				'type': 'toolitem',
				'text': _UNO('.uno:SpellDialog'),
				'command': '.uno:SpellDialog'
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
								'text': _UNO('.uno:Hyphenate', 'spreadsheet'),
								'command': '.uno:Hyphenate'
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
								'text': _UNO('.uno:DeleteAllNotes'),
								'command': '.uno:DeleteAllNotes'
							}
						]
					},
					{
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
			{
				'type': 'toolitem',
				'text': _UNO('.uno:TraceChangeMode', 'spreadsheet'),
				'command': '.uno:TraceChangeMode'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:AcceptChanges', 'spreadsheet'),
				'command': '.uno:AcceptChanges'
			}
		];

		return this.getTabPage('Review', content);
	}
});

L.control.notebookbarCalc = function (options) {
	return new L.Control.NotebookbarCalc(options);
};
