/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarWriter
 */

/* global _ _UNO */
L.Control.NotebookbarWriter = L.Control.Notebookbar.extend({

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
				'context': 'default|Text'
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
				'text': _('Reference~s'),
				'id': '-6',
				'name': 'References'
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
				'text': _('~Draw'),
				'id': '-9',
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

		case 'Layout':
			this.loadTab(this.getLayoutTab());
			break;

		case 'References':
			this.loadTab(this.getReferencesTab());
			break;

		case 'Review':
			this.loadTab(this.getReviewTab());
			break;

		case 'Table':
			this.loadTab(this.getTableTab());
			break;

		case 'Draw':
			this.loadTab(this.getDrawTab());
			break;
		}
	},

	getFileTab: function() {
		var hasSigning = L.DomUtil.get('document-signing-bar') !== null;
		var hasRevisionHistory = L.Params.revHistoryEnabled;
		var hasPrint = !this._map['wopi'].HidePrintOption;
		var hasSaveAs = !this._map['wopi'].UserCanNotWriteRelative;
		var hasShare = this._map['wopi'].EnableShare;

		var content = [
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
									'type': 'bigtoolitem',
									'text': _UNO('.uno:SaveAs', 'text'),
									'command': '.uno:SaveAs'
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
									'type': 'bigtoolitem',
									'text': _('Share'),
									'command': '.uno:shareas'
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
									'type': 'bigtoolitem',
									'text': _UNO('.uno:Print', 'text'),
									'command': '.uno:Print'
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
									'type': 'bigtoolitem',
									'text': _('See history'),
									'command': '.uno:rev-history'
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
												'id': 'downloadas-odt',
												'type': 'menubartoolitem',
												'text': _('ODF text document (.odt)'),
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
												'id': 'downloadas-rtf',
												'type': 'menubartoolitem',
												'text': _('Rich Text (.rtf)'),
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
												'id': 'downloadas-doc',
												'type': 'menubartoolitem',
												'text': _('Word 2003 Document (.doc)'),
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
												'id': 'downloadas-docx',
												'type': 'menubartoolitem',
												'text': _('Word Document (.docx)'),
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
												'id': 'downloadas-epub',
												'type': 'menubartoolitem',
												'text': _('EPUB (.epub)'),
												'command': ''
											}
										]
									}
								]
							}
						]
					},
					hasSigning ?
						{
							'id': 'Section12',
							'type': 'toolbox',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'signdocument',
									'type': 'menubartoolitem',
									'text': _('Sign document'),
									'command': ''
								}
							]
						} : {}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('File', content)], '-1');
	},

	getHelpTab: function() {
		var hasLatestUpdates = window.enableWelcomeMessage;

		var content = [
			{
				'id': 'Help-Section',
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
								'id': 'online-help',
								'type': 'menubartoolitem',
								'text': _('Online Help'),
								'command': ''
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
								'id': 'keyboard-shortcuts',
								'type': 'menubartoolitem',
								'text': _('Keyboard shortcuts'),
								'command': ''
							}
						]
					},
					{
						'id': 'Section3',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'id': 'report-an-issue',
								'type': 'menubartoolitem',
								'text': _('Report an issue'),
								'command': ''
							}
						]
					},
					hasLatestUpdates ?
						{
							'id': 'Section4',
							'type': 'toolbox',
							'text': '',
							'enabled': 'true',
							'children': [
								{
									'id': 'latest-updates',
									'type': 'menubartoolitem',
									'text': _('Latest Updates'),
									'command': ''
								}
							]
						} : {},
					{
						'id': 'Section5',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'id': 'about',
								'type': 'menubartoolitem',
								'text': _('About'),
								'command': ''
							}
						]
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Help', content)], '-2');
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
															'command': '.uno:OpenFromWriter'
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
																					'id': 'separator104',
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
																														'73'
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
																											'text': '12 pt',
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
																													'text': '12 pt',
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
																												'7'
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
																									'id': 'separator5',
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
																											'text': 'Subscript',
																											'command': '.uno:SubScript'
																										},
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
																											'text': 'Highlight Color',
																											'command': '.uno:BackColor'
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
																									'id': 'SectionBottom91',
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
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Outline',
																											'command': '.uno:SetOutline'
																										}
																									]
																								},
																								{
																									'id': 'separator68',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
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
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Justified',
																											'command': '.uno:JustifyPara'
																										}
																									]
																								},
																								{
																									'id': 'separator8',
																									'type': 'fixedline',
																									'text': '',
																									'enabled': 'true'
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
																			'id': 'Home-Section-Paragraph1',
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
																							'id': 'GroupB93',
																							'type': 'container',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'id': 'SectionBottom81',
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
																											'text': 'Formatting Marks',
																											'command': '.uno:ControlCodes'
																										}
																									]
																								},
																								{
																									'id': 'SectionBottom93',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Left-To-Right',
																											'command': '.uno:ParaLeftToRight'
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
																									'id': 'SectionBottom125',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Line Spacing',
																											'command': '.uno:LineSpacing'
																										},
																										{
																											'type': 'toolitem',
																											'text': 'Background Color',
																											'command': '.uno:BackgroundColor'
																										}
																									]
																								},
																								{
																									'id': 'SectionBottom130',
																									'type': 'toolbox',
																									'text': '',
																									'enabled': 'true',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Right-To-Left',
																											'command': '.uno:ParaRightToLeft'
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
																			'id': 'Home-Section-Style2',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator10',
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
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																			'vertical': 'false'
																		},
																		{
																			'id': 'Home-Section-Style3',
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
																							'id': 'SectionBottom127',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
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
																													'id': 'ApplyStyleBox',
																													'type': 'container',
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
																																	'id': 'stylesview',
																																	'type': 'iconview',
																																	'text': '',
																																	'enabled': 'true',
																																	'entries': [
																																		{
																																			'text': _('Default Style'),
																																			'selected': 'true'
																																		},
																																		{
																																			'text': _('Text Body'),
																																		},
																																		{
																																			'text': _('Title'),
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
																											],
																											'vertical': 'true'
																										}
																									]
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
																			'id': 'Home-Section-Style4',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'GroupB86',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'SectionBottom138',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Update',
																									'command': '.uno:StyleUpdateByExample'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Edit',
																									'command': '.uno:EditStyle'
																								}
																							]
																						},
																						{
																							'id': 'SectionBottom141',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Emphasis',
																									'command': '.uno:StyleApply?Style:string=Emphasis&FamilyName:string=CharacterStyles'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Strong Emphasis',
																									'command': '.uno:StyleApply?Style:string=Strong Emphasis&FamilyName:string=CharacterStyles'
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
																			'id': 'Home-Section-Insert',
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
																									'text': 'Table',
																									'command': '.uno:InsertTable'
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
																									'text': 'Image',
																									'command': '.uno:InsertGraphic'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Page Break',
																									'command': '.uno:InsertPagebreak'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Symbol',
																									'command': '.uno:CharmapControl'
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
																			'id': 'Home-Section-View',
																			'type': 'container',
																			'text': '',
																			'enabled': 'true',
																			'children': [
																				{
																					'id': 'separator67',
																					'type': 'fixedline',
																					'text': '',
																					'enabled': 'true'
																				},
																				{
																					'id': 'GroupB83',
																					'type': 'container',
																					'text': '',
																					'enabled': 'true',
																					'children': [
																						{
																							'id': 'LineA34',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Zoom',
																									'command': '.uno:Zoom'
																								}
																							]
																						},
																						{
																							'id': 'LineB35',
																							'type': 'toolbox',
																							'text': '',
																							'enabled': 'true',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': 'Comment',
																									'command': '.uno:InsertAnnotation'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Print Preview',
																									'command': '.uno:PrintPreview'
																								},
																								{
																									'type': 'toolitem',
																									'text': 'Navigator',
																									'command': '.uno:Navigator'
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
																							'text': 'Find',
																							'command': 'vnd.sun.star.findbar:FocusToFindbar'
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
													'text': 'Reference~s',
													'id': '5',
													'name': 'ReferencesLabel'
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
													'text': '~Print',
													'id': '13',
													'name': 'PrintLabel'
												},
												{
													'text': 'Fo~rm',
													'id': '14',
													'name': 'FormLabel'
												},
												{
													'text': 'E~xtension',
													'id': '15',
													'name': 'ExtensionLabel'
												},
												{
													'text': '~Tools',
													'id': '16',
													'name': 'ToolsLabel'
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
		var content = [
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
		];

		return this.getNotebookbar([this.getTabPage('Format', content)], '-3');
	},

	getInsertTab: function() {
		var content = [
			{
				'id': 'SectionBottom70',
				'type': 'toolbox',
				'text': '',
				'enabled': 'true',
				'children': [
					{
						'type': 'bigtoolitem',
						'text': _UNO('.uno:InsertPagebreak', 'text'),
						'command': '.uno:InsertPagebreak'
					}
				]
			},
			{
				'id': 'Insert-Section-Pagebreak1',
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
										'text': _UNO('.uno:TitlePageDialog', 'text'),
										'command': '.uno:TitlePageDialog'
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
										'text': _UNO('.uno:InsertSection', 'text'),
										'command': '.uno:InsertSection'
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
				'id': 'Insert-Section-Table-Chart',
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
										'text': 'Table',
										'command': '.uno:InsertTable'
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
										'text': _UNO('.uno:InsertObjectChart'),
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
				'id': 'Insert-Section-Fontwork',
				'type': 'container',
				'text': '',
				'enabled': 'true',
				'children': [
					{
						'id': 'SectionBottom656',
						'type': 'toolbox',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater'
							}
						]
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
				'id': 'Insert-Section-Bookmark',
				'type': 'container',
				'text': '',
				'enabled': 'true',
				'children': [
					{
						'id': 'GroupB27',
						'type': 'container',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'id': 'LineA13',
								'type': 'toolbox',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertBookmark', 'text'),
										'command': '.uno:InsertBookmark'
									}
								]
							},
							{
								'id': 'LineB14',
								'type': 'toolbox',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertReferenceField', 'text'),
										'command': '.uno:InsertReferenceField'
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
				'id': 'SectionBottom11',
				'type': 'toolbox',
				'text': '',
				'enabled': 'true',
				'children': [
					{
						'type': 'bigtoolitem',
						'text': _UNO('.uno:InsertFieldCtrl', 'text'),
						'command': '.uno:InsertFieldCtrl'
					}
				]
			},
			{
				'id': 'Insert-Section-HeaderFoorter',
				'type': 'container',
				'text': '',
				'enabled': 'true',
				'children': [
					{
						'id': 'GroupB291',
						'type': 'container',
						'text': '',
						'enabled': 'true',
						'children': [
							{
								'id': 'LineA151',
								'type': 'toolbox',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertPageHeader', 'text'),
										'command': '.uno:InsertPageHeader'
									}
								]
							},
							{
								'id': 'LineB161',
								'type': 'toolbox',
								'text': '',
								'enabled': 'true',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertPageFooter', 'text'),
										'command': '.uno:InsertPageFooter'
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
				'id': 'Insert-Section-Line',
				'type': 'toolbox',
				'text': '',
				'enabled': 'true',
				'children': [
					{
						'type': 'bigtoolitem',
						'text': _UNO('.uno:Line', 'text'),
						'command': '.uno:Line'
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Insert', content)], '-4');
	},

	getLayoutTab: function() {
		var content = [
			{
				'id': 'Layout-Section-File5',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB30',
						'type': 'container',
						'children': [
							{
								'id': 'LineA16',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertPagebreak', 'text'),
										'command': '.uno:InsertPagebreak'
									}
								]
							},
							{
								'id': 'LineB17',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertBreak', 'text'),
										'command': '.uno:InsertBreak'
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
				'id': 'Layout-Section-Backgrounds',
				'type': 'container',
				'children': [
					{
						'id': 'separator21',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'GroupB33',
						'type': 'container',
						'children': [
							{
								'id': 'LineA14',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:TitlePageDialog', 'text'),
										'command': '.uno:TitlePageDialog'
									}
								]
							},
							{
								'id': 'LineB15',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text':  _UNO('.uno:Watermark', 'text'),
										'command': '.uno:Watermark'
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
				'id': 'Layout-Section-Backgrounds1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB35',
						'type': 'container',
						'children': [
							{
								'id': 'LeftParaMargin3',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:Hyphenate', 'text'),
										'command': '.uno:Hyphenate'
									}
								]
							},
							{
								'id': 'belowspacing2',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:LineNumberingDialog', 'text'),
										'command': '.uno:LineNumberingDialog'
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
				'id': 'Layout-Section-SelectGroup',
				'type': 'container',
				'children': [
					{
						'id': 'separator116',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'GroupB57',
						'type': 'container',
						'children': [
							{
								'id': 'LineA27',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SelectObject'),
										'command': '.uno:SelectObject'
									}
								]
							},
							{
								'id': 'LineB28',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:FormatGroup'),
										'command': '.uno:FormatGroup'
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
				'id': 'Layout-Section-Wrap',
				'type': 'container',
				'children': [
					{
						'id': 'separator98',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'GroupB79',
						'type': 'container',
						'children': [
							{
								'id': 'Wrap7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapOff', 'text'),
										'command': '.uno:WrapOff'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapOn', 'text'),
										'command': '.uno:WrapOn'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapIdeal', 'text'),
										'command': '.uno:WrapIdeal'
									}
								]
							},
							{
								'id': 'Wrap8',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapLeft', 'text'),
										'command': '.uno:WrapLeft'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapThrough', 'text'),
										'command': '.uno:WrapThrough'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapRight', 'text'),
										'command': '.uno:WrapRight'
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
				'id': 'Layout-Section-Wrap1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB68',
						'type': 'container',
						'children': [
							{
								'id': 'Wrap15',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ContourDialog'),
										'command': '.uno:ContourDialog'
									}
								]
							},
							{
								'id': 'Wrap16',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:TextWrap'),
										'command': '.uno:TextWrap'
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
				'id': 'Layout-Section-Arrange',
				'type': 'container',
				'children': [
					{
						'id': 'separator19',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'GroupB32',
						'type': 'container',
						'children': [
							{
								'id': 'belowspacing14',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:BringToFront'),
										'command': '.uno:BringToFront'
									}
								]
							},
							{
								'id': 'belowspacing15',
								'type': 'toolbox',
								'children': [
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
				],
				'vertical': 'false'
			},
			{
				'id': 'Layout-Section-Arrange1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB28',
						'type': 'container',
						'children': [
							{
								'id': 'belowspacing1',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ObjectForwardOne'),
										'command': '.uno:ObjectForwardOne'
									}
								]
							},
							{
								'id': 'belowspacing10',
								'type': 'toolbox',
								'children': [
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
				],
				'vertical': 'false'
			},
			{
				'type': 'container',
				'children': [
					{
						'id': 'pagestyle',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:PageDialog'),
								'command': '.uno:PageDialog'
							}
						]
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Layout', content)], '-5');
	},

	getReferencesTab: function() {
		var content = [
			{
				'id': 'Reference-Section-Index',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom34',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertMultiIndex', 'text'),
								'command': '.uno:InsertMultiIndex'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Reference-Section-Index1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB36',
						'type': 'container',
						'children': [
							{
								'id': 'LineA17',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertIndexesEntry', 'text'),
										'command': '.uno:InsertIndexesEntry'
									}
								]
							},
							{
								'id': 'LineB18',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:UpdateCurIndex', 'text'),
										'command': '.uno:UpdateCurIndex'
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
				'id': 'Reference-Section-Reference',
				'type': 'container',
				'children': [
					{
						'id': 'separator33',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom18',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertFootnote', 'text'),
								'command': '.uno:InsertFootnote'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Reference-Section-Reference1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB38',
						'type': 'container',
						'children': [
							{
								'id': 'LeftParaMargin4',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertEndnote', 'text'),
										'command': '.uno:InsertEndnote'
									}
								]
							},
							{
								'id': 'belowspacing3',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:FootnoteDialog', 'text'),
										'command': '.uno:FootnoteDialog'
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
				'id': 'Reference-Section-Caption',
				'type': 'container',
				'children': [
					{
						'id': 'separator34',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom19',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertReferenceField', 'text'),
								'command': '.uno:InsertReferenceField'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Reference-Section-Caption1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB44',
						'type': 'container',
						'children': [
							{
								'id': 'LineB23',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertBookmark', 'text'),
										'command': '.uno:InsertBookmark'
									}
								]
							},
							{
								'id': 'LineA22',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertCaptionDialog', 'text'),
										'command': '.uno:InsertCaptionDialog'
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
				'id': 'Reference-Section-Field',
				'type': 'container',
				'children': [
					{
						'id': 'separator61',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom121',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:InsertFieldCtrl', 'text'),
								'command': '.uno:InsertFieldCtrl'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Reference-Section-Field1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB39',
						'type': 'container',
						'children': [
							{
								'id': 'LineB19',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertField', 'text'),
										'command': '.uno:InsertField'
									}
								]
							},
							{
								'id': 'LineA18',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertPageNumberField'),
										'command': '.uno:InsertPageNumberField'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertPageCountField', 'text'),
										'command': '.uno:InsertPageCountField'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertDateField', 'text'),
										'command': '.uno:InsertDateField'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertTitleField', 'text'),
										'command': '.uno:InsertTitleField'
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
				'id': 'Reference-Section-Bibliothek',
				'type': 'container',
				'children': [
					{
						'id': 'separator23',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom16',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertAuthoritiesEntry', 'text'),
								'command': '.uno:InsertAuthoritiesEntry'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Reference-Section-Bibliothek1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB40',
						'type': 'container',
						'children': [
							{
								'id': 'LineA19',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:BibliographyComponent', 'text'),
										'command': '.uno:BibliographyComponent'
									}
								]
							},
							{
								'id': 'LineB20',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ViewDataSourceBrowser', 'text'),
										'command': '.uno:ViewDataSourceBrowser'
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
				'type': 'container',
				'children': [
					{
						'id': 'updateall',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:UpdateAll', 'text'),
								'command': '.uno:UpdateAll'
							}
						]
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('References', content)], '-6');
	},

	getReviewTab: function() {
		var content = [
			{
				'id': 'Review-Section-Language',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom67',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:SpellingAndGrammarDialog'),
								'command': '.uno:SpellingAndGrammarDialog'
							},
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:ThesaurusDialog'),
								'command': '.uno:ThesaurusDialog'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Review-Section-Language1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB41',
						'type': 'container',
						'children': [
							{
								'id': 'LineA20',
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
								'id': 'LineB21',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WordCountDialog', 'text'),
										'command': '.uno:WordCountDialog'
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
				'id': 'Review-Section-Annotation',
				'type': 'container',
				'children': [
					{
						'id': 'separator109',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom69',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertAnnotation'),
								'command': '.uno:InsertAnnotation'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Review-Section-Annotation1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB42',
						'type': 'container',
						'children': [
							{
								'id': 'LeftParaMargin9',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ReplyComment'),
										'command': '.uno:ReplyComment'
									}
								]
							},
							{
								'id': 'belowspacing9',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:DeleteComment'),
										'command': '.uno:DeleteComment'
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
				'id': 'Review-Section-TrackChanges',
				'type': 'container',
				'children': [
					{
						'id': 'separator112',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom72',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:TrackChanges', 'text'),
								'command': '.uno:TrackChanges'
							},
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:ShowTrackedChanges', 'text'),
								'command': '.uno:ShowTrackedChanges'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Review-Section-TrackChanges1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB43',
						'type': 'container',
						'children': [
							{
								'id': 'LineA21',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NextTrackedChange', 'text'),
										'command': '.uno:NextTrackedChange'
									}
								]
							},
							{
								'id': 'LineB22',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:PreviousTrackedChange', 'text'),
										'command': '.uno:PreviousTrackedChange'
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
				'id': 'Review-Section-TrackChanges2',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB84',
						'type': 'container',
						'children': [
							{
								'id': 'LineB38',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AcceptTrackedChange', 'text'),
										'command': '.uno:AcceptTrackedChange'
									}
								]
							},
							{
								'id': 'LineA38',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:RejectTrackedChange', 'text'),
										'command': '.uno:RejectTrackedChange'
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
				'id': 'Review-Section-TrackChanges3',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB95',
						'type': 'container',
						'children': [
							{
								'id': 'LineB42',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AcceptTrackedChangeToNext', 'text'),
										'command': '.uno:AcceptTrackedChangeToNext'
									}
								]
							},
							{
								'id': 'LineA42',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:RejectTrackedChangeToNext', 'text'),
										'command': '.uno:RejectTrackedChangeToNext'
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
				'id': 'Review-Section-TrackChanges4',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB65',
						'type': 'container',
						'children': [
							{
								'id': 'LineB27',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:AcceptAllTrackedChanges', 'text'),
										'command': '.uno:AcceptAllTrackedChanges'
									}
								]
							},
							{
								'id': 'LineA26',
								'type': 'toolbox',
			
			
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:RejectAllTrackedChanges', 'text'),
										'command': '.uno:RejectAllTrackedChanges'
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
				'id': 'Review-Section-Document',
				'type': 'container',
				'children': [
					{
						'id': 'separator24',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom82',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:ProtectTraceChangeMode', 'text'),
								'command': '.uno:ProtectTraceChangeMode'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'type': 'container',
				'children': [
					{
						'id': 'accepttrackedchanges',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:AcceptTrackedChanges', 'text'),
								'command': '.uno:AcceptTrackedChanges'
							}
						]
					}
				]
			}
		];

		return this.getNotebookbar([this.getTabPage('Review', content)], '-7');
	},

	getTableTab: function() {
		var content = [
			{
				'id': 'Table-Section-Layout',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom62',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertCaptionDialog', 'text'),
								'command': '.uno:InsertCaptionDialog'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Table-Section-Layout1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB61',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom39',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertColumnsBefore', 'text'),
										'command': '.uno:InsertColumnsBefore'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertColumnsAfter', 'text'),
										'command': '.uno:InsertColumnsAfter'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:DeleteColumns', 'text'),
										'command': '.uno:DeleteColumns'
									}
								]
							},
							{
								'id': 'SectionBottom41',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertRowsBefore', 'text'),
										'command': '.uno:InsertRowsBefore'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:InsertRowsAfter', 'text'),
										'command': '.uno:InsertRowsAfter'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:DeleteRows', 'text'),
										'command': '.uno:DeleteRows'
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
				'id': 'Table-Section-Merge',
				'type': 'container',
				'children': [
					{
						'id': 'separator45',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom37',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:MergeCells', 'text'),
								'command': '.uno:MergeCells'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Table-Section-Merge1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB62',
						'type': 'container',
						'children': [
							{
								'id': 'LineA25',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SplitCell', 'text'),
										'command': '.uno:SplitCell'
									}
								]
							},
							{
								'id': 'LineB26',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SplitTable', 'text'),
										'command': '.uno:SplitTable'
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
				'id': 'Table-Section-Select',
				'type': 'container',
				'children': [
					{
						'id': 'separator51',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom43',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:EntireCell', 'text'),
								'command': '.uno:EntireCell'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Table-Section-Select1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB66',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom84',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:EntireColumn', 'text'),
										'command': '.uno:EntireColumn'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:SelectTable', 'text'),
										'command': '.uno:SelectTable'
									}
								]
							},
							{
								'id': 'SectionBottom85',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:EntireRow', 'text'),
										'command': '.uno:EntireRow'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:DeleteTable', 'text'),
										'command': '.uno:DeleteTable'
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
				'id': 'Table-Section-Optimize1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB63',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom44',
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
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:ParaRightToLeft'),
										'command': '.uno:ParaRightToLeft'
									}
								]
							},
							{
								'id': 'SectionBottom101',
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
							}
						],
						'vertical': 'true'
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Table-Section-Calc',
				'type': 'container',
				'children': [
					{
						'id': 'separator53',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom35',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:TableSort', 'text'),
								'command': '.uno:TableSort'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'type': 'container',
				'children': [
					{
						'id': 'pagestyle',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:TableNumberFormatDialog', 'text'),
								'command': '.uno:TableNumberFormatDialog'
							}
						]
					}
				]
			},
			{
				'id': 'Table-Section-FormatCalc1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB97',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom109',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatCurrency', 'text'),
										'command': '.uno:NumberFormatCurrency'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatDecimal', 'text'),
										'command': '.uno:NumberFormatDecimal'
									}
								]
							},
							{
								'id': 'SectionBottom110',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatPercent', 'text'),
										'command': '.uno:NumberFormatPercent'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:NumberFormatDate', 'text'),
										'command': '.uno:NumberFormatDate'
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
				'type': 'container',
				'children': [
					{
						'id': 'tabledialog',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:TableDialog', 'text'),
								'command': '.uno:TableDialog'
							}
						]
					}
				]
			},
		];

		return this.getNotebookbar([this.getTabPage('Table', content)], '-8');
	},

	getDrawTab: function() {
		var content = [
			{
				'id': 'Draw-Section-Edit',
				'type': 'container',
				'children': [
					{
						'id': 'SectionBottom46',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:InsertCaptionDialog'),
								'command': '.uno:InsertCaptionDialog'
							}
						]
					},
					{
						'id': 'GroupB69',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom49',
								'type': 'toolbox',
								'children': [
									{
										'type': 'bigtoolitem',
										'text': _UNO('.uno:FlipVertical'),
										'command': '.uno:FlipVertical'
									},
									{
										'type': 'bigtoolitem',
										'text': _UNO('.uno:FlipHorizontal'),
										'command': '.uno:FlipHorizontal'
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
				'id': 'Draw-Section-FormatLineArea2',
				'type': 'container',
				'children': [
					{
						'id': 'separator37',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'box10',
						'type': 'container',
						'children': [
							{
								'id': 'third8',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:FormatLine'),
										'command': '.uno:FormatLine'
									}
								]
							},
							{
								'id': 'third7',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:FormatArea'),
										'command': '.uno:FormatArea'
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
				'id': 'Draw-Section-FormatLineArea3',
				'type': 'container',
				'children': [
					{
						'id': 'box15',
						'type': 'container',
						'children': [
							{
								'id': 'box16',
								'type': 'container',
								'children': [
									{
										'id': 'SectionBottom61',
										'type': 'toolbox',
										'children': [
											{
												'type': 'toolitem',
												'text': _UNO('.uno:XLineColor'),
												'command': '.uno:XLineColor'
											}
										]
									}
								],
								'vertical': 'false'
							},
						],
						'vertical': 'true'
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Draw-Section-Wrap1',
				'type': 'container',
				'children': [
					{
						'id': 'WrapGroup5',
						'type': 'container',
						'children': [
							{
								'id': 'Wrap13',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapOff', 'text'),
										'command': '.uno:WrapOff'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapOn', 'text'),
										'command': '.uno:WrapOn'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapIdeal', 'text'),
										'command': '.uno:WrapIdeal'
									}
								]
							},
							{
								'id': 'Wrap14',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapLeft', 'text'),
										'command': '.uno:WrapLeft'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapThrough', 'text'),
										'command': '.uno:WrapThrough'
									},
									{
										'type': 'toolitem',
										'text': _UNO('.uno:WrapRight', 'text'),
										'command': '.uno:WrapRight'
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
				'id': 'Draw-Section-Wrap2',
				'type': 'container',
				'children': [
					{
						'id': 'WrapGroup8',
						'type': 'container',
						'children': [
							{
								'id': 'Wrap22',
								'type': 'toolbox',
								'children': [
									{
										'type': 'toolitem',
										'text': _UNO('.uno:TextWrap'),
										'command': '.uno:TextWrap'
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
				'id': 'Draw-Section-ObjectAlign',
				'type': 'container',
				'children': [
					{
						'id': 'separator48',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'box12',
						'type': 'container',
						'children': [
							{
								'id': 'AlignGroup5',
								'type': 'container',
								'children': [
									{
										'id': 'Align7',
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
										'id': 'Align8',
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
							}
						],
						'vertical': 'false'
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Draw-Section-Arrange',
				'type': 'container',
				'children': [
					{
						'id': 'separator49',
						'type': 'separator',
						'orientation': 'vertical'
					},
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
										'text': _UNO('.uno:ObjectForwardOne'),
										'command': '.uno:ObjectForwardOne'
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
										'text': _UNO('.uno:ObjectBackOne'),
										'command': '.uno:ObjectBackOne'
									}
								],
								'left': '1',
								'top': '1'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Draw-Section-Group',
				'type': 'container',
				'children': [
					{
						'id': 'separator132',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom51',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FormatGroup'),
								'command': '.uno:FormatGroup'
							}
						]
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Draw-Section-Group1',
				'type': 'container',
				'children': [
					{
						'id': 'GroupB70',
						'type': 'container',
						'children': [
							{
								'id': 'SectionBottom53',
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
								'id': 'SectionBottom64',
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
					}
				],
				'vertical': 'false'
			},
			{
				'id': 'Draw-Section-Fontwork',
				'type': 'container',
				'children': [
					{
						'id': 'separator44',
						'type': 'separator',
						'orientation': 'vertical'
					},
					{
						'id': 'SectionBottom98',
						'type': 'toolbox',
						'children': [
							{
								'type': 'bigtoolitem',
								'text': _UNO('.uno:FontworkGalleryFloater'),
								'command': '.uno:FontworkGalleryFloater'
							}
						]
					}
				],
				'vertical': 'false'
			}
		];

		return this.getNotebookbar([this.getTabPage('Draw', content)], '-9');
	},

	getNotebookbar: function(tabPages, selectedPage) {
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
											'selected': selectedPage,
											'children': tabPages
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

	getTabPage: function(tabName, content) {
		return {
			'id': '',
			'type': 'tabpage',
			'text': '',
			'enabled': 'true',
			'children': [
				{
					'id': tabName + ' Tab',
					'type': 'container',
					'text': '',
					'enabled': 'true',
					'children': [
						{
							'id': tabName,
							'type': 'container',
							'text': '',
							'enabled': 'true',
							'children': content
						}
					]
				}
			]
		};
	}
});

L.control.notebookbarWriter = function (options) {
	return new L.Control.NotebookbarWriter(options);
};
