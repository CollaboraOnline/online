/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarImpress
 */

/* global _ _UNO */
L.Control.NotebookbarImpress = L.Control.NotebookbarWriter.extend({

	getShortcutsBarData: function() {
		var hasSave = !this._map['wopi'].HideSaveOption;
		return [
			hasSave ?
				{
					'id': 'shortcutstoolbox',
					'type': 'toolbox',
					'children': [
						{
							'id': 'save',
							'type': 'toolitem',
							'text': _('Save'),
							'command': '.uno:Save'
						}
					]
				} : {}
		];
	},

	getOptionsSectionData: function() {
		return this.buildOptionsSectionData([
			{
				'id': 'options-modifg-page',
				'type': 'toolitem',
				'text': _UNO('.uno:ModifyPage', 'presentation', true),
				'command': '.uno:ModifyPage'
			},
			{
				'id': 'options-slide-change-window',
				'type': 'toolitem',
				'text': _UNO('.uno:SlideChangeWindow', 'presentation', true),
				'command': '.uno:SlideChangeWindow'
			},
			{
				'id': 'options-custom-animation',
				'type': 'toolitem',
				'text': _UNO('.uno:CustomAnimation', 'presentation', true),
				'command': '.uno:CustomAnimation'
			},
			{
				'id': 'options-master-slides-panel',
				'type': 'toolitem',
				'text': _UNO('.uno:MasterSlidesPanel', 'presentation', true),
				'command': '.uno:MasterSlidesPanel'
			},
			{
				'id': 'options-navigator',
				'type': 'toolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator'
			}
		]);
	},

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
				'context': 'default|DrawText'
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
				'id': 'Review-tab-label',
				'text': _('Review'),
				'name': 'Review'
			},
			{
				'id': 'Format-tab-label',
				'text': _('Format'),
				'name': 'Format',
			},
			{
				'id': 'Table-tab-label',
				'text': _('Table'),
				'name': 'Table',
				'context': 'Table'
			},
			{
				'id': 'Draw-tab-label',
				'text': 'Draw',
				'name': 'Draw',
				'context': 'Draw|DrawLine|3DObject|MultiObject|Graphic|DrawFontwork'
			},
			{
				'id': 'MasterPage-tab-label',
				'text': _('Master'),
				'name': 'MasterPage',
				'context': 'MasterPage'
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
				this.getReviewTab(),
				this.getFormatTab(),
				this.getTableTab(),
				this.getDrawTab(),
				this.getMasterTab(),
				this.getViewTab(),
				this.getHelpTab()
			], selectedId);
	},

	getFileTab: function() {
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasRepair = !this._map['wopi'].HideRepairOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hideDownload = this._map['wopi'].HideExportOption;
		var hasShare = this._map['wopi'].EnableShare;
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
					'id': 'file-saveas',
					'type': 'bigmenubartoolitem',
					'text': _('Save As'),
				});
			} else {
				content.push({
					'id': 'file-saveas',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:SaveAs', 'presentation'),
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

		var content = content.concat([
			{
				'id': 'file-shareas-rev-history',
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
					'id': 'file-print',
					'type': 'bigtoolitem',
					'text': _UNO('.uno:Print', 'presentation'),
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

			if (hasRepair) {
				content.push({
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
				});
			}
		} else if (!hideDownload) {
			content = content.concat([
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
					'id': 'file-exportdirectpdf',
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
				}
			]);
			if (hasRepair) {
				content.push({
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
				});
			}
		} else if (hasRepair) {
			content.push({
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
						'command': '.uno:SetDocumentProperties'
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
				'id': 'view-presentation',
				'type': 'bigcustomtoolitem',
				'text': _('Presentation'),
				'command': 'presentation'
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
				'id': 'view-master-view',
				'type': 'bigtoolitem',
				'text': _('Master View'),
				'command': '.uno:SlideMasterPage'
			},
			{
				'id':'toggledarktheme',
				'type': 'bigmenubartoolitem',
				'text': _('Dark Mode')
			},
			{
				'id': 'view-side-bar',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Sidebar'),
				'command': '.uno:SidebarDeck.PropertyDeck'
			}
		];

		return this.getTabPage('View', content);
	},

	getHomeTab: function() {
		var isODF = L.LOUtil.isFileODF(this._map);
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
								'text': _UNO('.uno:Cut'),
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
								'id': 'home-coppy',
								'type': 'toolitem',
								'text': _UNO('.uno:Copy'),
								'command': '.uno:Copy'
							},
							{
								'id': 'home-set-default',
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
								'id': 'ExtTop4',
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
										'id': 'home-shadowed',
										'type': 'toolitem',
										'text': _UNO('.uno:Shadowed'),
										'command': '.uno:Shadowed'
									},
									{
										'id': 'home-fontworkgalleryfloater',
										'type': 'toolitem',
										'text': _UNO('.uno:FontworkGalleryFloater'),
										'command': '.uno:FontworkGalleryFloater',
										// Fontwork export/import not supported in other formats.
										'visible': isODF ? 'true' : 'false',
									},
									{
										'id': 'home-charbackcolor',
										'type': 'toolitem',
										'text': _UNO('.uno:CharBackColor'),
										'command': '.uno:CharBackColor'
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
										'id': 'home-cell-vertical-top',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertTop'),
										'command': '.uno:CellVertTop'
									},
									{
										'id': 'home-cell-vertical-center',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertCenter'),
										'command': '.uno:CellVertCenter'
									},
									{
										'id': 'home-cell-vertical-bottom',
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
										'id': 'home-left-paragraph',
										'type': 'toolitem',
										'text': _UNO('.uno:LeftPara'),
										'command': '.uno:LeftPara'
									},
									{
										'id': 'home-center-paragraph',
										'type': 'toolitem',
										'text': _UNO('.uno:CenterPara'),
										'command': '.uno:CenterPara'
									},
									{
										'id': 'home-right-paragraph',
										'type': 'toolitem',
										'text': _UNO('.uno:RightPara'),
										'command': '.uno:RightPara'
									},
									{
										'id': 'home-justify-para',
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
										'id': 'home-default-bullet',
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultBullet'),
										'command': '.uno:DefaultBullet'
									},
									{
										'id': 'home-default-numbering',
										'type': 'toolitem',
										'text': _UNO('.uno:DefaultNumbering'),
										'command': '.uno:DefaultNumbering'
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
										'command': '.uno:ParaspaceIncrease'
									},
									{
										'id': 'home-para-space-decrease',
										'type': 'toolitem',
										'text': _UNO('.uno:ParaspaceDecrease'),
										'command': '.uno:ParaspaceDecrease'
									},
									{
										'id': 'home-line-spacing',
										'type': 'toolitem',
										'text': _UNO('.uno:LineSpacing'),
										'command': '.uno:LineSpacing'
									},
									{
										'id': 'home-para-right-to-left',
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
				'id': 'home-text',
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
								'id': 'home-basic-shapes',
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
								'id': 'home-connector-tool-box',
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
								'id': 'home-xline-color',
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
								'id': 'home-fill-color',
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
								'id': 'home-insert-graphic',
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
								'id': 'home-insert-slide',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlide', 'presentation'),
								'command': '.uno:InsertPage'
							},
							{
								'id': 'home-duplicate-slide',
								'type': 'toolitem',
								'text': _UNO('.uno:DuplicateSlide', 'presentation'),
								'command': '.uno:DuplicatePage'
							},
							{
								'id': 'home-object-chart',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart'),
								'command': '.uno:InsertObjectChart'
							},
							{
								'id': 'home-insert-table',
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
				'id': 'home-presentation',
				'type': 'bigcustomtoolitem',
				'text': _('Presentation'),
				'command': 'presentation'
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
		];

		return this.getTabPage('Home', content);
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
				'id': 'format-paragraph-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ParagraphDialog'),
				'command': '.uno:ParagraphDialog'
			},
			{
				'id': 'format-outline-bullet',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:OutlineBullet'),
				'command': '.uno:OutlineBullet'
			},
			{
				'id': 'format-slide-setup',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SlideSetup', 'presentation'),
				'command': '.uno:PageSetup'
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
				'id': 'format-theme-dialog',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ThemeDialog'),
				'command': '.uno:ThemeDialog',
				'accessibility': { focusBack: false, combination: 'J', de: null }
			}
		];

		return this.getTabPage('Format', content);
	},

	getInsertTab: function() {
		var isODF = L.LOUtil.isFileODF(this._map);
		var content = [
			{
				'id': 'insert-insert-slide',
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
								'id': 'insert-duplicate-slide',
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
								'id': 'insert-delete-slide',
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
				'id': 'insert-insert-graphic',
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
								'id': 'insert-insert-table',
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
								'id': 'insert-insert-object-chart',
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
				'id': 'HyperlinkDialog',
				'type': 'bigcustomtoolitem',
				'text': _UNO('.uno:HyperlinkDialog'),
				'command': 'hyperlinkdialog'
			},
			(this._map['wopi'].EnableRemoteLinkPicker) ? {
				'id': 'insert-insert-smart-picker',
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
								'id': 'insert-insert-date-field-fix',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateFieldFix', 'presentation'),
								'command': '.uno:InsertDateFieldFix'
							},
							{
								'id': 'insert-insert-date-field-var',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertDateFieldVar', 'presentation'),
								'command': '.uno:InsertDateFieldVar'
							},
							{
								'id': 'insert-insert-slide-field',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlideField', 'presentation'),
								'command': '.uno:InsertPageField'
							},
							{
								'id': 'insert-insert-slides-field',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlidesField', 'presentation'),
								'command': '.uno:InsertPagesField'
							}
						]
					},
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-insert-time-field-fix',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTimeFieldFix', 'presentation'),
								'command': '.uno:InsertTimeFieldFix'
							},
							{
								'id': 'insert-insert-time-field-var',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTimeFieldVar', 'presentation'),
								'command': '.uno:InsertTimeFieldVar'
							},
							{
								'id': 'insert-insert-slide-title-field',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertSlideTitleField', 'presentation'),
								'command': '.uno:InsertPageTitleField'
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
				'command': '.uno:Text'
			},
			{
				'type': 'container',
				'children': [
					{
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
						'type': 'toolbox',
						'children': [
							{
								'id': 'insert-presentation',
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
								'id': 'insert-fontwork-gallery-floater',
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
								'id': 'insert-vertical-text',
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
				'id': 'insert-header-and-footer',
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

	getLayoutTab: function() {
		var content = [
			{
				'id': 'layout-slide-setup',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SlideSetup', 'presentation'),
				'command': '.uno:PageSetup'
			},
			{
				'id': 'layout-header-and-footer',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
				'command': '.uno:HeaderAndFooter'
			},
			{
				'id': 'layout-insert-slide',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertSlide', 'presentation'),
				'command': '.uno:InsertPage'
			},
			{
				'id': 'showslide',
				'type': 'bigmenubartoolitem',
				'text': _UNO('.uno:ShowSlide', 'presentation'),
				'command': '.uno:ShowSlide'
			},
			{
				'id': 'hideslide',
				'type': 'bigmenubartoolitem',
				'text': _UNO('.uno:HideSlide', 'presentation'),
				'command': '.uno:HideSlide'
			},
			{
				'type': 'container',
				'children': [
					{
						'type': 'toolbox',
						'children': [
							{
								'id': 'layout-duplicate-slide',
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
				'id': 'layout-modify-page',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:ModifyPage', 'presentation'),
				'command': '.uno:ModifyPage'
			},
			{
				'id': 'layout-master-slides-panel',
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
								'id': 'layout-slide-change-window',
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
								'id': 'layout-custom-animation',
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
				'id': 'layout-navigator',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator'
			},
			{
				'id': 'layout-select-all',
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
								'id': 'layout-object-align-left',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'id': 'layout-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter'
							},
							{
								'id': 'layout-align-right',
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
								'id': 'layout-align-up',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp'),
								'command': '.uno:AlignUp'
							},
							{
								'id': 'layout-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle'
							},
							{
								'id': 'layout-align-down',
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
								'id': 'layout-object-forward-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							},
							{
								'id': 'layout-bring-to-front',
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
								'id': 'layout-object-back-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectBackOne'),
								'command': '.uno:ObjectBackOne'
							},
							{
								'id': 'layout-send-to-back',
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

	getMasterTab: function() {
		var content = [
			{
				'id': 'master-slide-setup',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:SlideSetup', 'presentation'),
				'command': '.uno:PageSetup'
			},
			{
				'id': 'master-header-and-footer',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
				'command': '.uno:HeaderAndFooter'
			},
			{
				'id': 'master-rename-master-page',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:RenameMasterPage', 'presentation'),
				'command': '.uno:RenameMasterPage'
			},
			{
				'id': 'master-close-master-view',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:CloseMasterView', 'presentation'),
				'command': '.uno:CloseMasterView'
			}
		];

		return this.getTabPage('MasterPage', content);
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
								'id': 'review-hyphenation',
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
				'id': 'review-insert-annotation',
				'type': 'bigtoolitem',
				'text': _UNO('.uno:InsertAnnotation'),
				'command': '.uno:InsertAnnotation'
			},
			{
				'id': 'review-delete-all-annotations',
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
				'id': 'table-table-dialog',
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
								'id': 'table-insert-columns-before',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsBefore', 'presentation'),
								'command': '.uno:InsertColumnsBefore'
							},
							{
								'id': 'table-insert-columns-after',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertColumnsAfter', 'presentation'),
								'command': '.uno:InsertColumnsAfter'
							},
							{
								'id': 'table-delete-columns',
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
								'id': 'table-insert-rows-before',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsBefore', 'presentation'),
								'command': '.uno:InsertRowsBefore'
							},
							{
								'id': 'table-insert-rows-after',
								'type': 'toolitem',
								'text': _UNO('.uno:InsertRowsAfter', 'presentation'),
								'command': '.uno:InsertRowsAfter'
							},
							{
								'id': 'table-delete-rows',
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
								'id': 'table-merge-cells',
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
								'id': 'table-split-cells',
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
								'id': 'table-select-table',
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
								'id': 'table-delete-table',
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
								'id': 'table-entire-column',
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
								'id': 'table-entire-row',
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
										'id': 'table-cell-vertical-top',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertTop'),
										'command': '.uno:CellVertTop'
									},
									{
										'id': 'table-cell-vertical-center',
										'type': 'toolitem',
										'text': _UNO('.uno:CellVertCenter'),
										'command': '.uno:CellVertCenter'
									},
									{
										'id': 'table-cell-vertical-bottom',
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
										'id': 'table-left-para',
										'type': 'toolitem',
										'text': _UNO('.uno:LeftPara'),
										'command': '.uno:LeftPara'
									},
									{
										'id': 'table-center-para',
										'type': 'toolitem',
										'text': _UNO('.uno:CenterPara'),
										'command': '.uno:CenterPara'
									},
									{
										'id': 'table-right-para',
										'type': 'toolitem',
										'text': _UNO('.uno:RightPara'),
										'command': '.uno:RightPara'
									},
									{
										'id': 'table-justify-para',
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
								'id': 'table-xline-color',
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
								'id': 'table-fill-color',
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
								'id': 'table-object-align-left',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectAlignLeft'),
								'command': '.uno:ObjectAlignLeft'
							},
							{
								'id': 'table-align-center',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignCenter'),
								'command': '.uno:AlignCenter'
							},
							{
								'id': 'table-object-align-right',
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
								'id': 'table-align-up',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignUp'),
								'command': '.uno:AlignUp'
							},
							{
								'id': 'table-align-middle',
								'type': 'toolitem',
								'text': _UNO('.uno:AlignMiddle'),
								'command': '.uno:AlignMiddle'
							},
							{
								'id': 'table-align-down',
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
								'id': 'table-bring-to-front',
								'type': 'toolitem',
								'text': _UNO('.uno:BringToFront'),
								'command': '.uno:BringToFront'
							},
							{
								'id': 'table-send-to-back',
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
								'id': 'table-object-forward-one',
								'type': 'toolitem',
								'text': _UNO('.uno:ObjectForwardOne'),
								'command': '.uno:ObjectForwardOne'
							},
							{
								'id': 'table-object-back-one',
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
		var isODF = L.LOUtil.isFileODF(this._map);
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
								'id': 'draw-connector-toolbox',
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
								'id': 'draw-fontwork-gallery-floater',
								'type': 'toolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater',
								// Fontwork export/import not supported in other formats.
								'visible': isODF ? 'true' : 'false',
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
	},
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
