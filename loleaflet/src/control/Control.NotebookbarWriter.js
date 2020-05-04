/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarWriter
 */

/* global */
L.Control.NotebookbarWriter = L.Control.Notebookbar.extend({

	selectedTab: function(tabText) {
		switch (tabText) {
		case 'HomeLabel':
			this.loadTab(this.getHomeTab());
			break;

		case 'InsertLabel':
			this.loadTab(this.getInsertTab());
			break;

		case 'LayoutLabel':
			this.loadTab(this.getLayoutTab());
			break;

		case 'ReferencesLabel':
			this.loadTab(this.getReferencesTab());
			break;

		case 'TableLabel':
			this.loadTab(this.getTableTab());
			break;

		case 'ReviewLabel':
			this.loadTab(this.getReviewTab());
			break;
		}
	},

	getTabs: function() {
		return [
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
				'text': '~Table',
				'id': '8',
				'name': 'TableLabel'
			}
		];
	},

	getHomeTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box',
					'type': 'container',
					'children': [
						{
							'id': 'ContextContainer',
							'type': 'tabcontrol',
							'children': [
								{
									'id': '',
									'type': 'tabpage',
									'children': [
										{
											'id': 'HomeBox',
											'type': 'container',
											'children': [
												{
													'id': 'Home-PasteBox',
													'type': 'container',
													'children': [
														{
															'id': 'FileSection7',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom87',
																	'type': 'toolbox',
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
																	'children': [
																		{
																			'id': 'LineA6',
																			'type': 'toolbox',
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
																},
																{
																	'id': 'separator104',
																	'type': 'fixedline',
																	'enabled': 'true'
																}
															],
														}
													],
												},
												{
													'id': 'Home-Container',
													'type': 'container',
													'children': [
														{
															'id': 'Home-Section-Style',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB13',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA7',
																			'type': 'toolbox',
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
														},
														{
															'id': 'Home-Section-Format',
															'type': 'container',
															'children': [
																{
																	'id': 'FileSection8',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'GroupB10',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'box76',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'font',
																							'type': 'toolbox',
																							'children': [
																								{
																									'id': '',
																									'type': 'borderwindow',
																									'children': [
																										{
																											'id': 'fontnamecombobox',
																											'type': 'combobox',
																											'text': 'Liberation Serif',
																											'children': [
																												{
																													'id': '',
																													'type': 'pushbutton',
																													'enabled': 'true'
																												},
																												{
																													'id': '',
																													'type': 'edit',
																													'text': 'Liberation Serif',
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
																							'children': [
																								{
																									'id': '',
																									'type': 'borderwindow',
																									'children': [
																										{
																											'id': 'fontsizecombobox',
																											'type': 'combobox',
																											'text': '12',
																											'children': [
																												{
																													'id': '',
																													'type': 'pushbutton',
																													'enabled': 'true'
																												},
																												{
																													'id': '',
																													'type': 'edit',
																													'text': '12',
																													'enabled': 'true'
																												}
																											],
																											'entries': [
																												'6',
																												'7',
																												'8',
																												'9',
																												'10',
																												'10.5',
																												'11',
																												'12',
																												'13',
																												'14',
																												'15',
																												'16',
																												'18',
																												'20',
																												'22',
																												'24',
																												'26',
																												'28',
																												'32',
																												'36',
																												'40',
																												'44',
																												'48',
																												'54',
																												'60',
																												'66',
																												'72',
																												'80',
																												'88',
																												'96'
																											],
																											'selectedCount': '1',
																											'selectedEntries': [
																												'7'
																											],
																											'command': '.uno:FontHeight'
																										}
																									]
																								}
																							]
																						},
																						{
																							'id': 'ExtTop6',
																							'type': 'toolbox',
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
																				},
																				{
																					'id': 'GroupB11',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'ExtTop4',
																							'type': 'toolbox',
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
																							'id': 'ExtTop5',
																							'type': 'toolbox',
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
																							'enabled': 'true'
																						},
																						{
																							'id': 'ExtTop2',
																							'type': 'toolbox',
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
																				}
																			],
																			'vertical': 'true'
																		},
																		{
																			'id': 'separator8',
																			'type': 'fixedline',
																			'enabled': 'true'
																		}
																	],
																}
															],
														},
														{
															'id': 'Home-Section-Paragraph',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB14',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'GroupB16',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom91',
																					'type': 'toolbox',
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
																					'id': 'separator7',
																					'type': 'fixedline',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom9',
																					'type': 'toolbox',
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
																					'id': 'SectionBottom89',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Left-To-Right',
																							'command': '.uno:ParaLeftToRight'
																						}
																					]
																				}
																			],
																		},
																		{
																			'id': 'GroupB15',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom13',
																					'type': 'toolbox',
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
																					'id': 'separator97',
																					'type': 'fixedline',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom3',
																					'type': 'toolbox',
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
																					'id': 'SectionBottom77',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Right-To-Left',
																							'command': '.uno:ParaRightToLeft'
																						}
																					]
																				}
																			],
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator102',
																	'type': 'fixedline',
																	'enabled': 'true'
																}
															],
														},
														{
															'id': 'Home-Section-Style2',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB17',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'GroupB19',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom5',
																					'type': 'toolbox',
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
																					'children': [
																						{
																							'id': '',
																							'type': 'borderwindow',
																							'children': [
																								{
																									'id': 'applystyle',
																									'type': 'combobox',
																									'text': 'Default Style',
																									'children': [
																										{
																											'id': '',
																											'type': 'pushbutton',
																											'enabled': 'true'
																										},
																										{
																											'id': '',
																											'type': 'edit',
																											'text': 'Default Style',
																											'enabled': 'true'
																										}
																									],
																									'entries': [
																										'Clear formatting',
																										'Default Style',
																										'Text Body',
																										'Title',
																										'Subtitle',
																										'Heading 1',
																										'Heading 2',
																										'Heading 3',
																										'Quotations',
																										'More Styles...'
																									],
																									'selectedCount': '0',
																									'selectedEntries': '',
																									'command': '.uno:StyleApply'
																								}
																							]
																						}
																					]
																				},
																				{
																					'id': 'SectionBottom81',
																					'type': 'toolbox',
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
																				}
																			],
																		},
																		{
																			'id': 'StyleParagraphSection1',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom102',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Default Paragraph',
																							'command': '.uno:StyleApply?Style:string=Standard&FamilyName:string=ParagraphStyles'
																						}
																					]
																				},
																				{
																					'id': 'separator106',
																					'type': 'fixedline',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom93',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Heading 1',
																							'command': '.uno:StyleApply?Style:string=Heading 1&FamilyName:string=ParagraphStyles'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Heading 2',
																							'command': '.uno:StyleApply?Style:string=Heading 2&FamilyName:string=ParagraphStyles'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Heading 3',
																							'command': '.uno:StyleApply?Style:string=Heading 3&FamilyName:string=ParagraphStyles'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Heading 4',
																							'command': '.uno:StyleApply?Style:string=Heading 4&FamilyName:string=ParagraphStyles'
																						}
																					]
																				},
																				{
																					'id': 'separator20',
																					'type': 'fixedline',
																					'enabled': 'true'
																				},
																				{
																					'id': 'SectionBottom7',
																					'type': 'toolbox',
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
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator10',
																	'type': 'fixedline',
																	'enabled': 'true'
																}
															],
														},
														{
															'id': 'Home-Section-Insert',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB20',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA8',
																			'type': 'toolbox',
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
																},
																{
																	'id': 'separator107',
																	'type': 'fixedline',
																	'enabled': 'true'
																}
															],
														},
														{
															'id': 'Home-Section-View',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB83',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA34',
																			'type': 'toolbox',
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
														},
														{
															'id': '',
															'type': 'pushbutton',
															'enabled': 'true'
														}
													],
												},
												{
													'id': 'separator9',
													'type': 'fixedline',
													'enabled': 'true'
												},
												{
													'id': 'Home-Menu',
													'type': 'container',
													'children': [
														{
															'id': 'PasteBox1',
															'type': 'container',
															'children': [
																{
																	'id': 'Home-HomeButton',
																	'type': 'menubutton',
																	'text': '~Home',
																	'enabled': 'true'
																},
																{
																	'id': 'SectionBottom10',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Find & Replace',
																			'command': '.uno:SearchDialog'
																		},
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
												}
											],
										}
									]
								}
							],
							'tabs': [],
							'selected': '2'
						}
					],
					'vertical': 'true',
					'left': '0',
					'top': '0'
				}
			]
		};
	},

	getInsertTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box',
					'type': 'container',
					'children': [
						{
							'id': 'ContextContainer',
							'type': 'tabcontrol',
							'children': [
								{
									'id': '',
									'type': 'tabpage',
									'children': [
										{
											'id': 'InsertBox',
											'type': 'container',
											'children': [
												{
													'id': 'Insert-Container',
													'type': 'container',
													'children': [
														{
															'id': 'Insert-Section-Pagebreak',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom70',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Page Break',
																			'command': '.uno:InsertPagebreak'
																		}
																	]
																},
																{
																	'id': 'GroupB21',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA9',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Title Page',
																					'command': '.uno:TitlePageDialog'
																				}
																			]
																		},
																		{
																			'id': 'LineB10',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Section',
																					'command': '.uno:InsertSection'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator11',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Table',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom12',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Table',
																			'command': '.uno:InsertTable'
																		}
																	]
																},
																{
																	'id': 'GroupB29',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA15',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Chart',
																					'command': '.uno:InsertObjectChart'
																				}
																			]
																		},
																		{
																			'id': 'LineB16',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'OLE Object',
																					'command': '.uno:InsertObject'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator15',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Image',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom65',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Image',
																			'command': '.uno:InsertGraphic'
																		}
																	]
																},
																{
																	'id': 'GroupB23',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA11',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Gallery',
																					'command': '.uno:Gallery'
																				}
																			]
																		},
																		{
																			'id': 'LineB12',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Media',
																					'command': '.uno:InsertAVMedia'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator36',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Bookmark',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom14',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Hyperlink',
																			'command': '.uno:HyperlinkDialog'
																		}
																	]
																},
																{
																	'id': 'GroupB22',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA10',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Bookmark',
																					'command': '.uno:InsertBookmark'
																				}
																			]
																		},
																		{
																			'id': 'LineB11',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Cross-reference',
																					'command': '.uno:InsertReferenceField'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator16',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Field',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom11',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Field',
																			'command': '.uno:InsertFieldCtrl'
																		}
																	]
																},
																{
																	'id': 'separator17',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-DrawText',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom90',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Text Box',
																			'command': '.uno:DrawText'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Vertical Text',
																			'command': '.uno:VerticalText'
																		}
																	]
																}
															],
														},
														{
															'id': 'Insert-Section-Draw',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB25',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'shapes1',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Line',
																					'command': '.uno:Line'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Polygon',
																					'command': '.uno:Polygon_Unfilled'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Curve',
																					'command': '.uno:Bezier_Unfilled'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Lines and Arrows',
																					'command': '.uno:ArrowsToolbox'
																				}
																			]
																		},
																		{
																			'id': 'shapes3',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'command': '.uno:BasicShapes.rectangle'
																				},
																				{
																					'type': 'toolitem',
																					'command': '.uno:BasicShapes.ellipse'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Callouts',
																					'command': '.uno:DrawCaption'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Curve',
																					'command': '.uno:LineToolbox'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator28',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Draw2',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB75',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'shapes6',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Basic Shapes',
																					'command': '.uno:BasicShapes'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Symbol Shapes',
																					'command': '.uno:SymbolShapes'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Arrow Shapes',
																					'command': '.uno:ArrowShapes'
																				}
																			]
																		},
																		{
																			'id': 'shapes8',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Star Shapes',
																					'command': '.uno:StarShapes'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Callout Shapes',
																					'command': '.uno:CalloutShapes'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Flowchart Shapes',
																					'command': '.uno:FlowChartShapes'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator95',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-AutoText',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom78',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'AutoText',
																			'command': '.uno:EditGlossary'
																		}
																	]
																},
																{
																	'id': 'separator12',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Symbol',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom105',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Symbol',
																			'command': '.uno:CharmapControl'
																		}
																	]
																},
																{
																	'id': 'GroupB27',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA13',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Formula',
																					'command': '.uno:InsertObjectStarMath'
																				}
																			]
																		},
																		{
																			'id': 'LineB14',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Emoji',
																					'command': '.uno:EmojiControl'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																}
															],
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator22',
													'type': 'fixedline',
												},
												{
													'id': 'Insert-Menu',
													'type': 'container',
													'children': [
														{
															'id': 'GroupB18',
															'type': 'container',
															'children': [
																{
																	'id': 'Insert-InsertButton',
																	'type': 'menubutton',
																	'text': '~Insert',
																},
																{
																	'id': 'SectionBottom32',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Draw Functions',
																			'command': '.uno:InsertDraw'
																		}
																	]
																}
															],
															'vertical': 'true'
														}
													],
												}
											],
										}
									]
								}
							],
							'tabs': [],
							'selected': '3'
						}
					],
					'vertical': 'true',
					'left': '0',
					'top': '0'
				}
			]
		};
	},

	getLayoutTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box',
					'type': 'container',
					'children': [
						{
							'id': 'ContextContainer',
							'type': 'tabcontrol',
							'children': [
								{
									'id': '',
									'type': 'tabpage',
									'children': [
										{
											'id': 'LayoutBox',
											'type': 'container',
											'children': [
												{
													'id': 'Layout-Container',
													'type': 'container',
													'children': [
														{
															'id': 'Layout-Section-File',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom33',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Page Margins',
																			'command': '.uno:PageMargin'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Orientation',
																			'command': '.uno:Orientation'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Page Size',
																			'command': '.uno:AttributePageSize'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Page Columns',
																			'command': '.uno:PageColumnType'
																		}
																	]
																},
																{
																	'id': 'GroupB28',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA12',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Page Break',
																					'command': '.uno:InsertPagebreak'
																				}
																			]
																		},
																		{
																			'id': 'LineB13',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Manual Break',
																					'command': '.uno:InsertBreak'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator19',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Layout-Section-ParaMargin',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB31',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LeftParaMargin1',
																			'type': 'toolbox',
																			'children': [
																				{
																					'id': 'ParaLRSpacingWindow',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'grid1',
																							'type': 'grid',
																							'children': [
																								{
																									'id': 'before',
																									'type': 'container',
																									'children': [
																										{
																											'id': 'image5',
																											'type': 'fixedimage',
																										},
																										{
																											'id': '',
																											'type': 'borderwindow',
																											'children': [
																												{
																													'id': 'beforetextindent',
																													'type': 'spinfield',
																													'text': '0.00 \"',
																	
																													'children': [
																														{
																															'id': '',
																															'type': 'edit',
																															'text': '0.00 \"',
																			
																														}
																													],
																													'min': '-3937',
																													'max': '673',
																													'unit': 'inch'
																												}
																											]
																										}
																									],
																									'left': '0',
																									'top': '0'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			]
																		},
																		{
																			'id': 'belowspacing5',
																			'type': 'toolbox',
																			'children': [
																				{
																					'id': 'ParaLRSpacingWindow',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'grid1',
																							'type': 'grid',
																							'children': [
																								{
																									'id': 'after',
																									'type': 'container',
																									'children': [
																										{
																											'id': 'image4',
																											'type': 'fixedimage',
																										},
																										{
																											'id': '',
																											'type': 'borderwindow',																											'children': [
																												{
																													'id': 'aftertextindent',
																													'type': 'spinfield',
																													'text': '0.00 \"',																													'children': [
																														{
																															'id': '',
																															'type': 'edit',
																															'text': '0.00 \"',
																														}
																													],
																													'min': '-3937',
																													'max': '673',
																													'unit': 'inch'
																												}
																											]
																										}
																									],
																									'left': '0',
																									'top': '1'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB30',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'belowspacing10',
																			'type': 'toolbox',
																			'children': [
																				{
																					'id': 'ParaULSpacingWindow',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'grid1',
																							'type': 'grid',
																							'children': [
																								{
																									'id': 'above',
																									'type': 'container',
																									'children': [
																										{
																											'id': 'image6',
																											'type': 'fixedimage',
																										},
																										{
																											'id': '',
																											'type': 'borderwindow',
																											'children': [
																												{
																													'id': 'aboveparaspacing',
																													'type': 'spinfield',
																													'text': '0.00 \"',
																													'children': [
																														{
																															'id': '',
																															'type': 'edit',
																															'text': '0.00 \"',
																			
																														}
																													],
																													'min': '0',
																													'max': '394',
																													'unit': 'inch'
																												}
																											]
																										}
																									],
																									'left': '0',
																									'top': '0'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			]
																		},
																		{
																			'id': 'belowspacing15',
																			'type': 'toolbox',
																			'children': [
																				{
																					'id': 'ParaULSpacingWindow',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'grid1',
																							'type': 'grid',
																							'children': [
																								{
																									'id': 'below',
																									'type': 'container',
																									'children': [
																										{
																											'id': 'image7',
																											'type': 'fixedimage',
																										},
																										{
																											'id': '',
																											'type': 'borderwindow',
																											'children': [
																												{
																													'id': 'belowparaspacing',
																													'type': 'spinfield',
																													'text': '0.00 \"',
																	
																													'children': [
																														{
																															'id': '',
																															'type': 'edit',
																															'text': '0.00 \"',
																			
																														}
																													],
																													'min': '0',
																													'max': '394',
																													'unit': 'inch'
																												}
																											]
																										}
																									],
																									'left': '0',
																									'top': '1'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator111',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Layout-Section-Backgrounds',
															'type': 'container',
															'children': [
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
																					'text': 'Title Page',
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
																					'text': 'Watermark',
																					'command': '.uno:Watermark'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB32',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LeftParaMargin2',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Hyphenation',
																					'command': '.uno:Hyphenate'
																				}
																			]
																		},
																		{
																			'id': 'belowspacing1',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Line Numbering',
																					'command': '.uno:LineNumberingDialog'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator21',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Layout-Section-SelectGroup',
															'type': 'container',
															'children': [
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
																					'text': 'Select',
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
																					'text': 'Group',
																					'command': '.uno:FormatGroup'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator116',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Layout-Section-Wrap',
															'type': 'container',
															'children': [
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
																					'text': 'Wrap Off',
																					'command': '.uno:WrapOff'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Page Wrap',
																					'command': '.uno:WrapOn'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Optimal Page Wrap',
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
																					'text': 'Wrap Left',
																					'command': '.uno:WrapLeft'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Wrap Through',
																					'command': '.uno:WrapThrough'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Wrap Right',
																					'command': '.uno:WrapRight'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator98',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Layout-Section-Arrange',
															'type': 'container',
															'children': [
																{
																	'id': 'grid3',
																	'type': 'grid',
																	'children': [
																		{
																			'id': 'first12',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Bring to Front',
																					'command': '.uno:BringToFront'
																				}
																			],
																			'left': '0',
																			'top': '0'
																		},
																		{
																			'id': 'first13',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Forward One',
																					'command': '.uno:ObjectForwardOne'
																				}
																			],
																			'left': '1',
																			'top': '0'
																		},
																		{
																			'id': 'second4',
																			'type': 'toolbox',
							
							
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Send to Back',
																					'command': '.uno:SendToBack'
																				}
																			],
																			'left': '0',
																			'top': '1'
																		},
																		{
																			'id': 'Second2',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Back One',
																					'command': '.uno:ObjectBackOne'
																				}
																			],
																			'left': '1',
																			'top': '1'
																		}
																	]
																}
															],
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator18',
													'type': 'fixedline',
												},
												{
													'id': 'Layout-Menu',
													'type': 'container',
	
	
													'children': [
														{
															'id': 'GroupB24',
															'type': 'container',
			
			
															'children': [
																{
																	'id': 'Layout-PageButton',
																	'type': 'menubutton',
																	'text': '~Layout',
					
																},
																{
																	'id': 'SectionBottom15',
																	'type': 'toolbox',
					
					
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Page Settings',
																			'command': '.uno:PageDialog'
																		}
																	]
																}
															],
															'vertical': 'true'
														}
													],
												}
											],
										}
									]
								}
							],
							'tabs': [],
							'selected': '4'
						}
					],
					'vertical': 'true',
					'left': '0',
					'top': '0'
				}
			]
		};
	},

	getReferencesTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box',
					'type': 'container',
					'children': [
						{
							'id': 'ContextContainer',
							'type': 'tabcontrol',
							'children': [
								{
									'id': '',
									'type': 'tabpage',
									'children': [
										{
											'id': 'ReferencesBox',
											'type': 'container',
											'children': [
												{
													'id': 'Reference-Container',
													'type': 'container',
													'children': [
														{
															'id': 'Reference-Section-Index',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom34',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Table of Contents',
																			'command': '.uno:InsertMultiIndex'
																		}
																	]
																},
																{
																	'id': 'GroupB35',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA16',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Index Entry',
																					'command': '.uno:InsertIndexesEntry'
																				}
																			]
																		},
																		{
																			'id': 'LineB17',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Update Index',
																					'command': '.uno:UpdateCurIndex'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator23',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Reference-Section-Reference',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom18',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Footnote',
																			'command': '.uno:InsertFootnote'
																		}
																	]
																},
																{
																	'id': 'GroupB36',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LeftParaMargin3',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Endnote',
																					'command': '.uno:InsertEndnote'
																				}
																			]
																		},
																		{
																			'id': 'belowspacing2',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Footnotes and Endnotes',
																					'command': '.uno:FootnoteDialog'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator33',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Reference-Section-Caption',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom19',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Cross-reference',
																			'command': '.uno:InsertReferenceField'
																		}
																	]
																},
																{
																	'id': 'GroupB38',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineB18',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Bookmark',
																					'command': '.uno:InsertBookmark'
																				}
																			]
																		},
																		{
																			'id': 'LineA17',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Caption',
																					'command': '.uno:InsertCaptionDialog'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator34',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Reference-Section-Bibliothek',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom16',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Bibliography Entry',
																			'command': '.uno:InsertAuthoritiesEntry'
																		}
																	]
																},
																{
																	'id': 'GroupB39',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA18',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Bibliography Database',
																					'command': '.uno:BibliographyComponent'
																				}
																			]
																		},
																		{
																			'id': 'LineB19',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Data Sources',
																					'command': '.uno:ViewDataSourceBrowser'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																}
															],
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator14',
													'type': 'fixedline',
												},
												{
													'id': 'Reference-Menu',
													'type': 'container',
													'children': [
														{
															'id': 'GroupB34',
															'type': 'container',
															'children': [
																{
																	'id': 'References-ReferencesButton',
																	'type': 'menubutton',
																	'text': 'Reference~s',
																},
																{
																	'id': 'SectionBottom8',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Update All',
																			'command': '.uno:UpdateAll'
																		}
																	]
																}
															],
															'vertical': 'true'
														}
													],
												}
											],
										}
									]
								}
							],
							'tabs': [],
							'selected': '5'
						}
					],
					'vertical': 'true',
					'left': '0',
					'top': '0'
				}
			]
		};
	},

	getTableTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box',
					'type': 'container',
					'children': [
						{
							'id': 'ContextContainer',
							'type': 'tabcontrol',
							'children': [
								{
									'id': '',
									'type': 'tabpage',
									'children': [
										{
											'id': 'TableBox',
											'type': 'container',
											'children': [
												{
													'id': 'Table-Container',
													'type': 'container',
													'children': [
														{
															'id': 'Table-Section-Layout',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom62',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Caption',
																			'command': '.uno:InsertCaptionDialog'
																		}
																	]
																},
																{
																	'id': 'GroupB60',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'SectionBottom38',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Insert Columns Before',
																					'command': '.uno:InsertColumnsBefore'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Insert Columns After',
																					'command': '.uno:InsertColumnsAfter'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Delete Columns',
																					'command': '.uno:DeleteColumns'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom40',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Insert Rows Above',
																					'command': '.uno:InsertRowsBefore'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Insert Rows Below',
																					'command': '.uno:InsertRowsAfter'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Delete Rows',
																					'command': '.uno:DeleteRows'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator119',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-FormatLineArea',
															'type': 'container',
															'children': [
																{
																	'id': 'box1',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'third1',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Borders',
																					'command': '.uno:BorderDialog'
																				}
																			]
																		},
																		{
																			'id': 'third6',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Area',
																					'command': '.uno:FormatArea'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'box17',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'box18',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'first20',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Borders (Shift to overwrite)',
																							'command': '.uno:SetBorderStyle'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Border Style',
																							'command': '.uno:LineStyle'
																						}
																					]
																				},
																				{
																					'id': 'SectionBottom63',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Border Color',
																							'command': '.uno:FrameLineColor'
																						}
																					]
																				}
																			],
																		},
																		{
																			'id': 'box19',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom73',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Background Color',
																							'command': '.uno:BackgroundColor'
																						}
																					]
																				}
																			],
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator5',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-Merge',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom37',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Merge Cells',
																			'command': '.uno:MergeCells'
																		}
																	]
																},
																{
																	'id': 'GroupB61',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA31',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Split Cells',
																					'command': '.uno:SplitCell'
																				}
																			]
																		},
																		{
																			'id': 'LineB32',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Split Table',
																					'command': '.uno:SplitTable'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator45',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-Select',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom43',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Select Cell',
																			'command': '.uno:EntireCell'
																		}
																	]
																},
																{
																	'id': 'GroupB62',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'SectionBottom36',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Select Column',
																					'command': '.uno:EntireColumn'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom39',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Select Row',
																					'command': '.uno:EntireRow'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB65',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'SectionBottom68',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Select Table',
																					'command': '.uno:SelectTable'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom64',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Delete Table',
																					'command': '.uno:DeleteTable'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator51',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-Optimize',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom76',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Optimize Size',
																			'command': '.uno:OptimizeTable'
																		}
																	]
																},
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
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Right-To-Left',
																					'command': '.uno:ParaRightToLeft'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom85',
																			'type': 'toolbox',
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
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator57',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-Style',
															'type': 'container',
															'children': [
																{
																	'id': 'LineA29',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'AutoFormat Table Styles',
																			'command': '.uno:AutoFormat'
																		}
																	]
																},
																{
																	'id': 'separator121',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-Calc',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom35',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Sort',
																			'command': '.uno:TableSort'
																		}
																	]
																},
																{
																	'id': 'GroupB63',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA30',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Formula',
																					'command': '.uno:InsertFormula'
																				}
																			]
																		},
																		{
																			'id': 'LineB31',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Sum',
																					'command': '.uno:AutoSum'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator53',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-FormatCalc',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom42',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Number Format',
																			'command': '.uno:TableNumberFormatDialog'
																		}
																	]
																},
																{
																	'id': 'GroupB64',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'SectionBottom41',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Number Format: Currency',
																					'command': '.uno:NumberFormatCurrency'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Number Format: Decimal',
																					'command': '.uno:NumberFormatDecimal'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom44',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Number Format: Percent',
																					'command': '.uno:NumberFormatPercent'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Number Format: Date',
																					'command': '.uno:NumberFormatDate'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																}
															],
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator118',
													'type': 'fixedline',
												},
												{
													'id': 'Table-Menu',
													'type': 'container',
													'children': [
														{
															'id': 'GroupB58',
															'type': 'container',
															'children': [
																{
																	'id': 'Table-TableButton',
																	'type': 'menubutton',
																	'text': '~Table',
																},
																{
																	'id': 'SectionBottom29',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Table Properties',
																			'command': '.uno:TableDialog'
																		}
																	]
																}
															],
															'vertical': 'true'
														}
													],
												}
											],
										}
									]
								}
							],
							'tabs': [],
							'selected': '8'
						}
					],
					'vertical': 'true',
					'left': '0',
					'top': '0'
				}
			]
		};
	},

	getReviewTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box',
					'type': 'container',
					'children': [
						{
							'id': 'ContextContainer',
							'type': 'tabcontrol',
							'children': [
								{
									'id': '',
									'type': 'tabpage',
									'children': [
										{
											'id': 'ReviewBox',
											'type': 'container',
											'children': [
												{
													'id': 'Review-Container',
													'type': 'container',
													'children': [
														{
															'id': 'Review-Section-Language',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom67',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Spelling',
																			'command': '.uno:SpellingAndGrammarDialog'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Thesaurus',
																			'command': '.uno:ThesaurusDialog'
																		}
																	]
																},
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
																					'text': 'Auto Spellcheck',
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
																					'text': 'Word Count',
																					'command': '.uno:WordCountDialog'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator99',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Review-Section-Annotation',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom69',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Comment',
																			'command': '.uno:InsertAnnotation'
																		}
																	]
																},
																{
																	'id': 'GroupB41',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LeftParaMargin4',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Reply Comment',
																					'command': '.uno:ReplyComment'
																				}
																			]
																		},
																		{
																			'id': 'belowspacing3',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Delete Comment',
																					'command': '.uno:DeleteComment'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator109',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Review-Section-TrackChanges',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom72',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Record',
																			'command': '.uno:TrackChanges'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Show',
																			'command': '.uno:ShowTrackedChanges'
																		}
																	]
																},
																{
																	'id': 'GroupB42',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA20',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Next',
																					'command': '.uno:NextTrackedChange'
																				}
																			]
																		},
																		{
																			'id': 'LineB21',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Previous',
																					'command': '.uno:PreviousTrackedChange'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
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
																					'text': 'Accept',
																					'command': '.uno:AcceptTrackedChange'
																				}
																			]
																		},
																		{
																			'id': 'LineA22',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Reject',
																					'command': '.uno:RejectTrackedChange'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB45',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineB24',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Accept All',
																					'command': '.uno:AcceptAllTrackedChanges'
																				}
																			]
																		},
																		{
																			'id': 'LineA23',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Reject All',
																					'command': '.uno:RejectAllTrackedChanges'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator112',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Review-Section-Document',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom82',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Protect',
																			'command': '.uno:ProtectTraceChangeMode'
																		}
																	]
																},
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
																					'text': 'Compare',
																					'command': '.uno:CompareDocuments'
																				}
																			]
																		},
																		{
																			'id': 'LineB22',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Merge',
																					'command': '.uno:MergeDocuments'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator24',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Review-Section-EditDoc',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom94',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Edit Mode',
																			'command': '.uno:EditDoc'
																		}
																	]
																}
															],
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator96',
													'type': 'fixedline',
												},
												{
													'id': 'Review-Menu',
													'type': 'container',
													'children': [
														{
															'id': 'GroupB37',
															'type': 'container',
															'children': [
																{
																	'id': 'Review-ReviewButton',
																	'type': 'menubutton',
																	'text': '~Review',
																},
																{
																	'id': 'SectionBottom17',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Manage',
																			'command': '.uno:AcceptTrackedChanges'
																		}
																	]
																}
															],
															'vertical': 'true'
														}
													],
												}
											],
										}
									]
								}
							],
							'tabs': [],
							'selected': '6'
						}
					],
					'vertical': 'true',
					'left': '0',
					'top': '0'
				}
			]
		};
	}
});

L.control.notebookbarWriter = function (options) {
	return new L.Control.NotebookbarWriter(options);
};
