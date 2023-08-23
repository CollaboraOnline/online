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
				'accessibility': { focusBack: true,	combination: 'F', de: null }
			},
			{
				'id': this.HOME_TAB_ID,
				'text': _('Home'),
				'name': 'Home',
				'context': 'default|Cell|Text|DrawText',
				'accessibility': { focusBack: true,	combination: 'H', de: null }
			},
			{
				'id': 'Insert-tab-label',
				'text': _('Insert'),
				'name': 'Insert',
				'accessibility': { focusBack: true,	combination: 'N', de: null }
			},
			{
				'id': 'Layout-tab-label',
				'text': _('Layout'),
				'name': 'Layout',
				'accessibility': { focusBack: true,	combination: 'P', de: null }
			},
			{
				'id': 'Data-tab-label',
				'text': _('Data'),
				'name': 'Data',
				'accessibility': { focusBack: true,	combination: 'A', de: null }
			},
			{
				'id': 'Review-tab-label',
				'text': _('Review'),
				'name': 'Review',
				'accessibility': { focusBack: true,	combination: 'R', de: null }
			},
			{
				'id': 'Format-tab-label',
				'text': _('Format'),
				'name': 'Format',
				'accessibility': { focusBack: true,	combination: 'M', de: null }
			},
			{
				'id': 'Draw-tab-label',
				'text': _('Draw'),
				'name': 'Draw',
				'context': 'Draw|DrawLine|3DObject|MultiObject|Graphic|DrawFontwork',
				'accessibility': { focusBack: true,	combination: 'D', de: null }
			},
			{
				'id': 'View-tab-label',
				'text': _('View'),
				'name': 'View',
				'accessibility': { focusBack: true,	combination: 'W', de: null }
			},
			{
				'id': 'Help-tab-label',
				'text': _('Help'),
				'name': 'Help',
				'accessibility': { focusBack: true,	combination: 'Y1', de: null }
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
						'command': '.uno:Save',
						'accessibility': { focusBack: true,	combination: 'S', de: null }
					}
				]
			}: {},
			!this._map['wopi'].UserCanNotWriteRelative ? (
				(window.uiDefaults && window.uiDefaults.saveAsMode === 'group') ? {
					'id': 'saveas',
					'type': 'bigmenubartoolitem',
					'text': _('Save As'),
					'accessibility': { focusBack: true,	combination: 'A', de: null }
				}:
				{
					'id': 'file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'spreadsheet'),
					'command': '.uno:SaveAs',
					'accessibility': { focusBack: true,	combination: 'A', de: null }
				}
			): {},
			!this._map['wopi'].UserCanNotWriteRelative ? {
				'id': 'exportas',
				'class': 'unoexportas',
				'type': 'bigmenubartoolitem',
				'text': _('Export As'),
				'accessibility': { focusBack: true,	combination: 'E', de: null }
			}: {},
			{
				'id': 'file-shareas-rev-history',
				'type': 'container',
				'children': [
					this._map['wopi'].EnableShare ?
						{
							'id': 'ShareAs',
							'class': 'unoShareAs',
							'type': 'customtoolitem',
							'text': _('Share'),
							'command': 'shareas',
							'inlineLabel': true,
							'accessibility': { focusBack: true,	combination: 'Z', de: null }
						} : {},
						L.Params.revHistoryEnabled ?
						{
							'id': 'Rev-History',
							'class': 'unoRev-History',
							'type': 'customtoolitem',
							'text': _('See history'),
							'command': 'rev-history',
							'inlineLabel': true,
							'accessibility': { focusBack: true,	combination: 'RV', de: null }
						} : {},
				],
				'vertical': 'true'
			},
			!this._map['wopi'].HidePrintOption ?
			{
				'id': 'print',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Print', 'spreadsheet'),
				'command': '.uno:Print',
				'accessibility': { focusBack: true,	combination: 'PT', de: null }
			} : {},
			(!(window.enableMacrosExecution  === 'false')) ?
			{
				'type': 'toolbox',
				'children': [
					{
						'id': 'runmacro',
						'type': 'bigtoolitem',
						'text': _UNO('.uno:RunMacro', 'text'),
						'command': '.uno:RunMacro',
						'accessibility': { focusBack: true,	combination: 'M', de: null }
					}
				]
			} : {},
			!!window.groupDownloadAsForNb && !this._map['wopi'].HideExportOption ? {
				'id': 'downloadas',
				'class': 'unodownloadas',
				'type': 'bigmenubartoolitem',
				'text': _('Download'),
				'accessibility': { focusBack: true,	combination: 'DA', de: null }
			}: (!this._map['wopi'].HideExportOption ? (
				{
					'id': 'file-downloadas-ods-downloadas-csv',
					'type': 'container',
					'children': [
						{
							'id': 'downloadas-ods',
							'type': 'menubartoolitem',
							'text': _('ODF Spreadsheet (.ods)'),
							'command': '',
							'accessibility': { focusBack: true,	combination: 'DS', de: null }
						},
						{
							'id': 'downloadas-csv',
							'type': 'menubartoolitem',
							'text': _('CSV File (.csv)'),
							'command': '',
							'accessibility': { focusBack: true,	combination: 'DV', de: null }
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
							'command': '',
							'accessibility': { focusBack: true,	combination: 'DX', de: null }
						},
						{
							'id': 'downloadas-xlsx',
							'type': 'menubartoolitem',
							'text': _('Excel Spreadsheet (.xlsx)'),
							'command': '',
							'accessibility': { focusBack: true,	combination: 'DL', de: null }
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
							'inlineLabel': true,
							'accessibility': { focusBack: true,	combination: 'EP', de: null }
						},
						{
							'id': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'type': 'customtoolitem',
							'text': _('PDF Document (.pdf) - Expert'),
							'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
							'inlineLabel': true,
							'accessibility': { focusBack: true,	combination: 'ED', de: null }
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
						'class': 'unorepair',
						'type': 'bigmenubartoolitem',
						'text': _('Repair'),
						'command': _('Repair'),
						'accessibility': { focusBack: true,	combination: 'RP', de: null }
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
						'command': '.uno:SetDocumentProperties',
						'accessibility': { focusBack: true,	combination: 'PR', de: null }
					}
				]
			},
			{
				'type': 'container',
				'children': [
					{
						'id': 'renamedocument',
						'class': 'unoRenameDocument',
						'type': 'bigcustomtoolitem',
						'text': _('Rename'),
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
						'command': '.uno:Undo',
						'accessibility': { focusBack: true,	combination: 'ZZ', de: null }
					},
					{
						'id': 'home-redo',
						'type': 'toolitem',
						'text': _UNO('.uno:Redo'),
						'command': '.uno:Redo',
						'accessibility': { focusBack: true,	combination: 'O', de: null }
					},
				],
				'vertical': 'true'
			},
			{
				'id': 'home-paste',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Paste'),
				'command': '.uno:Paste',
				'accessibility': { focusBack: true,	combination: 'V', de: null }
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
								'command': '.uno:Cut',
								'accessibility': { focusBack: true,	combination: 'X', de: null }
							},
							{
								'id': 'home-format-paint-brush',
								'type': 'toolitem',
								'text': _UNO('.uno:FormatPaintbrush'),
								'command': '.uno:FormatPaintbrush',
								'accessibility': { focusBack: true,	combination: 'FP', de: null }
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
								'command': '.uno:Copy',
								'accessibility': { focusBack: true,	combination: 'C', de: null }
							},
							{
								'id': 'home-reset-attributes',
								'type': 'toolitem',
								'text': _UNO('.uno:ResetAttributes'),
								'command': '.uno:ResetAttributes',
								'accessibility': { focusBack: true,	combination: 'E', de: null }
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
								'command': '.uno:CharFontName',
								'accessibility': { focusBack: true,	combination: 'FF', de: null }
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
								'command': '.uno:FontHeight',
								'accessibility': { focusBack: true,	combination: 'FS', de: null }
							},
							{
								'id': 'home-grow',
								'type': 'toolitem',
								'text': _UNO('.uno:Grow'),
								'command': '.uno:Grow',
								'accessibility': { focusBack: true,	combination: 'FG', de: null }
							},
							{
								'id': 'home-shrink',
								'type': 'toolitem',
								'text': _UNO('.uno:Shrink'),
								'command': '.uno:Shrink',
								'accessibility': { focusBack: true,	combination: 'FK', de: null }
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
								'command': '.uno:Bold',
								'accessibility': { focusBack: true,	combination: '1', de: null }
							},
							{
								'id': 'home-italic',
								'type': 'toolitem',
								'text': _UNO('.uno:Italic'),
								'command': '.uno:Italic',
								'accessibility': { focusBack: true,	combination: '2', de: null }
							},
							{
								'id': 'home-underline',
								'type': 'toolitem',
								'text': _UNO('.uno:Underline'),
								'command': '.uno:Underline',
								'accessibility': { focusBack: true,	combination: '3', de: null }
							},
							{
								'id': 'home-strikeout',
								'type': 'toolitem',
								'text': _UNO('.uno:Strikeout'),
								'command': '.uno:Strikeout',
								'accessibility': { focusBack: true,	combination: '4', de: null }
							},
							{
								'id': 'home-subscript',
								'type': 'toolitem',
								'text': _UNO('.uno:SubScript'),
								'command': '.uno:SubScript',
								'accessibility': { focusBack: true,	combination: '5', de: null }
							},
							{
								'id': 'home-superscript',
								'type': 'toolitem',
								'text': _UNO('.uno:SuperScript'),
								'command': '.uno:SuperScript',
								'accessibility': { focusBack: true,	combination: '6', de: null }
							},
							{
								'id': 'home-set-border-style',
								'type': 'toolitem',
								'text': _UNO('.uno:SetBorderStyle'),
								'command': '.uno:SetBorderStyle',
								'accessibility': { focusBack: true,	combination: 'B', de: null }
							},
							{
								'id': 'home-background-color',
								'class': 'unospan-BackgroundColor',
								'type': 'toolitem',
								'text': _UNO('.uno:BackgroundColor'),
								'command': '.uno:BackgroundColor',
								'accessibility': { focusBack: true,	combination: 'H', de: null }
							},
							{
								'id': 'home-color',
								'class': 'unospan-FontColor',
								'type': 'toolitem',
								'text': _UNO('.uno:Color'),
								'command': '.uno:Color',
								'accessibility': { focusBack: true,	combination: 'FC', de: null }
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
										'command': '.uno:AlignTop',
										'accessibility': { focusBack: true,	combination: 'AT', de: null }
									},
									{
										'id': 'home-align-vertical-center',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignVCenter', 'spreadsheet'),
										'command': '.uno:AlignVCenter',
										'accessibility': { focusBack: true,	combination: 'AM', de: null }
									},
									{
										'id': 'home-align-bottom',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignBottom', 'spreadsheet'),
										'command': '.uno:AlignBottom',
										'accessibility': { focusBack: true,	combination: 'AB', de: null }
									},
									{
										'id': 'home-increment-indent',
										'type': 'toolitem',
										'text': _UNO('.uno:IncrementIndent'),
										'command': '.uno:IncrementIndent',
										'accessibility': { focusBack: true,	combination: '7', de: null }
									},
									{
										'id': 'home-decrement-indent',
										'type': 'toolitem',
										'text': _UNO('.uno:DecrementIndent'),
										'command': '.uno:DecrementIndent',
										'accessibility': { focusBack: true,	combination: '8', de: null }
									},
									{
										'id': 'home-para-left-to-right',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaLeftToRight'),
										'command': '.uno:ParaLeftToRight',
										'accessibility': { focusBack: true,	combination: 'RL', de: null }
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
										'command': '.uno:AlignLeft',
										'accessibility': { focusBack: true,	combination: 'AL', de: null }
									},
									{
										'id': 'home-align-horizontal-center',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignHorizontalCenter', 'spreadsheet'),
										'command': '.uno:AlignHorizontalCenter',
										'accessibility': { focusBack: true,	combination: 'AC', de: null }
									},
									{
										'id': 'home-align-right',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignRight', 'spreadsheet'),
										'command': '.uno:AlignRight',
										'accessibility': { focusBack: true,	combination: 'AR', de: null }
									},
									{
										'id': 'home-align-block',
										'type': 'toolitem',
										'text': _UNO('.uno:AlignBlock', 'spreadsheet'),
										'command': '.uno:AlignBlock',
										'accessibility': { focusBack: true,	combination: 'AO', de: null }
									},
									{
										'id': 'home-wrap-text',
										'type': 'toolitem',
										'text': _UNO('.uno:WrapText', 'spreadsheet'),
										'command': '.uno:WrapText',
										'accessibility': { focusBack: true,	combination: 'W', de: null }
									},
									{
										'id': 'home-para-right-to-left',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaRightToLeft'),
										'command': '.uno:ParaRightToLeft',
										'accessibility': { focusBack: true,	combination: 'RR', de: null }
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
						],
						'accessibility': { focusBack: true,	combination: 'N', de: null }
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
										'command': '.uno:NumberFormatCurrency',
										'accessibility': { focusBack: true,	combination: 'P', de: null }
									},
									{
										'id': 'home-number-format-percent',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatPercent', 'spreadsheet'),
										'command': '.uno:NumberFormatPercent',
										'accessibility': { focusBack: true,	combination: 'AN', de: null }
									},
									{
										'id': 'home-number-format-decimal',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatDecimal', 'spreadsheet'),
										'command': '.uno:NumberFormatDecimal',
										'accessibility': { focusBack: true,	combination: 'K', de: null }
									}
								]
							},
							{
								'id': 'second2',
								'type': 'toolbox',
								'children': [
									{
										'id': 'home-number-format-increment-decimals',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatIncDecimals', 'spreadsheet'),
										'command': '.uno:NumberFormatIncDecimals',
										'accessibility': { focusBack: true,	combination: '0', de: null }
									},
									{
										'id': 'home-number-format-decrement-decimals',
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatDecDecimals', 'spreadsheet'),
										'command': '.uno:NumberFormatDecDecimals',
										'accessibility': { focusBack: true,	combination: '9', de: null }
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
				'command': '.uno:ToggleMergeCells',
				'accessibility': { focusBack: true,	combination: 'M', de: null }
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
								'command': '.uno:InsertRowsBefore',
								'accessibility': { focusBack: true,	combination: 'RB', de: null }
							},
							{
								'id': 'home-insert-rows-after',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'spreadsheet'),
								'command': '.uno:InsertRowsAfter',
								'accessibility': { focusBack: true,	combination: 'RA', de: null }
							},
							{
								'id': 'home-delete-rows',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteRows', 'spreadsheet'),
								'command': '.uno:DeleteRows',
								'accessibility': { focusBack: true,	combination: 'RD', de: null }
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
								'command': '.uno:InsertColumnsBefore',
								'accessibility': { focusBack: true,	combination: 'UB', de: null }
							},
							{
								'id': 'home-insert-columns-after',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'spreadsheet'),
								'command': '.uno:InsertColumnsAfter',
								'accessibility': { focusBack: true,	combination: 'UA', de: null }
							},
							{
								'id': 'home-delete-columns',
								'type': 'toolitem',
								'text': _UNO('.uno:DeleteColumns', 'spreadsheet'),
								'command': '.uno:DeleteColumns',
								'accessibility': { focusBack: true,	combination: 'UD', de: null }
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
				'command': '.uno:ConditionalFormatMenu',
				'accessibility': { focusBack: true,	combination: 'L', de: null }
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
								'command': '.uno:StyleApply?Style:string=Default&FamilyName:string=CellStyles',
								'accessibility': { focusBack: true,	combination: 'AD', de: null }
							},
							{
								'id': 'StyleApplyHeading1',
								'type': 'toolitem',
								'text': _('Heading 1'),
								'command': '.uno:StyleApply?Style:string=Heading 1&FamilyName:string=CellStyles',
								'accessibility': { focusBack: true,	combination: 'D1', de: null }
							},
							{
								'id': 'StyleApplyHeading2',
								'type': 'toolitem',
								'text': _('Heading 2'),
								'command': '.uno:StyleApply?Style:string=Heading 2&FamilyName:string=CellStyles',
								'accessibility': { focusBack: true,	combination: 'D2', de: null }
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
								'command': '.uno:StyleApply?Style:string=Good&FamilyName:string=CellStyles',
								'accessibility': { focusBack: true,	combination: 'TG', de: null }
							},
							{
								'id': 'StyleApplyNeutral',
								'type': 'toolitem',
								'text': _('Neutral'),
								'command': '.uno:StyleApply?Style:string=Neutral&FamilyName:string=CellStyles',
								'accessibility': { focusBack: true,	combination: 'TN', de: null }
							},
							{
								'id': 'StyleApplyBad',
								'type': 'toolitem',
								'text': _('Bad'),
								'command': '.uno:StyleApply?Style:string=Bad&FamilyName:string=CellStyles',
								'accessibility': { focusBack: true,	combination: 'TB', de: null }
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
									'id': 'home-search',
									'type': 'menubartoolitem',
									'text': _('Search'),
									'command': _('Show Status Bar'),
									'accessibility': { focusBack: false,	combination: 'SS',	de: 'SS' }
								}
							]
						},
						{
							'type': 'toolbox',
							'children': [
								{
									'id': 'home-search-dialog',
									'type': 'toolitem',
									'text': _UNO('.uno:SearchDialog'),
									'command': '.uno:SearchDialog',
									'accessibility': { focusBack: false, 	combination: 'FD',	de: null }
								}
							]
						}
					],
				'vertical': 'true'
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
								'command': '.uno:DataSort',
								'accessibility': { focusBack: true,	combination: 'S', de: null }
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
								'command': '.uno:DataFilterAutoFilter',
								'accessibility': { focusBack: true,	combination: 'FI', de: null }
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
				'command': '.uno:PageFormatDialog',
				'accessibility': { focusBack: true,	combination: 'FD', de: null }
			},
			{
				'id': 'layout-sheet-right-to-left',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SheetRightToLeft', 'spreadsheet'),
				'command': '.uno:SheetRightToLeft',
				'accessibility': { focusBack: true,	combination: 'RL', de: null }
			},
			{
				'id': 'Data-PrintRangesMenu:MenuPrintRanges',
				'class': 'unoData-PrintRangesMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:PrintRangesMenu', 'spreadsheet'),
				'enabled': 'true',
				'accessibility': { focusBack: true,	combination: 'PR', de: null }
			},
			{
				'id': 'Data-RowMenuHeight:MenuRowHeight',
				'class': 'unoData-RowMenuHeight',
				'type': 'menubutton',
				'text': _('Row Height'),
				'enabled': 'true',
				'accessibility': { focusBack: true,	combination: 'RH', de: null }
			},
			{
				'id': 'Data-ColumnMenuWidth:MenuColumnWidth',
				'class': 'unoData-ColumnMenuWidth',
				'type': 'menubutton',
				'text': _('Column Width'),
				'enabled': 'true',
				'accessibility': { focusBack: true,	combination: 'CW', de: null }
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
								'command': '.uno:InsertRowsBefore',
								'accessibility': { focusBack: true,	combination: 'RB', de: null }
							},
							{
								'id': 'layout-insert-columns-before',
								'type': 'toolitem',
								'text': _('Insert Columns Before'),
								'command': '.uno:InsertColumnsBefore',
								'accessibility': { focusBack: true,	combination: 'CB', de: null }
							},
							{
								'id': 'layout-delete-rows',
								'type': 'toolitem',
								'text': _('Delete Rows'),
								'command': '.uno:DeleteRows',
								'accessibility': { focusBack: true,	combination: 'RD', de: null }
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
								'command': '.uno:InsertRowsAfter',
								'accessibility': { focusBack: true,	combination: 'RA', de: null }
							},
							{
								'id': 'layout-insert-columns-after',
								'type': 'toolitem',
								'text': _('Insert Columns After'),
								'command': '.uno:InsertColumnsAfter',
								'accessibility': { focusBack: true,	combination: 'CA', de: null }
							},
							{
								'id': 'layout-delete-columns',
								'type': 'toolitem',
								'text': _('Delete Columns'),
								'command': '.uno:DeleteColumns',
								'accessibility': { focusBack: true,	combination: 'CD', de: null }
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
				'command': '.uno:FreezePanes',
				'accessibility': { focusBack: true,	combination: 'FP', de: null }
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
								'command': '.uno:FreezePanesColumn',
								'accessibility': { focusBack: true,	combination: 'FC', de: null }
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
								'command': '.uno:FreezePanesRow',
								'accessibility': { focusBack: true,	combination: 'FR', de: null }
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
				'command': '.uno:SelectAll',
				'accessibility': { focusBack: true,	combination: 'SA', de: null }
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
								'command': '.uno:ObjectAlignLeft',
								'accessibility': { focusBack: true,	combination: 'AL', de: null }
							},
							{
								'id': 'layout-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter', 'text'),
								'command': '.uno:AlignCenter',
								'accessibility': { focusBack: true,	combination: 'AC', de: null }
							},
							{
								'id': 'layout-align-right',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignRight', 'text'),
								'command': '.uno:ObjectAlignRight',
								'accessibility': { focusBack: true,	combination: 'AR', de: null }
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
								'command': '.uno:AlignUp',
								'accessibility': { focusBack: true,	combination: 'AU', de: null }
							},
							{
								'id': 'layout-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle', 'text'),
								'command': '.uno:AlignMiddle',
								'accessibility': { focusBack: true,	combination: 'AM', de: null }
							},
							{
								'id': 'layout-align-down',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignDown', 'text'),
								'command': '.uno:AlignDown',
								'accessibility': { focusBack: true,	combination: 'AD', de: null }
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
								'command': '.uno:ObjectForwardOne',
								'accessibility': { focusBack: true,	combination: 'FO', de: null }
							},
							{
								'id': 'layout-bring-to-front',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront', 'text'),
								'command': '.uno:BringToFront',
								'accessibility': { focusBack: true,	combination: 'AF', de: null }
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
								'command': '.uno:ObjectBackOne',
								'accessibility': { focusBack: true,	combination: 'BO', de: null }
							},
							{
								'id': 'layout-send-to-back',
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack', 'text'),
								'command': '.uno:SendToBack',
								'accessibility': { focusBack: true,	combination: 'AE', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('Layout', content);
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
				'command': '.uno:FullScreen',
				'accessibility': { focusBack: true,	combination: 'FS', de: null }
			},
			{
				'id': 'zoomreset',
				'class': 'unozoomreset',
				'type': 'menubartoolitem',
				'text': _('Reset zoom'),
				'command': _('Reset zoom'),
				'accessibility': { focusBack: true,	combination: 'J', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'zoomout',
								'class': 'unozoomout',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:ZoomMinus'),
								'command': '.uno:ZoomMinus',
								'accessibility': { focusBack: true,	combination: 'ZO', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'zoomin',
								'class': 'unozoomin',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:ZoomPlus'),
								'command': '.uno:ZoomPlus',
								'accessibility': { focusBack: true,	combination: 'ZI', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'toggleuimode',
				'class': 'unotoggleuimode',
				'type': 'bigmenubartoolitem',
				'text': _('Compact view'),
				'command': _('Toggle UI Mode'),
				'accessibility': { focusBack: true,	combination: 'UI', de: null }
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
								'command': _('Collapse Notebook Bar'),
								'accessibility': { focusBack: true,	combination: 'CT', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'showstatusbar',
								'class': 'unoshowstatusbar',
								'type': 'menubartoolitem',
								'text': _('Status Bar'),
								'command': _('Show Status Bar'),
								'accessibility': { focusBack: true,	combination: 'SB', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id':'toggledarktheme',
				'type': 'bigmenubartoolitem',
				'text': _('Dark Mode'),
				'accessibility': { focusBack: true,	combination: 'DT', de: null }
			},
			{
				'id': 'view-sidebardeck',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Sidebar'),
				'command': '.uno:SidebarDeck.PropertyDeck',
				'accessibility': { focusBack: true,	combination: 'SD', de: null }
			},
			{
				'id': 'view-navigator',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator',
				'accessibility': { focusBack: true,	combination: 'N', de: null }
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
				'command': '.uno:DataDataPilotRun',
				'accessibility': { focusBack: true,	combination: 'V', de: null }
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
								'command': '.uno:RecalcPivotTable',
								'accessibility': { focusBack: true,	combination: 'R', de: null }
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
								'command': '.uno:DeletePivotTable',
								'accessibility': { focusBack: true,	combination: 'DV', de: null }
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
				'command': '.uno:InsertObjectChart',
				'accessibility': { focusBack: true,	combination: 'IC', de: null }
			},
			{
				'id': 'insert-insert-sparkline',
				'type': 'bigtoolitem',
				'text': _('Sparkline'),
				'command': '.uno:InsertSparkline',
				'accessibility': { focusBack: true,	combination: 'IS', de: null }
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
								'command': '.uno:InsertGraphic',
								'accessibility': { focusBack: true,	combination: 'IG', de: null }
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
								'command': '.uno:FunctionDialog',
								'accessibility': { focusBack: true,	combination: 'FD', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'HyperlinkDialog',
				'class': 'unoHyperlinkDialog',
				'type': 'bigcustomtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': 'hyperlinkdialog',
				'accessibility': { focusBack: true,	combination: 'I2', de: null }
			},
			(this._map['wopi'].EnableRemoteLinkPicker) ? {
				'id': 'insert-smart-picker',
				'type': 'bigcustomtoolitem',
				'text': _('Smart Picker'),
				'command': 'remotelink',
				'accessibility': { focusBack: true,	combination: 'LR', de: null }
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
                                'command': '.uno:InsertCurrentDate',
								'accessibility': { focusBack: true,	combination: 'ID', de: null }
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
                                'command': '.uno:InsertCurrentTime',
								'accessibility': { focusBack: true,	combination: 'IT', de: null }
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
								'command': '.uno:AddName',
								'accessibility': { focusBack: true,	combination: 'IN', de: null }
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
								'command': '.uno:DefineName',
								'accessibility': { focusBack: true,	combination: 'DN', de: null }
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
				'command': '.uno:DrawText',
				'accessibility': { focusBack: true,	combination: 'DT', de: null }
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
								'command': '.uno:BasicShapes',
								'accessibility': { focusBack: true,	combination: 'IP', de: null }
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
								'command': '.uno:Line',
								'accessibility': { focusBack: true,	combination: 'IL', de: null }
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
								'accessibility': { focusBack: true,	combination: 'IF', de: null }
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
								'command': '.uno:VerticalText',
								'accessibility': { focusBack: true,	combination: 'IV', de: null }
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
				'command': '.uno:EditHeaderAndFooter',
				'accessibility': { focusBack: true,	combination: 'IH', de: null }
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
								'class': 'unoCharmapControl',
								'type': 'customtoolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': 'charmapcontrol',
								'accessibility': { focusBack: true,	combination: 'ZS', de: null }
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
								'command': '.uno:InsertAnnotation',
								'accessibility': { focusBack: true,	combination: 'IA', de: null }
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
				'command': '.uno:DataSort',
				'accessibility': { focusBack: true,	combination: 'SS', de: null }
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
								'command': '.uno:SortAscending',
								'accessibility': { focusBack: true,	combination: 'SA', de: null }
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
								'command': '.uno:SortDescending',
								'accessibility': { focusBack: true,	combination: 'SD', de: null }
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
				'command': '.uno:DataFilterAutoFilter',
				'accessibility': { focusBack: true,	combination: 'T', de: null }
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
								'command': '.uno:DataFilterStandardFilter',
								'accessibility': { focusBack: true,	combination: 'SF', de: null }
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
								'command': '.uno:DataFilterSpecialFilter',
								'accessibility': { focusBack: true,	combination: 'Q', de: null }
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
								'command': '.uno:DataFilterHideAutoFilter',
								'accessibility': { focusBack: true,	combination: 'HF', de: null }
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
								'command': '.uno:DataFilterRemoveFilter',
								'accessibility': { focusBack: true,	combination: 'FR', de: null }
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
				'command': '.uno:Group',
				'accessibility': { focusBack: true,	combination: 'GA', de: null }
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
								'command': '.uno:Ungroup',
								'accessibility': { focusBack: true,	combination: 'GR', de: null }
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
								'command': '.uno:ClearOutline',
								'accessibility': { focusBack: true,	combination: 'CO', de: null }
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
								'command': '.uno:ShowDetail',
								'accessibility': { focusBack: true,	combination: 'DS', de: null }
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
								'command': '.uno:HideDetail',
								'accessibility': { focusBack: true,	combination: 'DH', de: null }
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
				'command': '.uno:Calculate',
				'accessibility': { focusBack: true,	combination: 'R', de: null }
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
								'command': '.uno:GoalSeekDialog',
								'accessibility': { focusBack: true,	combination: 'SG', de: null }
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
								'command': '.uno:Validation',
								'accessibility': { focusBack: true,	combination: 'DV', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Data-StatisticsMenu:Menu Statistic',
				'class': 'unoData-StatisticsMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:StatisticsMenu', 'spreadsheet'),
				'enabled': 'true',
				'accessibility': { focusBack: true,	combination: 'DS', de: null }
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
				'command': '.uno:SpellDialog',
				'accessibility': { focusBack: true,	combination: 'S', de: null }
			},
			{
				'id': 'LanguageMenu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:LanguageMenu'),
				'command': '.uno:LanguageMenu',
				'accessibility': { focusBack: true,	combination: 'L', de: null }
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
								'command': '.uno:SpellOnline',
								'accessibility': { focusBack: true,	combination: 'O', de: null }
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
								'command': '.uno:Hyphenate',
								'accessibility': { focusBack: true,	combination: 'H', de: null }
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
				'command': '.uno:InsertAnnotation',
				'accessibility': { focusBack: true,	combination: 'IA', de: null }
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
								'command': '.uno:DeleteAllNotes',
								'accessibility': { focusBack: true,	combination: 'DA', de: null }
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
								'command': '.uno:DeleteNote',
								'accessibility': { focusBack: true,	combination: 'DO', de: null }
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
				'command': '.uno:FontDialog',
				'accessibility': { focusBack: true,	combination: 'FD', de: null }
			},
			{
				'id': 'FormatMenu:FormatMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormatMenu', 'spreadsheet'),
				'command': '.uno:FormatMenu',
				'accessibility': { focusBack: true,	combination: 'FM', de: null }
			},
			{
				'id': 'format-paragraph-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog'),
				'command': '.uno:ParagraphDialog',
				'accessibility': { focusBack: true,	combination: 'PD', de: null }
			},
			{
				'id': 'format-page-format-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageFormatDialog', 'spreadsheet', true),
				'command': '.uno:PageFormatDialog',
				'accessibility': { focusBack: true,	combination: 'PD', de: null }
			},
			{
				'id': 'format-format-cell-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatCellDialog', 'spreadsheet', true),
				'command': '.uno:FormatCellDialog',
				'accessibility': { focusBack: true,	combination: 'FC', de: null }
			},
			{
				'id': 'format-conditional-format-menu',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ConditionalFormatMenu', 'spreadsheet'),
				'command': '.uno:ConditionalFormatMenu',
				'accessibility': { focusBack: true,	combination: 'CF', de: null }
			},
			{
				'id': 'format-format-line',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatLine'),
				'command': '.uno:FormatLine',
				'accessibility': { focusBack: true,	combination: 'FL', de: null }
			},
			{
				'id': 'format-format-area',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatArea'),
				'command': '.uno:FormatArea',
				'accessibility': { focusBack: true,	combination: 'FA', de: null }
			},
			{
				'id': 'format-transform-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TransformDialog'),
				'command': '.uno:TransformDialog',
				'accessibility': { focusBack: true,	combination: 'TD', de: null }
			},
			{
				'id': 'Format-SparklineMenu:FormatSparklineMenu',
				'class': 'unoFormat-SparklineMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:FormatSparklineMenu', 'spreadsheet'),
				'enabled': 'true',
				'accessibility': { focusBack: true,	combination: 'SM', de: null }
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
				'command': '.uno:TransformDialog',
				'accessibility': { focusBack: true,	combination: 'TD', de: null }
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
								'command': '.uno:FlipVertical',
								'accessibility': { focusBack: true,	combination: 'FV', de: null }
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
								'command': '.uno:FlipHorizontal',
								'accessibility': { focusBack: true,	combination: 'FH', de: null }
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
								'command': '.uno:XLineColor',
								'accessibility': { focusBack: true,	combination: 'DX', de: null }
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
								'command': '.uno:FillColor',
								'accessibility': { focusBack: true,	combination: 'FC', de: null }
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
								'command': '.uno:WrapOff',
								'accessibility': { focusBack: true,	combination: 'WO', de: null }
							},
							{
								'id': 'draw-wrap-on',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapOn', 'text'),
								'command': '.uno:WrapOn',
								'accessibility': { focusBack: true,	combination: 'WN', de: null }
							},
							{
								'id': 'draw-wrap-ideal',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapIdeal', 'text'),
								'command': '.uno:WrapIdeal',
								'accessibility': { focusBack: true,	combination: 'WI', de: null }
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
								'command': '.uno:WrapLeft',
								'accessibility': { focusBack: true,	combination: 'WL', de: null }
							},
							{
								'id': 'draw-wrap-through',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapThrough', 'text'),
								'command': '.uno:WrapThrough',
								'accessibility': { focusBack: true,	combination: 'WT', de: null }
							},
							{
								'id': 'draw-wrap-right',
								'type': 'toolitem',
								'text': _UNO('.uno:WrapRight', 'text'),
								'command': '.uno:WrapRight',
								'accessibility': { focusBack: true,	combination: 'WR', de: null }
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
								'command': '.uno:ObjectAlignLeft',
								'accessibility': { focusBack: true,	combination: 'AL', de: null }
							},
							{
								'id': 'draw-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter',
								'accessibility': { focusBack: true,	combination: 'AC', de: null }
							},
							{
								'id': 'draw-object-align-right',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignRight'),
								'command': '.uno:ObjectAlignRight',
								'accessibility': { focusBack: true,	combination: 'AR', de: null }
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
								'command': '.uno:AlignUp',
								'accessibility': { focusBack: true,	combination: 'AU', de: null }
							},
							{
								'id': 'draw-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle',
								'accessibility': { focusBack: true,	combination: 'AM', de: null }
							},
							{
								'id': 'draw-align-down',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignDown'),
								'command': '.uno:AlignDown',
								'accessibility': { focusBack: true,	combination: 'AD', de: null }
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
								'command': '.uno:BringToFront',
								'accessibility': { focusBack: true,	combination: 'BF', de: null }
							},
							{
								'id': 'draw-send-to-back',
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack'),
								'command': '.uno:SendToBack',
								'accessibility': { focusBack: true,	combination: 'SB', de: null }
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
								'command': '.uno:ObjectForwardOne',
								'accessibility': { focusBack: true,	combination: 'FO', de: null }
							},
							{
								'id': 'draw-object-back-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne',
								'accessibility': { focusBack: true,	combination: 'BO', de: null }
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
				'command': '.uno:FormatGroup',
				'accessibility': { focusBack: true,	combination: 'FG', de: null }
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
								'command': '.uno:EnterGroup',
								'accessibility': { focusBack: true,	combination: 'EG', de: null }
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
								'command': '.uno:LeaveGroup',
								'accessibility': { focusBack: true,	combination: 'LG', de: null }
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
				'command': '.uno:Text',
				'accessibility': { focusBack: true,	combination: 'DT', de: null }
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
								'command': '.uno:BasicShapes',
								'accessibility': { focusBack: true,	combination: 'BS', de: null }
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
								'command': '.uno:Line',
								'accessibility': { focusBack: true,	combination: 'DL', de: null }
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
								'accessibility': { focusBack: true,	combination: 'FW', de: null }
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
								'command': '.uno:VerticalText',
								'accessibility': { focusBack: true,	combination: 'DV', de: null }
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
