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
						'type': 'toolitem',
						'text': _('Menu'),
						'command': '.uno:Menubar'
					},
					{
						'type': 'toolitem',
						'text': _('Save'),
						'command': '.uno:Save'
					},
					{
						'type': 'toolitem',
						'text': _('Start Presentation'),
						'command': '.uno:Presentation'
					},
					{
						'type': 'toolitem',
						'text': _('Undo'),
						'command': '.uno:Undo'
					},
					{
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
				'id': '2',
				'name': 'HomeLabel',
				'context': 'default|DrawText'
			},
			{
				'text': _('~Insert'),
				'id': '-4',
				'name': 'Insert'
			},
			{
				'text': _('~Review'),
				'id': '6',
				'name': 'ReviewLabel'
			},
			{
				'text': _('Format'),
				'id': '-3',
				'name': 'Format',
			},
			{
				'text': _('~Table'),
				'id': '8',
				'name': 'TableLabel',
				'context': 'Table'
			},
			{
				'text': '~Draw',
				'id': '10',
				'name': 'DrawLabel',
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
		}
	},

	getFileTab: function() {
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hasShare = this._map['wopi'].EnableShare;

		return {
			'id': '',
			'type': 'control',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': '',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'box',
									'type': 'container',
									'text': '',
									'enabled': 'true',
									'children': [
										{
											'id': 'ContextContainer',
											'type': 'tabcontrol',
											'text': '',
											'enabled': 'true',
											'selected': '-1',
											'children': [
												{
													'id': '',
													'type': 'tabpage',
													'text': '',
													'enabled': 'true',
													'children': [
														{
															'id': 'File Tab',
															'type': 'container',
															'text': '',
															'enabled': 'true',
															'children': [
																{
																	'id': 'File',
																	'type': 'container',
																	'text': '',
																	'enabled': 'true',
																	'children': [
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
																								'type': 'menubartoolitem',
																								'text': _UNO('.uno:SaveAs', 'presentation'),
																								'command': ''
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
																								'type': 'menubartoolitem',
																								'text': _('Share...'),
																								'command': ''
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
																								'type': 'menubartoolitem',
																								'text': _UNO('.uno:Print', 'presentation'),
																								'command': ''
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
																								'type': 'menubartoolitem',
																								'text': _('See revision history'),
																								'command': ''
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
																	]
																}
															]
														}
													]
												}
											]
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

	getHomeTab: function() {
		return {
			'id': '',
			'type': 'control',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': '',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'box1',
									'type': 'container',
									'text': '',
									'enabled': 'true',
									'children': [
										{
											'id': 'ContextContainer',
											'type': 'tabcontrol',
											'text': '',
											'enabled': 'true',
											'children': [
												{
													'id': '',
													'type': 'pushbutton',
													'text': '',
													'enabled': 'true'
												},
												{
													'id': '',
													'type': 'toolbox',
													'text': '',
													'enabled': 'true',
													'children': [
														{
															'type': 'toolitem',
															'text': 'Menubar',
															'command': '.uno:Menubar'
														},
														{
															'type': 'toolitem',
															'text': 'Open',
															'command': '.uno:Open'
														},
														{
															'type': 'toolitem',
															'text': 'Save',
															'command': '.uno:Save'
														},
														{
															'type': 'toolitem',
															'text': 'Undo',
															'command': '.uno:Undo'
														},
														{
															'type': 'toolitem',
															'text': 'Redo',
															'command': '.uno:Redo'
														},
														{
															'type': 'toolitem',
															'text': 'Start from First Slide',
															'command': '.uno:Presentation'
														}
													]
												},
												{
													'id': '',
													'type': 'tabpage',
													'text': '',
													'enabled': 'true',
													'children': [
														{
															'id': 'Home Tab',
															'type': 'container',
															'text': '',
															'enabled': 'true',
															'children': [
																{
																	'id': 'Home',
																	'type': 'container',
																	'text': '',
																	'enabled': 'true',
																	'children': [
																		{
																			'id': 'Home-Section-Clipboard',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionBottom87',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Paste',
																							'command': '.uno:Paste'
																						}
																					]
																				},
																				{
																					'id': 'GroupB9',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA6',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Cut',
																									'command': '.uno:Cut'
																								}
																							]
																						},
																						{
																							'id': 'LineB7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Copy',
																									'command': '.uno:Copy'
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
																			'id': 'Home-Section-Slide',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator107',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB20',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA8',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'New Page',
																									'command': '.uno:InsertPage'
																								}
																							]
																						},
																						{
																							'id': 'LineB9',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Duplicate Page',
																									'command': '.uno:DuplicatePage'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Delete Page',
																									'command': '.uno:DeletePage'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Slide Layout',
																									'command': '.uno:AssignLayout'
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
																			'id': 'Home-Section-Style',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator7',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB13',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Clone',
																									'command': '.uno:FormatPaintbrush'
																								}
																							]
																						},
																						{
																							'id': 'LineB8',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Clear',
																									'command': '.uno:SetDefault'
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
																			'id': 'Home-Section-Format',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB10',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'box76',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'font',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'id': '',
																											'type': 'borderwindow',
																											'text': '',
																											'enabled': 'true',
																											'children': [
																												{
																													'id': 'fontnamecombobox',
																													'type': 'combobox',
																													'text': 'Carlito',
																													'enabled': 'true',
																													'children': [
																														{
																															'id': '',
																															'type': 'pushbutton',
																															'text': '',
																															'enabled': 'true'
																														},
																														{
																															'id': '',
																															'type': 'edit',
																															'text': 'Carlito',
																															'enabled': 'true'
																														}
																													],
																													'entries': [
																														'Alef',
																														'Amiri',
																														'Amiri Quran',
																														'Baekmuk Batang',
																														'Baekmuk Dotum',
																														'Baekmuk Gulim',
																														'Baekmuk Headline',
																														'Bandal',
																														'Bangwool',
																														'Caladea',
																														'Cantarell',
																														'Carlito',
																														'David CLM',
																														'David Libre',
																														'DejaVu Math TeX Gyre',
																														'DejaVu Sans',
																														'DejaVu Sans Condensed',
																														'DejaVu Sans Light',
																														'DejaVu Sans Mono',
																														'DejaVu Serif',
																														'DejaVu Serif Condensed',
																														'Droid Arabic Kufi',
																														'Droid Arabic Naskh',
																														'Droid Naskh Shift Alt',
																														'Droid Sans',
																														'Droid Sans Armenian',
																														'Droid Sans Devanagari',
																														'Droid Sans Ethiopic',
																														'Droid Sans Fallback',
																														'Droid Sans Georgian',
																														'Droid Sans Hebrew',
																														'Droid Sans Japanese',
																														'Droid Sans Mono',
																														'Droid Sans Tamil',
																														'Droid Sans Thai',
																														'Droid Serif',
																														'East Syriac Adiabene',
																														'East Syriac Ctesiphon',
																														'EmojiOne Color',
																														'Estrangelo Antioch',
																														'Estrangelo Edessa',
																														'Estrangelo Midyat',
																														'Estrangelo Nisibin',
																														'Estrangelo Nisibin Outline',
																														'Estrangelo Quenneshrin',
																														'Estrangelo Talada',
																														'Estrangelo TurAbdin',
																														'Eunjin',
																														'Eunjin Nakseo',
																														'Frank Ruehl CLM',
																														'Frank Ruhl Hofshi',
																														'Gentium Basic',
																														'Gentium Book Basic',
																														'Goha-Tibeb Zemen',
																														'Guseul',
																														'KacstBook',
																														'KacstOffice',
																														'Karla',
																														'Khmer OS',
																														'Khmer OS Battambang',
																														'Khmer OS Bokor',
																														'Khmer OS Content',
																														'Khmer OS Fasthand',
																														'Khmer OS Freehand',
																														'Khmer OS Metal Chrieng',
																														'Khmer OS Muol',
																														'Khmer OS Muol Light',
																														'Khmer OS Muol Pali',
																														'Khmer OS Siemreap',
																														'Khmer OS System',
																														'Liberation Mono',
																														'Liberation Sans',
																														'Liberation Sans Narrow',
																														'Liberation Serif',
																														'Linux Biolinum G',
																														'Linux Libertine Display G',
																														'Linux Libertine G',
																														'LM Mono 10',
																														'LM Mono 12',
																														'LM Mono 8',
																														'LM Mono 9',
																														'LM Mono Caps 10',
																														'LM Mono Light 10',
																														'LM Mono Light Cond 10',
																														'LM Mono Prop 10',
																														'LM Mono Prop Light 10',
																														'LM Mono Slanted 10',
																														'LM Roman 10',
																														'LM Roman 12',
																														'LM Roman 17',
																														'LM Roman 5',
																														'LM Roman 6',
																														'LM Roman 7',
																														'LM Roman 8',
																														'LM Roman 9',
																														'LM Roman Caps 10',
																														'LM Roman Demi 10',
																														'LM Roman Dunhill 10',
																														'LM Roman Slanted 10',
																														'LM Roman Slanted 12',
																														'LM Roman Slanted 17',
																														'LM Roman Slanted 8',
																														'LM Roman Slanted 9',
																														'LM Roman Unslanted 10',
																														'LM Sans 10',
																														'LM Sans 12',
																														'LM Sans 17',
																														'LM Sans 8',
																														'LM Sans 9',
																														'LM Sans Demi Cond 10',
																														'LM Sans Quot 8',
																														'Luxi Mono',
																														'Luxi Sans',
																														'Luxi Serif',
																														'Miriam CLM',
																														'Miriam Libre',
																														'Miriam Mono CLM',
																														'Nachlieli CLM',
																														'Noto Color Emoji',
																														'Noto Kufi Arabic',
																														'Noto Mono',
																														'Noto Naskh Arabic',
																														'Noto Naskh Arabic UI',
																														'Noto Sans',
																														'Noto Sans Arabic',
																														'Noto Sans Arabic UI',
																														'Noto Sans Armenian',
																														'Noto Sans Blk',
																														'Noto Sans Cond',
																														'Noto Sans Cond Blk',
																														'Noto Sans Cond ExtBd',
																														'Noto Sans Cond ExtLt',
																														'Noto Sans Cond Light',
																														'Noto Sans Cond Med',
																														'Noto Sans Cond SemBd',
																														'Noto Sans Cond Thin',
																														'Noto Sans ExtBd',
																														'Noto Sans ExtCond',
																														'Noto Sans ExtCond Blk',
																														'Noto Sans ExtCond ExtBd',
																														'Noto Sans ExtCond ExtLt',
																														'Noto Sans ExtCond Light',
																														'Noto Sans ExtCond Med',
																														'Noto Sans ExtCond SemBd',
																														'Noto Sans ExtCond Thin',
																														'Noto Sans ExtLt',
																														'Noto Sans Georgian',
																														'Noto Sans Hebrew',
																														'Noto Sans JP Bold',
																														'Noto Sans JP Regular',
																														'Noto Sans KR Bold',
																														'Noto Sans KR Regular',
																														'Noto Sans Lao',
																														'Noto Sans Light',
																														'Noto Sans Lisu',
																														'Noto Sans Med',
																														'Noto Sans SC Bold',
																														'Noto Sans SC Regular',
																														'Noto Sans SemBd',
																														'Noto Sans SemCond',
																														'Noto Sans SemCond Blk',
																														'Noto Sans SemCond ExtBd',
																														'Noto Sans SemCond ExtLt',
																														'Noto Sans SemCond Light',
																														'Noto Sans SemCond Med',
																														'Noto Sans SemCond SemBd',
																														'Noto Sans SemCond Thin',
																														'Noto Sans TC Bold',
																														'Noto Sans TC Regular',
																														'Noto Sans Thin',
																														'Noto Serif',
																														'Noto Serif Armenian',
																														'Noto Serif Cond',
																														'Noto Serif Georgian',
																														'Noto Serif Hebrew',
																														'Noto Serif Lao',
																														'Noto Serif Light',
																														'Open Sans',
																														'Open Sans Condensed',
																														'Open Sans Condensed Light',
																														'Open Sans Extrabold',
																														'Open Sans Light',
																														'Open Sans Semibold',
																														'OpenDyslexic',
																														'OpenSymbol',
																														'Reem Kufi',
																														'Roboto',
																														'Roboto Black',
																														'Roboto Condensed',
																														'Roboto Condensed Light',
																														'Roboto Light',
																														'Roboto Medium',
																														'Roboto Slab',
																														'Roboto Thin',
																														'Rubik',
																														'Scheherazade',
																														'Serto Batnan',
																														'Serto Jerusalem',
																														'Serto Jerusalem Outline',
																														'Serto Kharput',
																														'Serto Malankara',
																														'Serto Mardin',
																														'Serto Urhoy',
																														'Source Code Pro',
																														'Source Code Pro Black',
																														'Source Code Pro ExtraLight',
																														'Source Code Pro Light',
																														'Source Code Pro Medium',
																														'Source Code Pro Semibold',
																														'Source Sans Pro',
																														'Source Sans Pro Black',
																														'Source Sans Pro ExtraLight',
																														'Source Sans Pro Light',
																														'Source Sans Pro Semibold',
																														'Source Serif Pro',
																														'Source Serif Pro Black',
																														'Source Serif Pro ExtraLight',
																														'Source Serif Pro Light',
																														'Source Serif Pro Semibold',
																														'STIXGeneral'
																													],
																													'selectedCount': '1',
																													'selectedEntries': [
																														'71'
																													],
																													'command': '.uno:CharFontName'
																												}
																											]
																										}
																									]
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
																											'enabled': 'true',
																											'children': [
																												{
																													'id': '',
																													'type': 'pushbutton',
																													'text': '',
																													'enabled': 'true'
																												},
																												{
																													'id': '',
																													'type': 'edit',
																													'text': '18 pt',
																													'enabled': 'true'
																												},
																												{
																													'id': '',
																													'type': 'borderwindow',
																													'text': '',
																													'enabled': 'true',
																													'children': [
																														{
																															'id': '',
																															'type': 'edit',
																															'text': '',
																															'enabled': 'true'
																														}
																													]
																												}
																											],
																											'entries': [
																												'6 pt',
																												'7 pt',
																												'8 pt',
																												'9 pt',
																												'10 pt',
																												'10.5 pt',
																												'11 pt',
																												'12 pt',
																												'13 pt',
																												'14 pt',
																												'15 pt',
																												'16 pt',
																												'18 pt',
																												'20 pt',
																												'22 pt',
																												'24 pt',
																												'26 pt',
																												'28 pt',
																												'32 pt',
																												'36 pt',
																												'40 pt',
																												'44 pt',
																												'48 pt',
																												'54 pt',
																												'60 pt',
																												'66 pt',
																												'72 pt',
																												'80 pt',
																												'88 pt',
																												'96 pt'
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
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Increase',
																											'command': '.uno:Grow'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Decrease',
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
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'ExtTop4',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Bold',
																											'command': '.uno:Bold'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Italic',
																											'command': '.uno:Italic'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Underline',
																											'command': '.uno:Underline'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Strikethrough',
																											'command': '.uno:Strikeout'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Shadow',
																											'command': '.uno:Shadowed'
																										}
																									]
																								},
																								{
																									'id': 'separator78',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'ExtTop2',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Character Spacing',
																											'command': '.uno:Spacing'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Highlight Color',
																											'command': '.uno:CharBackColor'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Font Color',
																											'command': '.uno:Color'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Paragraph',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator102',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB14',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'GroupB16',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom9',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Top',
																											'command': '.uno:CellVertTop'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Center',
																											'command': '.uno:CellVertCenter'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Bottom',
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
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom13',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Left',
																											'command': '.uno:LeftPara'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Center',
																											'command': '.uno:CenterPara'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Right',
																											'command': '.uno:RightPara'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Paragraph2',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB31',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'GroupB95',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'separator64',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'SectionBottom98',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Bullets',
																											'command': '.uno:DefaultBullet'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Numbering',
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
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom143',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Justified',
																											'command': '.uno:JustifyPara'
																										}
																									]
																								},
																								{
																									'id': 'separator99',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'SectionBottom144',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Line Spacing',
																											'command': '.uno:LineSpacing'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Paragraph3',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB98',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'SectionBottom145',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Increase',
																									'command': '.uno:IncrementIndent'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Decrease',
																									'command': '.uno:DecrementIndent'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Left-To-Right',
																									'command': '.uno:ParaLeftToRight'
																								}
																							]
																						},
																						{
																							'id': 'SectionBottom146',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Increase',
																									'command': '.uno:ParaspaceIncrease'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Decrease',
																									'command': '.uno:ParaspaceDecrease'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Right-To-Left',
																									'command': '.uno:ParaRightToLeft'
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
																			'id': 'Home-Section-DrawSection',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator69',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom5',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Text Box',
																							'command': '.uno:Text'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Vertical Text',
																							'command': '.uno:VerticalText'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-DrawSection1',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB43',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'GroupB12',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'shapes12',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Line',
																											'command': '.uno:Line'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Curves and Polygons',
																											'command': '.uno:LineToolbox'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						},
																						{
																							'id': 'GroupB38',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'shapes15',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': '',
																											'command': '.uno:BasicShapes.rectangle'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Basic Shapes',
																											'command': '.uno:BasicShapes'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-DrawSection2',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB92',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'GroupB93',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'shapes1',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Connectors',
																											'command': '.uno:ConnectorToolbox'
																										}
																									]
																								},
																								{
																									'id': 'separator95',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'LineA28',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Line Color',
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
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'shapes3',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Flowchart Shapes',
																											'command': '.uno:FlowChartShapes'
																										}
																									]
																								},
																								{
																									'id': 'separator98',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'LineB29',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Fill Color',
																											'command': '.uno:FillColor'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Slideshow',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator94',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB39',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA9',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Start from First Slide',
																									'command': '.uno:Presentation'
																								}
																							]
																						},
																						{
																							'id': 'LineB21',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Start from Current Slide',
																									'command': '.uno:PresentationCurrentSlide'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		}
																	],
																	'vertical': 'false'
																},
																{
																	'id': 'separator9',
																	'type': 'fixedline',
																	'text': '',
																	'enabled': 'true'
																},
																{
																	'id': 'Home-Menu',
																	'type': 'container',
																	'text': '',
																	'enabled': 'true',
																	'children': [
																		{
																			'id': 'PasteBox1',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'Home-HomeButton:Menu Home',
																					'type': 'menubutton',
																					'text': '~Home',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom10',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Find & Replace',
																							'command': '.uno:SearchDialog'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Start from First Slide',
																							'command': '.uno:Presentation'
																						}
																					]
																				}
																			],
																			'vertical': 'true'
																		}
																	],
																	'vertical': 'false'
																}
															],
															'vertical': 'false'
														}
													]
												}
											],
											'tabs': [
												{
													'text': '~File',
													'id': '1',
													'name': 'FileLabel'
												},
												{
													'text': '~Home',
													'id': '2',
													'name': 'HomeLabel'
												},
												{
													'text': '~Insert',
													'id': '3',
													'name': 'InsertLabel'
												},
												{
													'text': '~Layout',
													'id': '4',
													'name': 'LayoutLabel'
												},
												{
													'text': '~Slide Show',
													'id': '5',
													'name': 'SlideShowLabel'
												},
												{
													'text': '~Review',
													'id': '6',
													'name': 'ReviewLabel'
												},
												{
													'text': '~View',
													'id': '7',
													'name': 'ViewLabel'
												},
												{
													'text': '~Table',
													'id': '8',
													'name': 'TableLabel'
												},
												{
													'text': 'Ima~ge',
													'id': '9',
													'name': 'ImageLabel'
												},
												{
													'text': '~Draw',
													'id': '10',
													'name': 'DrawLabel'
												},
												{
													'text': '~Object',
													'id': '11',
													'name': 'ObjectLabel'
												},
												{
													'text': '~Media',
													'id': '12',
													'name': 'MediaLabel'
												},
												{
													'text': 'Fo~rm',
													'id': '13',
													'name': 'FormLabel'
												},
												{
													'text': '~Master',
													'id': '14',
													'name': 'MasterLabel'
												},
												{
													'text': '~Outline',
													'id': '15',
													'name': 'OutlineLabel'
												},
												{
													'text': '3~d',
													'id': '16',
													'name': '3DObjectLabel'
												},
												{
													'text': 'E~xtension',
													'id': '17',
													'name': 'ExtensionLabel'
												},
												{
													'text': '~Tools',
													'id': '18',
													'name': 'DevLabel'
												}
											],
											'selected': '2'
										}
									],
									'vertical': 'true',
									'left': '0',
									'top': '0'
								}
							]
						}
					],
					'vertical': 'true'
				}
			]
		};
	},

	getFormatTab: function() {
		return {
			'id': '',
			'type': 'control',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': '',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'box',
									'type': 'container',
									'text': '',
									'enabled': 'true',
									'children': [
										{
											'id': 'ContextContainer',
											'type': 'tabcontrol',
											'text': '',
											'enabled': 'true',
											'selected': '-3',
											'children': [
												{
													'id': '',
													'type': 'tabpage',
													'text': '',
													'enabled': 'true',
													'children': [
														{
															'id': 'Format Tab',
															'type': 'container',
															'text': '',
															'enabled': 'true',
															'children': [
																{
																	'id': 'Format',
																	'type': 'container',
																	'text': '',
																	'enabled': 'true',
																	'children': [
																		{
																			'id': 'Format-Section',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'Section1',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:FontDialog'),
																							'command': '.uno:FontDialog'
																						}
																					]
																				},
																				{
																					'id': 'Section2',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:ParagraphDialog'),
																							'command': '.uno:ParagraphDialog'
																						}
																					]
																				},
																				{
																					'id': 'Section7',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:OutlineBullet'),
																							'command': '.uno:OutlineBullet'
																						}
																					]
																				},
																				{
																					'id': 'Section5',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:FormatLine'),
																							'command': '.uno:FormatLine'
																						}
																					]
																				},
																				{
																					'id': 'Section6',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:FormatArea'),
																							'command': '.uno:FormatArea'
																						}
																					]
																				},
																				{
																					'id': 'Section4',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
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
																	]
																}
															]
														}
													]
												}
											]
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

	getInsertTab: function() {
		return {
			'id': '',
			'type': 'control',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': '',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'box',
									'type': 'container',
									'text': '',
									'enabled': 'true',
									'children': [
										{
											'id': 'ContextContainer',
											'type': 'tabcontrol',
											'text': '',
											'enabled': 'true',
											'children': [
												{
													'id': '',
													'type': 'tabpage',
													'text': '',
													'enabled': 'true',
													'children': [
														{
															'id': 'Insert Tab',
															'type': 'container',
															'text': '',
															'enabled': 'true',
															'children': [
																{
																	'id': 'Insert',
																	'type': 'container',
																	'text': '',
																	'enabled': 'true',
																	'children': [
																		{
																			'id': 'Insert-Section-Page',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionBottom13',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:InsertPage', 'presentation'),
																							'command': '.uno:InsertPage'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-Pages',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB29',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA15',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-Image',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionBottom65',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
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
																			'id': 'Insert-Section-Table',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB29',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA15',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-Hyperlink',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionBottom14',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
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
																			'id': 'Insert-Text',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB293',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA153',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-Text',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'shapes6',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:Text'),
																							'command': '.uno:Text'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Text',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB293',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA153',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-Symbol',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionBottom105',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
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
																			'id': 'Insert-Section-HeaderFooter',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionHeaderFooter',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:HeaderAndFooter', 'presentation'),
																							'command': '.uno:HeaderAndFooter'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		}
																	],
																	'vertical': 'false'
																}
															],
															'vertical': 'false'
														}
													]
												}
											],
											'tabs': [],
											'selected': '-4'
										}
									],
									'vertical': 'true',
									'left': '0',
									'top': '0'
								}
							]
						}
					],
					'vertical': 'true'
				}
			]
		};
	}
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
