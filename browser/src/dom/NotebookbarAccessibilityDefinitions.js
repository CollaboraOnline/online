/* -*- js-indent-level: 8 -*- */
/*
	This class is used as the notebookbar accessibility configuration provider for the current document type.
*/

/* global app */

/* eslint-disable-next-line */
var NotebookbarAccessibilityDefinitions = function() {

	this.getWriterDefinitions = function() {
		return {
			'File-tab-label': {
				focusBack: true,
				combination: '0',
				contentList: []
			},
			'Home-tab-label': {
				focusBack: true,
				combination: '1',
				contentList: [
					{ id: 'ResetAttributesimg',				focusBack: true, 	combination: 'AA' },
					{ id: 'Boldimg',						focusBack: true, 	combination: 'AB' },
					{ id: 'Italicimg',						focusBack: true, 	combination: 'AC' },
					{ id: 'Underlineimg',					focusBack: true, 	combination: 'AD' },
					{ id: 'Strikeoutimg',					focusBack: true, 	combination: 'AE' },
					{ id: 'SubScriptimg',					focusBack: true, 	combination: 'AF' },
					{ id: 'SuperScriptimg',					focusBack: true, 	combination: 'AG' },
					{ id: 'Growimg',						focusBack: true, 	combination: 'AH' },
					{ id: 'Shrinkimg',						focusBack: true, 	combination: 'AI' },
					{ id: 'DefaultBulletimg',				focusBack: true, 	combination: 'AJ' },
					{ id: 'DefaultNumberingimg',			focusBack: true, 	combination: 'AK' },
					{ id: 'IncrementIndentimg',				focusBack: true, 	combination: 'AL' },
					{ id: 'DecrementIndentimg',				focusBack: true, 	combination: 'AM' },
					{ id: 'LeftParaimg',					focusBack: true, 	combination: 'AN' },
					{ id: 'CenterParaimg',					focusBack: true, 	combination: 'AO' },
					{ id: 'RightParaimg',					focusBack: true, 	combination: 'AP' },
					{ id: 'JustifyParaimg',					focusBack: true, 	combination: 'AQ' },
					{ id: 'ControlCodesimg',				focusBack: true, 	combination: 'AR' },
					{ id: 'ParaLeftToRightimg',				focusBack: true, 	combination: 'AS' },
					{ id: 'ParaRightToLeftimg',				focusBack: true, 	combination: 'AT' },
					{ id: 'InsertGraphicimg',				focusBack: true, 	combination: 'AU' },
					{ id: 'InsertPagebreakimg',				focusBack: true, 	combination: 'AV' },
					{ id: 'InsertAnnotationimg',			focusBack: false, 	combination: 'AW' },
					{ id: 'SearchDialogimg',				focusBack: false, 	combination: 'AX' }
				]
			},
			'Insert-tab-label': {
				focusBack: true,
				combination: '2',
				contentList: [
					{ id: 'InsertPagebreak',				focusBack: true,	combination: 'AB' },
					{ id: 'TitlePageDialogimg',				focusBack: false,	combination: 'AC' },
					{ id: 'InsertSectionimg',				focusBack: false,	combination: 'AD' },
					{ id: 'InsertGraphic',					focusBack: true,	combination: 'AE' },
					{ id: 'InsertObjectChartimg',			focusBack: false,	combination: 'AF' },
					{ id: 'HyperlinkDialogimg',				focusBack: false,	combination: 'AG' },
					{ id: 'InsertBookmarkimg',				focusBack: false,	combination: 'AH' },
					{ id: 'InsertReferenceFieldimg',		focusBack: false,	combination: 'AI' },
					{ id: 'PageNumberWizardimg',			focusBack: false,	combination: 'AJ' },
					{ id: 'InsertFieldCtrlimg',				focusBack: false,	combination: 'AK' },
					{ id: 'InsertPageHeaderimg',			focusBack: true,	combination: 'AL' },
					{ id: 'InsertPageFooterimg',			focusBack: true,	combination: 'AM' },
					{ id: 'DrawTextimg',					focusBack: true,	combination: 'AN' },
					{ id: 'InsertObjectStarMathimg',		focusBack: true,	combination: 'AO' },
					{ id: 'Lineimg',						focusBack: true,	combination: 'AP' },
					{ id: 'FontworkGalleryFloaterimg',		focusBack: false,	combination: 'AQ' },
					{ id: 'VerticalTextimg',				focusBack: false,	combination: 'AR' },
					{ id: 'FontworkGalleryFloaterimg',		focusBack: false,	combination: 'AS' },
					{ id: 'InsertAnnotation',				focusBack: false,	combination: 'AT' }
				]
			},
			'Layout-tab-label': {
				focusBack: true,
				combination: '3',
				contentList: [
					{ id: 'PageDialogimg',					focusBack: false,	combination: 'AA' },
					{ id: 'InsertPagebreak2img',			focusBack: true,	combination: 'AB' },
					{ id: 'InsertBreakimg',					focusBack: false,	combination: 'AC' },
					{ id: 'TitlePageDialog',				focusBack: true,	combination: 'AD' },
					{ id: 'FormatColumnsimg',				focusBack: false,	combination: 'AE' },
					{ id: 'Watermarkimg',					focusBack: false,	combination: 'AF' },
					{ id: 'Hyphenateimg',					focusBack: true,	combination: 'AG' },
					{ id: 'LineNumberingDialogimg',			focusBack: true,	combination: 'AH' },
					{ id: 'SelectAllimg',					focusBack: true,	combination: 'AI' },
					{ id: 'WrapOffimg',						focusBack: true,	combination: 'AJ' },
					{ id: 'WrapLeftimg',					focusBack: true,	combination: 'AK' },
					{ id: 'WrapOnimg',						focusBack: true,	combination: 'AL' },
					{ id: 'WrapThroughimg',					focusBack: true,	combination: 'AM' },
					{ id: 'WrapIdealimg',					focusBack: true,	combination: 'AN' },
					{ id: 'WrapRightimg',					focusBack: true,	combination: 'AO' },
					{ id: 'ObjectAlignLeftimg',				focusBack: true,	combination: 'AP' },
					{ id: 'AlignUpimg',						focusBack: true,	combination: 'AQ' },
					{ id: 'AlignCenterimg',					focusBack: true,	combination: 'AR' },
					{ id: 'AlignMiddleimg',					focusBack: true,	combination: 'AS' },
					{ id: 'ObjectAlignRightimg',			focusBack: true,	combination: 'AT' },
					{ id: 'AlignDownimg',					focusBack: true,	combination: 'AU' },
					{ id: 'ObjectForwardOneimg',			focusBack: true,	combination: 'AV' },
					{ id: 'ObjectBackOneimg',				focusBack: true,	combination: 'AW' },
					{ id: 'BringToFrontimg',				focusBack: true,	combination: 'AX' },
					{ id: 'SendToBackimg',					focusBack: true,	combination: 'AY' }
				]
			},
			'References-tab-label': {
				focusBack: true,
				combination: '4',
				contentList: [
					{ id: 'InsertMultiIndeximg',			focusBack: false,	combination: 'AA' },
					{ id: 'InsertIndexesEntryimg',			focusBack: false,	combination: 'AB' },
					{ id: 'UpdateCurIndeximg',				focusBack: false,	combination: 'AC' },
					{ id: 'InsertFootnoteimg',				focusBack: true,	combination: 'AD' },
					{ id: 'InsertEndnoteimg',				focusBack: true,	combination: 'AE' },
					{ id: 'FootnoteDialogimg',				focusBack: false,	combination: 'AF' },
					{ id: 'InsertBookmark',					focusBack: false,	combination: 'AG' },
					{ id: 'InsertReferenceField',			focusBack: false,	combination: 'AH' },
					{ id: 'InsertFieldCtrl',				focusBack: false,	combination: 'AI' },
					{ id: 'InsertPageNumberFieldimg',		focusBack: true,	combination: 'AJ' },
					{ id: 'InsertDateFieldimg',				focusBack: true,	combination: 'AK' },
					{ id: 'InsertPageCountFieldimg',		focusBack: true,	combination: 'AL' },
					{ id: 'InsertTitleFieldimg',			focusBack: true,	combination: 'AM' },
					{ id: 'UpdateAllimg',					focusBack: true,	combination: 'AN' }
				]
			},
			'Review-tab-label': {
				focusBack: true,
				combination: '5',
				contentList: [
					{ id: 'SpellingAndGrammarDialogimg',	focusBack: false,	combination: 'AA' },
					{ id: 'ThesaurusDialogimg',				focusBack: false,	combination: 'AB' },
					{ id: 'SpellOnlineimg',					focusBack: true,	combination: 'AC' },
					{ id: 'WordCountDialogimg',				focusBack: false,	combination: 'AD' },
					{ id: 'InsertAnnotation2img',			focusBack: false,	combination: 'AE' },
					{ id: 'showresolvedannotationsimg',		focusBack: true,	combination: 'AF' },
					{ id: 'TrackChangesimg',				focusBack: true,	combination: 'AG' },
					{ id: 'ShowTrackedChangesimg',			focusBack: true,	combination: 'AH' },
					{ id: 'NextTrackedChangeimg',			focusBack: true,	combination: 'AI' },
					{ id: 'PreviousTrackedChangeimg',		focusBack: true,	combination: 'AJ' },
					{ id: 'AcceptAllTrackedChangesimg',		focusBack: true,	combination: 'AK' },
					{ id: 'RejectAllTrackedChangesimg',		focusBack: true,	combination: 'AL' },
					{ id: 'AcceptTrackedChangesimg',		focusBack: false,	combination: 'AM' },
					{ id: 'AccessibilityCheckimg',			focusBack: false,	combination: 'AN' }
				]
			},
			'Format-tab-label': {
				focusBack: true,
				combination: '6',
				contentList: [
					{ id: 'FontDialogimg',					focusBack: false,	combination: 'AA' },
					{ id: 'ParagraphDialogimg',				focusBack: false,	combination: 'AB' },
					{ id: 'OutlineBulletimg',				focusBack: false,	combination: 'AC' },
					{ id: 'PageDialog',						focusBack: false,	combination: 'AD' },
					{ id: 'FormatColumns',					focusBack: false,	combination: 'AE' },
					{ id: 'EditRegionimg',					focusBack: false,	combination: 'AF' },
					{ id: 'FormatLineimg',					focusBack: false,	combination: 'AG' },
					{ id: 'TransformDialogimg',				focusBack: false,	combination: 'AH' },
					{ id: 'ChapterNumberingDialogimg',		focusBack: false,	combination: 'AI' },
					{ id: 'ThemeDialogimg',					focusBack: false,	combination: 'AJ' }
				]
			},
			'Form-tab-label': {
				focusBack: true,
				combination: '7',
				contentList: [
					{ id: 'InsertContentControlimg',		focusBack: true,	combination: 'AA' },
					{ id: 'InsertCheckboxContentControlimg',focusBack: true,	combination: 'AB' },
					{ id: 'InsertDropdownContentControlimg',focusBack: true,	combination: 'AC' },
					{ id: 'InsertPictureContentControlimg',	focusBack: true,	combination: 'AD' },
					{ id: 'InsertDateContentControlimg',	focusBack: true,	combination: 'AE' },
					{ id: 'ContentControlPropertiesimg',	focusBack: false,	combination: 'AF' }
				]
			},
			'View-tab-label':{
				focusBack: true,
				combination: '8',
				contentList: [
					{ id: 'ControlCodes',					focusBack: true,	combination: 'AA' },
					{ id: 'FullScreenimg',					focusBack: true,	combination: 'AB' },
					{ id: 'zoomresetimg',					focusBack: true,	combination: 'AC' },
					{ id: 'zoomoutimg',						focusBack: true,	combination: 'AD' },
					{ id: 'zoominimg',						focusBack: true,	combination: 'AE' },
					{ id: 'toggleuimodeimg',				focusBack: false,	combination: 'AF' },
					{ id: 'showrulerimg',					focusBack: true,	combination: 'AG' },
					{ id: 'showstatusbarimg',				focusBack: true,	combination: 'AH' },
					{ id: 'toggledarkthemeimg',				focusBack: true,	combination: 'AI' },
					{ id: 'SidebarDeck.PropertyDeckimg',	focusBack: true,	combination: 'AJ' },
					{ id: 'Navigatorimg',					focusBack: true,	combination: 'AK' }
				]
			},
			'Help-tab-label': {
				focusBack: true,
				combination: '9',
				contentList: [
					{ id: 'ForumHelpimg',					focusBack: true,	combination: 'AA' },
					{ id: 'OnlineHelpimg',					focusBack: false,	combination: 'AB' },
					{ id: 'KeyboardShortcuts',				focusBack: false,	combination: 'AC' },
					{ id: 'AccessibilityCheck',				focusBack: false,	combination: 'AD' },
					{ id: 'ReportIssueimg',					focusBack: true,	combination: 'AE' },
					{ id: 'Aboutimg',						focusBack: false,	combination: 'AF' }
				]
			},
			'Table-tab-label': {
				focusBack: true,
				combination: '',
				contentList: []
			},
			'Draw-tab-label': {
				focusBack: true,
				combination: '',
				contentList: []
			}
		};
	};

	this.getDefinitions = function() {
		if (app.map.getDocType() === 'text')
			return this.getWriterDefinitions();
		else
			return null;
	};
};
