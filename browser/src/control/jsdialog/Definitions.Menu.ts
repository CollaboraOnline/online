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
enum Paper {
	PAPER_A0,
	PAPER_A1,
	PAPER_A2,
	PAPER_A3,
	PAPER_A4,
	PAPER_A5,
	PAPER_B4_ISO,
	PAPER_B5_ISO,
	PAPER_LETTER,
	PAPER_LEGAL,
	PAPER_TABLOID,
	PAPER_USER,
	PAPER_B6_ISO,
	PAPER_ENV_C4,
	PAPER_ENV_C5,
	PAPER_ENV_C6,
	PAPER_ENV_C65,
	PAPER_ENV_DL,
	PAPER_SLIDE_DIA,
	PAPER_SCREEN_4_3,
	PAPER_C,
	PAPER_D,
	PAPER_E,
	PAPER_EXECUTIVE,
	PAPER_FANFOLD_LEGAL_DE,
	PAPER_ENV_MONARCH,
	PAPER_ENV_PERSONAL,
	PAPER_ENV_9,
	PAPER_ENV_10,
	PAPER_ENV_11,
	PAPER_ENV_12,
	PAPER_KAI16,
	PAPER_KAI32,
	PAPER_KAI32BIG,
	PAPER_B4_JIS,
	PAPER_B5_JIS,
	PAPER_B6_JIS,
	PAPER_LEDGER,
	PAPER_STATEMENT,
	PAPER_QUARTO,
	PAPER_10x14,
	PAPER_ENV_14,
	PAPER_ENV_C3,
	PAPER_ENV_ITALY,
	PAPER_FANFOLD_US,
	PAPER_FANFOLD_DE,
	PAPER_POSTCARD_JP,
	PAPER_9x11,
	PAPER_10x11,
	PAPER_15x11,
	PAPER_ENV_INVITE,
	PAPER_A_PLUS,
	PAPER_B_PLUS,
	PAPER_LETTER_PLUS,
	PAPER_A4_PLUS,
	PAPER_DOUBLEPOSTCARD_JP,
	PAPER_A6,
	PAPER_12x11,
	PAPER_A7,
	PAPER_A8,
	PAPER_A9,
	PAPER_A10,
	PAPER_B0_ISO,
	PAPER_B1_ISO,
	PAPER_B2_ISO,
	PAPER_B3_ISO,
	PAPER_B7_ISO,
	PAPER_B8_ISO,
	PAPER_B9_ISO,
	PAPER_B10_ISO,
	PAPER_ENV_C2,
	PAPER_ENV_C7,
	PAPER_ENV_C8,
	PAPER_ARCHA,
	PAPER_ARCHB,
	PAPER_ARCHC,
	PAPER_ARCHD,
	PAPER_ARCHE,
	PAPER_SCREEN_16_9,
	PAPER_SCREEN_16_10,
	PAPER_16K_195x270,
	PAPER_16K_197x273,
	PAPER_WIDESCREEN, //PowerPoint Widescreen
	PAPER_ONSCREENSHOW_4_3, //PowerPoint On-screen Show (4:3)
	PAPER_ONSCREENSHOW_16_9, //PowerPoint On-screen Show (16:9)
	PAPER_ONSCREENSHOW_16_10, //PowerPoint On-screen Show (16:10)
}

const pageMarginOptions = {
	normal: {
		title: _('Normal'),
		icon: 'pagemargin',
		details: { Top: 0.79, Left: 0.79, Bottom: 0.79, Right: 0.79 },
	},
	wide: {
		title: _('Wide'),
		icon: 'pagemarginwide',
		details: { Top: 1, Left: 2, Bottom: 1, Right: 2 },
	},
	narrow: {
		title: _('Narrow'),
		icon: 'pagemarginnarrow',
		details: { Top: 0.5, Left: 0.5, Bottom: 0.5, Right: 0.5 },
	},
};

enum LO_BorderLineWidth {
	Hairline = 1, // 0.05pt
	VeryThin = 10, // 0.50pt
	Thin = 15, // 0.75pt
	Medium = 30, // 1.50pt
	Thick = 45, // 2.25pt
	ExtraThick = 90, // 4.50pt
}

enum UNO_BorderLineStyle {
	// Matches table::BorderLineStyle::DOUBLE in UNO IDL
	NONE = 32767,
	SOLID = 1,
	DOUBLE = 3,
}

