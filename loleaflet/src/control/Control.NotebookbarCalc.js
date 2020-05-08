/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarCalc
 */

/* global */
L.Control.NotebookbarCalc = L.Control.NotebookbarWriter.extend({

	selectedTab: function(tabText) {
		switch (tabText) {
		case 'HomeLabel':
			this.loadTab(this.getHomeTab());
			break;

		case 'InsertLabel':
			this.loadTab(this.getInsertTab());
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
				'name': 'HomeLabel',
				'context': 'default|Cell'
			},
			{
				'text': '~Insert',
				'id': '3',
				'name': 'InsertLabel'
			},
			{
				'text': '~Review',
				'id': '6',
				'name': 'ReviewLabel'
			}
		];
	},

	getHomeTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box1',
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
																							'id': 'font1',
																							'type': 'toolbox',
																							'children': [
																								{
																									'id': '',
																									'type': 'borderwindow',
																									'children': [
																										{
																											'id': 'fontnamecombobox',
																											'type': 'combobox',
																											'text': 'Liberation Sans',
																											'children': [
																												{
																													'id': '',
																													'type': 'pushbutton',
																												},
																												{
																													'id': '',
																													'type': 'edit',
																													'text': 'Liberation Sans',
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
																							'children': [
																								{
																									'id': '',
																									'type': 'borderwindow',
																									'children': [
																										{
																											'id': 'fontsizecombobox',
																											'type': 'combobox',
																											'text': '10',
																											'children': [
																												{
																													'id': '',
																													'type': 'pushbutton',
																												},
																												{
																													'id': '',
																													'type': 'edit',
																													'text': '10',
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
																												'4'
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
																						},
																						{
																							'id': 'ExtTop2',
																							'type': 'toolbox',
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
																				}
																			],
																			'vertical': 'true'
																		},
																		{
																			'id': 'separator10',
																			'type': 'fixedline',
																		}
																	],
																}
															],
														},
														{
															'id': 'Home-Section-Align',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB14',
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
																				},
																				{
																					'id': 'separator97',
																					'type': 'fixedline',
																				},
																				{
																					'id': 'first1',
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
																						}
																					]
																				}
																			],
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
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Justified',
																							'command': '.uno:AlignBlock'
																						}
																					]
																				},
																				{
																					'id': 'separator23',
																					'type': 'fixedline',
																				},
																				{
																					'id': 'second1',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Wrap Text',
																							'command': '.uno:WrapText'
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
																}
															],
														},
														{
															'id': 'Home-Section-Number',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB18',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'box2',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom36',
																					'type': 'toolbox',
																					'children': [
																						{
																							'id': '',
																							'type': 'borderwindow',
																							'children': [
																								{
																									'id': '',
																									'type': 'listbox',
																									'children': [
																										{
																											'id': '',
																											'type': 'control',
																										},
																										{
																											'id': '',
																											'type': 'pushbutton',
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
																				},
																				{
																					'id': 'second2',
																					'type': 'toolbox',
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
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator30',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Home-Section-Cell',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom35',
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
																	'id': 'GroupB20',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA10',
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
																		},
																		{
																			'id': 'LineB11',
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
																									'text': 'Default',
																									'children': [
																										{
																											'id': '',
																											'type': 'pushbutton',
																										},
																										{
																											'id': '',
																											'type': 'edit',
																											'text': 'Default',
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
																							'text': 'Default',
																							'command': '.uno:StyleApply?Style:string=Default&FamilyName:string=CellStyles'
																						}
																					]
																				},
																				{
																					'id': 'separator106',
																					'type': 'fixedline',
																				},
																				{
																					'id': 'SectionBottom93',
																					'type': 'toolbox',
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
																				},
																				{
																					'id': 'SectionBottom7',
																					'type': 'toolbox',
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
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator25',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Home-Section-Condition',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom37',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Conditional',
																			'command': '.uno:ConditionalFormatMenu'
																		}
																	]
																},
																{
																	'id': 'separator1',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Home-Section-Find',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom26',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Find & Replace',
																			'command': '.uno:SearchDialog'
																		}
																	]
																},
																{
																	'id': 'GroupB47',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA17',
																			'type': 'toolbox',
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
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator26',
													'type': 'fixedline',
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
					'id': 'box1',
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
															'id': 'Insert-Section-Function',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom70',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Pivot Table',
																			'command': '.uno:DataDataPilotRun'
																		}
																	]
																},
																{
																	'id': 'SectionBottom73',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Function List',
																			'command': '.uno:FunctionBox'
																		}
																	]
																},
																{
																	'id': 'separator11',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Chart',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom12',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Chart',
																			'command': '.uno:InsertObjectChart'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'OLE Object',
																			'command': '.uno:InsertObject'
																		}
																	]
																},
																{
																	'id': 'separator2',
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
															'id': 'Insert-Section-Reference',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom11',
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
																	'id': 'GroupB29',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA9',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Define Name',
																					'command': '.uno:AddName'
																				}
																			]
																		},
																		{
																			'id': 'LineB10',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Manage Names',
																					'command': '.uno:DefineName'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator4',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Field',
															'type': 'container',
															'children': [
																{
																	'id': 'Insert-FieldButton',
																	'type': 'menubutton',
																	'text': 'Fiel~d',
																},
																{
																	'id': 'separator57',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-DrawText',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom97',
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
																	'id': 'GroupB66',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'shapes2',
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
																			'id': 'shapes4',
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
																	'id': 'separator33',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Draw2',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB71',
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
													'id': 'separator6',
													'type': 'fixedline',
												},
												{
													'id': 'Insert-Menu',
													'type': 'container',
													'children': [
														{
															'id': 'GroupB26',
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

	getReviewTab: function() {
		return {
			'id': 'NotebookBar',
			'type': 'notebookbar',
			'children': [
				{
					'id': 'box1',
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
																			'command': '.uno:SpellDialog'
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
																					'text': 'Hyphenation',
																					'command': '.uno:Hyphenate'
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
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Edit Comment',
																			'command': '.uno:EditAnnotation'
																		}
																	]
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
																					'text': 'Show All Comments',
																					'command': '.uno:ShowAllNotes'
																				}
																			]
																		},
																		{
																			'id': 'belowspacing1',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Hide All Comments',
																					'command': '.uno:HideAllNotes'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB41',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'belowspacing7',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Delete Comment',
																					'command': '.uno:DeleteNote'
																				}
																			]
																		},
																		{
																			'id': 'LeftParaMargin7',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Delete All Comments',
																					'command': '.uno:DeleteAllNotes'
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
																			'command': '.uno:TraceChangeMode'
																		},
																		{
																			'type': 'toolitem',
																			'text': 'Manage',
																			'command': '.uno:AcceptChanges'
																		}
																	]
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
																			'text': 'Protect Sheet',
																			'command': '.uno:Protect'
																		}
																	]
																},
																{
																	'id': 'GroupB38',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA16',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Protect Spreadsheet Structure',
																					'command': '.uno:ToolProtectionDocument'
																				}
																			]
																		},
																		{
																			'id': 'LineB18',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Share Spreadsheet',
																					'command': '.uno:ShareDocument'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
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
																	'id': 'separator5',
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
													'id': 'Reference-Menu',
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
																			'command': '.uno:AcceptChanges'
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

L.control.notebookbarCalc = function (options) {
	return new L.Control.NotebookbarCalc(options);
};
