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

declare var JSDialog: any;

type MenuDefinition = {
	id: string,			// unique identifier
	type: (undefined | 'action' | 'menu'| 'separator'),		// type of entry
	text: string,		// displayed text
	uno: string,		// uno command
	action: string,		// dispatch command
	img: string,		// icon name
	checked: boolean	// state of check mark
};

const menuDefinitions = new Map<string, Array<MenuDefinition>>();

menuDefinitions.set('AutoSumMenu', [
	{text: _('Sum'), uno: '.uno:AutoSum'},
	{text: _('Average'), uno: '.uno:AutoSum?Function:string=average'},
	{text: _('Min'), uno: '.uno:AutoSum?Function:string=min'},
	{text: _('Max'), uno: '.uno:AutoSum?Function:string=max'},
	{text: _('Count'), uno: '.uno:AutoSum?Function:string=count'}
] as Array<MenuDefinition>);

menuDefinitions.set('Menu Statistic', [
	{text: _UNO('.uno:SamplingDialog', 'spreadsheet'), uno: '.uno:SamplingDialog'},
	{text: _UNO('.uno:DescriptiveStatisticsDialog', 'spreadsheet'), uno: '.uno:DescriptiveStatisticsDialog'},
	{text: _UNO('.uno:AnalysisOfVarianceDialog', 'spreadsheet'), uno: '.uno:AnalysisOfVarianceDialog'},
	{text: _UNO('.uno:CorrelationDialog', 'spreadsheet'), uno: '.uno:CorrelationDialog'},
	{text: _UNO('.uno:CovarianceDialog', 'spreadsheet'), uno: '.uno:CovarianceDialog'},
	{text: _UNO('.uno:ExponentialSmoothingDialog', 'spreadsheet'), uno: '.uno:ExponentialSmoothingDialog'},
	{text: _UNO('.uno:MovingAverageDialog', 'spreadsheet'), uno: '.uno:MovingAverageDialog'},
	{text: _UNO('.uno:RegressionDialog', 'spreadsheet'), uno: '.uno:RegressionDialog'},
	{text: _UNO('.uno:TTestDialog', 'spreadsheet'), uno: '.uno:TTestDialog'},
	{text: _UNO('.uno:FTestDialog', 'spreadsheet'), uno: '.uno:FTestDialog'},
	{text: _UNO('.uno:ZTestDialog', 'spreadsheet'), uno: '.uno:ZTestDialog'},
	{text: _UNO('.uno:ChiSquareTestDialog', 'spreadsheet'), uno: '.uno:ChiSquareTestDialog'},
	{text: _UNO('.uno:FourierAnalysisDialog', 'spreadsheet'), uno: '.uno:FourierAnalysisDialog'}
] as Array<MenuDefinition>);

menuDefinitions.set('FormatSparklineMenu', [
	{text: _UNO('.uno:InsertSparkline', 'spreadsheet'), uno: 'InsertSparkline'},
	{text: _UNO('.uno:DeleteSparkline', 'spreadsheet'), uno: 'DeleteSparkline'},
	{text: _UNO('.uno:DeleteSparklineGroup', 'spreadsheet'), uno: 'DeleteSparklineGroup'},
	{text: _UNO('.uno:EditSparklineGroup', 'spreadsheet'), uno: 'EditSparklineGroup'},
	{text: _UNO('.uno:EditSparkline', 'spreadsheet'), uno: 'EditSparkline'},
	{text: _UNO('.uno:GroupSparklines', 'spreadsheet'), uno: 'GroupSparklines'},
	{text: _UNO('.uno:UngroupSparklines', 'spreadsheet'), uno: 'UngroupSparklines'}
] as Array<MenuDefinition>);

menuDefinitions.set('MenuPrintRanges', [
	{text: _UNO('.uno:DefinePrintArea', 'spreadsheet'), uno: '.uno:DefinePrintArea'},
	{text: _UNO('.uno:AddPrintArea', 'spreadsheet'), uno: '.uno:AddPrintArea'},
	{text: _UNO('.uno:EditPrintArea', 'spreadsheet'), uno: '.uno:EditPrintArea'},
	{text: _UNO('.uno:DeletePrintArea', 'spreadsheet'), uno: '.uno:DeletePrintArea'}
] as Array<MenuDefinition>);

menuDefinitions.set('Print', [
	{text: _('Active sheet'), id: 'print-active-sheet', type: 'action'},
	{text: _('All Sheets'), id: 'print-all-sheets', type: 'action'},
] as Array<MenuDefinition>);

menuDefinitions.set('MenuRowHeight', [
	{text: _UNO('.uno:RowHeight', 'spreadsheet'), uno: '.uno:RowHeight'},
	{text: _UNO('.uno:SetOptimalRowHeight', 'spreadsheet'), uno: '.uno:SetOptimalRowHeight'},
] as Array<MenuDefinition>);

menuDefinitions.set('MenuColumnWidth', [
	{text: _UNO('.uno:ColumnWidth', 'spreadsheet'), uno: '.uno:ColumnWidth'},
	{text: _UNO('.uno:SetOptimalColumnWidth', 'spreadsheet'), uno: '.uno:SetOptimalColumnWidth'},
] as Array<MenuDefinition>);

