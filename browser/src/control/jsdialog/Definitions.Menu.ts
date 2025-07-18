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

enum functionCategories {
	DATABASE = 1,
	DATEnTIME = 2,
	FINANCIAL = 3,
	INFORMATION = 4,
	LOGICAL = 5,
	MATHEMATICAL = 6,
	ARRAY = 7,
	STATISTICAL = 8,
	SPREADSHEET = 9,
	TEXT = 10,
}

const financialFunctions: Array<string> = [
	_('ACCRINT'),
	_('ACCRINTM'),
	_('AMORDEGRC'),
	_('AMORLINC'),
	_('COUPDAYBS'),
	_('COUPDAYS'),
	_('COUPDAYSNC'),
	_('COUPNDC'),
	_('COUPNUM'),
	_('COUPPCD'),
	_('CUMIPMT'),
	_('CUMIPMT_ADD'),
	_('CUMPRINC'),
	_('CUMPRINC_ADD'),
	_('DB'),
	_('DDB'),
	_('DISC'),
	_('DOLLARDE'),
	_('DOLLARFR'),
	_('DURATION'),
	_('EFFECT'),
	_('EFFECT_ADD'),
	_('FV'),
	_('FVSCHEDULE'),
	_('INTRATE'),
	_('IPMT'),
	_('IRR'),
	_('ISPMT'),
	_('MDURATION'),
	_('MIRR'),
	_('NOMINAL'),
	_('NOMINAL_ADD'),
	_('NPER'),
	_('NPV'),
	_('ODDFPRICE'),
	_('ODDFYIELD'),
	_('ODDLPRICE'),
	_('ODDLYIELD'),
	_('OPT_BARRIER'),
	_('OPT_PROB_HIT'),
	_('OPT_PROB_INMONEY'),
	_('OPT_TOUCH'),
	_('PDURATION'),
	_('PMT'),
	_('PPMT'),
	_('PRICE'),
	_('PRICEDISC'),
	_('PRICEMAT'),
	_('PV'),
	_('RATE'),
	_('RECEIVED'),
	_('RRI'),
	_('SLN'),
	_('SYD'),
	_('TBILLEQ'),
	_('TBILLPRICE'),
	_('TBILLYIELD'),
	_('YDB'),
	_('XIRR'),
	_('XNPV'),
	_('YIELD'),
	_('YIELDDISC'),
	_('YIELDMAT'),
];

const logicalFunctions: Array<string> = [
	_('AND'),
	_('FALSE'),
	_('IF'),
	_('IFERROR'),
	_('IFNA'),
	_('IFS'),
	_('NOT'),
	_('OR'),
	_('SWITCH'),
	_('TRUE'),
	_('XOR'),
];

const textFunctions: Array<string> = [
	_('ARABIC'),
	_('ASC'),
	_('BAHTTEXT'),
	_('BASE'),
	_('CHAR'),
	_('CLEAN'),
	_('CODE'),
	_('CONCAT'),
	_('CONCATENATE'),
	_('DECIMAL'),
	_('DOLLAR'),
	_('ENCODEURL'),
	_('EXTRACT'),
	_('FILTERXML'),
	_('FIND'),
	_('FINDB'),
	_('FIXED'),
	_('JIS'),
	_('LEFT'),
	_('LEFTB'),
	_('LEN'),
	_('LENB'),
	_('LOWER'),
	_('MID'),
	_('MIDB'),
	_('NUMBERVALUE'),
	_('PROPER'),
	_('REGEX'),
	_('REPLACE'),
	_('REPLACEB'),
	_('REPT'),
	_('RIGHT'),
	_('RIGHTB'),
	_('ROMAN'),
	_('ROT13'),
	_('SEARCH'),
	_('SEARCHB'),
	_('SUBSTITUTE'),
	_('T'),
	_('TEXT'),
	_('TEXTJOIN'),
	_('TRIM'),
	_('UNICHAR'),
	_('UNICODE'),
	_('UPPER'),
	_('VALUE'),
	_('WEBSERVICE'),
];

