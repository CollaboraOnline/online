/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * L.Control.NotebookbarDraw - definition of notebookbar content in Draw
 */

/* global _ _UNO */
L.Control.NotebookbarDraw = L.Control.NotebookbarImpress.extend({

	getShortcutsBarData: function() {
		return [
			!this._map['wopi'].HideSaveOption ?
				{
					'id': 'shortcutstoolbox',
					'type': 'toolbox',
					'children': [
						{
							'id': 'save',
							'type': 'toolitem',
							'text': _('Save'),
							'command': '.uno:Save',
							'accessKey': '1'
						}
					]
				} : {}
		];
	},

	getOptionsSectionData: function() {
		return this.buildOptionsSectionData([
			{
				'type': 'toolitem',
				'text': _UNO('.uno:Sidebar'),
				'command': '.uno:SidebarDeck.PropertyDeck',
				'accessibility': { focusBack: true, combination: 'SB', de: null }
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator',
				'accessibility': { focusBack: true, combination: 'N', de: null }
			},
			{
				'type': 'toolitem',
			}
		]);
	},

	getTabs: function() {
		return [
			{
				'id': 'File-tab-label',
				'text': _('File'),
				'name': 'File',
				'accessibility': { focusBack: true, combination: 'F', de: null }
			},
			{
				'id': this.HOME_TAB_ID,
				'text': _('Home'),
				'name': 'Home',
				'context': 'default|DrawText',
				'accessibility': { focusBack: true, combination: 'H', de: null }
			},
			{
				'id': 'Insert-tab-label',
				'text': _('Insert'),
				'name': 'Insert',
				'accessibility': { focusBack: true, combination: 'N', de: null }
			},
			{
				'id': 'Layout-tab-label',
				'text': _('Layout'),
				'name': 'Layout',
				'accessibility': { focusBack: true, combination: 'P', de: null }
			},
			{
				'id': 'Review-tab-label',
				'text': _('Review'),
				'name': 'Review',
				'accessibility': { focusBack: true, combination: 'R', de: null }
			},
			{
				'id': 'Format-tab-label',
				'text': _('Format'),
				'name': 'Format',
				'accessibility': { focusBack: true, combination: 'M', de: null }
			},
			{
				'id': 'Table-tab-label',
				'text': _('Table'),
				'name': 'Table',
				'context': 'Table',
				'accessibility': { focusBack: true, combination: 'T', de: null }
			},
			{
				'id': 'Draw-tab-label',
				'text': _('Draw'),
				'name': 'Draw',
				'context': 'Draw|DrawLine|3DObject|MultiObject|Graphic|DrawFontwork',
				'accessibility': { focusBack: true, combination: 'D', de: null }
			},
			{
				'id': 'View-tab-label',
				'text': _('View'),
				'name': 'View',
				'accessibility': { focusBack: true, combination: 'V', de: null }
			},
			{
				'id': 'Help-tab-label',
				'text': _('Help'),
				'name': 'Help',
				'accessibility': { focusBack: true, combination: 'Y', de: null }
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
				this.getViewTab(),
				this.getHelpTab()
			], selectedId);
	},

	getFileTab: function() {
		var content = [];

		if (!this._map['wopi'].HideSaveOption) {
			content.push(
				{
					'type': 'toolbox',
					'children': [
						{
							'id': 'file-save',
							'type': 'bigtoolitem',
							'text': _('Save'),
							'command': '.uno:Save',
							'accessibility': { focusBack: true, combination: 'SF', de: null }
						}
					]
				});
			}

		if (!this._map['wopi'].UserCanNotWriteRelative) {
			content.push(
				{
					'id': 'file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'presentation'),
					'command': '.uno:SaveAs',
					'accessibility': { focusBack: true, combination: 'SA', de: null }
				}
			);
		}

		if (!this._map['wopi'].UserCanNotWriteRelative) {
			content.push(
				{
					'id': 'exportas:ExportAsMenu',
					'command': 'exportas',
					'class': 'unoexportas',
					'type': 'exportmenubutton',
					'text': _('Export As'),
					'accessibility': { focusBack: true, combination: 'EA', de: null }
				}
			);
		}

		content.push(
			{
				'id': 'file-shareas-rev-history',
				'type': 'container',
				'children': [
					(this._map['wopi'].EnableShare) ?
						{
							'id': 'ShareAs',
							'class': 'unoShareAs',
							'type': 'customtoolitem',
							'text': _('Share'),
							'command': 'shareas',
							'inlineLabel': true,
							'accessibility': { focusBack: true, combination: 'SH', de: null }
						} : {},
					(L.Params.revHistoryEnabled) ?
						{
							'id': 'Rev-History',
							'class': 'unoRev-History',
							'type': 'customtoolitem',
							'text': _('See history'),
							'command': 'rev-history',
							'inlineLabel': true,
							'accessibility': { focusBack: true, combination: 'RH', de: null }
						} : {},
				],
				'vertical': 'true'
			}
		);

		if (!this._map['wopi'].HidePrintOption) {
			content.push(
				{
					'id': 'print',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:Print', 'presentation'),
					'command': '.uno:Print',
					'accessibility': { focusBack: true, combination: 'P', de: null }
				}
			);
		}

		if (!this._map['wopi'].HideExportOption) {
			content.push(
			{
				'id': 'file-downloadas-odg-downloadas-png',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-odg',
						'class': 'unodownloadas-odg',
						'type': 'menubartoolitem',
						'text': _('ODF Drawing (.odg)'),
						'command': '',
						'accessibility': { focusBack: true, combination: 'DO', de: null }
					},
					{
						'id': 'downloadas-png',
						'class': 'unodownloadas-png',
						'type': 'menubartoolitem',
						'text': _('Image (.png)'),
						'command': '',
						'accessibility': { focusBack: true, combination: 'DP', de: null }
					},
				],
				'vertical': 'true'
			});
		}

		content.push(
			{
				'id': 'file-exportpdf',
				'type': 'container',
				'children': [
					{
						'id': !window.ThisIsAMobileApp ? 'exportdirectpdf' : 'downloadas-pdf',
						'class': 'unoexportas',
						'type': 'customtoolitem',
						'text': _('PDF Document (.pdf)'),
						'command': !window.ThisIsAMobileApp ? 'exportdirectpdf' : 'downloadas-pdf',
						'inlineLabel': true,
						'accessibility': { focusBack: true, combination: 'EP', de: null }
					},
					{
						'id': 'exportpdf' ,
						'class': 'unoexportas',
						'type': 'customtoolitem',
						'text': _('PDF Document (.pdf) - Expert'),
						'command': 'exportpdf' ,
						'inlineLabel': true,
						'accessibility': { focusBack: true, combination: 'ES', de: null }
					},
				],
				'vertical': 'true'
			}
		);

		if (!this._map['wopi'].HideRepairOption) {
			content.push(
				{
				'type': 'container',
				'children': [
					{
						'id': 'repair',
						'class': 'unorepair',
						'type': 'bigtoolitem',
						'text': _('Repair'),
						'command': _('Repair'),
						'accessibility': { focusBack: true, combination: 'RF', de: null }
					}
				]
			});
		}

		content.push(
			{
				'type': 'container',
				'children': [
					{
						'id': 'properties',
						'type': 'bigtoolitem',
						'text': _('Properties'),
						'command': '.uno:SetDocumentProperties',
						'accessibility': { focusBack: true, combination: 'FP', de: null }
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
		);

		return this.getTabPage('File', content);
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
				'id': 'view-fullscreen',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FullScreen'),
				'command': '.uno:FullScreen',
				'accessibility': { focusBack: true, combination: 'FR', de: null }
			},
			{
				'id': 'zoomreset',
				'class': 'unozoomreset',
				'type': 'menubartoolitem',
				'text': _('Reset zoom'),
				'command': _('Reset zoom'),
				'accessibility': { focusBack: true, combination: 'RZ', de: null }
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
								'accessibility': { focusBack: true, combination: 'ZO', de: null }
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
								'accessibility': { focusBack: true, combination: 'ZI', de: null }
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
				'accessibility': { focusBack: true, combination: 'UI', de: null }
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
								'accessibility': { focusBack: true, combination: 'CN', de: null }
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
								'accessibility': { focusBack: true, combination: 'SS', de: null }
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
				'accessibility': { focusBack: true, combination: 'DT', de: null }
			},
			{
				'id': 'view-sidebar',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Sidebar'),
				'command': '.uno:SidebarDeck.PropertyDeck',
				'accessibility': { focusBack: true, combination: 'SB', de: null }
			},
			{
				'id': 'view-navigator',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator',
				'accessibility': { focusBack: true, combination: 'N', de: null }
			}
		];

		return this.getTabPage('View', content);
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
						'accessibility': { focusBack: true, combination: 'ZZ', de: null }
					},
					{
						'id': 'home-redo',
						'type': 'toolitem',
						'text': _UNO('.uno:Redo'),
						'command': '.uno:Redo',
						'accessibility': { focusBack: true, combination: 'O', de: null }
					},
				],
				'vertical': 'true'
			},
			{
				'id': 'home-paste:PasteMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:Paste'),
				'command': '.uno:Paste',
				'accessibility': { focusBack: true, combination: 'V', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-cut',
								'type': 'customtoolitem',
								'text': _UNO('.uno:Cut'),
								'command': '.uno:Cut',
								'accessibility': { focusBack: true, combination: 'X', de: null }
							},
							{
								'id': 'home-format-paint-brush',
								'type': 'toolitem',
								'text': _UNO('.uno:FormatPaintbrush'),
								'command': '.uno:FormatPaintbrush',
								'accessibility': { focusBack: true, combination: 'FP', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-copy',
								'type': 'customtoolitem',
								'text': _UNO('.uno:Copy'),
								'command': '.uno:Copy',
								'accessibility': { focusBack: true, combination: 'C', de: null }
							},
							{
								'id': 'home-set-default',
								'type': 'toolitem',
								'text': _UNO('.uno:SetDefault'),
								'command': '.uno:SetDefault',
								'accessibility': { focusBack: true, combination: 'SF', de: null }
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
								'command': '.uno:CharFontName',
								'accessibility': { focusBack: true, combination: 'FN', de: null }
							},
							{
								'id': 'fontsizecombobox',
								'type': 'combobox',
								'text': '12 pt',
								'entries': [
									'12 pt'
								],
								'selectedCount': '1',
								'selectedEntries': [
									'0'
								],
								'command': '.uno:FontHeight',
								'accessibility': { focusBack: true, combination: 'FS', de: null }
							},
							{
								'id': 'home-grow',
								'type': 'toolitem',
								'text': _UNO('.uno:Grow'),
								'command': '.uno:Grow',
								'accessibility': { focusBack: true, combination: 'FG', de: null }
							},
							{
								'id': 'home-shrink',
								'type': 'toolitem',
								'text': _UNO('.uno:Shrink'),
								'command': '.uno:Shrink',
								'accessibility': { focusBack: true, combination: 'FK', de: null }
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
										'id': 'home-bold',
										'type': 'toolitem',
										'text': _UNO('.uno:Bold'),
										'command': '.uno:Bold',
										'accessibility': { focusBack: true, combination: '1', de: null }
									},
									{
										'id': 'home-italic',
										'type': 'toolitem',
										'text': _UNO('.uno:Italic'),
										'command': '.uno:Italic',
										'accessibility': { focusBack: true, combination: '2', de: null }
									},
									{
										'id': 'home-underline',
										'type': 'toolitem',
										'text': _UNO('.uno:Underline'),
										'command': '.uno:Underline',
										'accessibility': { focusBack: true, combination: '3', de: null }
									},
									{
										'id': 'home-strikeout',
										'type': 'toolitem',
										'text': _UNO('.uno:Strikeout'),
										'command': '.uno:Strikeout',
										'accessibility': { focusBack: true, combination: '4', de: null }
									},
									{
										'id': 'home-shadowed',
										'type': 'toolitem',
										'text': _UNO('.uno:Shadowed'),
										'command': '.uno:Shadowed',
										'accessibility': { focusBack: true, combination: 'SH', de: null }
									},
									{
										'id': 'home-fontwork-gallery',
										'type': 'toolitem',
										'text': _UNO('.uno:FontworkGalleryFloater'),
										'command': '.uno:FontworkGalleryFloater',
										// Fontwork export/import not supported in other formats.
										'visible': L.LOUtil.isFileODF(this._map) ? 'true' : 'false',
										'accessibility': { focusBack: true, combination: 'FW', de: null }
									},
									{
										'id': 'home-char-back-color',
										'class': 'unospan-BackColor',
										'type': 'toolitem',
										'text': _UNO('.uno:CharBackColor'),
										'command': '.uno:CharBackColor',
										'accessibility': { focusBack: true, combination: 'BC', de: null }
									},
									{
										'id': 'home-color',
										'class': 'unospan-FontColor',
										'type': 'toolitem',
										'text': _UNO('.uno:Color'),
										'command': '.uno:Color',
										'accessibility': { focusBack: true, combination: 'FC', de: null }
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
										'id': 'home-cell-vertical-top',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertTop'),
										'command': '.uno:CellVertTop',
										'accessibility': { focusBack: true, combination: 'AT', de: null }
									},
									{
										'id': 'home-cell-vertical-center',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertCenter'),
										'command': '.uno:CellVertCenter',
										'accessibility': { focusBack: true, combination: 'AC', de: null }
									},
									{
										'id': 'home-cell-vertical-bottom',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertBottom'),
										'command': '.uno:CellVertBottom',
										'accessibility': { focusBack: true, combination: 'AB', de: null }
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
										'id': 'home-left-para',
										'type': 'toolitem',
										'text': _UNO('.uno:LeftPara'),
										'command': '.uno:LeftPara',
										'accessibility': { focusBack: true, combination: 'PL', de: null }
									},
									{
										'id': 'home-center-para',
										'type': 'toolitem',
										'text': _UNO('.uno:CenterPara'),
										'command': '.uno:CenterPara',
										'accessibility': { focusBack: true, combination: 'PC', de: null }
									},
									{
										'id': 'home-right-para',
										'type': 'toolitem',
										'text': _UNO('.uno:RightPara'),
										'command': '.uno:RightPara',
										'accessibility': { focusBack: true, combination: 'PR', de: null }
									},
									{
										'id': 'home-justify-para',
										'type': 'toolitem',
										'text': _UNO('.uno:JustifyPara'),
										'command': '.uno:JustifyPara',
										'accessibility': { focusBack: true, combination: 'PJ', de: null }
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
										'id': 'home-default-bullet',
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultBullet'),
										'command': '.uno:DefaultBullet',
										'accessibility': { focusBack: true, combination: 'BD', de: null }
									},
									{
										'id': 'home-default-numbering',
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultNumbering'),
										'command': '.uno:DefaultNumbering',
										'accessibility': { focusBack: true, combination: 'ND', de: null }
									},
									{
										'id': 'home-increment-indent',
										'type': 'toolitem',
										'text': _UNO('.uno:IncrementIndent'),
										'command': '.uno:IncrementIndent',
										'accessibility': { focusBack: true, combination: 'II', de: null }
									},
									{
										'id': 'home-decrement-indent',
										'type': 'toolitem',
										'text': _UNO('.uno:DecrementIndent'),
										'command': '.uno:DecrementIndent',
										'accessibility': { focusBack: true, combination: 'ID', de: null }
									},
									{
										'id': 'home-para-left-to-right',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaLeftToRight'),
										'command': '.uno:ParaLeftToRight',
										'accessibility': { focusBack: true, combination: 'LT', de: null }
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
										'id': 'home-para-space-increase',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaspaceIncrease'),
										'command': '.uno:ParaspaceIncrease',
										'accessibility': { focusBack: true, combination: 'SI', de: null }
									},
									{
										'id': 'home-para-space-decrease',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaspaceDecrease'),
										'command': '.uno:ParaspaceDecrease',
										'accessibility': { focusBack: true, combination: 'SD', de: null }
									},
									{
										'id': 'home-line-spacing:LineSpacingMenu',
										'type': 'menubutton',
										'noLabel': true,
										'text': _UNO('.uno:LineSpacing'),
										'command': '.uno:LineSpacing',
										'accessibility': { focusBack: false, combination: 'LS', de: null }
									},
									{
										'id': 'home-para-right-to-left',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaRightToLeft'),
										'command': '.uno:ParaRightToLeft',
										'accessibility': { focusBack: true, combination: 'RT', de: null }
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
				'id': 'home-text',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Text'),
				'command': '.uno:Text',
				'accessibility': { focusBack: true, combination: 'DT', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'id': 'LineA6',
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-basic-shapes:InsertShapesMenu',
								'type': 'menubutton',
								'noLabel': true,
								'text': _('Shapes'),
								'command': '.uno:BasicShapes',
								'accessibility': { focusBack: true, combination: 'IS', de: null }
							}
						]
					},
					{
						'id': 'LineB7',
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-connector-toolbox:InsertConnectorsMenu',
								'type': 'menubutton',
								'noLabel': true,
								'text': _UNO('.uno:ConnectorToolbox', 'presentation'),
								'command': '.uno:ConnectorToolbox',
								'accessibility': { focusBack: true, combination: 'TC', de: null }
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
								'id': 'home-xline-color',
								'class': 'unospan-XLineColor',
								'type': 'toolitem',
								'text': _UNO('.uno:XLineColor'),
								'command': '.uno:XLineColor',
								'accessibility': { focusBack: true, combination: 'NC', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-fill-color',
								'class': 'unospan-BackgroundColor',
								'type': 'toolitem',
								'text': _UNO('.uno:FillColor'),
								'command': '.uno:FillColor',
								'accessibility': { focusBack: true, combination: 'LC', de: null }
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
								'id': 'home-insert-graphic:InsertImageMenu',
								'type': 'menubutton',
								'noLabel': true,
								'text': _UNO('.uno:InsertGraphic'),
								'command': '.uno:InsertGraphic',
								'accessibility': { focusBack: true, combination: 'IG', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'home-insert-page',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPage', 'presentation'),
								'command': '.uno:InsertPage',
								'accessibility': { focusBack: true, combination: 'IP', de: null }
							},
							{
								'id': 'home-duplicate-page',
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicatePage', 'presentation'),
								'command': '.uno:DuplicatePage',
								'accessibility': { focusBack: true, combination: 'DP', de: null }
							},
							{
								'id': 'home-insert-object-chart',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart'),
								'command': '.uno:InsertObjectChart',
								'accessibility': { focusBack: true, combination: 'IC', de: null }
							},
							{
								'id': 'home-insert-table',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTable', 'presentation'),
								'command': '.uno:InsertTable',
								'accessibility': { focusBack: true, combination: 'IT', de: null }
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
									'class': 'unoSearch',
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
		];

		return this.getTabPage('Home', content);
	},

	getLayoutTab: function() {
		var content = [
			{
				'id': 'layout-page-setup',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageSetup', 'presentation'),
				'command': '.uno:PageSetup',
				'accessibility': { focusBack: true, combination: 'PS', de: null }
			},
			{
				'id': 'layout-header-and-footer',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
				'command': '.uno:HeaderAndFooter',
				'accessibility': { focusBack: true, combination: 'IH', de: null }
			},
			{
				'id': 'layout-insert-page',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertPage', 'presentation'),
				'command': '.uno:InsertPage',
				'accessibility': { focusBack: true, combination: 'IP', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-duplicate-page',
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicatePage', 'presentation'),
								'command': '.uno:DuplicatePage',
								'accessibility': { focusBack: true, combination: 'DP', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'selectbackground',
								'class': 'unoselectbackground',
								'type': 'menubartoolitem',
								'text': _UNO('.uno:SelectBackground', 'presentation'),
								'command': '',
								'accessibility': { focusBack: true, combination: 'SB', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'layout-sidebar-deck',
				'type': 'bigtoolitem',
				'text': _('Page Layout'),
				'command': '.uno:SidebarDeck.PropertyDeck',
				'accessibility': { focusBack: true, combination: 'PL', de: null }
			},
			{
				'id': 'layout-select-all',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SelectAll'),
				'command': '.uno:SelectAll',
				'accessibility': { focusBack: true, combination: 'SA', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-object-align-left',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft'),
								'command': '.uno:ObjectAlignLeft',
								'accessibility': { focusBack: true, combination: 'AL', de: null }
							},
							{
								'id': 'layout-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter',
								'accessibility': { focusBack: true, combination: 'AC', de: null }
							},
							{
								'id': 'layout-object-align-right',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignRight'),
								'command': '.uno:ObjectAlignRight',
								'accessibility': { focusBack: true, combination: 'AR', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-align-up',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp'),
								'command': '.uno:AlignUp',
								'accessibility': { focusBack: true, combination: 'AU', de: null }
							},
							{
								'id': 'layout-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle',
								'accessibility': { focusBack: true, combination: 'AM', de: null }
							},
							{
								'id': 'layout-align-down',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignDown'),
								'command': '.uno:AlignDown',
								'accessibility': { focusBack: true, combination: 'AD', de: null }
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
								'id': 'layout-object-forward-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne',
								'accessibility': { focusBack: true, combination: 'FO', de: null }
							},
							{
								'id': 'layout-bring-to-front',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront',
								'accessibility': { focusBack: true, combination: 'BF', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-object-backwards-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne',
								'accessibility': { focusBack: true, combination: 'BO', de: null }
							},
							{
								'id': 'layout-send-to-back',
								'type': 'toolitem',
								'text': _UNO('.uno:SendToBack'),
								'command': '.uno:SendToBack',
								'accessibility': { focusBack: true, combination: 'SB', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('Layout', content);
	},

	getInsertTab: function() {
		var content = [
			{
				'id': 'insert-insert-page',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertPage', 'presentation'),
				'command': '.uno:InsertPage',
				'accessibility': { focusBack: true, combination: 'IP', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-duplicate-page',
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicatePage', 'presentation'),
								'command': '.uno:DuplicatePage',
								'accessibility': { focusBack: true, combination: 'DP', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-delete-page',
								'type': 'toolitem',
								'text': _UNO('.uno:DeletePage', 'presentation'),
								'command': '.uno:DeletePage',
								'accessibility': { focusBack: true, combination: 'RP', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'insert-insert-graphic:InsertImageMenu',
				'type': 'menubutton',
				'text': _UNO('.uno:InsertGraphic'),
				'command': '.uno:InsertGraphic',
				'accessibility': { focusBack: true, combination: 'IG', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insert-table',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTable', 'presentation'),
								'command': '.uno:InsertTable',
								'accessibility': { focusBack: true, combination: 'IT', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insert-object-chart',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart', 'presentation'),
								'command': '.uno:InsertObjectChart',
								'accessibility': { focusBack: true, combination: 'IC', de: null }
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
				'accessibility': { focusBack: true, combination: 'HD', de: null }
			},
			(this._map['wopi'].EnableRemoteLinkPicker) ? {
				'id': 'insert-remote-link',
				'class': 'unoremotelink',
				'type': 'bigcustomtoolitem',
				'text': _('Smart Picker'),
				'command': 'remotelink',
				'accessibility': { focusBack: true, combination: 'RL', de: null }
			} : {},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-innsert-date-field-fix',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateFieldFix', 'presentation'),
								'command': '.uno:InsertDateFieldFix',
								'accessibility': { focusBack: true, combination: 'ID', de: null }
							},
							{
								'id': 'insert-insert-date-field-var',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateFieldVar', 'presentation'),
								'command': '.uno:InsertDateFieldVar',
								'accessibility': { focusBack: true, combination: 'IV', de: null }
							},
							{
								'id': 'insert-insert-page-field',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageField', 'presentation'),
								'command': '.uno:InsertPageField',
								'accessibility': { focusBack: true, combination: 'IF', de: null }
							},
							{
								'id': 'insert-insert-pages-field',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPagesField', 'presentation'),
								'command': '.uno:InsertPagesField',
								'accessibility': { focusBack: true, combination: 'IS', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-time-field-fix',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTimeFieldFix', 'presentation'),
								'command': '.uno:InsertTimeFieldFix',
								'accessibility': { focusBack: true, combination: 'TF', de: null }
							},
							{
								'id': 'insert-time-field-var',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTimeFieldVar', 'presentation'),
								'command': '.uno:InsertTimeFieldVar',
								'accessibility': { focusBack: true, combination: 'TV', de: null }
							},
							{
								'id': 'insert-page-title-field',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPageTitleField', 'presentation'),
								'command': '.uno:InsertPageTitleField',
								'accessibility': { focusBack: true, combination: 'PT', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'insert-text',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Text'),
				'command': '.uno:Text',
				'accessibility': { focusBack: true, combination: 'TI', de: null }
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-basic-shapes:InsertShapesMenu',
								'type': 'menubutton',
								'noLabel': true,
								'text': _('Shapes'),
								'command': '.uno:BasicShapes',
								'accessibility': { focusBack: true, combination: 'BS', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-line',
								'type': 'toolitem',
								'text': _UNO('.uno:Line', 'presentation'),
								'command': '.uno:Line',
								'accessibility': { focusBack: true, combination: 'IL', de: null }
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
								'id': 'insert-font-gallery-floater',
								'type': 'toolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater',
								// Fontwork export/import not supported in other formats.
								'visible': L.LOUtil.isFileODF(this._map) ? 'true' : 'false',
								'accessibility': { focusBack: true, combination: 'FG', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-vertical-text',
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText', 'presentation'),
								'command': '.uno:VerticalText',
								'accessibility': { focusBack: true, combination: 'VT', de: null }
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
								'id': 'CharmapControl',
								'class': 'unoCharmapControl',
								'type': 'customtoolitem',
								'text': _UNO('.uno:CharmapControl'),
								'command': 'charmapcontrol',
								'accessibility': { focusBack: true, combination: 'CM', de: null }
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insert-annnotation',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertAnnotation', 'text'),
								'command': '.uno:InsertAnnotation',
								'accessibility': { focusBack: true, combination: 'IA', de: null }
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('Insert', content);
	},

	getFormatTab: function() {
		var content = [
			{
				'id': 'format-font-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FontDialog'),
				'command': '.uno:FontDialog',
				'accessibility': { focusBack: true, combination: 'FD', de: null }
			},
			{
				'id': 'format-paragraph-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog'),
				'command': '.uno:ParagraphDialog',
				'accessibility': { focusBack: true, combination: 'PD', de: null }
			},
			{
				'id': 'format-outline-bullet',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:OutlineBullet'),
				'command': '.uno:OutlineBullet',
				'accessibility': { focusBack: true, combination: 'OB', de: null }
			},
			{
				'id': 'format-page-setup',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:PageSetup', 'presentation'),
				'command': '.uno:PageSetup',
				'accessibility': { focusBack: true, combination: 'PS', de: null }
			},
			{
				'id': 'format-line',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatLine'),
				'command': '.uno:FormatLine',
				'accessibility': { focusBack: true, combination: 'FL', de: null }
			},
			{
				'id': 'format-area',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:FormatArea'),
				'command': '.uno:FormatArea',
				'accessibility': { focusBack: true, combination: 'FA', de: null }
			},
			{
				'id': 'format-transform-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:TransformDialog'),
				'command': '.uno:TransformDialog',
				'accessibility': { focusBack: true, combination: 'TD', de: null }
			},
			{
				'id': 'format-theme-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ThemeDialog'),
				'command': '.uno:ThemeDialog',
				'accessibility': { focusBack: false, combination: 'J', de: null }
			}
		];

		return this.getTabPage('Format', content);
	},

});

L.control.notebookbarDraw = function (options) {
	return new L.Control.NotebookbarDraw(options);
};