menuDefinitions.set('FormattingMarkMenu', [
	{text: _UNO('.uno:InsertNonBreakingSpace', 'text'), uno: 'InsertNonBreakingSpace'},
	{text: _UNO('.uno:InsertHardHyphen', 'text'), uno: 'InsertHardHyphen'},
	{text: _UNO('.uno:InsertSoftHyphen', 'text'), uno: 'InsertSoftHyphen'},
	{text: _UNO('.uno:InsertZWSP', 'text'), uno: 'InsertZWSP'},
	{text: _UNO('.uno:InsertWJ', 'text'), uno: 'InsertWJ'},
	{text: _UNO('.uno:InsertLRM', 'text'), uno: 'InsertLRM'},
	{text: _UNO('.uno:InsertRLM', 'text'), uno: 'InsertRLM'}
] as Array<MenuDefinition>);

menuDefinitions.set('FormatMenu', [
	{text: _UNO('.uno:Bold', 'text'), uno: 'Bold'},
	{text: _UNO('.uno:Italic', 'text'), uno: 'Italic'},
	{text: _UNO('.uno:Underline', 'text'), uno: 'Underline'},
	{text: _UNO('.uno:UnderlineDouble', 'text'), uno: 'UnderlineDouble'},
	{text: _UNO('.uno:Strikeout', 'text'), uno: 'Strikeout'},
	{text: _UNO('.uno:Overline', 'text'), uno: 'Overline'},
	{type: 'separator'},
	{text: _UNO('.uno:SuperScript', 'text'), uno: 'SuperScript'},
	{text: _UNO('.uno:SubScript', 'text'), uno: 'SubScript'},
	{type: 'separator'},
	{text: _UNO('.uno:Shadowed', 'text'), uno: 'Shadowed'},
	{text: _UNO('.uno:OutlineFont', 'text'), uno: 'OutlineFont'},
	{type: 'separator'},
	{text: _UNO('.uno:Grow', 'text'), uno: 'Grow'},
	{text: _UNO('.uno:Shrink', 'text'), uno: 'Shrink'},
	{type: 'separator'},
	{text: _UNO('.uno:ChangeCaseToUpper', 'text'), uno: 'ChangeCaseToUpper'},
	{text: _UNO('.uno:ChangeCaseToLower', 'text'), uno: 'ChangeCaseToLower'},
	{text: _UNO('.uno:ChangeCaseRotateCase', 'text'), uno: 'ChangeCaseRotateCase'},
	{type: 'separator'},
	{text: _UNO('.uno:ChangeCaseToSentenceCase', 'text'), uno: 'ChangeCaseToSentenceCase'},
	{text: _UNO('.uno:ChangeCaseToTitleCase', 'text'), uno: 'ChangeCaseToTitleCase'},
	{text: _UNO('.uno:ChangeCaseToToggleCase', 'text'), uno: 'ChangeCaseToToggleCase'},
	{type: 'separator'},
	{text: _UNO('.uno:SmallCaps', 'text'), uno: 'SmallCaps'}
] as Array<MenuDefinition>);

menuDefinitions.set('FormatBulletsMenu', [
	{text: _UNO('.uno:DefaultBullet', 'text'), uno: 'DefaultBullet'},
	{type: 'separator'},
	{text: _UNO('.uno:DecrementLevel', 'text'), uno: 'DecrementLevel'},
	{text: _UNO('.uno:IncrementLevel', 'text'), uno: 'IncrementLevel'},
	{text: _UNO('.uno:DecrementSubLevels', 'text'), uno: 'DecrementSubLevels'},
	{text: _UNO('.uno:IncrementSubLevels', 'text'), uno: 'IncrementSubLevels'},
	{type: 'separator'},
	{text: _UNO('.uno:MoveDown', 'text'), uno: 'MoveDown'},
	{text: _UNO('.uno:MoveUp', 'text'), uno: 'MoveUp'},
	{text: _UNO('.uno:MoveDownSubItems', 'text'), uno: 'MoveDownSubItems'},
	{text: _UNO('.uno:MoveUpSubItems', 'text'), uno: 'MoveUpSubItems'},
	{type: 'separator'},
	{text: _UNO('.uno:InsertNeutralParagraph', 'text'), uno: 'InsertNeutralParagraph'},
	{text: _UNO('.uno:NumberingStart', 'text'), uno: 'NumberingStart'},
	{text: _UNO('.uno:RemoveBullets', 'text'), uno: 'RemoveBullets'},
	{type: 'separator'},
	{text: _UNO('.uno:JumpDownThisLevel', 'text'), uno: 'JumpDownThisLevel'},
	{text: _UNO('.uno:JumpUpThisLevel', 'text'), uno: 'JumpUpThisLevel'},
	{text: _UNO('.uno:ContinueNumbering', 'text'), uno: 'ContinueNumbering'}
] as Array<MenuDefinition>);

menuDefinitions.set('LineSpacingMenu', [
	{id: 'spacepara1', img: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: 'SpacePara1'},
	{id: 'spacepara15', img: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: 'SpacePara15'},
	{id: 'spacepara2', img: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: 'SpacePara2'},
	{type: 'separator'},
	{id: 'paraspaceincrease', img: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: 'ParaspaceIncrease'},
	{id: 'paraspacedecrease', img: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: 'ParaspaceDecrease'}
] as Array<MenuDefinition>);

menuDefinitions.set('LanguageMenu', [
	{action: 'morelanguages-selection', text: _UNO('.uno:SetLanguageSelectionMenu', 'text')},
	{action: 'morelanguages-paragraph', text: _UNO('.uno:SetLanguageParagraphMenu', 'text')},
	{action: 'morelanguages-all', text: _UNO('.uno:SetLanguageAllTextMenu', 'text')},
] as Array<MenuDefinition>);

menuDefinitions.set('InsertImageMenu', [
	{action: 'localgraphic', text: _('Insert Local Image')}
	// remote entry added in Map.WOPI
] as Array<MenuDefinition>);

JSDialog.MenuDefinitions = menuDefinitions;
