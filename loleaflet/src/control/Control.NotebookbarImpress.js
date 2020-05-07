/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarImpress
 */

/* global */
L.Control.NotebookbarImpress = L.Control.NotebookbarWriter.extend({

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

		case 'TableLabel':
			this.loadTab(this.getTableTab());
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
															'id': 'Home-Section-Slide',
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
																					'text': 'New Page',
																					'command': '.uno:InsertPage'
																				}
																			]
																		},
																		{
																			'id': 'LineB9',
																			'type': 'toolbox',
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
																},
																{
																	'id': 'separator107',
																	'type': 'fixedline',
																}
															],
														},
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
																					'command': '.uno:SetDefault'
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
																									'text': '18',
																									'children': [
																										{
																											'id': '',
																											'type': 'pushbutton',
																										},
																										{
																											'id': '',
																											'type': 'edit',
																											'text': '18',
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
																										'12'
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
																				},
																				{
																					'id': 'ExtTop2',
																					'type': 'toolbox',
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
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator8',
																	'type': 'fixedline',
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
																					'id': 'SectionBottom9',
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
																						}
																					]
																				},
																				{
																					'id': 'separator7',
																					'type': 'fixedline',
																				},
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
																							'text': 'Outline',
																							'command': '.uno:SetOutline'
																						},
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
																							'text': 'Increase',
																							'command': '.uno:ParaspaceIncrease'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Decrease',
																							'command': '.uno:ParaspaceDecrease'
																						}
																					]
																				}
																			],
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB31',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'SectionBottom94',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Left-To-Right',
																					'command': '.uno:ParaLeftToRight'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom98',
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
																	'vertical': 'true'
																},
																{
																	'id': 'separator102',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Home-Section-DrawSection',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom5',
																	'type': 'toolbox',
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
																},
																{
																	'id': 'GroupB43',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'GroupB12',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'shapes12',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Line',
																							'command': '.uno:Line'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Curve',
																							'command': '.uno:LineToolbox'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Connector',
																							'command': '.uno:ConnectorToolbox'
																						}
																					]
																				},
																				{
																					'id': 'separator58',
																					'type': 'fixedline',
																				},
																				{
																					'id': 'LineA20',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Line Color',
																							'command': '.uno:XLineColor'
																						}
																					]
																				}
																			],
																		},
																		{
																			'id': 'GroupB38',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'shapes15',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'command': '.uno:BasicShapes.rectangle'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Basic Shapes',
																							'command': '.uno:BasicShapes'
																						},
																						{
																							'type': 'toolitem',
																							'text': 'Flowchart Shapes',
																							'command': '.uno:FlowChartShapes'
																						}
																					]
																				},
																				{
																					'id': 'separator64',
																					'type': 'fixedline',
																				},
																				{
																					'id': 'LineB22',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': 'Fill Color',
																							'command': '.uno:FillColor'
																						}
																					]
																				}
																			],
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator69',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Home-Section-Slideshow',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB39',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA9',
																			'type': 'toolbox',
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
														},
														{
															'id': '',
															'type': 'pushbutton',
														}
													],
												},
												{
													'id': 'separator9',
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
															'id': 'Insert-Section-Slide',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom24',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'New Page',
																			'command': '.uno:InsertPage'
																		}
																	]
																},
																{
																	'id': 'SectionBottom81',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Master Slide Design',
																			'command': '.uno:PresentationLayout'
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
																	'id': 'GroupB22',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineB11',
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
																			'id': 'LineA10',
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
																			'id': 'LineB12',
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
																			'id': 'LineA11',
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
															'id': 'Insert-Section-Hyperlink',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom34',
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
																	'id': 'GroupB19',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'LineA18',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Fontwork Style',
																					'command': '.uno:FontworkGalleryFloater'
																				}
																			]
																		},
																		{
																			'id': 'LineB10',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Snap Guide',
																					'command': '.uno:CapturePoint'
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
															'id': 'Insert-Section-Field',
															'type': 'container',
															'children': [
																{
																	'id': 'Insert-FieldButton',
																	'type': 'menubutton',
																	'text': 'Fiel~d',
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
																	'id': 'SectionBottom97',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Text Box',
																			'command': '.uno:Text'
																		}
																	]
																},
																{
																	'id': 'SectionBottom82',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Vertical Text',
																			'command': '.uno:VerticalText'
																		}
																	]
																},
																{
																	'id': 'separator28',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Draw',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB59',
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
																	'id': 'separator4',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Insert-Section-Draw2',
															'type': 'container',
															'children': [
																{
																	'id': 'GroupB64',
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
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Connector',
																					'command': '.uno:ConnectorToolbox'
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
																				},
																				{
																					'type': 'toolitem',
																					'text': '3D Objects',
																					'command': '.uno:Objects3DToolbox'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator83',
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
																					'command': '.uno:InsertMath'
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
																			'text': 'Text Box',
																			'command': '.uno:Text'
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
																					'command': '.uno:Hyphenation'
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
																			'text': 'Show Comments',
																			'command': '.uno:ShowAnnotations'
																		}
																	]
																},
																{
																	'id': 'GroupB41',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'belowspacing3',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Next Comment',
																					'command': '.uno:NextAnnotation'
																				}
																			]
																		},
																		{
																			'id': 'LeftParaMargin4',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Previous Comment',
																					'command': '.uno:PreviousAnnotation'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'GroupB42',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'belowspacing14',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Delete Comment',
																					'command': '.uno:DeleteAnnotation'
																				}
																			]
																		},
																		{
																			'id': 'LeftParaMargin13',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Delete All Comments',
																					'command': '.uno:DeleteAllAnnotation'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator20',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Review-Section-EditDoc',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom92',
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
																			'text': 'Comment',
																			'command': '.uno:InsertAnnotation'
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
	},

	getTableTab: function() {
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
																	'id': 'SectionBottom44',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Interaction',
																			'command': '.uno:AnimationEffects'
																		}
																	]
																},
																{
																	'id': 'GroupB30',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'SectionBottom55',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Insert Column Before',
																					'command': '.uno:InsertColumnsBefore'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Insert Column After',
																					'command': '.uno:InsertColumnsAfter'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Delete Column',
																					'command': '.uno:DeleteColumns'
																				}
																			]
																		},
																		{
																			'id': 'SectionBottom57',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Insert Row Above',
																					'command': '.uno:InsertRowsBefore'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Insert Row Below',
																					'command': '.uno:InsertRowsAfter'
																				},
																				{
																					'type': 'toolitem',
																					'text': 'Delete Row',
																					'command': '.uno:DeleteRows'
																				}
																			]
																		}
																	],
																	'vertical': 'true'
																},
																{
																	'id': 'separator1',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-FormatLineArea',
															'type': 'container',
															'children': [
																{
																	'id': 'box9',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'third5',
																			'type': 'toolbox',
																			'children': [
																				{
																					'type': 'toolitem',
																					'text': 'Line',
																					'command': '.uno:Line'
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
																	'id': 'box10',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'box11',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'first10',
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
																					'id': 'SectionBottom76',
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
																					'id': 'SectionBottom79',
																					'type': 'toolbox',
																					'children': [
																						{
																							'id': '',
																							'type': 'window',
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
																												'None',
																												'Color',
																												'Gradient',
																												'Hatching',
																												'Bitmap',
																												'Pattern'
																											],
																											'selectedCount': '1',
																											'selectedEntries': [
																												'1'
																											],
																											'command': '.uno:FillStyle'
																										}
																									]
																								},
																								{
																									'id': '',
																									'type': 'toolbox',
																									'children': [
																										{
																											'type': 'toolitem',
																											'text': 'Fill Color',
																											'command': '.uno:FillColor'
																										}
																									]
																								}
																							]
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
																	'id': 'SectionBottom40',
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
																	'id': 'SectionBottom37',
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
																			'text': 'Select Table',
																			'command': '.uno:SelectTable'
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
																	'id': 'SectionBottom35',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Optimize',
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
																	'id': 'separator2',
																	'type': 'fixedline',
																}
															],
														},
														{
															'id': 'Table-Section-Style',
															'type': 'container',
															'children': [
																{
																	'id': 'SectionBottom62',
																	'type': 'toolbox',
																	'children': [
																		{
																			'type': 'toolitem',
																			'text': 'Table Design',
																			'command': '.uno:TableDesign'
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
	}
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