const dateAndTimeFunctions: Array<string> = [
	_('DATE'),
	_('DATEDIF'),
	_('DATEVALUE'),
	_('DAY'),
	_('DAYS'),
	_('DAYS360'),
	_('DAYSINMONTH'),
	_('DAYSINYEAR'),
	_('EASTERSUNDAY'),
	_('EDATE'),
	_('EOMONTH'),
	_('HOUR'),
	_('ISLEAPYEAR'),
	_('ISOWEEKNUM'),
	_('MINUTE'),
	_('MONTH'),
	_('MONTHS'),
	_('NETWORKDAYS'),
	_('NETWORKDAYS_EXCEL2003'),
	_('NETWORKDAYS.INTL'),
	_('NOW'),
	_('SECOND'),
	_('TIME'),
	_('TIMEVALUE'),
	_('TODAY'),
	_('WEEKDAY'),
	_('WEEKNUM'),
	_('WEEKNUM_EXCEL2003'),
	_('WEEKNUM_OOO'),
	_('WEEKS'),
	_('WEEKSINYEAR'),
	_('WORKDAY'),
	_('WORKDAY.INTL'),
	_('YEAR'),
	_('YEARFRAC'),
	_('YEARS'),
];

const lookupFunctions: Array<string> = [
	_('HLOOKUP'),
	_('LOOKUP'),
	_('VLOOKUP'),
	_('XLOOKUP'),
];

const refFunctions: Array<string> = [_('ISREF')];

const mathAndTrigFunctions: Array<string> = [
	_('ABS'),
	_('ACOS'),
	_('ACOSH'),
	_('ACOT'),
	_('ACOTH'),
	_('AGGREGATE'),
	_('ASIN'),
	_('ASINH'),
	_('ATAN'),
	_('ATAN2'),
	_('ATANH'),
	_('BITAND'),
	_('BITLSHIFT'),
	_('BITOR'),
	_('BITRSHIFT'),
	_('BITXOR'),
	_('CEILING'),
	_('CEILING.MATH'),
	_('CEILING.PRECISE'),
	_('CEILING.XCL'),
	_('COLOR'),
	_('COMBIN'),
	_('COMBINA'),
	_('CONVERT_OOO'),
	_('COS'),
	_('COSH'),
	_('COT'),
	_('COTH'),
	_('CSC'),
	_('CSCH'),
	_('DEGREES'),
	_('EUROCONVERT'),
	_('EVEN'),
	_('EXP'),
	_('FACT'),
	_('FLOOR'),
	_('FLOOR.MATH'),
	_('FLOOR.PRECISE'),
	_('FLOOR.XCL'),
	_('GCD'),
	_('GCD.EXCEL2003'),
	_('INT'),
	_('ISO.CEILING'),
	_('LCM'),
	_('LCM_EXCEL2003'),
	_('LN'),
	_('LOG'),
	_('LOG10'),
	_('MOD'),
	_('MROUND'),
	_('MULTINOMIAL'),
	_('ODD'),
	_('PI'),
	_('POWER'),
	_('PRODUCT'),
	_('QUOTIENT'),
	_('RADIANS'),
	_('RAND'),
	_('RAND.NV'),
	_('RANDARRAY'),
	_('RANDBETWEEN'),
	_('RANDBETWEEN.NV'),
	_('RAWSUBSTRACT'),
	_('ROUND'),
	_('ROUNDDOWN'),
	_('ROUNDSIG'),
	_('ROUNDUP'),
	_('SEC'),
	_('SECH'),
	_('SERIESSUM'),
	_('SIGN'),
	_('SIN'),
	_('SINH'),
	_('SQRT'),
	_('SQRTPI'),
	_('SUBTOTAL'),
	_('SUM'),
	_('SUMIF'),
	_('SUMIFS'),
	_('SUMSQ'),
	_('TAN'),
	_('TANH'),
	_('TRUNC'),
];

