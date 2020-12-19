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
				'id': '2',
				'name': 'HomeLabel',
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
				'id': '5',
				'name': 'DataLabel'
			},
			{
				'text': _('~Review'),
				'id': '6',
				'name': 'ReviewLabel'
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

		case 'Sheet':
			this.loadTab(this.getSheetTab());
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
																								'text': _UNO('.uno:SaveAs', 'spreadsheet'),
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
																								'text': _UNO('.uno:Print', 'spreadsheet'),
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
															'command': '.uno:OpenFromCalc'
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
															'text': 'Print',
															'command': '.uno:Print'
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
																			'id': 'Home-Section-Style',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator70',
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
																									'command': '.uno:ResetAttributes'
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
																					'id': 'FileSection8',
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
																											'id': 'font1',
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
																											'id': 'fontheight1',
																											'type': 'toolbox',
																											'text': '',
																											'enabled': 'true',
																											'children': [
																												{
																													'id': 'fontsize',
																													'type': 'combobox',
																													'text': '10 pt',
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
																															'text': '10 pt',
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
																														'4'
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
																												}
																											]
																										},
																										{
																											'id': 'separator67',
																											'type': 'fixedline',
																											'text': '',
																											'enabled': 'true'
																										},
																										{
																											'id': 'ExtTop5',
																											'type': 'toolbox',
																											'text': '',
																											'enabled': 'true',
																											'children': [
																												{
																													'type': 'toolitem',
																													'text': 'Superscript',
																													'command': '.uno:SuperScript'
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
																													'text': 'Borders (Shift to overwrite)',
																													'command': '.uno:SetBorderStyle'
																												},
																												{
																													'type': 'toolitem',
																													'text': 'Background Color',
																													'command': '.uno:BackgroundColor'
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
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Align',
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
																							'id': 'GroupB15',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'first6',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Align Top',
																											'command': '.uno:AlignTop'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Center Vertically',
																											'command': '.uno:AlignVCenter'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Align Bottom',
																											'command': '.uno:AlignBottom'
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						},
																						{
																							'id': 'GroupB16',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'second6',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Align Left',
																											'command': '.uno:AlignLeft'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Align Center',
																											'command': '.uno:AlignHorizontalCenter'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Align Right',
																											'command': '.uno:AlignRight'
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
																			'id': 'Home-Section-Align1',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB76',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'GroupB80',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'separator74',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'first16',
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
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						},
																						{
																							'id': 'GroupB85',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'second12',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Justified',
																											'command': '.uno:AlignBlock'
																										}
																									]
																								},
																								{
																									'id': 'separator77',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'second14',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Wrap Text',
																											'command': '.uno:WrapText'
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
																			'id': 'Home-Section-Number',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator30',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB18',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'box2',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom36',
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
																													'id': 'numbertype',
																													'type': 'listbox',
																													'text': '',
																													'enabled': 'true',
																													'children': [
																														{
																															'id': '',
																															'type': 'control',
																															'text': '',
																															'enabled': 'true'
																														},
																														{
																															'id': '',
																															'type': 'pushbutton',
																															'text': '',
																															'enabled': 'true'
																														}
																													],
																													'entries': [
																														'General',
																														'Number',
																														'Percent',
																														'Currency',
																														'Date',
																														'Time',
																														'Scientific',
																														'Fraction',
																														'Boolean Value',
																														'Text'
																													],
																													'selectedCount': '1',
																													'selectedEntries': [
																														'0'
																													]
																												}
																											]
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						},
																						{
																							'id': 'GroupB22',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'second9',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Currency',
																											'command': '.uno:NumberFormatCurrency'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Percent',
																											'command': '.uno:NumberFormatPercent'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Number',
																											'command': '.uno:NumberFormatDecimal'
																										}
																									]
																								},
																								{
																									'id': 'separator27',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'second2',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Add Decimal Place',
																											'command': '.uno:NumberFormatIncDecimals'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Delete Decimal Place',
																											'command': '.uno:NumberFormatDecDecimals'
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
																			'id': 'Home-Section-Cell',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator53',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom35',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Merge and Center Cells',
																							'command': '.uno:ToggleMergeCells'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Cell1',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB20',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA10',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Insert Rows Above',
																									'command': '.uno:InsertRowsBefore'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Delete Rows',
																									'command': '.uno:DeleteRows'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Row',
																									'command': '.uno:RowOperations'
																								}
																							]
																						},
																						{
																							'id': 'LineB11',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Insert Columns Before',
																									'command': '.uno:InsertColumnsBefore'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Delete Columns',
																									'command': '.uno:DeleteColumns'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Column',
																									'command': '.uno:ColumnOperations'
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
																			'id': 'Home-Section-Style2',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator25',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB17',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'GroupB19',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom5',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Styles',
																											'command': '.uno:DesignerDialog'
																										}
																									]
																								},
																								{
																									'id': 'SectionBottom101',
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
																													'id': 'applystyle',
																													'type': 'combobox',
																													'text': 'Default',
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
																															'text': 'Default',
																															'enabled': 'true'
																														}
																													],
																													'entries': [
																														'Clear formatting',
																														'Default',
																														'More Styles...'
																													],
																													'selectedCount': '0',
																													'selectedEntries': '',
																													'command': '.uno:StyleApply'
																												}
																											]
																										}
																									]
																								}
																							],
																							'vertical': 'false'
																						},
																						{
																							'id': 'StyleParagraphSection1',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom102',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Default',
																											'command': '.uno:StyleApply?Style:string=Default&FamilyName:string=CellStyles'
																										}
																									]
																								},
																								{
																									'id': 'separator106',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'SectionBottom93',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Heading 1',
																											'command': '.uno:StyleApply?Style:string=Heading 1&FamilyName:string=CellStyles'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Heading 2',
																											'command': '.uno:StyleApply?Style:string=Heading 2&FamilyName:string=CellStyles'
																										}
																									]
																								},
																								{
																									'id': 'separator24',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
																								},
																								{
																									'id': 'SectionBottom7',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Good',
																											'command': '.uno:StyleApply?Style:string=Good&FamilyName:string=CellStyles'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Neutral',
																											'command': '.uno:StyleApply?Style:string=Neutral&FamilyName:string=CellStyles'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Bad',
																											'command': '.uno:StyleApply?Style:string=Bad&FamilyName:string=CellStyles'
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
																			'id': 'Home-Section-Condition',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator1',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom37',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Conditional',
																							'command': '.uno:ConditionalFormatMenu'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Find',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator72',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom26',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Find & Replace',
																							'command': '.uno:SearchDialog'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Find1',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB47',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA17',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Sort',
																									'command': '.uno:DataSort'
																								}
																							]
																						},
																						{
																							'id': 'LineB19',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'AutoFilter',
																									'command': '.uno:DataFilterAutoFilter'
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
																	'id': 'separator26',
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
																							'text': 'Sort Ascending',
																							'command': '.uno:SortAscending'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'AutoFilter',
																							'command': '.uno:DataFilterAutoFilter'
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
													'text': '~Data',
													'id': '5',
													'name': 'DataLabel'
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
													'text': 'Ima~ge',
													'id': '8',
													'name': 'ImageLabel'
												},
												{
													'text': '~Draw',
													'id': '9',
													'name': 'DrawLabel'
												},
												{
													'text': '~Object',
													'id': '10',
													'name': 'ObjectLabel'
												},
												{
													'text': '~Media',
													'id': '11',
													'name': 'MediaLabel'
												},
												{
													'text': '~Print',
													'id': '12',
													'name': 'PrintLabel'
												},
												{
													'text': 'Fo~rm',
													'id': '13',
													'name': 'FormLabel'
												},
												{
													'text': 'E~xtension',
													'id': '14',
													'name': 'ExtensionLabel'
												},
												{
													'text': '~Tools',
													'id': '15',
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

	getSheetTab: function() {
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
															'id': 'Sheet Tab',
															'type': 'container',
															'text': '',
															'enabled': 'true',
															'children': [
																{
																	'id': 'Sheet',
																	'type': 'container',
																	'text': '',
																	'enabled': 'true',
																	'children': [
																		{
																			'id': 'Sheet-Section',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'PageFormatDialog-Section',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'SectionBottom655',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'bigtoolitem',
																									'text': _UNO('.uno:PageFormatDialog', 'spreadsheet', true),
																									'command': '.uno:PageFormatDialog'
																								}
																							]
																						}
																					],
																					'vertical': 'false'
																				},
																				{
																					'id': 'rows-Section',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _('Insert Rows Above'),
																									'command': '.uno:InsertRowsBefore'
																								}
																							]
																						},
																						{
																							'id': 'Section10',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'columns-Section',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section8',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _('Insert Columns Before'),
																									'command': '.uno:InsertColumnsBefore'
																								}
																							]
																						},
																						{
																							'id': 'Section9',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'break-Section',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'delete-Section',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
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
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'deletebreak-Section',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'freeze-section1',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'freeze-section2',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'vertical': 'true',
																					'children': [
																						{
																							'id': 'Section7',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																			'id': 'Insert-Section-PivotTable',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'SectionPivotTable',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:DataDataPilotRun', 'spreadsheet'),
																							'command': '.uno:DataDataPilotRun'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-PivotTable-Ext',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB292',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA152',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-Table1',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'LineA11',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:InsertObjectChart'),
																							'command': '.uno:InsertObjectChart'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-Section-PivotTable-Ext',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB292',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA152',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
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
																							'text': '',
																							'enabled': 'true',
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
																					'id': 'shapes6',
																					'type': 'toolbox',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'type': 'bigtoolitem',
																							'text': _UNO('.uno:DrawText'),
																							'command': '.uno:DrawText'
																						}
																					]
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Insert-BasicShapes-VerticalText',
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
																									'text': _UNO('.uno:BasicShapes'),
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
																									'text': _UNO('.uno:VerticalText', 'text'),
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
																					'id': 'shapes6',
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
																							'text': _UNO('.uno:EditHeaderAndFooter', 'spreadsheet'),
																							'command': '.uno:EditHeaderAndFooter'
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

L.control.notebookbarCalc = function (options) {
	return new L.Control.NotebookbarCalc(options);
};
