/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarCalc
 */

/* global _ _UNO */
L.Control.NotebookbarCalc = L.Control.NotebookbarWriter.extend({

	getTabs: function() {
		return [
			{
				'id': 'File-tab-label',
				'text': _('File'),
				'name': 'File',
			},
			{
				'id': this.HOME_TAB_ID,
				'text': _('Home'),
				'name': 'Home',
				'context': 'default|Cell|Text|DrawText'
			},
			{
				'id': 'Insert-tab-label',
				'text': _('Insert'),
				'name': 'Insert'
			},
			{
				'id': 'Layout-tab-label',
				'text': _('Layout'),
				'name': 'Layout'
			},
			{
				'id': 'Data-tab-label',
				'text': _('Data'),
				'name': 'Data'
			},
			{
				'id': 'Review-tab-label',
				'text': _('Review'),
				'name': 'Review'
			},
			{
				'id': 'Format-tab-label',
				'text': _('Format'),
				'name': 'Format'
			},
			{
				'id': 'Draw-tab-label',
				'text': _('Draw'),
				'name': 'Draw',
				'context': 'Draw|DrawLine|3DObject|MultiObject|Graphic|DrawFontwork'
			},
			{
				'id': 'View-tab-label',
				'text': _('View'),
				'name': 'View',
			},
			{
				'id': 'Help-tab-label',
				'text': _('Help'),
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
				this.getDataTab(),
				this.getReviewTab(),
				this.getFormatTab(),
				this.getDrawTab(),
				this.getViewTab(),
				this.getHelpTab()
			], selectedId);
	},

	getFileTab: function() {
		var content = [
			!this._map['wopi'].HideSaveOption ? {
				'type': 'toolbox',
				'children': [
					{
						'id': 'file-save',
						'type': 'bigtoolitem',
						'text': _('Save'),
						'command': '.uno:Save'
					}
				]
			}: {},
			!this._map['wopi'].UserCanNotWriteRelative ? (
				(window.uiDefaults && window.uiDefaults.saveAsMode === 'group') ? {
					'id': 'saveas',
					'type': 'bigmenubartoolitem',
					'text': _('Save As'),
				}:
				{
					'id': 'file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'spreadsheet'),
					'command': '.uno:SaveAs'
				}
			): {},
			!this._map['wopi'].UserCanNotWriteRelative ? {
				'id': 'exportas',
				'type': 'bigmenubartoolitem',
				'text': _('Export As'),
			}: {},
			{
				'id': 'file-shareas-rev-history',
				'type': 'container',
				'children': [
					this._map['wopi'].EnableShare ?
						{
							'id': 'ShareAs',
							'type': 'customtoolitem',
							'text': _('Share'),
							'command': 'shareas',
							'inlineLabel': true
						} : {},
						L.Params.revHistoryEnabled ?
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
			!this._map['wopi'].HidePrintOption ?
			{
				'id': 'print',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Print', 'spreadsheet'),
				'command': '.uno:Print'
			} : {},
			(!(window.enableMacrosExecution  === 'false')) ?
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
			} : {},
			!!window.groupDownloadAsForNb && !this._map['wopi'].HideExportOption ? {
				'id': 'downloadas',
				'type': 'bigmenubartoolitem',
				'text': _('Download')
			}: (!this._map['wopi'].HideExportOption ? (
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
					'id': 'file-exportpdf',
					'type': 'container',
					'children': [
						{
							'id': !window.ThisIsAMobileApp ? 'exportdirectpdf' : 'downloadas-direct-pdf',
							'type': 'customtoolitem',
							'text': _('PDF Document (.pdf)'),
							'command': !window.ThisIsAMobileApp ? 'exportdirectpdf' : 'downloadas-direct-pdf',
							'inlineLabel': true
						},
						{
							'id': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'type': 'customtoolitem',
							'text': _('PDF Document (.pdf) - Expert'),
							'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'inlineLabel': true
						},
					],
					'vertical': 'true'
				}): {}
			),
			!this._map['wopi'].HideRepairOption ? {
				'type': 'container',
				'children': [
					{
						'id': 'repair',
						'type': 'bigmenubartoolitem',
						'text': _('Repair'),
						'command': _('Repair')
					}
				],
				'vertical': 'true'
			}: {},
			{
				'type': 'container',
				'children': [
					{
						'id': 'properties',
						'type': 'bigtoolitem',
						'text': _('Properties'),
						'command': '.uno:SetDocumentProperties'
					}
				]
			}
		];

		return this.getTabPage('File', content);
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
				'id': 'home-paste',
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
								'text': _UNO('.uno:Cut', true),
								'command': '.uno:Cut'
							},
							{
								'id': 'home-format-paint-brush',
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
								'text': _UNO('.uno:Copy', true),
								'command': '.uno:Copy'
							},
							{
								'id': 'home-reset-attributes',
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
						'id': 'GroupB11',
						'type': 'container',
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
								'id': 'home-set-border-style',
								'type': 'toolitem',
								'text': _UNO('.uno:SetBorderStyle'),
								'command': '.uno:SetBorderStyle'
							},
							{
								'id': 'home-background-color',
								'type': 'toolitem',
								'text': _UNO('.uno:BackgroundColor'),
								'command': '.uno:BackgroundColor'
							},
							{
								'id': 'home-color',
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
										'id': 'home-align-top',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignTop', 'spreadsheet'),
										'command': '.uno:AlignTop'
									},
									{
										'id': 'home-align-vertical-center',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignVCenter', 'spreadsheet'),
										'command': '.uno:AlignVCenter'
									},
									{
										'id': 'home-align-bottom',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignBottom', 'spreadsheet'),
										'command': '.uno:AlignBottom'
									},
									{
										'id': 'home-increment-indent',
										'type': 'toolitem',
										'text': _UNO('.uno:IncrementIndent'),
										'command': '.uno:IncrementIndent'
									},
									{
										'id': 'home-decrement-indent',
										'type': 'toolitem',
										'text': _UNO('.uno:DecrementIndent'),
										'command': '.uno:DecrementIndent'
									},
									{
										'id': 'home-para-left-to-right',
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
						'id': 'GroupB16',
						'type': 'container',
						'children': [
							{
								'id': 'second6',
								'type': 'toolbox',
								'children': [
									{
										'id': 'home-align-left',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignLeft', 'spreadsheet'),
										'command': '.uno:AlignLeft'
									},
									{
										'id': 'home-align-horizontal-center',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignHorizontalCenter', 'spreadsheet'),
										'command': '.uno:AlignHorizontalCenter'
									},
									{
										'id': 'home-align-right',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignRight', 'spreadsheet'),
										'command': '.uno:AlignRight'
									},
									{
										'id': 'home-align-block',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignBlock', 'spreadsheet'),
										'command': '.uno:AlignBlock'
									},
									{
										'id': 'home-wrap-text',
										'type': 'toolitem',
										'text': _UNO('.uno:WrapText', 'spreadsheet'),
										'command': '.uno:WrapText'
									},
									{
										'id': 'home-para-right-to-left',
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
										'id': 'home-number-format-currency',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatCurrency', 'spreadsheet'),
										'command': '.uno:NumberFormatCurrency'
									},
									{
										'id': 'home-number-format-percent',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatPercent', 'spreadsheet'),
										'command': '.uno:NumberFormatPercent'
									},
									{
										'id': 'home-number-format-decimal',
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
										'id': 'home-number-format-in-decimals',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet'),
										'command': '.uno:NumberFormatIncDecimals'
									},
									{
										'id': 'home-number-format-dec-decimals',
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
				'id': 'home-merge-cells',
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
								'id': 'home-insert-rows-before',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'spreadsheet'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'id': 'home-insert-rows-after',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'spreadsheet'),
								'command': '.uno:InsertRowsAfter'
							},
							{
								'id': 'home-delete-rows',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteRows', 'spreadsheet'),
								'command': '.uno:DeleteRows'
							},
							{
								'id': 'home-row-operations',
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
								'id': 'home-insert-columns-before',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'spreadsheet'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'id': 'home-insert-columns-after',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'spreadsheet'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
								'id': 'home-delete-columns',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteColumns', 'spreadsheet'),
								'command': '.uno:DeleteColumns'
							},
							{
								'id': 'home-column-operations',
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
				'id': 'home-conditional-format-menu',
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
								'id': 'StyleApplyDefault',
								'type': 'toolitem',
								'text': _('Default'),
								'command': '.uno:StyleApply?Style:string=Default&FamilyName:string=CellStyles'
							},
							{
								'id': 'StyleApplyHeading1',
								'type': 'toolitem',
								'text': _('Heading 1'),
								'command': '.uno:StyleApply?Style:string=Heading 1&FamilyName:string=CellStyles'
							},
							{
								'id': 'StyleApplyHeading2',
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
								'id': 'StyleApplyGood',
								'type': 'toolitem',
								'text': _('Good'),
								'command': '.uno:StyleApply?Style:string=Good&FamilyName:string=CellStyles'
							},
							{
								'id': 'StyleApplyNeutral',
								'type': 'toolitem',
								'text': _('Neutral'),
								'command': '.uno:StyleApply?Style:string=Neutral&FamilyName:string=CellStyles'
							},
							{
								'id': 'StyleApplyBad',
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
								'id': 'home-data-sort',
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
								'id': 'home-data-filter-auto-filter',
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

	getLayoutTab: function() {
		var content = [
			{
				'id': 'layout-page-format-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageFormatDialog', 'spreadsheet', true),
				'command': '.uno:PageFormatDialog'
			},
			{
				'id': 'layout-sheet-right-to-left',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SheetRightToLeft', 'spreadsheet'),
				'command': '.uno:SheetRightToLeft'
			},
			{
				'id': 'Data-PrintRangesMenu:MenuPrintRanges',
				'type': 'menubutton',
				'text': _UNO('.uno:PrintRangesMenu', 'spreadsheet'),
				'enabled': 'true'
			},
			{
				'id': 'Data-RowMenuHeight:MenuRowHeight',
				'type': 'menubutton',
				'text': _('Row Height'),
				'enabled': 'true'
			},
			{
				'id': 'Data-ColumnMenuWidth:MenuColumnWidth',
				'type': 'menubutton',
				'text': _('Column Width'),
				'enabled': 'true'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-insert-rows-before',
								'type': 'toolitem',
								'text': _('Insert Rows Above'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'id': 'layout-insert-columns-before',
								'type': 'toolitem',
								'text': _('Insert Columns Before'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'id': 'layout-delete-rows',
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
								'id': 'layout-insert-rows-after',
								'type': 'toolitem',
								'text': _('Insert Rows Below'),
								'command': '.uno:InsertRowsAfter'
							},
							{
								'id': 'layout-insert-columns-after',
								'type': 'toolitem',
								'text': _('Insert Columns After'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
								'id': 'layout-delete-columns',
								'type': 'toolitem',
								'text': _('Delete Columns'),
								'command': '.uno:DeleteColumns'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'layout-freeze-panes',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FreezePanes', 'spreadsheet', true),
				'command': '.uno:FreezePanes'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-freeze-panes-column',
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
								'id': 'layout-freeze-panes-row',
								'type': 'toolitem',
								'text': _UNO('.uno:FreezePanesRow', 'spreadsheet', true),
								'command': '.uno:FreezePanesRow'
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'layout-select-all',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SelectAll'),
				'command': '.uno:SelectAll'
			},
			{
				'id': 'Layout-Section-Align',
				'type': 'container',
				'children': [
					{
						'id': 'Layout-ObjectAlignLeft-ObjectAlignRight',
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-object-align-left',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft', 'text'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'id': 'layout-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter', 'text'),
								'command': '.uno:AlignCenter'
							},
							{
								'id': 'layout-align-right',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignRight', 'text'),
								'command': '.uno:ObjectAlignRight'
							}
						]
					},
					{
						'id': 'Layout-AlignUp-AlignDown',
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-align-up',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp', 'text'),
								'command': '.uno:AlignUp'
							},
							{
								'id': 'layout-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle', 'text'),
								'command': '.uno:AlignMiddle'
							},
							{
								'id': 'layout-align-down',
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
				'id': 'Layout-Section-ForwardBackward',
				'type': 'container',
				'children': [
					{
						'id': 'Layout-ObjectForwardOne-BringToFront',
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-object-forward-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne', 'text'),
								'command': '.uno:ObjectForwardOne'
							},
							{
								'id': 'layout-bring-to-front',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront', 'text'),
								'command': '.uno:BringToFront'
							}
						]
					},
					{
						'id': 'Layout-ObjectBackOne-SendToBack',
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-object-back-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne', 'text'),
								'command': '.uno:ObjectBackOne'
							},
							{
								'id': 'layout-send-to-back',
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

		return this.getTabPage('Sheet', content);
	},

	getViewTab: function() {
		var content = [
			(window.mode.isTablet()) ?
				{
					'id': 'closemobile',
					'type': 'bigcustomtoolitem',
					'text': _('Read mode'),
					'command': 'closetablet',
				} : {},
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
								'id': 'collapsenotebookbar',
								'type': 'menubartoolitem',
								'text': _('Collapse Tabs'),
								'command': _('Collapse Notebook Bar')
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
				'type': 'bigmenubartoolitem',
				'text': _('Dark Mode')
			},
			{
				'id': 'view-sidebardeck',
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

	getInsertTab: function() {
		var content = [
			{
				'id': 'insert-data-pilot-run',
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
								'id': 'insert-recalc-pivot-table',
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
								'id': 'insert-delete-pivot-table',
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
				'id': 'insert-insert-object-chart',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertObjectChart'),
				'command': '.uno:InsertObjectChart'
			},
			{
				'id': 'insert-insert-sparkline',
				'type': 'bigtoolitem',
				'text': _('Sparkline'),
				'command': '.uno:InsertSparkline'
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
								'id': 'insert-insert-graphic',
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
								'id': 'insert-function-dialog',
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
				'id': 'HyperlinkDialog',
				'type': 'bigcustomtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': 'hyperlinkdialog'
			},
			(this._map['wopi'].EnableRemoteLinkPicker) ? {
				'id': 'insert-smart-picker',
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
								'id': 'insert-insert-current-date',
                                'type': 'toolitem',
                                'text': _UNO('.uno:InsertCurrentDate', 'spreadsheet'),
                                'command': '.uno:InsertCurrentDate'
                            }
                        ]
                    },
                    {
                        'type': 'toolbox',
                        'children': [
                            {
								'id': 'insert-insert-current-time',
                                'type': 'toolitem',
                                'text': _UNO('.uno:InsertCurrentTime', 'spreadsheet'),
                                'command': '.uno:InsertCurrentTime'
                            }
                        ]
                    }
                ],
                'vertical': 'true'
            },
			{
				'id': 'Insert-Section-NameRangesTable-Ext',
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-add-name',
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
								'id': 'insert-define-name',
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
				'id': 'insert-draw-text',
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
								'id': 'insert-basic-shapes',
								'type': 'toolitem',
								'text': _('Shapes'),
								'command': '.uno:BasicShapes'
							}
						]
					},
					{
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-line',
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
								'id': 'insert-font-work-gallery-floater',
								'type': 'toolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater',
								// Fontwork export/import not supported in other formats.
								'visible': (L.LOUtil.isFileODF(this._map)) ? 'true' : 'false',
							}
						]
					},
					{
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-vertical-text',
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
				'id': 'insert-edit-header-and-footer',
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
								'id': 'CharmapControl',
								'type': 'customtoolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': 'charmapcontrol'
							}
						]
					},
					{
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insert-annotation',
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
				'id': 'data-data-sort',
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
								'id': 'data-sort-ascending',
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
								'id': 'data-sort-descending',
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
				'id': 'data-data-filter-auto-filter',
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
								'id': 'data-data-filter-standart-filter',
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
								'id': 'data-data-filter-special-filter',
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
								'id': 'data-data-filter-hide-auto-filter',
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
								'id': 'data-data-filter-remove-filter',
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
				'id': 'data-group',
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
								'id': 'data-ungroup',
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
								'id': 'data-clear-outline',
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
								'id': 'data-show-detail',
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
								'id': 'data-hide-detail',
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
				'id': 'data-calculate',
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
								'id': 'data-goal-seek-dialog',
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
								'id': 'data-validation',
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
				'id': 'review-spell-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SpellDialog'),
				'command': '.uno:SpellDialog'
			},
			{
				'id': 'LanguageMenu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:LanguageMenu'),
				'command': '.uno:LanguageMenu'
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
								'id': 'review-spell-online',
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
								'id': 'review-hyphenate',
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
				'id': 'review-insert-annotation',
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
								'id': 'review-delete-all-notes',
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
								'id': 'review-delete-note',
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
				'id': 'format-font-dialog',
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
				'id': 'format-paragraph-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog'),
				'command': '.uno:ParagraphDialog'
			},
			{
				'id': 'format-page-format-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageFormatDialog', 'spreadsheet', true),
				'command': '.uno:PageFormatDialog'
			},
			{
				'id': 'format-format-cell-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatCellDialog', 'spreadsheet', true),
				'command': '.uno:FormatCellDialog'
			},
			{
				'id': 'format-conditional-format-menu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'),
				'command': '.uno:ConditionalFormatMenu'
			},
			{
				'id': 'format-format-line',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatLine'),
				'command': '.uno:FormatLine'
			},
			{
				'id': 'format-format-area',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatArea'),
				'command': '.uno:FormatArea'
			},
			{
				'id': 'format-transform-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TransformDialog'),
				'command': '.uno:TransformDialog'
			},
			{
				'id': 'Format-SparklineMenu:FormatSparklineMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormatSparklineMenu', 'spreadsheet'),
				'enabled': 'true'
			},
		];

		return this.getTabPage('Format', content);
	},

	getDrawTab: function() {
		var content = [
			{
				'id': 'draw-transform-dialog',
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
								'id': 'draw-flip-vertical',
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
								'id': 'draw-flip-horizontal',
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
								'id': 'draw-xline-color',
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
								'id': 'draw-fill-color',
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
								'id': 'draw-wrap-off',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOff', 'text'),
								'command': '.uno:WrapOff'
							},
							{
								'id': 'draw-wrap-on',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOn', 'text'),
								'command': '.uno:WrapOn'
							},
							{
								'id': 'draw-wrap-ideal',
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
								'id': 'draw-wrap-left',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapLeft', 'text'),
								'command': '.uno:WrapLeft'
							},
							{
								'id': 'draw-wrap-through',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapThrough', 'text'),
								'command': '.uno:WrapThrough'
							},
							{
								'id': 'draw-wrap-right',
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
								'id': 'draw-object-align-left',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'id': 'draw-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter'
							},
							{
								'id': 'draw-object-align-right',
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
								'id': 'draw-align-up',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp'),
								'command': '.uno:AlignUp'
							},
							{
								'id': 'draw-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle'
							},
							{
								'id': 'draw-align-down',
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
								'id': 'draw-bring-to-front',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront'
							},
							{
								'id': 'draw-send-to-back',
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
								'id': 'draw-object-forward-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							},
							{
								'id': 'draw-object-back-one',
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
				'id': 'draw-format-group',
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
								'id': 'draw-enter-group',
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
								'id': 'draw-leave-group',
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
						'id': 'LineA6',
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-basic-shapes',
								'type': 'toolitem',
								'text': _('Shapes'),
								'command': '.uno:BasicShapes'
							}
						]
					},
					{
						'id': 'LineB7',
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
				'id': 'Insert-Text-Fontwork',
				'type': 'container',
				'children': [
					{
						'id': 'LineA153',
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-font-work-gallery-floater',
								'type': 'toolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater',
								// Fontwork export/import not supported in other formats.
								'visible': (L.LOUtil.isFileODF(this._map)) ? 'true' : 'false',
							}
						]
					},
					{
						'id': 'LineB163',
						'type': 'toolbox',
						'children': [
							{
								'id': 'draw-vertical-text',
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
	}
});

L.control.notebookbarCalc = function (options) {
	return new L.Control.NotebookbarCalc(options);
};
