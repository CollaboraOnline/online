/* -*- js-indent-level: 8 -*- */
/*
	This class is used as the notebookbar accessibility configuration provider for the current document type.
*/

/* global app */

/* eslint-disable-next-line */
var NotebookbarAccessibilityDefinitions = function() {

	this.getWriterDefinitions = function() {
		return {
			'Save': {
				focusBack: true,
				combination: 'S1',
				contentList: []
			},
			'File-tab-label': {
				focusBack: true,
				combination: 'F', de: 'D',
				contentList: [
					{ id: 'Save1img',						focusBack: true,	combination: 'S',	de:	null	},
					{ id: 'Printimg',						focusBack: true,	combination: 'P',	de:	'P'		},
					{ id: 'downloadasimg',					focusBack: true,	combination: 'A',	de:	'M'		},
					{ id: 'repairimg',						focusBack: true,	combination: 'RF',	de:	null	},
					{ id: 'SetDocumentPropertiesimg',		focusBack: true,	combination: 'I',	de:	'I'		}
				]
			},
			'Home-tab-label': {
				focusBack: true,
				combination: 'H', de: 'R',
				contentList: [
					{ id: 'Undoimg',						focusBack: true,	combination: 'ZZ',	de: 'ZZ'	},
					{ id: 'Redoimg',						focusBack: true,	combination: 'O',	de: 'W' 	},
					{ id: 'Pasteimg',						focusBack: false,	combination: 'V',	de: null	},
					{ id: 'CharSpacingimg',					focusBack: false,	combination: 'FT',	de: null	},
					{ id: 'BackColor',						focusBack: true,	combination: 'I',	de:	null	},
					{ id: 'FontColor',						focusBack: false,	combination: 'FC',	de: null	},
					{ id: 'LineSpacingimg',					focusBack: false,	combination: 'K',	de: null	},
					{ id: 'BackgroundColor',				focusBack: false,	combination: 'H',	de: null	},
					{ id: 'Cutimg',							focusBack: true, 	combination: 'X',	de: 'X' 	},
					{ id: 'FormatPaintbrushimg',			focusBack: true,	combination: 'FP',	de: null	},
					{ id: 'fontnamecombobox',				focusBack: false,	combination: 'FF',	de: null	},
					{ id: 'fontsize',						focusBack: false,	combination: 'FS',	de: null	},
					{ id: 'Copyimg',						focusBack: true, 	combination: 'C',	de: 'C' 	},
					{ id: 'ResetAttributesimg',				focusBack: true, 	combination: 'E',	de: 'Q' 	},
					{ id: 'Boldimg',						focusBack: true, 	combination: '1',	de: '1' 	},
					{ id: 'Italicimg',						focusBack: true, 	combination: '2',	de: '2' 	},
					{ id: 'Underlineimg',					focusBack: true, 	combination: '3',	de: '3' 	},
					{ id: 'Strikeoutimg',					focusBack: true, 	combination: '4',	de: '4' 	},
					{ id: 'SubScriptimg',					focusBack: true, 	combination: '5',	de: '5' 	},
					{ id: 'SuperScriptimg',					focusBack: true, 	combination: '6',	de: '6' 	},
					{ id: 'Growimg',						focusBack: true, 	combination: 'FG',	de: 'SV'	},
					{ id: 'Shrinkimg',						focusBack: true, 	combination: 'FK',	de: 'J' 	},
					{ id: 'DefaultBulletimg',				focusBack: true, 	combination: 'U',	de: 'AA' 	},
					{ id: 'DefaultNumberingimg',			focusBack: true, 	combination: 'N',	de: 'GN'	},
					{ id: 'IncrementIndentimg',				focusBack: true, 	combination: 'AI',	de: 'ÖI'	},
					{ id: 'DecrementIndentimg',				focusBack: true, 	combination: 'AO',	de: 'PI'	},
					{ id: 'LeftParaimg',					focusBack: true, 	combination: 'AL',	de: 'AL'	},
					{ id: 'CenterParaimg',					focusBack: true, 	combination: 'AC',	de: 'RZ'	},
					{ id: 'RightParaimg',					focusBack: true, 	combination: 'AR',	de: 'RE'	},
					{ id: 'JustifyParaimg',					focusBack: true, 	combination: 'AJ',	de: 'OL'	},
					{ id: 'ControlCodesimg',				focusBack: true, 	combination: 'FM',	de: 'FM'	},
					{ id: 'ParaLeftToRightimg',				focusBack: true, 	combination: 'TL',	de: null	},
					{ id: 'ParaRightToLeftimg',				focusBack: true, 	combination: 'TR',	de: 'EB'	},
					{ id: 'InsertTable',					focusBack: false,	combination: 'IT',	de:	null	},
					{ id: 'CharmapControlimg',				focusBack: false,	combination: 'IS',	de:	null	},
					{ id: 'InsertGraphicimg',				focusBack: true, 	combination: 'IG',	de: null	},
					{ id: 'InsertPagebreakimg',				focusBack: true, 	combination: 'IP',	de: null	},
					{ id: 'InsertAnnotationimg',			focusBack: false, 	combination: 'ZC',	de: 'ZC'	},
					{ id: 'SearchDialogimg',				focusBack: false, 	combination: 'FD',	de: 'US'	}
				]
			},
			'Insert-tab-label': {
				focusBack: true,
				combination: 'N', de: 'I',
				contentList: [
					{ id: 'InsertPagebreak',				focusBack: true,	combination: 'B',	de:	'SU'	},
					{ id: 'InsertTable1img',				focusBack: false,	combination: 'T',	de: null	},
					{ id: 'TitlePageDialogimg',				focusBack: false,	combination: 'TI',	de:	null	},
					{ id: 'InsertSectionimg',				focusBack: false,	combination: 'IS',	de:	null	},
					{ id: 'InsertGraphic',					focusBack: true,	combination: 'P',	de:	'BI'	},
					{ id: 'InsertObjectChartimg',			focusBack: false,	combination: 'C',	de:	null 	},
					{ id: 'HyperlinkDialogimg',				focusBack: false,	combination: 'ZL',	de:	'8' 	},
					{ id: 'InsertBookmarkimg',				focusBack: false,	combination: 'IB',	de:	null	},
					{ id: 'InsertReferenceFieldimg',		focusBack: false,	combination: 'IR',	de:	null	},
					{ id: 'PageNumberWizardimg',			focusBack: false,	combination: 'NU',	de:	null	},
					{ id: 'InsertFieldCtrlimg',				focusBack: false,	combination: 'IE',	de:	null	},
					{ id: 'InsertPageHeaderimg',			focusBack: true,	combination: 'H',	de:	'H' 	},
					{ id: 'InsertPageFooterimg',			focusBack: true,	combination: 'O',	de:	null	},
					{ id: 'DrawTextimg',					focusBack: true,	combination: 'X',	de:	null	},
					{ id: 'InsertObjectStarMathimg',		focusBack: true,	combination: 'ET',	de:	null	},
					{ id: 'Lineimg',						focusBack: true,	combination: 'IL',	de:	null	},
					{ id: 'FontworkGalleryFloaterimg',		focusBack: false,	combination: 'FG',	de:	null	},
					{ id: 'FormattingMarkMenuimg',			focusBack: false,	combination: 'FM',	de: null	},
					{ id: 'CharmapControlimg',				focusBack: false,	combination: 'ZS',	de: null	},
					{ id: 'VerticalTextimg',				focusBack: false,	combination: 'VT',	de:	null	},
					{ id: 'InsertAnnotation',				focusBack: false,	combination: 'L',	de:	'N'		}
				]
			},
			'Layout-tab-label': {
				focusBack: true,
				combination: 'P', de: 'S',
				contentList: [
					{ id: 'PageDialogimg',					focusBack: false,	combination: 'M',	de:	'8'		},
					{ id: 'InsertPagebreak2img',			focusBack: true,	combination: 'IB',	de:	null	},
					{ id: 'InsertBreakimg',					focusBack: false,	combination: 'IK',	de:	null	},
					{ id: 'TitlePageDialog',				focusBack: true,	combination: 'TP',	de:	null	},
					{ id: 'FormatColumnsimg',				focusBack: false,	combination: 'J',	de:	'R'		},
					{ id: 'Watermarkimg',					focusBack: false,	combination: 'WM',	de:	null	},
					{ id: 'Hyphenateimg',					focusBack: true,	combination: 'H',	de:	null	},
					{ id: 'LineNumberingDialogimg',			focusBack: true,	combination: 'LN',	de:	null	},
					{ id: 'SelectAllimg',					focusBack: true,	combination: 'SA',	de:	null	},
					{ id: 'WrapOffimg',						focusBack: true,	combination: 'TW',	de:	null	},
					{ id: 'WrapLeftimg',					focusBack: true,	combination: 'WL',	de:	null	},
					{ id: 'WrapOnimg',						focusBack: true,	combination: 'WO',	de:	null	},
					{ id: 'WrapThroughimg',					focusBack: true,	combination: 'WT',	de:	null	},
					{ id: 'WrapIdealimg',					focusBack: true,	combination: 'WI',	de:	null	},
					{ id: 'WrapRightimg',					focusBack: true,	combination: 'WR',	de:	null	},
					{ id: 'ObjectAlignLeftimg',				focusBack: true,	combination: 'OL',	de:	null	},
					{ id: 'AlignUpimg',						focusBack: true,	combination: 'OU',	de:	null	},
					{ id: 'AlignCenterimg',					focusBack: true,	combination: 'AC',	de:	null	},
					{ id: 'AlignMiddleimg',					focusBack: true,	combination: 'AM',	de:	null	},
					{ id: 'ObjectAlignRightimg',			focusBack: true,	combination: 'OR',	de:	null	},
					{ id: 'AlignDownimg',					focusBack: true,	combination: 'AD',	de:	null	},
					{ id: 'ObjectForwardOneimg',			focusBack: true,	combination: 'OF',	de:	null	},
					{ id: 'ObjectBackOneimg',				focusBack: true,	combination: 'OB',	de:	null	},
					{ id: 'BringToFrontimg',				focusBack: true,	combination: 'BF',	de:	null	},
					{ id: 'SendToBackimg',					focusBack: true,	combination: 'SB',	de:	null	}
				]
			},
			'References-tab-label': {
				focusBack: true,
				combination: 'S', de: 'C',
				contentList: [
					{ id: 'InsertMultiIndeximg',			focusBack: false,	combination: 'T',	de:	'LA'	},
					{ id: 'InsertIndexesEntryimg',			focusBack: false,	combination: 'I',	de:	null	},
					{ id: 'UpdateCurIndeximg',				focusBack: false,	combination: 'U',	de:	'T' 	},
					{ id: 'InsertFootnoteimg',				focusBack: true,	combination: 'F',	de:	'U' 	},
					{ id: 'InsertEndnoteimg',				focusBack: true,	combination: 'E',	de:	'E' 	},
					{ id: 'FootnoteDialogimg',				focusBack: false,	combination: 'H',	de:	'I' 	},
					{ id: 'InsertBookmark',					focusBack: false,	combination: 'IB',	de:	null	},
					{ id: 'InsertReferenceField',			focusBack: false,	combination: 'IR',	de:	null	},
					{ id: 'InsertFieldCtrl',				focusBack: false,	combination: 'IF',	de:	null	},
					{ id: 'InsertPageNumberFieldimg',		focusBack: true,	combination: 'PN',	de:	null	},
					{ id: 'InsertDateFieldimg',				focusBack: true,	combination: 'ID',	de:	null	},
					{ id: 'InsertPageCountFieldimg',		focusBack: true,	combination: 'PC',	de:	null	},
					{ id: 'InsertTitleFieldimg',			focusBack: true,	combination: 'IT',	de:	null	},
					{ id: 'UpdateAllimg',					focusBack: true,	combination: 'UA',	de:	null	}
				]
			},
			'Review-tab-label': {
				focusBack: true,
				combination: 'R', de: 'P',
				contentList: [
					{ id: 'SpellingAndGrammarDialogimg',	focusBack: false,	combination: 'S',	de:	'C'		},
					{ id: 'ThesaurusDialogimg',				focusBack: false,	combination: 'E',	de:	null	},
					{ id: 'LanguageMenuimg',				focusBack: false,	combination: 'ZL',	de: null	},
					{ id: 'SpellOnlineimg',					focusBack: true,	combination: 'SO',	de:	null	},
					{ id: 'WordCountDialogimg',				focusBack: false,	combination: 'W',	de:	'W'		},
					{ id: 'InsertAnnotation2img',			focusBack: false,	combination: 'C',	de:	'N'		},
					{ id: 'showresolvedannotationsimg',		focusBack: true,	combination: 'SR',	de:	null	},
					{ id: 'TrackChangesimg',				focusBack: true,	combination: 'TC',	de:	null	},
					{ id: 'ShowTrackedChangesimg',			focusBack: true,	combination: 'SC',	de:	null	},
					{ id: 'NextTrackedChangeimg',			focusBack: true,	combination: 'H1',	de:	'H'		},
					{ id: 'PreviousTrackedChangeimg',		focusBack: true,	combination: 'F',	de:	'F'		},
					{ id: 'AcceptAllTrackedChangesimg',		focusBack: true,	combination: 'A2',	de:	'A2'	},
					{ id: 'RejectAllTrackedChangesimg',		focusBack: true,	combination: 'J',	de:	'J'		},
					{ id: 'AcceptTrackedChangesimg',		focusBack: false,	combination: 'AA',	de:	null	},
					{ id: 'AccessibilityCheckimg',			focusBack: false,	combination: 'A1',	de:	'B'		}
				]
			},
			'Format-tab-label': {
				focusBack: true,
				combination: 'O',
				contentList: [
					{ id: 'FontDialogimg',					focusBack: false,	combination: 'A',	de:	null	},
					{ id: 'FormatMenuimg',					focusBack: false,	combination: 'FT',	de: null	},
					{ id: 'ParagraphDialogimg',				focusBack: false,	combination: 'B',	de:	null	},
					{ id: 'OutlineBulletimg',				focusBack: false,	combination: 'C',	de:	null	},
					{ id: 'PageDialog',						focusBack: false,	combination: 'D',	de:	null	},
					{ id: 'FormatColumns',					focusBack: false,	combination: 'E',	de:	null	},
					{ id: 'EditRegionimg',					focusBack: false,	combination: 'F',	de:	null	},
					{ id: 'FormatLineimg',					focusBack: false,	combination: 'G',	de:	null	},
					{ id: 'TransformDialogimg',				focusBack: false,	combination: 'H',	de:	null	},
					{ id: 'ChapterNumberingDialogimg',		focusBack: false,	combination: 'I',	de:	null	},
					{ id: 'ThemeDialogimg',					focusBack: false,	combination: 'J',	de:	null	}
				]
			},
			'Form-tab-label': {
				focusBack: true,
				combination: 'M',
				contentList: [
					{ id: 'InsertContentControlimg',		focusBack: true,	combination: 'A',	de:	null	},
					{ id: 'InsertCheckboxContentControlimg',focusBack: true,	combination: 'B',	de:	null	},
					{ id: 'InsertDropdownContentControlimg',focusBack: true,	combination: 'C',	de:	null	},
					{ id: 'InsertPictureContentControlimg',	focusBack: true,	combination: 'D',	de:	null	},
					{ id: 'InsertDateContentControlimg',	focusBack: true,	combination: 'E',	de:	null	},
					{ id: 'ContentControlPropertiesimg',	focusBack: false,	combination: 'F',	de:	null	}
				]
			},
			'View-tab-label':{
				focusBack: true,
				combination: 'W', de: 'F',
				contentList: [
					{ id: 'ControlCodes',					focusBack: true,	combination: 'CC',	de:	null	},
					{ id: 'FullScreenimg',					focusBack: true,	combination: 'F',	de:	'E'		},
					{ id: 'zoomresetimg',					focusBack: true,	combination: 'J',	de:	'O'		},
					{ id: 'zoomoutimg',						focusBack: true,	combination: 'ZO',	de:	null	},
					{ id: 'zoominimg',						focusBack: true,	combination: 'ZI',	de:	null	},
					{ id: 'toggleuimodeimg',				focusBack: false,	combination: 'UI',	de:	null	},
					{ id: 'showrulerimg',					focusBack: true,	combination: 'R',	de:	'L'		},
					{ id: 'showstatusbarimg',				focusBack: true,	combination: 'AH',	de:	null	},
					{ id: 'toggledarkthemeimg',				focusBack: true,	combination: 'D',	de:	null	},
					{ id: 'SidebarDeck.PropertyDeckimg',	focusBack: true,	combination: 'SB',	de:	null	},
					{ id: 'Navigatorimg',					focusBack: true,	combination: 'K',	de:	'V'		}
				]
			},
			'Help-tab-label': {
				focusBack: true,
				combination: 'Y', de: 'E',
				contentList: [
					{ id: 'ForumHelpimg',					focusBack: true,	combination: 'C',	de:	null	},
					{ id: 'OnlineHelpimg',					focusBack: false,	combination: 'H',	de:	null	},
					{ id: 'KeyboardShortcutsimg',			focusBack: false,	combination: 'S',	de:	null	},
					{ id: 'AccessibilityCheck1img',			focusBack: false,	combination: 'A',	de:	null	},
					{ id: 'ReportIssueimg',					focusBack: true,	combination: 'K',	de:	null	},
					{ id: 'Aboutimg',						focusBack: false,	combination: 'W',	de:	null	}
				]
			},
			'Table-tab-label': {
				focusBack: true,
				combination: '',
				contentList: []
			},
			'Draw-tab-label': {
				focusBack: true,
				combination: 'JI', de: 'JI',
				contentList: []
			}
		};
	};

	this.applyLanguageSpecificCombinations = function(selectedDefinitions) {
		if (!selectedDefinitions)
			return;

		// Browser language is not reflected to UI so we only check URL's language parameter.
		if (app.UI.language.fromURL && app.UI.language.fromURL !== '') {
			var lang = app.UI.language.fromURL;

			Object.keys(selectedDefinitions).forEach(function(ID) {
				if (selectedDefinitions[ID][lang])
					selectedDefinitions[ID].combination = selectedDefinitions[ID][lang];

				for (var i = 0; i < selectedDefinitions[ID].contentList.length; i++) {
					if (selectedDefinitions[ID].contentList[i][lang])
						selectedDefinitions[ID].contentList[i].combination = selectedDefinitions[ID].contentList[i][lang];
				}
			});
		}
	};

	this.getDefinitions = function() {
		var selectedDefinitions = null;
		if (app.map.getDocType() === 'text')
			selectedDefinitions = this.getWriterDefinitions();

		this.applyLanguageSpecificCombinations(selectedDefinitions);

		return selectedDefinitions;
	};
};
