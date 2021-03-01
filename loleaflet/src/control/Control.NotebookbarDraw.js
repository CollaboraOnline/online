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
				'text': _('Format'),
				'id': '-3',
				'name': 'Format',
			},
			{
				'text': '~Draw',
				'id': '-10',
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

		case 'Draw':
			this.loadTab(this.getDrawTab());
			break;
		}
	},

	getHomeTab: function() {
		return {
			'type': 'control',
			'children': [
				{
					'type': 'container',
					'children': [
						{
							'id': 'NotebookBar',
							'type': 'grid',
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
													'type': 'pushbutton',
												},
												{
													'type': 'toolbox',
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
														}
													]
												},
												{
													'type': 'tabpage',
													'children': [
														{
															'id': 'Home Tab',
															'type': 'container',
															'children': [
																{
																	'id': 'Home',
																	'type': 'container',
																	'children': [
																		{
																			'id': 'Home-Section-Clipboard',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'SectionBottom87',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': _UNO('.uno:Paste'),
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
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-DrawColor',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'separator47',
																					'type': 'separator',
																					'orientation': 'vertical'
																				},
																				{
																					'id': 'SectionBottom11',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': _UNO('.uno:DesignerDialog'),
																							'command': '.uno:DesignerDialog'
																						}
																					]
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-DrawColor1',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'box23',
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
																								}
																							]
																						},
																						{
																							'id': 'third8',
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
																		},
																		{
																			'id': 'Home-Section-DrawColor2',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'box10',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'box11',
																							'type': 'container',
																							'children': [
																								{
																									'id': 'first6',
																									'type': 'toolbox',
																									'children': [
																										{
																											'type': 'borderwindow',
																											'children': [
																												{
																													'type': 'listbox',
																													'children': [
																														{
																															'type': 'control',
																														},
																														{
																															'type': 'pushbutton',
																														}
																													],
																													'entries': [
																														'None',
																														'Continuous',
																														'Dot',
																														'Long Dot',
																														'Double Dot',
																														'Dashed',
																														'Long Dash',
																														'Double Dash',
																														'Long Dash Dot',
																														'Double Dash Dot',
																														'Double Dash Dot Dot',
																														'Ultrafine Dotted',
																														'Fine Dotted',
																														'Ultrafine Dashed',
																														'Fine Dashed',
																														'Line Style 9',
																														'3 Dashes 3 Dots',
																														'2 Dots 3 Dashes',
																														'2 Dots 1 Dash',
																														'Line with Fine Dots'
																													],
																													'selectedCount': '1',
																													'selectedEntries': [
																														'1'
																													]
																												}
																											]
																										},
																										{
																											'type': 'borderwindow',
																											'children': [
																												{
																													'type': 'metricfield',
																													'text': '0.00″',
																													'children': [
																														{
																															'type': 'edit',
																															'text': '0.00″',
																														}
																													],
																													'min': '0',
																													'max': '197',
																													'unit': 'inch',
																													'value': '0'
																												}
																											]
																										}
																									]
																								},
																								{
																									'id': 'SectionBottom136',
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
																						},
																						{
																							'id': 'SectionBottom140',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'window',
																									'children': [
																										{
																											'type': 'borderwindow',
																											'children': [
																												{
																													'type': 'listbox',
																													'children': [
																														{
																															'type': 'control',
																														},
																														{
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
																											'id': 'colortoolbox',
																											'type': 'toolbox',
																											'children': [
																												{
																													'type': 'toolitem',
																													'text': _UNO('.uno:FillColor'),
																													'command': '.uno:FillColor'
																												}
																											]
																										}
																									]
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-DrawText',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'separator28',
																					'type': 'separator',
																					'orientation': 'vertical'
																				},
																				{
																					'id': 'SectionBottom97',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': _UNO('.uno:Text'),
																							'command': '.uno:Text'
																						},
																						{
																							'type': 'toolitem',
																							'text': _UNO('.uno:VerticalText'),
																							'command': '.uno:VerticalText'
																						}
																					]
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Draw',
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
																									'text': _UNO('.uno:Line'),
																									'command': '.uno:Line'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:Polygon_Unfilled'),
																									'command': '.uno:Polygon_Unfilled'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:Bezier_Unfilled'),
																									'command': '.uno:Bezier_Unfilled'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:ArrowsToolbox'),
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
																									'text': _UNO('.uno:DrawCaption'),
																									'command': '.uno:DrawCaption'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:LineToolbox'),
																									'command': '.uno:LineToolbox'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Draw2',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'GroupB72',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'shapes2',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:ArrowShapes'),
																									'command': '.uno:ArrowShapes'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:ConnectorToolbox'),
																									'command': '.uno:ConnectorToolbox'
																								}
																							]
																						},
																						{
																							'id': 'shapes4',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:FlowChartShapes'),
																									'command': '.uno:FlowChartShapes'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:Objects3DToolbox'),
																									'command': '.uno:Objects3DToolbox'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Draw1',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'separator95',
																					'type': 'separator',
																					'orientation': 'vertical'
																				},
																				{
																					'id': 'GroupB82',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'shapes13',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:BasicShapes'),
																									'command': '.uno:BasicShapes'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:SymbolShapes'),
																									'command': '.uno:SymbolShapes'
																								}
																							]
																						},
																						{
																							'id': 'shapes14',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:StarShapes'),
																									'command': '.uno:StarShapes'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:CalloutShapes'),
																									'command': '.uno:CalloutShapes'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Arrange',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'separator20',
																					'type': 'separator',
																					'orientation': 'vertical'
																				},
																				{
																					'id': 'SectionBottom7',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': _UNO('.uno:SelectObject'),
																							'command': '.uno:SelectObject'
																						}
																					]
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Arrange1',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'GroupB21',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'LineA15',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:GridVisible'),
																									'command': '.uno:GridVisible'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:HelplinesVisible'),
																									'command': '.uno:HelplinesVisible'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:HelplinesMove'),
																									'command': '.uno:HelplinesMove'
																								}
																							]
																						},
																						{
																							'id': 'LineB18',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:GridUse'),
																									'command': '.uno:GridUse'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:HelplinesUse'),
																									'command': '.uno:HelplinesUse'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:SnapFrame'),
																									'command': '.uno:SnapFrame'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Arrange2',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'GroupB68',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'LineA27',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:CapturePoint'),
																									'command': '.uno:CapturePoint'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:GlueInsertPoint'),
																									'command': '.uno:GlueInsertPoint'
																								}
																							]
																						},
																						{
																							'id': 'LineB24',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:SnapPoints'),
																									'command': '.uno:SnapPoints'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:SnapBorder'),
																									'command': '.uno:SnapBorder'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		},
																		{
																			'id': 'Home-Section-Insert',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'separator53',
																					'type': 'separator',
																					'orientation': 'vertical'
																				},
																				{
																					'id': 'GroupB46',
																					'type': 'container',
																					'children': [
																						{
																							'id': 'LineA24',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:SnapPoints'),
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
																			],
																		},
																		{
																			'id': 'Home-Section-Transform',
																			'type': 'container',
																			'children': [
																				{
																					'id': 'separator69',
																					'type': 'separator',
																					'orientation': 'vertical'
																				},
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
																									'text': _UNO('.uno:ObjectAlign'),
																									'command': '.uno:ObjectAlign'
																								}
																							]
																						},
																						{
																							'id': 'LineB35',
																							'type': 'toolbox',
																							'children': [
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:ObjectPosition'),
																									'command': '.uno:ObjectPosition'
																								},
																								{
																									'type': 'toolitem',
																									'text': _UNO('.uno:DistributeSelection'),
																									'command': '.uno:DistributeSelection'
																								}
																							]
																						}
																					],
																					'vertical': 'true'
																				}
																			],
																		}
																	],
																},
																{
																	'id': 'separator9',
																	'type': 'separator',
																	'orientation': 'vertical'
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
																					'id': 'Home-HomeButton:Menu Home',
																					'type': 'menubutton',
																					'text': '~Home',
																				},
																				{
																					'id': 'SectionBottom10',
																					'type': 'toolbox',
																					'children': [
																						{
																							'type': 'toolitem',
																							'text': _UNO('.uno:ZoomMode'),
																							'command': '.uno:ZoomMode'
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
													'name': 'PageLabel'
												},
												{
													'text': '~Review',
													'id': '5',
													'name': 'ReviewLabel'
												},
												{
													'text': '~View',
													'id': '6',
													'name': 'ViewLabel'
												},
												{
													'text': 'T~ext',
													'id': '7',
													'name': 'TextLabel'
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
													'text': '3~d',
													'id': '14',
													'name': '3DObjectLabel'
												},
												{
													'text': '~Master',
													'id': '15',
													'name': 'MasterLabel'
												},
												{
													'text': 'E~xtension',
													'id': '16',
													'name': 'ExtensionLabel'
												},
												{
													'text': '~Tools',
													'id': '17',
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
	}
});

L.control.notebookbarDraw = function (options) {
	return new L.Control.NotebookbarDraw(options);
};
