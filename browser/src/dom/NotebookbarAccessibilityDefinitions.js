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
					{ id: 'home-resetattributes-button',			focusBack: true, 	combination: 'AA' },
					{ id: 'home-bold-button',						focusBack: true, 	combination: 'AB' },
					{ id: 'home-italic-button',						focusBack: true, 	combination: 'AC' },
					{ id: 'home-underline-button',					focusBack: true, 	combination: 'AD' },
					{ id: 'home-strikeout-button',					focusBack: true, 	combination: 'AE' },
					{ id: 'home-subscript-button',					focusBack: true, 	combination: 'AF' },
					{ id: 'home-superscript-button',				focusBack: true, 	combination: 'AG' },
					{ id: 'home-grow-button',						focusBack: true, 	combination: 'AH' },
					{ id: 'home-shrink-button',						focusBack: true, 	combination: 'AI' },
					{ id: 'home-defaultbullet-button',				focusBack: true, 	combination: 'AJ' },
					{ id: 'home-defaultnumbering-button',			focusBack: true, 	combination: 'AK' },
					{ id: 'home-incrementindent-button',			focusBack: true, 	combination: 'AL' },
					{ id: 'home-decrementindent-button',			focusBack: true, 	combination: 'AM' },
					{ id: 'home-leftpara-button',					focusBack: true, 	combination: 'AN' },
					{ id: 'home-centerpara-button',					focusBack: true, 	combination: 'AO' },
					{ id: 'home-rightpara-button',					focusBack: true, 	combination: 'AP' },
					{ id: 'home-justifypara-button',				focusBack: true, 	combination: 'AQ' },
					{ id: 'home-controlcodes-button',				focusBack: true, 	combination: 'AR' },
					{ id: 'home-paralefttoright-button',			focusBack: true, 	combination: 'AS' },
					{ id: 'home-pararighttoleft-button',			focusBack: true, 	combination: 'AT' },
					{ id: 'home-insertgraphic-button',				focusBack: true, 	combination: 'AU' },
					{ id: 'home-insertpagebreak-button',			focusBack: true, 	combination: 'AV' },
					{ id: 'home-insertannotation-button',			focusBack: false, 	combination: 'AW' },
					{ id: 'home-searchdialog-button',				focusBack: false, 	combination: 'AX' }
				]
			},
			'Insert-tab-label': {
				focusBack: true,
				combination: '2',
				contentList: [
					{ id: 'insert-insertpagebreak',						focusBack: true,	combination: 'AB' },
					{ id: 'insert-titlepagedialog-button',				focusBack: false,	combination: 'AC' },
					{ id: 'insert-insertsection-button',				focusBack: false,	combination: 'AD' },
					{ id: 'insert-insertgraphic-button',				focusBack: true,	combination: 'AE' },
					{ id: 'insert-insertobjectchart-button',			focusBack: false,	combination: 'AF' },
					{ id: 'insert-hyperlinkdialog',						focusBack: false,	combination: 'AG' },
					{ id: 'insert-insertbookmark-button',				focusBack: false,	combination: 'AH' },
					{ id: 'insert-insertreferencefield-button',			focusBack: false,	combination: 'AI' },
					{ id: 'insert-pagenumberwizard-button',				focusBack: false,	combination: 'AJ' },
					{ id: 'insert-insertfieldctrl-button',						focusBack: false,	combination: 'AK' },
					{ id: 'insert-insertpageheader-button',				focusBack: true,	combination: 'AL' },
					{ id: 'insert-insertpagefooter-button',				focusBack: true,	combination: 'AM' },
					{ id: 'insert-drawtext-button',						focusBack: true,	combination: 'AN' },
					{ id: 'insert-insertobjectstarmath-button',			focusBack: true,	combination: 'AO' },
					{ id: 'insert-line-button',							focusBack: true,	combination: 'AP' },
					{ id: 'insert-fontworkgalleryfloater-button',		focusBack: false,	combination: 'AQ' },
					{ id: 'insert-verticaltext-button',					focusBack: false,	combination: 'AR' },
					{ id: 'insert-fontworkgalleryfloater-button',		focusBack: false,	combination: 'AS' },
					{ id: 'insert-insertannotation',					focusBack: false,	combination: 'AT' }
				]
			},
			'Layout-tab-label': {
				focusBack: true,
				combination: '3',
				contentList: [
					{ id: 'layout-pagedialog-button',					focusBack: false,	combination: 'AA' },
					{ id: 'layout-insertpagebreak-button',				focusBack: true,	combination: 'AB' },
					{ id: 'layout-insertbreak-button',					focusBack: false,	combination: 'AC' },
					{ id: 'layout-titlepagedialog',						focusBack: true,	combination: 'AD' },
					{ id: 'layout-formatcolumns-button',				focusBack: false,	combination: 'AE' },
					{ id: 'layout-watermark-button',					focusBack: false,	combination: 'AF' },
					{ id: 'layout-hyphenate-button',					focusBack: true,	combination: 'AG' },
					{ id: 'layout-linenumberingdialog-button',			focusBack: true,	combination: 'AH' },
					{ id: 'layout-selectall-button',					focusBack: true,	combination: 'AI' },
					{ id: 'layout-wrapoff',								focusBack: true,	combination: 'AJ' },
					{ id: 'layout-wrapleft-button',						focusBack: true,	combination: 'AK' },
					{ id: 'layout-wrapon-button',						focusBack: true,	combination: 'AL' },
					{ id: 'layout-wrapthrough-button',					focusBack: true,	combination: 'AM' },
					{ id: 'layout-wrapideal-button',					focusBack: true,	combination: 'AN' },
					{ id: 'layout-wrapright-button',					focusBack: true,	combination: 'AO' },
					{ id: 'layout-objectalignleft',						focusBack: true,	combination: 'AP' },
					{ id: 'layout-alignup-button',						focusBack: true,	combination: 'AQ' },
					{ id: 'layout-aligncenter-button',					focusBack: true,	combination: 'AR' },
					{ id: 'layout-alignmiddle-button',					focusBack: true,	combination: 'AS' },
					{ id: 'layout-objectalignright-button',				focusBack: true,	combination: 'AT' },
					{ id: 'layout-aligndown-button',					focusBack: true,	combination: 'AU' },
					{ id: 'layout-objectforwardone-button',				focusBack: true,	combination: 'AV' },
					{ id: 'layout-objectbackone-button',				focusBack: true,	combination: 'AW' },
					{ id: 'layout-bringtofront-button',					focusBack: true,	combination: 'AX' },
					{ id: 'layout-sendtoback-button',					focusBack: true,	combination: 'AY' }
				]
			},
			'References-tab-label': {
				focusBack: true,
				combination: '4',
				contentList: [
					{ id: 'references-indexesmenu-button',				focusBack: false,	combination: 'AA' },
					{ id: 'references-insertindexesentry-button',		focusBack: false,	combination: 'AB' },
					{ id: 'references-updatecurrentindex-button',		focusBack: false,	combination: 'AC' },
					{ id: 'references-insertfootnote-button',			focusBack: true,	combination: 'AD' },
					{ id: 'references-insertendnote-button',			focusBack: true,	combination: 'AE' },
					{ id: 'references-footnotedialog-button',			focusBack: false,	combination: 'AF' },
					{ id: 'references-insertbookmark',					focusBack: false,	combination: 'AG' },
					{ id: 'references-insertreferencefield-button',		focusBack: false,	combination: 'AH' },
					{ id: 'references-insertfieldctrl-button',			focusBack: false,	combination: 'AI' },
					{ id: 'references-insertpagenumberfield-button',	focusBack: true,	combination: 'AJ' },
					{ id: 'references-insertdatefield-button',			focusBack: true,	combination: 'AK' },
					{ id: 'references-insertpagecountfield',			focusBack: true,	combination: 'AL' },
					{ id: 'references-inserttitlefield-button',			focusBack: true,	combination: 'AM' },
					{ id: 'references-updateall-button',				focusBack: true,	combination: 'AN' }
				]
			},
			'Review-tab-label': {
				focusBack: true,
				combination: '5',
				contentList: [
					{ id: 'review-spellingandgrammardialog-button',		focusBack: false,	combination: 'AA' },
					{ id: 'review-thesaurusdialog-button',				focusBack: false,	combination: 'AB' },
					{ id: 'review-spellonline-button',					focusBack: true,	combination: 'AC' },
					{ id: 'review-wordcountdialog-button',				focusBack: false,	combination: 'AD' },
					{ id: 'review-insertannotation-button',				focusBack: false,	combination: 'AE' },
					{ id: 'review-showresolvedannotations-button',		focusBack: true,	combination: 'AF' },
					{ id: 'review-trackchanges-button',					focusBack: true,	combination: 'AG' },
					{ id: 'review-showtrackedchanges-button',			focusBack: true,	combination: 'AH' },
					{ id: 'review-nexttrackedchange-button',			focusBack: true,	combination: 'AI' },
					{ id: 'review-previoustrackedchange-button',		focusBack: true,	combination: 'AJ' },
					{ id: 'review-acceptalltrackedchanges-button',		focusBack: true,	combination: 'AK' },
					{ id: 'review-rejectalltrackedchanges-button',		focusBack: true,	combination: 'AL' },
					{ id: 'review-accepttrackedchanges-button',			focusBack: false,	combination: 'AM' },
					{ id: 'review-accessibilitycheck-button',			focusBack: false,	combination: 'AN' }
				]
			},
			'Format-tab-label': {
				focusBack: true,
				combination: '6',
				contentList: [
					{ id: 'format-fontdialog-button',					focusBack: false,	combination: 'AA' },
					{ id: 'format-paragraphdialog-button',				focusBack: false,	combination: 'AB' },
					{ id: 'format-outlinebullet-button',				focusBack: false,	combination: 'AC' },
					{ id: 'format-pagedialog-button',					focusBack: false,	combination: 'AD' },
					{ id: 'format-formatcolumns-button',				focusBack: false,	combination: 'AE' },
					{ id: 'format-editregion-button',					focusBack: false,	combination: 'AF' },
					{ id: 'format-formatline-button',					focusBack: false,	combination: 'AG' },
					{ id: 'format-transformdialog-button',				focusBack: false,	combination: 'AH' },
					{ id: 'format-chapternumberingdialog-button',		focusBack: false,	combination: 'AI' },
					{ id: 'format-themedialog-button',					focusBack: false,	combination: 'AJ' }
				]
			},
			'Form-tab-label': {
				focusBack: true,
				combination: '7',
				contentList: [
					{ id: 'form-insertcontentcontrol-button',			focusBack: true,	combination: 'AA' },
					{ id: 'form-insertcheckboxcontentcontrol-button',	focusBack: true,	combination: 'AB' },
					{ id: 'form-insertdropdowncontentcontrol-button',	focusBack: true,	combination: 'AC' },
					{ id: 'form-insertpicturecontentcontrol-button',	focusBack: true,	combination: 'AD' },
					{ id: 'form-insertdatecontentcontrol-button',		focusBack: true,	combination: 'AE' },
					{ id: 'form-contentcontrolproperties-button',		focusBack: false,	combination: 'AF' }
				]
			},
			'View-tab-label':{
				focusBack: true,
				combination: '8',
				contentList: [
					{ id: 'view-controlcodes-button',				focusBack: true,	combination: 'AA' },
					{ id: 'view-fullscreen-button',					focusBack: true,	combination: 'AB' },
					{ id: 'view-zoomreset-button',					focusBack: true,	combination: 'AC' },
					{ id: 'view-zoomout-button',					focusBack: true,	combination: 'AD' },
					{ id: 'view-zoomin-button',						focusBack: true,	combination: 'AE' },
					{ id: 'view-toggleuimode-button',				focusBack: false,	combination: 'AF' },
					{ id: 'view-showruler-button',					focusBack: true,	combination: 'AG' },
					{ id: 'view-showstatusbar-button',				focusBack: true,	combination: 'AH' },
					{ id: 'view-toggledarktheme-button',			focusBack: true,	combination: 'AI' },
					{ id: 'view-sidebar-button',					focusBack: true,	combination: 'AJ' },
					{ id: 'view-navigator-button',					focusBack: true,	combination: 'AK' }
				]
			},
			'Help-tab-label': {
				focusBack: true,
				combination: '9',
				contentList: [
					{ id: 'help-forum-button',						focusBack: true,	combination: 'AA' },
					{ id: 'help-online-help-button',				focusBack: false,	combination: 'AB' },
					{ id: 'help-keyboard-shortcuts-button',			focusBack: false,	combination: 'AC' },
					{ id: 'help-accessibility-check-button',		focusBack: false,	combination: 'AD' },
					{ id: 'help-report-an-issue-button',			focusBack: true,	combination: 'AE' },
					{ id: 'help-about-button',						focusBack: false,	combination: 'AF' }
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