const statisticalFunctions: Array<string> = [
	_('AVEDEV'),
	_('AVERAGE'),
	_('AVERAGEA'),
	_('AVERAGEIF'),
	_('AVERAGEIFS'),
	_('B'),
	_('BETA.DIST'),
	_('BETA.INV'),
	_('BETADIST'),
	_('BETAINV'),
	_('BINOM.DIST'),
	_('BINOM.INV'),
	_('BINOMDIST'),
	_('CHIDIST'),
	_('CHIINV'),
	_('CHISQ.DIST'),
	_('CHISQ.DIST.RT'),
	_('CHISQ.INV'),
	_('CHISQ.INV.RT'),
	_('CHISQ.TEST'),
	_('CHISQDIST'),
	_('CHISQINV'),
	_('CHITEST'),
	_('CONFIDENCE'),
	_('CONFIDENCE.NORM'),
	_('CONFIDENCE.T'),
	_('CORREL'),
	_('COUNT'),
	_('COUNTA'),
	_('COUNTBLANK'),
	_('COUNTIF'),
	_('COUNTIFS'),
	_('COVAR'),
	_('COVARIANCE.P'),
	_('COVARIANCE.S'),
	_('CRITBINOM'),
	_('DEVSQ'),
	_('ERF.PRECISE'),
	_('ERFC.PRECISE'),
	_('EXPON.DIST'),
	_('EXPONDIST'),
	_('F.DIST'),
	_('F.DIST.RT'),
	_('F.INV'),
	_('F.INV.RT'),
	_('F.TEST'),
	_('F.DIST'),
	_('F.INV'),
	_('FISHER'),
	_('FISHERINV'),
	_('FORECAST'),
	_('FORECAST.ETS.ADD'),
	_('FORECAST.ETS.MULT'),
	_('FORECAST.ETS.PI.ADD'),
	_('FORECAST.ETS.PI.MULT'),
	_('FORECAST.ETS.SEASONALITY'),
	_('FORECAST.ETS.STAT.ADD'),
	_('FORECAST.ETS.STAT.MULT'),
	_('FORECAST.LINEAR'),
	_('FTEST'),
	_('GAMMA'),
	_('GAMMA.DIST'),
	_('GAMMA.INV'),
	_('GAMMADIST'),
	_('GAMMAINV'),
	_('GAMMALN'),
	_('GAMMALN.PRECISE'),
	_('GAUSS'),
	_('GEOMEAN'),
	_('HARMEAN'),
	_('HYPGEOM.DIST'),
	_('HYPGEOMDIST'),
	_('INTERCEPT'),
	_('KURT'),
	_('LARGE'),
	_('LOGINV'),
	_('LOGNORM.DIST'),
	_('LOGNORM.INV'),
	_('LOGNORMDIST'),
	_('MAX'),
	_('MAXA'),
	_('MAXIFS'),
	_('MEDIAN'),
	_('MIN'),
	_('MINA'),
	_('MINIFS'),
	_('MODE'),
	_('MODEMULT'),
	_('MODE.SNGL'),
	_('NEGBINOM.DIST'),
	_('NEGBINOMDIST'),
	_('NORM.DIST'),
	_('NORM.INV'),
	_('NORM.S.DIST'),
	_('NORM.S.INV'),
	_('NORMDIST'),
	_('NORMINV'),
	_('NORMSDIST'),
	_('NORMSINV'),
	_('PEARSON'),
	_('PERCENTILE'),
	_('PERCENTILE.EXC'),
	_('PERCENTILE.INC'),
	_('PERCENTRANK'),
	_('PERCENTRANK.EXC'),
	_('PERCENTRANK.INC'),
	_('PERMUT'),
	_('PERMUTATIONA'),
	_('PHI'),
	_('POISSION'),
	_('POISSION.DIST'),
	_('PROB'),
	_('QUARTILE'),
	_('QUARTILE.EXC'),
	_('QUARTILE.INC'),
	_('RANK'),
	_('RANK.AVG'),
	_('RANK.EQ'),
	_('RSQ'),
	_('SKEW'),
	_('SKEWP'),
	_('SLOPE'),
	_('SMALL'),
	_('STANDARDIZE'),
	_('STDEV'),
	_('STDEV.P'),
	_('STDEV.S'),
	_('STDEVA'),
	_('STDEVP'),
	_('STDEVPA'),
	_('STEYX'),
	_('T.DIST'),
	_('T.DIST.2T'),
	_('T.DIST.RT'),
	_('T.INV'),
	_('T.INV.2T'),
	_('T.TEST'),
	_('TDIST'),
	_('TINV'),
	_('TRIMMEAN'),
	_('TTEST'),
	_('VAR'),
	_('VAR.P'),
	_('VAR.S'),
	_('VARA'),
	_('VARP'),
	_('VARPA'),
	_('WEIBULL'),
	_('WEIBULL.DIST'),
	_('Z.TEST'),
	_('ZTEST'),
];

