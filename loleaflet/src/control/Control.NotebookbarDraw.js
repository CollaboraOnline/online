/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarDraw
 */

/* global _ _UNO */
L.Control.NotebookbarDraw = L.Control.NotebookbarImpress.extend({

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
								'text': _UNO('.uno:ModifyPage', 'drawing', true),
								'command': '.uno:ModifyPage'
							},
							{
								'type': 'toolitem',
							}
						]
					}
				]
			}
		];
	},

	/// override to not load tabs from core
	onNotebookbar: function(data) {
		this.map._isNotebookbarLoadedOnCore = true;
		// setup id for events
		this.builder.setWindowId(data.id);
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
				'text': _('Format'),
				'id': '-3',
				'name': 'Format',
			},
			{
				'text': '~Draw',
				'id': '-11',
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

	getFullJSON: function(selectedId) {
		return this.getNotebookbar(
			[
				this.getFileTab(),
				this.getHomeTab(),
				this.getInsertTab(),
				this.getFormatTab(),
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
				'id': 'file-downloadas-odg-downloadas-png',
				'type': 'container',
				'children': [
					{
						'id': 'downloadas-odg',
						'type': 'menubartoolitem',
						'text': _('ODF Drawing (.odg)'),
						'command': ''
					},
					{
						'id': 'downloadas-png',
						'type': 'menubartoolitem',
						'text': _('Image (.png)'),
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
				'id': 'Home-Section-Clipboard',
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
				'id': 'Home-Section-DrawColor1',
				'type': 'container',
				'children': [
					{
						'id': 'third7',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:FormatLine'),
								'command': '.uno:FormatLine'
							},
							{
								'type': 'toolitem',
							}
						]
					},
					{
						'id': 'third8',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:BasicShapes'),
								'command': '.uno:BasicShapes'
							},
							{
								'type': 'toolitem',
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-DrawColor1',
				'type': 'container',
				'children': [
					{
						'id': 'third7',
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
						'id': 'third8',
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
				'id': 'Home-Section-DrawColor1',
				'type': 'container',
				'children': [
					{
						'id': 'third7',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Text'),
								'command': '.uno:Text'
							},
							{
								'type': 'toolitem',
							}
						]
					},
					{
						'id': 'third8',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:VerticalText'),
								'command': '.uno:VerticalText'
							},
							{
								'type': 'toolitem',
							}
						]
					}
				],
				'vertical': 'true'
			},
			{
				'id': 'Home-Section-Draw',
				'type': 'container',
				'children': [
					{
						'id': 'shapes1',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Line'),
								'command': '.uno:Line'
							},
							{
								'type': 'toolitem',
							}
						]
					},
					{
						'id': 'shapes3',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ConnectorToolbox'),
								'command': '.uno:ConnectorToolbox'
							},
							{
								'type': 'toolitem',
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
				'id': 'Home-Section-Insert',
				'type': 'container',
				'children': [
					{
						'id': 'LineA24',
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
						'id': 'LineB27',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertPage'),
								'command': '.uno:InsertPage'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertObjectChart'),
								'command': '.uno:InsertObjectChart'
							},
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertTable'),
								'command': '.uno:InsertTable'
							}
						]
					}
				],
				'vertical': 'true'
			}
		];

		return this.getTabPage('Home', content);
	}
});

L.control.notebookbarDraw = function (options) {
	return new L.Control.NotebookbarDraw(options);
};
