// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Definitions.Menu - JSON description of menus for JSDialog
 */

declare var L: any;
declare var JSDialog: any;

const menuDefinitions = new Map<string, Array<MenuDefinition>>();

menuDefinitions.set('AutoSumMenu', [
	{ text: _('Sum'), uno: '.uno:AutoSum' },
	{ text: _('Average'), uno: '.uno:AutoSum?Function:string=average' },
	{ text: _('Min'), uno: '.uno:AutoSum?Function:string=min' },
	{ text: _('Max'), uno: '.uno:AutoSum?Function:string=max' },
	{ text: _('Count'), uno: '.uno:AutoSum?Function:string=count' },
] as Array<MenuDefinition>);

menuDefinitions.set('Menu Statistic', [
	{
		text: _UNO('.uno:SamplingDialog', 'spreadsheet'),
		uno: '.uno:SamplingDialog',
	},
	{
		text: _UNO('.uno:DescriptiveStatisticsDialog', 'spreadsheet'),
		uno: '.uno:DescriptiveStatisticsDialog',
	},
	{
		text: _UNO('.uno:AnalysisOfVarianceDialog', 'spreadsheet'),
		uno: '.uno:AnalysisOfVarianceDialog',
	},
	{
		text: _UNO('.uno:CorrelationDialog', 'spreadsheet'),
		uno: '.uno:CorrelationDialog',
	},
	{
		text: _UNO('.uno:CovarianceDialog', 'spreadsheet'),
		uno: '.uno:CovarianceDialog',
	},
	{
		text: _UNO('.uno:ExponentialSmoothingDialog', 'spreadsheet'),
		uno: '.uno:ExponentialSmoothingDialog',
	},
	{
		text: _UNO('.uno:MovingAverageDialog', 'spreadsheet'),
		uno: '.uno:MovingAverageDialog',
	},
	{
		text: _UNO('.uno:RegressionDialog', 'spreadsheet'),
		uno: '.uno:RegressionDialog',
	},
	{ text: _UNO('.uno:TTestDialog', 'spreadsheet'), uno: '.uno:TTestDialog' },
	{ text: _UNO('.uno:FTestDialog', 'spreadsheet'), uno: '.uno:FTestDialog' },
	{ text: _UNO('.uno:ZTestDialog', 'spreadsheet'), uno: '.uno:ZTestDialog' },
	{
		text: _UNO('.uno:ChiSquareTestDialog', 'spreadsheet'),
		uno: '.uno:ChiSquareTestDialog',
	},
	{
		text: _UNO('.uno:FourierAnalysisDialog', 'spreadsheet'),
		uno: '.uno:FourierAnalysisDialog',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('FormatSparklineMenu', [
	{ text: _UNO('.uno:InsertSparkline', 'spreadsheet'), uno: 'InsertSparkline' },
	{ text: _UNO('.uno:DeleteSparkline', 'spreadsheet'), uno: 'DeleteSparkline' },
	{
		text: _UNO('.uno:DeleteSparklineGroup', 'spreadsheet'),
		uno: 'DeleteSparklineGroup',
	},
	{
		text: _UNO('.uno:EditSparklineGroup', 'spreadsheet'),
		uno: 'EditSparklineGroup',
	},
	{ text: _UNO('.uno:EditSparkline', 'spreadsheet'), uno: 'EditSparkline' },
	{ text: _UNO('.uno:GroupSparklines', 'spreadsheet'), uno: 'GroupSparklines' },
	{
		text: _UNO('.uno:UngroupSparklines', 'spreadsheet'),
		uno: 'UngroupSparklines',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('MenuPrintRanges', [
	{
		text: _UNO('.uno:DefinePrintArea', 'spreadsheet'),
		uno: '.uno:DefinePrintArea',
	},
	{ text: _UNO('.uno:AddPrintArea', 'spreadsheet'), uno: '.uno:AddPrintArea' },
	{
		text: _UNO('.uno:EditPrintArea', 'spreadsheet'),
		uno: '.uno:EditPrintArea',
	},
	{
		text: _UNO('.uno:DeletePrintArea', 'spreadsheet'),
		uno: '.uno:DeletePrintArea',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('MenuOrientation', [
	{
		id: 'portrait',
		img: 'portrait',
		text: _('Portrait'),
		uno: '.uno:Orientation?isLandscape:bool=false',
	},
	{
		id: 'landscape',
		img: 'landscape',
		text: _('Landscape'),
		uno: '.uno:Orientation?isLandscape:bool=true',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('MenuPageSizes', [
	{
		id: 'A6',
		text: _('A6'),
		uno: '.uno:CalcPageSize?PaperFormat:string=A6',
	},
	{
		id: 'A5',
		text: _('A5'),
		uno: '.uno:CalcPageSize?PaperFormat:string=A5',
	},
	{
		id: 'A4',
		text: _('A4'),
		uno: '.uno:CalcPageSize?PaperFormat:string=A4',
	},
	{
		id: 'A3',
		text: _('A3'),
		uno: '.uno:CalcPageSize?PaperFormat:string=A3',
	},
	{
		id: 'B6ISO',
		text: _('B6 (ISO)'),
		uno: '.uno:CalcPageSize?PaperFormat:string=B6%20(ISO)',
	},
	{
		id: 'B5ISO',
		text: _('B5 (ISO)'),
		uno: '.uno:CalcPageSize?PaperFormat:string=B5%20(ISO)',
	},
	{
		id: 'B4ISO',
		text: _('B4 (ISO)'),
		uno: '.uno:CalcPageSize?PaperFormat:string=B4%20(ISO)',
	},
	{
		id: 'Letter',
		text: _('Letter'),
		uno: '.uno:CalcPageSize?PaperFormat:string=Letter',
	},
	{
		id: 'Legal',
		text: _('Legal'),
		uno: '.uno:CalcPageSize?PaperFormat:string=Legal',
	},
	{
		id: 'LongBond',
		text: _('Long Bond'),
		uno: '.uno:CalcPageSize?PaperFormat:string=Long%20Bond',
	},
	{
		id: 'Tabloid',
		text: _('Tabloid'),
		uno: '.uno:CalcPageSize?PaperFormat:string=Tabloid',
	},
	{
		id: 'B6JIS',
		text: _('B6 (JIS)'),
		uno: '.uno:CalcPageSize?PaperFormat:string=B6%20(JIS)',
	},
	{
		id: 'B5JIS',
		text: _('B5 (JIS)'),
		uno: '.uno:CalcPageSize?PaperFormat:string=B5%20(JIS)',
	},
	{
		id: 'B4JIS',
		text: _('B4 (JIS)'),
		uno: '.uno:CalcPageSize?PaperFormat:string=B4%20(JIS)',
	},
	{
		id: '16Kai',
		text: _('16 Kai'),
		uno: '.uno:CalcPageSize?PaperFormat:string=16%20Kai',
	},
	{
		id: '32Kai',
		text: _('32 Kai'),
		uno: '.uno:CalcPageSize?PaperFormat:string=32%20Kai',
	},
	{
		id: 'Big32Kai',
		text: _('Big 32 Kai'),
		uno: '.uno:CalcPageSize?PaperFormat:string=Big%2032%20Kai',
	},
	{
		id: 'User',
		text: _('User'),
		uno: '.uno:CalcPageSize?PaperFormat:string=User',
	},
	{
		id: 'DLEnvelope',
		text: _('DL Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=DL%20Envelope',
	},
	{
		id: 'C6Envelope',
		text: _('C6 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=C6%20Envelope',
	},
	{
		id: 'C6_5Envelope',
		text: _('C6/5 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=C6/5%20Envelope',
	},
	{
		id: 'C5Envelope',
		text: _('C5 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=C5%20Envelope',
	},
	{
		id: 'C4Envelope',
		text: _('C4 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=C4%20Envelope',
	},
	{
		id: 'No6_3_4Envelope',
		text: _('#6¾ Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=%236%C2%BE%20Envelope',
	},
	{
		id: 'No7_3_4MonarchEnvelope',
		text: _('#7¾ (Monarch) Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=%237%C2%BE%20(Monarch)%20Envelope',
	},
	{
		id: 'No9Envelope',
		text: _('#9 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=%239%20Envelope',
	},
	{
		id: 'No10Envelope',
		text: _('#10 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=%2310%20Envelope',
	},
	{
		id: 'No11Envelope',
		text: _('#11 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=%2311%20Envelope',
	},
	{
		id: 'No12Envelope',
		text: _('#12 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:string=%2312%20Envelope',
	},
	{
		id: 'JapanesePostcard',
		text: _('Japanese Postcard'),
		uno: '.uno:CalcPageSize?PaperFormat:string=Japanese%20Postcard',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('Print', [
	{ text: _('Active sheet'), action: 'print-active-sheet' },
	{ text: _('All Sheets'), action: 'print-all-sheets' },
] as Array<MenuDefinition>);

menuDefinitions.set('MenuRowHeight', [
	{ text: _UNO('.uno:RowHeight', 'spreadsheet'), uno: '.uno:RowHeight' },
	{
		text: _UNO('.uno:SetOptimalRowHeight', 'spreadsheet'),
		uno: '.uno:SetOptimalRowHeight',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('MenuColumnWidth', [
	{ text: _UNO('.uno:ColumnWidth', 'spreadsheet'), uno: '.uno:ColumnWidth' },
	{
		text: _UNO('.uno:SetOptimalColumnWidth', 'spreadsheet'),
		uno: '.uno:SetOptimalColumnWidth',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('FormattingMarkMenu', [
	{
		text: _UNO('.uno:InsertNonBreakingSpace', 'text'),
		uno: 'InsertNonBreakingSpace',
	},
	{ text: _UNO('.uno:InsertHardHyphen', 'text'), uno: 'InsertHardHyphen' },
	{ text: _UNO('.uno:InsertSoftHyphen', 'text'), uno: 'InsertSoftHyphen' },
	{ text: _UNO('.uno:InsertZWSP', 'text'), uno: 'InsertZWSP' },
	{ text: _UNO('.uno:InsertWJ', 'text'), uno: 'InsertWJ' },
	{ text: _UNO('.uno:InsertLRM', 'text'), uno: 'InsertLRM' },
	{ text: _UNO('.uno:InsertRLM', 'text'), uno: 'InsertRLM' },
] as Array<MenuDefinition>);

menuDefinitions.set('FormatMenu', [
	{ text: _UNO('.uno:Bold', 'text'), uno: 'Bold' },
	{ text: _UNO('.uno:Italic', 'text'), uno: 'Italic' },
	{ text: _UNO('.uno:Underline', 'text'), uno: 'Underline' },
	{ text: _UNO('.uno:UnderlineDouble', 'text'), uno: 'UnderlineDouble' },
	{ text: _UNO('.uno:Strikeout', 'text'), uno: 'Strikeout' },
	{ text: _UNO('.uno:Overline', 'text'), uno: 'Overline' },
	{ type: 'separator' },
	{ text: _UNO('.uno:SuperScript', 'text'), uno: 'SuperScript' },
	{ text: _UNO('.uno:SubScript', 'text'), uno: 'SubScript' },
	{ type: 'separator' },
	{ text: _UNO('.uno:Shadowed', 'text'), uno: 'Shadowed' },
	{ text: _UNO('.uno:OutlineFont', 'text'), uno: 'OutlineFont' },
	{ type: 'separator' },
	{ text: _UNO('.uno:Grow', 'text'), uno: 'Grow' },
	{ text: _UNO('.uno:Shrink', 'text'), uno: 'Shrink' },
	{ type: 'separator' },
	{ text: _UNO('.uno:ChangeCaseToUpper', 'text'), uno: 'ChangeCaseToUpper' },
	{ text: _UNO('.uno:ChangeCaseToLower', 'text'), uno: 'ChangeCaseToLower' },
	{
		text: _UNO('.uno:ChangeCaseRotateCase', 'text'),
		uno: 'ChangeCaseRotateCase',
	},
	{ type: 'separator' },
	{
		text: _UNO('.uno:ChangeCaseToSentenceCase', 'text'),
		uno: 'ChangeCaseToSentenceCase',
	},
	{
		text: _UNO('.uno:ChangeCaseToTitleCase', 'text'),
		uno: 'ChangeCaseToTitleCase',
	},
	{
		text: _UNO('.uno:ChangeCaseToToggleCase', 'text'),
		uno: 'ChangeCaseToToggleCase',
	},
	{ type: 'separator' },
	{ text: _UNO('.uno:SmallCaps', 'text'), uno: 'SmallCaps' },
] as Array<MenuDefinition>);

menuDefinitions.set('FormatBulletsMenu', [
	{ text: _UNO('.uno:DefaultBullet', 'text'), uno: 'DefaultBullet' },
	{ type: 'separator' },
	{ text: _UNO('.uno:DecrementLevel', 'text'), uno: 'DecrementLevel' },
	{ text: _UNO('.uno:IncrementLevel', 'text'), uno: 'IncrementLevel' },
	{ text: _UNO('.uno:DecrementSubLevels', 'text'), uno: 'DecrementSubLevels' },
	{ text: _UNO('.uno:IncrementSubLevels', 'text'), uno: 'IncrementSubLevels' },
	{ type: 'separator' },
	{ text: _UNO('.uno:MoveDown', 'text'), uno: 'MoveDown' },
	{ text: _UNO('.uno:MoveUp', 'text'), uno: 'MoveUp' },
	{ text: _UNO('.uno:MoveDownSubItems', 'text'), uno: 'MoveDownSubItems' },
	{ text: _UNO('.uno:MoveUpSubItems', 'text'), uno: 'MoveUpSubItems' },
	{ type: 'separator' },
	{
		text: _UNO('.uno:InsertNeutralParagraph', 'text'),
		uno: 'InsertNeutralParagraph',
	},
	{ text: _UNO('.uno:NumberingStart', 'text'), uno: 'NumberingStart' },
	{ text: _UNO('.uno:RemoveBullets', 'text'), uno: 'RemoveBullets' },
	{ type: 'separator' },
	{ text: _UNO('.uno:JumpDownThisLevel', 'text'), uno: 'JumpDownThisLevel' },
	{ text: _UNO('.uno:JumpUpThisLevel', 'text'), uno: 'JumpUpThisLevel' },
	{ text: _UNO('.uno:ContinueNumbering', 'text'), uno: 'ContinueNumbering' },
] as Array<MenuDefinition>);

menuDefinitions.set('LineSpacingMenu', [
	{
		id: 'spacepara1',
		img: 'spacepara1',
		text: _UNO('.uno:SpacePara1'),
		uno: 'SpacePara1',
	},
	{
		id: 'spacepara15',
		img: 'spacepara15',
		text: _UNO('.uno:SpacePara15'),
		uno: 'SpacePara15',
	},
	{
		id: 'spacepara2',
		img: 'spacepara2',
		text: _UNO('.uno:SpacePara2'),
		uno: 'SpacePara2',
	},
	{ type: 'separator' },
	{
		id: 'paraspaceincrease',
		img: 'paraspaceincrease',
		text: _UNO('.uno:ParaspaceIncrease'),
		uno: 'ParaspaceIncrease',
	},
	{
		id: 'paraspacedecrease',
		img: 'paraspacedecrease',
		text: _UNO('.uno:ParaspaceDecrease'),
		uno: 'ParaspaceDecrease',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('LanguageMenu', [
	{
		action: 'morelanguages-selection',
		text: _UNO('.uno:SetLanguageSelectionMenu', 'text'),
	},
	{
		action: 'morelanguages-paragraph',
		text: _UNO('.uno:SetLanguageParagraphMenu', 'text'),
	},
	{
		action: 'morelanguages-all',
		text: _UNO('.uno:SetLanguageAllTextMenu', 'text'),
	},
] as Array<MenuDefinition>);

menuDefinitions.set('InsertImageMenu', [
	{ action: 'localgraphic', text: _('Insert Local Image') },
	// remote entry added in Map.WOPI
] as Array<MenuDefinition>);

menuDefinitions.set('InsertMultimediaMenu', [
	{ action: 'insertmultimedia', text: _('Insert Local Multimedia') },
	// remote entry added in Map.WOPI
] as Array<MenuDefinition>);

menuDefinitions.set('CharSpacingMenu', [
	{ id: 'space1', text: _('Very Tight'), uno: 'Spacing?Spacing:short=-60' },
	{ id: 'space1', text: _('Tight'), uno: 'Spacing?Spacing:short=-30' },
	{ id: 'space15', text: _('Normal'), uno: 'Spacing?Spacing:short=0' },
	{ id: 'space2', text: _('Loose'), uno: 'Spacing?Spacing:short=60' },
	{ id: 'space2', text: _('Very Loose'), uno: 'Spacing?Spacing:short=120' },
] as Array<MenuDefinition>);

menuDefinitions.set('PasteMenu', [
	{
		text: _UNO('.uno:Paste', 'text'),
		action: '.uno:Paste',
		hint: JSDialog.ShortcutsUtil.getShortcut(
			_UNO('.uno:Paste', 'text'),
			'.uno:Paste',
		),
	},
	{
		text: _UNO('.uno:PasteSpecial', 'text'),
		action: '.uno:PasteSpecial',
		hint: JSDialog.ShortcutsUtil.getShortcut(
			_UNO('.uno:PasteSpecial', 'text'),
			'.uno:PasteSpecial',
		),
	},
] as Array<MenuDefinition>);

menuDefinitions.set('RecordTrackedChangesMenu', [
	{
		id: 'review-track-changes-off',
		text: _('Off'),
		uno: '.uno:TrackChanges?TrackChanges:bool=false',
	},
	{
		id: 'review-track-changes-all-views',
		text: _('All users'),
		uno: '.uno:TrackChangesInAllViews',
	},
	{
		id: 'review-track-changes-this-view',
		text: _('This user'),
		uno: '.uno:TrackChangesInThisView',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('ConditionalFormatMenu', [
	{
		text: _('Highlight cells with...'),
		items: [
			{
				text: _('Values greater than...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=2',
			},
			{
				text: _('Values less than...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=1',
			},
			{
				text: _('Values equal to...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=0',
			},
			{
				text: _('Values between...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=6',
			},
			{
				text: _('Values duplicate...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=8',
			},
			{
				text: _('Containing text...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=23',
			},
			{ type: 'separator' },
			{ text: _('More highlights...'), uno: '.uno:ConditionalFormatDialog' },
		],
	},
	{
		text: _('Top/Bottom Rules...'),
		items: [
			{
				text: _('Top N elements...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=11',
			},
			{
				text: _('Top N percent...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=13',
			},
			{
				text: _('Bottom N elements...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=12',
			},
			{
				text: _('Bottom N percent...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=14',
			},
			{
				text: _('Above Average...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=15',
			},
			{
				text: _('Below Average...'),
				uno: '.uno:ConditionalFormatEasy?FormatRule:short=16',
			},
			{ type: 'separator' },
			{ text: _('More highlights...'), uno: '.uno:ConditionalFormatDialog' },
		],
	},
	{ type: 'separator' },
	{
		id: 'scaleset',
		text: _UNO('.uno:ColorScaleFormatDialog', 'spreadsheet'),
		items: [{ type: 'html', htmlId: 'scaleset' }],
	},
	{
		id: 'databarset',
		text: _UNO('.uno:DataBarFormatDialog', 'spreadsheet'),
		items: [{ type: 'html', htmlId: 'databarset' }],
	},
	{
		id: 'iconset',
		text: _UNO('.uno:IconSetFormatDialog', 'spreadsheet'),
		items: [{ type: 'html', htmlId: 'iconset' }],
	},
	{
		text: _UNO('.uno:CondDateFormatDialog', 'spreadsheet'),
		uno: '.uno:CondDateFormatDialog',
	},
	{ type: 'separator' },
	{
		text: _UNO('.uno:ConditionalFormatManagerDialog', 'spreadsheet'),
		uno: '.uno:ConditionalFormatManagerDialog',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('BorderStyleMenu', [
	{ type: 'html', htmlId: 'borderstylepopup' },
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('InsertShapesMenu', [
	{ type: 'html', htmlId: 'insertshapespopup' },
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('InsertConnectorsMenu', [
	{ type: 'html', htmlId: 'insertconnectorspopup' },
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('InsertTableMenu', [
	{ type: 'html', htmlId: 'inserttablepopup' },
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('UsersListMenu', [
	{ type: 'html', htmlId: 'userslistpopup' },
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('ColorPickerMenu', [
	{ id: 'colorpickerwidget', type: 'colorpicker' },
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('LanguageStatusMenu', [
	{ type: 'separator' },
	{ type: 'separator' },
	// dynamically updated in Control.StatusBar
] as Array<MenuDefinition>);

menuDefinitions.set('Presentation', [
	{
		text: _('From Beginning'),
		action: 'fullscreen-presentation',
	},
	{
		text: _('From Current Slide'),
		action: 'presentation-currentslide',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('SlideSizeMenu', [
	{
		text: _('Standard (4:3)'),
		img: 'standard-size',
		uno: '.uno:AttributePageSize?AttributePageSize.Width:long=28000&AttributePageSize.Height:long=21000',
	},
	{
		text: _('Widescreen (16:9)'),
		img: 'widescreen-size',
		uno: '.uno:AttributePageSize?AttributePageSize.Width:long=28000&AttributePageSize.Height:long=15750',
	},
] as Array<MenuDefinition>);

function generateLayoutPopupGrid(unoCommand: string): GridWidgetJSON {
	// please see enum AutoLayout in autolayout.hxx. this is the actual WhatLayout sequence
	// based on the visual position of the icons in the popup.
	const layoutMap = [
		{ layout: 20, text: _('Blank Slide') },
		{ layout: 0, text: _('Title Slide') },
		{ layout: 1, text: _('Title, Content') },
		{ layout: 3, text: _('Title and 2 Content') },
		{ layout: 19, text: _('Title Only') },
		{ layout: 32, text: _('Centered Text') },
		{ layout: 15, text: _('Title, 2 Content and Content') },
		{ layout: 12, text: _('Title, Content and 2 Content') },
		{ layout: 16, text: _('Title, 2 Content over Content') },
		{ layout: 14, text: _('Title, Content over Content') },
		{ layout: 18, text: _('Title, 4 Content') },
		{ layout: 34, text: _('Title, 6 Content') },
		{ layout: 27, text: _('Vertical Title, Text, Chart') },
		{ layout: 28, text: _('Vertical Title, Vertical Text') },
		{ layout: 29, text: _('Title, Vertical Text') },
		{ layout: 30, text: _('Title, Vertical Text, Clipart') },
	];

	const grid = {
		id: 'slidelayoutgrid',
		type: 'grid',
		cols: 4,
		rows: 4,
		children: new Array<WidgetJSON>(),
	};

	for (let i = 0; i < 16; i += 4) {
		for (let j = i; j < i + 4; j++) {
			grid.children.push({
				id: 'layout' + j,
				type: 'toolitem',
				command:
					'.uno:' + unoCommand + '?WhatLayout:long=' + layoutMap[j].layout,
				text: layoutMap[j].text,
				noLabel: true,
				left: j % 4,
				top: (i / 4) % 4,
			} as any as WidgetJSON);
		}
	}

	return grid as any as GridWidgetJSON;
}

menuDefinitions.set('NewSlideLayoutMenu', [
	{
		type: 'json',
		content: generateLayoutPopupGrid('InsertPage'),
	},
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set('ChangeSlideLayoutMenu', [
	{
		type: 'json',
		content: generateLayoutPopupGrid('AssignLayout'),
	},
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

JSDialog.MenuDefinitions = menuDefinitions;