const databaseFunctions: Array<string> = [
	_('DAVERAGE'),
	_('DCOUNT'),
	_('DCOUNTA'),
	_('DGET'),
	_('DMAX'),
	_('DMIN'),
	_('DPRODUCT'),
	_('DSTDEV'),
	_('DSTEEVP'),
	_('DSUM'),
	_('DVAR'),
	_('DVARP'),
];

const informationFunctions: Array<string> = [
	_('CELL'),
	_('CURRENT'),
	_('FORMULA'),
	_('INFO'),
	_('ISBLANK'),
	_('ISERR'),
	_('ISERROR'),
	_('ISEVEN'),
	_('ISEVEN_ADD'),
	_('ISFORMULA'),
	_('ISLOGICAL'),
	_('ISNA'),
	_('ISNONTEXT'),
	_('ISNUMBER'),
	_('ISODD'),
	_('ISODD_ADD'),
	_('ISTEXT'),
	_('N'),
	_('NA'),
	_('TYPE'),
];

const arrayFunctions: Array<string> = [
	_('FOURIER'),
	_('FREQUENCY'),
	_('GROWTH'),
	_('LINEST'),
	_('LONGEST'),
	_('MDETERM'),
	_('MINVERSE'),
	_('MMULT'),
	_('MUNIT'),
	_('SEQUENCE'),
	_('SUMPRODUCT'),
	_('SUMX2MY2'),
	_('SUMX2PY2'),
	_('SUMXMY2'),
	_('TRANSPOSE'),
	_('TREND'),
];

const spreadsheetFunctions: Array<string> = [
	_('ADDRESS'),
	_('AREAS'),
	_('CHOOSE'),
	_('COLUMN'),
	_('COLUMNS'),
	_('DDE'),
	_('ERROR.TYPE'),
	_('ERRORTYPE'),
	_('FILTER'),
	_('GETPIVOTDATA'),
	_('HYPERLINK'),
	_('INDEX'),
	_('INDIRECT'),
	_('LET'),
	_('MATCH'),
	_('OFFSET'),
	_('ROW'),
	_('ROWS'),
	_('SHEET'),
	_('SHEETS'),
	_('SORT'),
	_('SORTBY'),
	_('STYLE'),
	_('UNIQUE'),
];

function getFunctionsMenuArray(
	funcs: Array<string>,
	category: number,
): Array<MenuDefinition> {
	var financialFunctionsMenu: Array<any> = [];
	for (var func of funcs) {
		financialFunctionsMenu.push({
			text: func,
			uno:
				'.uno:InsertFunction?FunctionName:string=' +
				func +
				'&FunctionCategory:short=' +
				category,
		});
	}
	return financialFunctionsMenu as Array<MenuDefinition>;
}

menuDefinitions.set(
	'FinancialFunctionsMenu',
	getFunctionsMenuArray(financialFunctions, functionCategories.FINANCIAL),
);
menuDefinitions.set(
	'LogicalFunctionsMenu',
	getFunctionsMenuArray(logicalFunctions, functionCategories.LOGICAL),
);
menuDefinitions.set(
	'TextFunctionsMenu',
	getFunctionsMenuArray(textFunctions, functionCategories.TEXT),
);
menuDefinitions.set(
	'DateAndTimeFunctionsMenu',
	getFunctionsMenuArray(dateAndTimeFunctions, functionCategories.DATEnTIME),
);
menuDefinitions.set(
	'LookupAndRefFunctionsMenu',
	getFunctionsMenuArray(lookupFunctions, functionCategories.SPREADSHEET).concat(
		getFunctionsMenuArray(refFunctions, functionCategories.INFORMATION),
	),
);
menuDefinitions.set(
	'MathAndTrigFunctionsMenu',
	getFunctionsMenuArray(
		mathAndTrigFunctions,
		functionCategories.MATHEMATICAL,
	).concat(
		getFunctionsMenuArray(statisticalFunctions, functionCategories.STATISTICAL),
	),
);
menuDefinitions.set(
	'MoreFunctionsMenu',
	getFunctionsMenuArray(databaseFunctions, functionCategories.DATABASE).concat(
		getFunctionsMenuArray(informationFunctions, functionCategories.INFORMATION),
		getFunctionsMenuArray(arrayFunctions, functionCategories.ARRAY),
		getFunctionsMenuArray(spreadsheetFunctions, functionCategories.SPREADSHEET),
	),
);

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