function getLineStyleModificationCommand(
	LineStyle: UNO_BorderLineStyle,
	n1: number, // Corresponds to SvxBorderLineWidth
	n2: number,
	n3: number,
): string {
	const borderLine2Properties = {
		LineStyle: { type: 'short', value: LineStyle },
		InnerLineWidth: { type: 'short', value: n1 },
		OuterLineWidth: { type: 'short', value: n2 },
		LineDistance: { type: 'short', value: n3 },
	};

	const jsonParams = JSON.stringify(borderLine2Properties);

	// The UNO command name itself, from `scslots.hxx`
	return `.uno:LineStyle ${jsonParams}`;
}
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
	var functionsMenu: Array<any> = [];
	for (var func of funcs) {
		functionsMenu.push({
			text: func,
			uno:
				'.uno:InsertFunction?FunctionName:string=' +
				func +
				'&FunctionCategory:short=' +
				category,
		});
	}
	return functionsMenu as Array<MenuDefinition>;
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

menuDefinitions.set('EditSparklineMenu', [
	{
		text: _UNO('.uno:EditSparklineGroup', 'spreadsheet'),
		uno: 'EditSparklineGroup',
	},
	{
		text: _('Edit Single Sparkline'),
		uno: 'EditSparkline',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('DeleteSparklineMenu', [
	{
		text: _UNO('.uno:DeleteSparklineGroup', 'spreadsheet'),
		uno: 'DeleteSparklineGroup',
	},
	{
		text: _('Delete Single Sparkline'),
		uno: 'DeleteSparkline',
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
menuDefinitions.set('MenuMargins', [
	{
		type: 'json',
		content: {
			id: 'Layout-MarginMenu',
			type: 'pagemarginentry',
			options: pageMarginOptions,
		},
	},
	{ type: 'separator' },
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
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_A6,
	},
	{
		id: 'A5',
		text: _('A5'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_A5,
	},
	{
		id: 'A4',
		text: _('A4'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_A4,
	},
	{
		id: 'A3',
		text: _('A3'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_A3,
	},
	{
		id: 'B6ISO',
		text: _('B6 (ISO)'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_B6_ISO,
	},
	{
		id: 'B5ISO',
		text: _('B5 (ISO)'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_B5_ISO,
	},
	{
		id: 'B4ISO',
		text: _('B4 (ISO)'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_B4_ISO,
	},
	{
		id: 'Letter',
		text: _('Letter'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_LETTER,
	},
	{
		id: 'Legal',
		text: _('Legal'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_LEGAL,
	},
	{
		id: 'LongBond',
		text: _('Long Bond'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_FANFOLD_LEGAL_DE,
	},
	{
		id: 'Tabloid',
		text: _('Tabloid'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_TABLOID,
	},
	{
		id: 'B6JIS',
		text: _('B6 (JIS)'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_B6_JIS,
	},
	{
		id: 'B5JIS',
		text: _('B5 (JIS)'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_B5_JIS,
	},
	{
		id: 'B4JIS',
		text: _('B4 (JIS)'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_B4_JIS,
	},
	{
		id: '16Kai',
		text: _('16 Kai'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_KAI16,
	},
	{
		id: '32Kai',
		text: _('32 Kai'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_KAI32,
	},
	{
		id: 'Big32Kai',
		text: _('Big 32 Kai'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_KAI32BIG,
	},
	{
		id: 'User',
		text: _('User'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_USER,
	},
	{
		id: 'DLEnvelope',
		text: _('DL Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_DL,
	},
	{
		id: 'C6Envelope',
		text: _('C6 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_C6,
	},
	{
		id: 'C6_5Envelope',
		text: _('C6/5 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_C65,
	},
	{
		id: 'C5Envelope',
		text: _('C5 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_C5,
	},
	{
		id: 'C4Envelope',
		text: _('C4 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_C4,
	},
	{
		id: 'No6_3_4Envelope',
		text: _('#6¾ Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_PERSONAL,
	},
	{
		id: 'No7_3_4MonarchEnvelope',
		text: _('#7¾ (Monarch) Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_MONARCH,
	},
	{
		id: 'No9Envelope',
		text: _('#9 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_9,
	},
	{
		id: 'No10Envelope',
		text: _('#10 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_10,
	},
	{
		id: 'No11Envelope',
		text: _('#11 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_11,
	},
	{
		id: 'No12Envelope',
		text: _('#12 Envelope'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_ENV_12,
	},
	{
		id: 'JapanesePostcard',
		text: _('Japanese Postcard'),
		uno: '.uno:CalcPageSize?PaperFormat:long=' + Paper.PAPER_POSTCARD_JP,
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
	// local and remote entries added in Map.WOPI
] as Array<MenuDefinition>);

menuDefinitions.set('InsertMultimediaMenu', [
	// local and remote entries added in Map.WOPI
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
	{
		id: 'noborders',
		img: 'fr01',
		text: _('No Borders'),
		uno: (window as any).getBorderStyleUNOCommand(0, 0, 0, 0, 0, 0, 0),
	},
	{
		id: 'leftborder',
		img: 'fr02',
		text: _('Left Border'),
		uno: (window as any).getBorderStyleUNOCommand(1, 0, 0, 0, 0, 0, 0),
	},
	{
		id: 'rightborder',
		img: 'fr03',
		text: _('Right Border'),
		uno: (window as any).getBorderStyleUNOCommand(0, 1, 0, 0, 0, 0, 0),
	},
	{
		id: 'leftandrightborders',
		img: 'fr04',
		text: _('Left And Right Borders'),
		uno: (window as any).getBorderStyleUNOCommand(1, 1, 0, 0, 0, 0, 0),
	},
	{
		id: 'topborder',
		img: 'fr05',
		text: _('Top Border'),
		uno: (window as any).getBorderStyleUNOCommand(0, 0, 0, 1, 0, 0, 0),
	},
	{
		id: 'bottomborder',
		img: 'fr06',
		text: _('Bottom Border'),
		uno: (window as any).getBorderStyleUNOCommand(0, 0, 1, 0, 0, 0, 0),
	},
	{
		id: 'topandbottomborder',
		img: 'fr07',
		text: _('Top And Bottom Border'),
		uno: (window as any).getBorderStyleUNOCommand(0, 0, 1, 1, 0, 0, 0),
	},
	{
		id: 'outerborder',
		img: 'fr08',
		text: _('Outer Border'),
		uno: (window as any).getBorderStyleUNOCommand(1, 1, 1, 1, 0, 0, 0),
	},
	{
		id: 'allhorizontallines',
		img: 'fr09',
		text: _('All Horizontal Lines'),
		uno: (window as any).getBorderStyleUNOCommand(0, 0, 1, 1, 1, 0, 0),
	},
	{
		id: 'outerborderandhorizontallines',
		img: 'fr010',
		text: _('Outer Border And Horizontal Lines'),
		uno: (window as any).getBorderStyleUNOCommand(1, 1, 1, 1, 1, 0, 0),
	},
	{
		id: 'outerborderandverticallines',
		img: 'fr011',
		text: _('Outer Border and Vertical Lines'),
		uno: (window as any).getBorderStyleUNOCommand(1, 1, 1, 1, 0, 1, 0),
	},
	{
		id: 'outerbordersandalllines',
		img: 'fr012',
		text: _('Outer Borders And All Inner lines'),
		uno: (window as any).getBorderStyleUNOCommand(1, 1, 1, 1, 1, 1, 0),
	},
	{ type: 'separator' },
	{
		text: _('Line color'),
		items: [
			{
				id: 'colorpickerwidget',
				type: 'colorpicker',
				command: '.uno:FrameLineColor',
			},
			{ type: 'separator' }, // required to show dropdown arrow
		],
	},
	{
		text: _('Line style'),
		items: [
			{
				text: _('Hairline (0.05 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.SOLID,
					LO_BorderLineWidth.Hairline,
					0,
					0,
				),
			},
			{
				text: _('Very thin (0.50 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.SOLID,
					LO_BorderLineWidth.VeryThin,
					0,
					0,
				),
			},
			{
				text: _('Thin (0.75 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.SOLID,
					LO_BorderLineWidth.Thin,
					0,
					0,
				),
			},
			{
				text: _('Medium (1.50 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.SOLID,
					LO_BorderLineWidth.Medium,
					0,
					0,
				),
			},
			{
				text: _('Thick (2.25 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.SOLID,
					LO_BorderLineWidth.Thick,
					0,
					0,
				),
			},
			{
				text: _('Extra thick (4.50 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.SOLID,
					LO_BorderLineWidth.ExtraThick,
					0,
					0,
				),
			},
			{
				text: _('Double Hairline (1.10 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.DOUBLE,
					LO_BorderLineWidth.Hairline,
					LO_BorderLineWidth.Hairline,
					LO_BorderLineWidth.Medium,
				),
			},
			{
				text: _('Double Hairline (2.35 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.DOUBLE,
					LO_BorderLineWidth.Hairline,
					LO_BorderLineWidth.Hairline,
					LO_BorderLineWidth.Thick,
				),
			},
			{
				text: _('Thin/Medium (3.00 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.DOUBLE,
					LO_BorderLineWidth.Thin,
					LO_BorderLineWidth.Medium,
					LO_BorderLineWidth.Thin,
				),
			},
			{
				text: _('Medium/Hairline (3.05 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.DOUBLE,
					LO_BorderLineWidth.Medium,
					LO_BorderLineWidth.Hairline,
					LO_BorderLineWidth.Medium,
				),
			},
			{
				text: _('Medium/Medium (4.50 pt)'),
				uno: getLineStyleModificationCommand(
					UNO_BorderLineStyle.DOUBLE,
					LO_BorderLineWidth.Medium,
					LO_BorderLineWidth.Medium,
					LO_BorderLineWidth.Medium,
				),
			},
			{ type: 'separator' }, // required to show dropdown arrow
		],
	},
	{ type: 'separator' },
	{
		id: 'more',
		text: _('More...'),
		uno: '.uno:FormatCellBorders',
	},
	{ type: 'separator' }, // required to show dropdown arrow
] as Array<MenuDefinition>);

menuDefinitions.set(
	'BorderStyleMenuWriter',
	(menuDefinitions.get('BorderStyleMenu') || []).filter(
		(item) => item.uno !== '.uno:FormatCellBorders',
	),
);

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

function generatePictureBrightnessMenu(
	unoCommand: string,
): Array<MenuDefinition> {
	const brightnessValues = [-40, -20, 0, 20, 40];

	const menuItems: Array<MenuDefinition> = [];

	for (let i = 0; i < brightnessValues.length; i++) {
		menuItems.push({
			id: 'brightness' + brightnessValues[i],
			uno: '.uno:' + unoCommand + '?Brightness:short=' + brightnessValues[i],
			text: brightnessValues[i] + '%',
			img: 'insertgraphic',
		} as MenuDefinition);
	}

	return menuItems;
}

function generatePictureContrastMenu(
	unoCommand: string,
): Array<MenuDefinition> {
	const contrastValues = [-40, -20, 0, 20, 40];

	const menuItems: Array<MenuDefinition> = [];

	for (let i = 0; i < contrastValues.length; i++) {
		menuItems.push({
			id: 'contrast' + contrastValues[i],
			uno: '.uno:' + unoCommand + '?Contrast:short=' + contrastValues[i],
			text: contrastValues[i] + '%',
			img: 'insertgraphic',
		} as MenuDefinition);
	}

	return menuItems;
}

function generatePictureTransparencyMenu(
	unoCommand: string,
): Array<MenuDefinition> {
	const transparencyValues = [0, 15, 30, 50, 65, 80, 95];

	const menuItems: Array<MenuDefinition> = [];

	for (let i = 0; i < transparencyValues.length; i++) {
		menuItems.push({
			id: 'transparency' + transparencyValues[i],
			uno:
				'.uno:' + unoCommand + '?Transparency:short=' + transparencyValues[i],
			text: transparencyValues[i] + '%',
			img: 'insertgraphic',
		} as MenuDefinition);
	}

	return menuItems;
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

menuDefinitions.set(
	'PictureBrightness',
	generatePictureBrightnessMenu('GrafLuminance'),
);

menuDefinitions.set(
	'PictureContrast',
	generatePictureContrastMenu('GrafContrast'),
);

menuDefinitions.set(
	'PictureTransparency',
	generatePictureTransparencyMenu('GrafTransparence'),
);

menuDefinitions.set('PictureColorMode', [
	{
		text: _('Default'),
		img: 'insertgraphic',
		uno: '.uno:GrafMode?ColorMode:short=0',
	},
	{
		text: _('Grayscale'),
		img: 'insertgraphic',
		uno: '.uno:GrafMode?ColorMode:short=1',
	},
	{
		text: _('Black/White'),
		img: 'insertgraphic',
		uno: '.uno:GrafMode?ColorMode:short=2',
	},
	{
		text: _('Watermark'),
		img: 'insertgraphic',
		uno: '.uno:GrafMode?ColorMode:short=3',
	},
] as Array<MenuDefinition>);

menuDefinitions.set('PictureEffectsMenu', [
	{
		text: _UNO('.uno:GraphicFilterInvert'),
		uno: '.uno:GraphicFilterInvert',
		img: 'graphicfilterinvert',
	},
	{
		text: _UNO('.uno:GraphicFilterSharpen'),
		uno: '.uno:GraphicFilterSharpen',
		img: 'graphicfiltersharpen',
	},
	{
		text: _UNO('.uno:GraphicFilterRemoveNoise'),
		uno: '.uno:GraphicFilterRemoveNoise',
		img: 'graphicfilterremovenoise',
	},
	{
		text: _UNO('.uno:GraphicFilterPopart'),
		uno: '.uno:GraphicFilterPopart',
		img: 'graphicfilterpopart',
	},
	{
		text: _UNO('.uno:GraphicFilterSobel'),
		uno: '.uno:GraphicFilterSobel',
		img: 'graphicfiltersobel',
	},
] as Array<MenuDefinition>);

JSDialog.MenuDefinitions = menuDefinitions;
