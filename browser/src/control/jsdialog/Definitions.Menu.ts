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

const financialFunctions: Array<FunctionNameAlias> = [
	{ en: 'ACCRINT', de: 'AUFGELZINS' },
	{ en: 'ACCRINTM', de: 'AUFGELZINSF' },
	{ en: 'AMORDEGRC', de: 'AMORDEGRK' },
	{ en: 'AMORLINC', de: 'AMORLINEARK' },
	{ en: 'COUPDAYBS', de: 'ZINSTERMTAGVA' },
	{ en: 'COUPDAYS', de: 'ZINSTERMTAGE' },
	{ en: 'COUPDAYSNC', de: 'ZINSTERMTAGNZ' },
	{ en: 'COUPNUM', de: 'ZINSTERMZAHL' },
	{ en: 'COUPPCD', de: 'ZINSTERMVZ' },
	{ en: 'CUMIPMT', de: 'KUMZINSZ' },
	{ en: 'CUMIPMT_ADD', de: 'KUMZINSZ_ADD' },
	{ en: 'CUMPRINC', de: 'KUMKAPITAL' },
	{ en: 'CUMPRINC_ADD', de: 'KUMKAPITAL_ADD' },
	{ en: 'DB', de: 'GDA2' },
	{ en: 'DDB', de: 'GDA' },
	{ en: 'DISC', de: 'DISAGIO' },
	{ en: 'DOLLARDE', de: 'NOTIERUNGDEZ' },
	{ en: 'DOLLARFR', de: 'NOTIERUNGBRU' },
	{ en: 'DURATION', de: 'LAUFZEIT' },
	{ en: 'EFFECT', de: 'EFFEKTIV' },
	{ en: 'EFFECT_ADD', de: 'EFFEKTIV_ADD' },
	{ en: 'FV', de: 'ZW' },
	{ en: 'FV', de: 'Zielwert' },
	{ en: 'FVSCHEDULE', de: 'ZW2' },
	{ en: 'INTRATE', de: 'ZINSSATZ' },
	{ en: 'IPMT', de: 'ZINSZ' },
	{ en: 'IRR', de: 'IKV' },
	{ en: 'ISPMT', de: 'ISPMT' },
	{ en: 'MDURATION', de: 'MLAUFZEIT' },
	{ en: 'MIRR', de: 'QIKV' },
	{ en: 'NOMINAL', de: 'NOMINAL' },
	{ en: 'NOMINAL_ADD', de: 'NOMINAL_ADD' },
	{ en: 'NPER', de: 'ZZR' },
	{ en: 'NPER', de: 'Zeitraum' },
	{ en: 'NPV', de: 'NBW' },
	{ en: 'ODDFPRICE', de: 'UNREGERKURS' },
	{ en: 'ODDFYIELD', de: 'UNREGERREND' },
	{ en: 'ODDLPRICE', de: 'UNREGLEKURS' },
	{ en: 'ODDLYIELD', de: 'UNREGLEREND' },
	{ en: 'OPT_BARRIER', de: 'OPT_BARRIER' },
	{ en: 'OPT_PROB_HIT', de: 'OPT_PROB_HIT' },
	{ en: 'OPT_PROB_INMONEY', de: 'OPT_PROB_INMONEY' },
	{ en: 'OPT_TOUCH', de: 'OPT_TOUCH' },
	{ en: 'OPT_TOUCH', de: 'Funktion OPT_TOUCH' },
	{ en: 'OPT_TOUCH', de: 'OPT_TOUCH' },
	{ en: 'PDURATION', de: 'PLAUFZEIT' },
	{ en: 'PMT', de: 'RMZ' },
	{ en: 'PMT', de: 'Zahlungen' },
	{ en: 'PPMT', de: 'KAPZ' },
	{ en: 'PRICE', de: 'KURS' },
	{ en: 'PRICEDISC', de: 'KURSDISAGIO' },
	{ en: 'PRICEMAT', de: 'KURSFÄLLIG' },
	{ en: 'PV', de: 'BW' },
	{ en: 'PV', de: 'Barwert' },
	{ en: 'RATE', de: 'ZINS' },
	{ en: 'RECEIVED', de: 'AUSZAHLUNG' },
	{ en: 'RRI', de: 'ZGZ' },
	{ en: 'SLN', de: 'LIA' },
	{ en: 'SYD', de: 'DIA' },
	{ en: 'TBILLEQ', de: 'TBILLÄQUIV' },
	{ en: 'TBILLPRICE', de: 'TBILLKURS' },
	{ en: 'TBILLYIELD', de: 'TBILLRENDITE' },
	{ en: 'XIRR', de: 'XINTZINSFUSS' },
	{ en: 'XNPV', de: 'XKAPITALWERT' },
	{ en: 'YIELD', de: 'RENDITE' },
	{ en: 'YIELDDISC', de: 'RENDITEDIS' },
	{ en: 'YIELDMAT', de: 'RENDITEFÄLL' },
];

const logicalFunctions: Array<FunctionNameAlias> = [
	{ en: 'AND', de: 'UND' },
	{ en: 'FALSE', de: 'FALSCH' },
	{ en: 'IF', de: 'WENN' },
	{ en: 'IFERROR', de: 'WENNFEHLER' },
	{ en: 'IFNA', de: 'WENNNV' },
	{ en: 'IFS', de: 'WENNS' },
	{ en: 'NOT', de: 'NICHT' },
	{ en: 'OR', de: 'ODER' },
	{ en: 'SWITCH', de: 'SCHALTER' },
	{ en: 'TRUE', de: 'WAHR' },
	{ en: 'XOR', de: 'XODER' },
];

const textFunctions: Array<FunctionNameAlias> = [
	{ en: 'ARABIC', de: 'ARABISCH' },
	{ en: 'ASC', de: 'ASC' },
	{ en: 'BAHTTEXT', de: 'BAHTTEXT' },
	{ en: 'BASE', de: 'BASIS' },
	{ en: 'CHAR', de: 'ZEICHEN' },
	{ en: 'CLEAN', de: 'SÄUBERN' },
	{ en: 'CODE', de: 'CODE' },
	{ en: 'CONCAT', de: 'TEXTKETTE' },
	{ en: 'CONCATENATE', de: 'VERKETTEN' },
	{ en: 'DECIMAL', de: 'DEZIMAL' },
	{ en: 'DOLLAR', de: 'EUR' },
	{ en: 'ENCODEURL', de: 'URLCODIEREN' },
	{ en: 'ENCODEURL', de: '' },
	{ en: 'FILTERXML', de: 'XMLFILTERN' },
	{ en: 'FILTERXML', de: '' },
	{ en: 'FIND', de: 'FINDEN' },
	{ en: 'FINDB', de: 'FINDENB' },
	{ en: 'FIXED', de: 'FEST' },
	{ en: 'JIS', de: 'JIS' },
	{ en: 'LEFT', de: 'LINKS' },
	{ en: 'LEFTB', de: 'LINKSB' },
	{ en: 'LEN', de: 'LÄNGE' },
	{ en: 'LENB', de: 'LÄNGEB' },
	{ en: 'LOWER', de: 'KLEIN' },
	{ en: 'MID', de: 'TEIL' },
	{ en: 'MIDB', de: 'TEILB' },
	{ en: 'NUMBERVALUE', de: 'ZAHLWERT' },
	{ en: 'PROPER', de: 'GROSS2' },
	{ en: 'REGEX', de: 'REGAUS' },
	{ en: 'REPLACE', de: 'ERSETZEN' },
	{ en: 'REPLACEB', de: 'ERSETZENB' },
	{ en: 'REPT', de: 'WIEDERHOLEN' },
	{ en: 'RIGHT', de: 'RECHTS' },
	{ en: 'RIGHTB', de: 'RECHTSB' },
	{ en: 'ROMAN', de: 'RÖMISCH' },
	{ en: 'ROT13', de: 'ROT13' },
	{ en: 'SEARCH', de: 'SUCHEN' },
	{ en: 'SEARCH', de: 'SUCHE' },
	{ en: 'SEARCHB', de: 'SUCHENB' },
	{ en: 'SUBSTITUTE', de: 'WECHSELN' },
	{ en: 'T', de: 'T' },
	{ en: 'TEXT', de: 'TEXT' },
	{ en: 'TEXTJOIN', de: 'VERBINDEN' },
	{ en: 'TRIM', de: 'GLÄTTEN' },
	{ en: 'UNICHAR', de: 'UNIZEICHEN' },
	{ en: 'UNICODE', de: 'UNICODE' },
	{ en: 'UPPER', de: 'GROSS' },
	{ en: 'VALUE', de: 'WERT' },
	{ en: 'WEBSERVICE', de: 'WEBDIENST' },
];

const dateAndTimeFunctions: Array<FunctionNameAlias> = [
	{ en: 'DATE', de: 'DATUM' },
	{ en: 'DATEDIF', de: 'DATUMDIF' },
	{ en: 'DATEVALUE', de: 'DATUMWERT' },
	{ en: 'DAY', de: 'TAG' },
	{ en: 'DAYS', de: 'TAGE' },
	{ en: 'DAYS360', de: 'TAGE360' },
	{ en: 'DAYSINMONTH', de: 'TAGEIMMONAT' },
	{ en: 'DAYSINYEAR', de: 'TAGEIMJAHR' },
	{ en: 'EASTERSUNDAY', de: 'OSTERSONNTAG' },
	{ en: 'EDATE', de: 'EDATUM' },
	{ en: 'EOMONTH', de: 'MONATSENDE' },
	{ en: 'HOUR', de: 'STUNDE' },
	{ en: 'ISLEAPYEAR', de: 'ISTSCHALTJAHR' },
	{ en: 'ISOWEEKNUM', de: 'ISOKALENDERWOCHE' },
	{ en: 'MINUTE', de: 'MINUTE' },
	{ en: 'MINUTE', de: 'Minute' },
	{ en: 'MONTH', de: 'MONAT' },
	{ en: 'MONTHS', de: 'MONATE' },
	{ en: 'NETWORKDAYS', de: 'NETTOARBEITSTAGE' },
	{ en: 'NETWORKDAYS.INTL', de: 'NETTOARBEITSTAGE.INTL' },
	{ en: 'NOW', de: 'JETZT' },
	{ en: 'SECOND', de: 'SEKUNDE' },
	{ en: 'TIME', de: 'ZEIT' },
	{ en: 'TIMEVALUE', de: 'ZEITWERT' },
	{ en: 'TODAY', de: 'HEUTE' },
	{ en: 'WEEKDAY', de: 'WOCHENTAG' },
	{ en: 'WEEKNUM', de: 'KALENDERWOCHE' },
	{ en: 'WEEKNUM_EXCEL2003', de: 'KALENDERWOCHE_EXCEL2003' },
	{ en: 'WEEKNUM_OOO', de: 'KALENDERWOCHE_OOO' },
	{ en: 'WEEKS', de: 'WOCHEN' },
	{ en: 'WEEKSINYEAR', de: 'WOCHENIMJAHR' },
	{ en: 'WORKDAY', de: 'ARBEITSTAG' },
	{ en: 'WORKDAY.INTL', de: 'ARBEITSTAG.INTL' },
	{ en: 'YEAR', de: 'JAHR' },
	{ en: 'YEARFRAC', de: 'BRTEILJAHRE' },
	{ en: 'YEARS', de: 'JAHRE' },
];

const lookupFunctions: Array<FunctionNameAlias> = [
	{ en: 'HLOOKUP', de: 'WVERWEIS' },
	{ en: 'LOOKUP', de: 'VERWEIS' },
	{ en: 'VLOOKUP', de: 'SVERWEIS' },
	{ en: 'XLOOKUP', de: 'XVERWEIS' },
];

const refFunctions: Array<FunctionNameAlias> = [
	{ en: 'ISREF', de: 'ISTBEZUG' },
];

const mathAndTrigFunctions: Array<FunctionNameAlias> = [
	{ en: 'ABS', de: 'ABS' },
	{ en: 'ABS', de: 'BETRAG' },
	{ en: 'ABS', de: 'Bezug' },
	{ en: 'ACOS', de: 'ARCCOS' },
	{ en: 'ACOSH', de: 'ARCCOSHYP' },
	{ en: 'ACOT', de: 'ARCCOT' },
	{ en: 'ACOTH', de: 'ARCCOTHYP' },
	{ en: 'AGGREGATE', de: 'AGGREGAT' },
	{ en: 'ASIN', de: 'ARCSIN' },
	{ en: 'ASINH', de: 'ARCSINHYP' },
	{ en: 'ATAN', de: 'ARCTAN' },
	{ en: 'ATAN2', de: 'ARCTAN2' },
	{ en: 'ATANH', de: 'ARCTANHYP' },
	{ en: 'BITAND', de: 'BITUND' },
	{ en: 'BITLSHIFT', de: 'BITLVERSCHIEB' },
	{ en: 'BITOR', de: 'BITODER' },
	{ en: 'BITRSHIFT', de: 'BITRVERSCHIEB' },
	{ en: 'BITXOR', de: 'BITXODER' },
	{ en: 'CEILING', de: 'OBERGRENZE' },
	{ en: 'CEILING.MATH', de: 'OBERGRENZE.MATHEMATIK' },
	{ en: 'CEILING.PRECISE', de: 'OBERGRENZE.GENAU' },
	{ en: 'CEILING.XCL', de: 'OBERGRENZE.EXCEL' },
	{ en: 'COLOR', de: 'FARBE' },
	{ en: 'COMBIN', de: 'KOMBINATIONEN' },
	{ en: 'COMBINA', de: 'KOMBINATIONEN2' },
	{ en: 'CONVERT_OOO', de: 'UMRECHNEN_OOO' },
	{ en: 'COS', de: 'COS' },
	{ en: 'COSH', de: 'COSHYP' },
	{ en: 'COT', de: 'COT' },
	{ en: 'COTH', de: 'COTHYP' },
	{ en: 'CSC', de: 'COSEC' },
	{ en: 'CSCH', de: 'COSECHYP' },
	{ en: 'DEGREES', de: 'GRAD' },
	{ en: 'EUROCONVERT', de: 'EUROUMRECHNEN' },
	{ en: 'EVEN', de: 'GERADE' },
	{ en: 'EXP', de: 'EXP' },
	{ en: 'FACT', de: 'FAKULTÄT' },
	{ en: 'FLOOR', de: 'UNTERGRENZE' },
	{ en: 'FLOOR.MATH', de: 'UNTERGRENZE.MATHEMATIK' },
	{ en: 'FLOOR.PRECISE', de: 'UNTERGRENZE.GENAU' },
	{ en: 'FLOOR.XCL', de: 'UNTERGRENZE.EXCEL' },
	{ en: 'GCD', de: 'GGT' },
	{ en: 'GCD_EXCEL2003', de: 'GGT_EXCEL2003' },
	{ en: 'INT', de: 'GANZZAHL' },
	{ en: 'INT', de: 'GANZ' },
	{ en: 'ISO.CEILING', de: 'ISO.OBERGRENZE' },
	{ en: 'LCM', de: 'KGV' },
	{ en: 'LCM_EXCEL2003', de: 'KGV_EXCEL2003' },
	{ en: 'LN', de: 'LN' },
	{ en: 'LOG', de: 'LOG' },
	{ en: 'LOG10', de: 'LOG10' },
	{ en: 'MOD', de: 'REST' },
	{ en: 'MROUND', de: 'VRUNDEN' },
	{ en: 'MULTINOMIAL', de: 'POLYNOMIAL' },
	{ en: 'ODD', de: 'UNGERADE' },
	{ en: 'PI', de: 'PI' },
	{ en: 'POWER', de: 'POTENZ' },
	{ en: 'PRODUCT', de: 'PRODUKT' },
	{ en: 'QUOTIENT', de: 'QUOTIENT' },
	{ en: 'RADIANS', de: 'BOGENMASS' },
	{ en: 'RAND', de: 'ZUFALLSZAHL' },
	{ en: 'RAND.NV', de: 'ZUFALLSZAHL.NF' },
	{ en: 'RANDARRAY', de: 'ZUFALLSMATRIX' },
	{ en: 'RANDBETWEEN', de: 'ZUFALLSBEREICH' },
	{ en: 'RANDBETWEEN.NV', de: 'ZUFALLSBEREICH.NF' },
	{ en: 'ROUND', de: 'RUNDEN' },
	{ en: 'ROUND', de: 'RUNDE' },
	{ en: 'ROUNDDOWN', de: 'ABRUNDEN' },
	{ en: 'ROUNDSIG', de: 'RUNDENSIG' },
	{ en: 'ROUNDUP', de: 'AUFRUNDEN' },
	{ en: 'SEC', de: 'SEC' },
	{ en: 'SECH', de: 'SECHYP' },
	{ en: 'SERIESSUM', de: 'POTENZREIHE' },
	{ en: 'SIGN', de: 'VORZEICHEN' },
	{ en: 'SIN', de: 'SIN' },
	{ en: 'SINH', de: 'SINHYP' },
	{ en: 'SQRT', de: 'WURZEL' },
	{ en: 'SQRTPI', de: 'WURZELPI' },
	{ en: 'SUBTOTAL', de: 'TEILERGEBNIS' },
	{ en: 'SUM', de: 'SUMME' },
	{ en: 'SUMIF', de: 'SUMMEWENN' },
	{ en: 'SUMIFS', de: 'SUMMEWENNS' },
	{ en: 'SUMSQ', de: 'QUADRATESUMME' },
	{ en: 'TAN', de: 'TAN' },
	{ en: 'TANH', de: 'TANHYP' },
	{ en: 'TRUNC', de: 'KÜRZEN' },
];

const statisticalFunctions: Array<FunctionNameAlias> = [
	{ en: 'AVEDEV', de: 'MITTELABW' },
	{ en: 'AVERAGE', de: 'MITTELWERT' },
	{ en: 'AVERAGEA', de: 'MITTELWERTA' },
	{ en: 'AVERAGEIF', de: 'MITTELWERTWENN' },
	{ en: 'AVERAGEIFS', de: 'MITTELWERTWENNS' },
	{ en: 'B', de: 'B:' },
	{ en: 'B', de: 'B' },
	{ en: 'BETA.DIST', de: 'BETA.VERT' },
	{ en: 'BETA.INV', de: 'BETA.INV' },
	{ en: 'BETADIST', de: 'BETAVERT' },
	{ en: 'BETAINV', de: 'BETAINV' },
	{ en: 'BINOM.DIST', de: 'BINOM.VERT' },
	{ en: 'BINOM.INV', de: 'BINOM.INV' },
	{ en: 'BINOMDIST', de: 'BINOMVERT' },
	{ en: 'CHIDIST', de: 'CHIVERT' },
	{ en: 'CHIINV', de: 'CHIINV' },
	{ en: 'CHISQ.DIST', de: 'CHIQU.VERT' },
	{ en: 'CHISQ.DIST.RT', de: 'CHIQU.VERT.RE' },
	{ en: 'CHISQ.INV', de: 'CHIQU.INV' },
	{ en: 'CHISQ.INV.RT', de: 'CHIQU.INV.RE' },
	{ en: 'CHISQ.TEST', de: 'CHIQU.TEST' },
	{ en: 'CHISQDIST', de: 'CHIQUVERT' },
	{ en: 'CHISQINV', de: 'CHIQUINV' },
	{ en: 'CHITEST', de: 'CHITEST' },
	{ en: 'CONFIDENCE', de: 'KONFIDENZ' },
	{ en: 'CONFIDENCE.NORM', de: 'KONFIDENZ.NORM' },
	{ en: 'CONFIDENCE.T', de: 'KONFIDENZ.T' },
	{ en: 'CORREL', de: 'KORREL' },
	{ en: 'COUNT', de: 'ANZAHL' },
	{ en: 'COUNT', de: 'ZÄHLE' },
	{ en: 'COUNTA', de: 'ANZAHL2' },
	{ en: 'COUNTBLANK', de: 'ANZAHLLEEREZELLEN' },
	{ en: 'COUNTIF', de: 'ZÄHLENWENN' },
	{ en: 'COUNTIFS', de: 'ZÄHLENWENNS' },
	{ en: 'COVAR', de: 'KOVARIANZ' },
	{ en: 'COVARIANCE.P', de: 'KOVARIANZ.P' },
	{ en: 'COVARIANCE.S', de: 'KOVARIANZ.S' },
	{ en: 'CRITBINOM', de: 'KRITBINOM' },
	{ en: 'DEVSQ', de: 'SUMQUADABW' },
	{ en: 'ERF.PRECISE', de: 'GAUSSF.GENAU' },
	{ en: 'ERFC.PRECISE', de: 'GAUSSFKOMPL.GENAU' },
	{ en: 'EXPON.DIST', de: 'EXPON.VERT' },
	{ en: 'EXPONDIST', de: 'EXPONVERT' },
	{ en: 'F.DIST', de: 'F.VERT' },
	{ en: 'F.DIST.RT', de: 'F.VERT.RE' },
	{ en: 'F.INV', de: 'F.INV' },
	{ en: 'F.INV.RT', de: 'F.INV.RE' },
	{ en: 'F.TEST', de: 'F.TEST' },
	{ en: 'F.DIST', de: 'F.VERT' },
	{ en: 'F.INV', de: 'F.INV' },
	{ en: 'FISHER', de: 'FISHER' },
	{ en: 'FISHERINV', de: 'FISHERINV' },
	{ en: 'FORECAST', de: 'PROGNOSE' },
	{ en: 'FORECAST.ETS.ADD', de: 'PROGNOSE.EXP.ADD' },
	{ en: 'FORECAST.ETS.MULT', de: 'PROGNOSE.EXP.MULT' },
	{ en: 'FORECAST.ETS.PI.ADD', de: 'PROGNOSE.EXP.VOR.ADD' },
	{ en: 'FORECAST.ETS.PI.MULT', de: 'PROGNOSE.EXP.VOR.MULT' },
	{ en: 'FORECAST.ETS.SEASONALITY', de: 'PROGNOSE.EXP.SAISONAL' },
	{ en: 'FORECAST.ETS.STAT.ADD', de: 'PROGNOSE.EXP.STAT.ADD' },
	{ en: 'FORECAST.ETS.STAT.MULT', de: 'PROGNOSE.EXP.STAT.MULT' },
	{ en: 'FORECAST.LINEAR', de: 'PROGNOSE.LINEAR' },
	{ en: 'FTEST', de: 'FTEST' },
	{ en: 'GAMMA', de: 'GAMMA' },
	{ en: 'GAMMA.DIST', de: 'GAMMA.VERT' },
	{ en: 'GAMMA.INV', de: 'GAMMA.INV' },
	{ en: 'GAMMADIST', de: 'GAMMAVERT' },
	{ en: 'GAMMAINV', de: 'GAMMAINV' },
	{ en: 'GAMMALN', de: 'GAMMALN' },
	{ en: 'GAMMALN.PRECISE', de: 'GAMMALN.GENAU' },
	{ en: 'GAUSS', de: 'GAUSS' },
	{ en: 'GEOMEAN', de: 'GEOMITTEL' },
	{ en: 'HARMEAN', de: 'HARMITTEL' },
	{ en: 'HYPGEOM.DIST', de: 'HYPGEOM.VERT' },
	{ en: 'HYPGEOMDIST', de: 'HYPGEOMVERT' },
	{ en: 'INTERCEPT', de: 'ACHSENABSCHNITT' },
	{ en: 'KURT', de: 'KURT' },
	{ en: 'LARGE', de: 'KGRÖSSTE' },
	{ en: 'LOGINV', de: 'LOGINV' },
	{ en: 'LOGNORM.DIST', de: 'LOGNORM.VERT' },
	{ en: 'LOGNORM.INV', de: 'LOGNORM.INV' },
	{ en: 'LOGNORMDIST', de: 'LOGNORMVERT' },
	{ en: 'MAX', de: 'MAX' },
	{ en: 'MAXA', de: 'MAXA' },
	{ en: 'MAXIFS', de: 'MAXWENNS' },
	{ en: 'MEDIAN', de: 'MEDIAN' },
	{ en: 'MIN', de: 'MIN' },
	{ en: 'MINA', de: 'MINA' },
	{ en: 'MINIFS', de: 'MINWENNS' },
	{ en: 'MODE', de: 'MODALWERT' },
	{ en: 'MODE.SNGL', de: 'MODUS.EINF' },
	{ en: 'NEGBINOM.DIST', de: 'NEGBINOM.VERT' },
	{ en: 'NEGBINOMDIST', de: 'NEGBINOMVERT' },
	{ en: 'NORMSDIST', de: 'STANDNORMVERT' },
	{ en: 'NORM.DIST', de: 'NORM.VERT' },
	{ en: 'NORMSDIST', de: 'STANDNORMVERT' },
	{ en: 'NORMSINV', de: 'STANDNORMINV' },
	{ en: 'NORM.INV', de: 'NORM.INV' },
	{ en: 'NORMSINV', de: 'STANDNORMINV' },
	{ en: 'NORM.S.DIST', de: 'NORM.S.VERT' },
	{ en: 'NORM.S.INV', de: 'NORM.S.INV' },
	{ en: 'NORMDIST', de: 'NORMVERT' },
	{ en: 'NORMINV', de: 'NORMINV' },
	{ en: 'NORMSDIST', de: 'STANDNORMVERT' },
	{ en: 'NORMSINV', de: 'STANDNORMINV' },
	{ en: 'PEARSON', de: 'PEARSON' },
	{ en: 'PERCENTILE', de: 'QUANTIL' },
	{ en: 'PERCENTILE.EXC', de: 'QUANTIL.EXKL' },
	{ en: 'PERCENTILE.INC', de: 'QUANTIL.INKL' },
	{ en: 'PERCENTRANK', de: 'QUANTILSRANG' },
	{ en: 'PERCENTRANK.EXC', de: 'QUANTILSRANG.EXKL' },
	{ en: 'PERCENTRANK.INC', de: 'QUANTILSRANG.INKL' },
	{ en: 'PERMUT', de: 'VARIATIONEN' },
	{ en: 'PERMUTATIONA', de: 'VARIATIONEN2' },
	{ en: 'PHI', de: 'PHI' },
	{ en: 'PROB', de: 'WAHRSCHBEREICH' },
	{ en: 'QUARTILE', de: 'QUARTILE' },
	{ en: 'QUARTILE.EXC', de: 'QUARTILE.EXKL' },
	{ en: 'QUARTILE.INC', de: 'QUARTILE.INKL' },
	{ en: 'RANK', de: 'RANG' },
	{ en: 'RANK.AVG', de: 'RANG.MITTELW' },
	{ en: 'RANK.EQ', de: 'RANG.GLEICH' },
	{ en: 'RSQ', de: 'BESTIMMTHEITSMASS' },
	{ en: 'SKEW', de: 'SCHIEFE' },
	{ en: 'SKEWP', de: 'SCHIEFEP' },
	{ en: 'SLOPE', de: 'STEIGUNG' },
	{ en: 'SMALL', de: 'KKLEINSTE' },
	{ en: 'STANDARDIZE', de: 'STANDARDISIERUNG' },
	{ en: 'STDEV', de: 'STABW' },
	{ en: 'STDEV.P', de: 'STABW.N' },
	{ en: 'STDEV.S', de: 'STABW.S' },
	{ en: 'STDEVA', de: 'STABWA' },
	{ en: 'STDEVP', de: 'STABWN' },
	{ en: 'STDEVPA', de: 'STABWNA' },
	{ en: 'STEYX', de: 'STFEHLERYX' },
	{ en: 'T.DIST', de: 'T.VERT' },
	{ en: 'T.DIST.2T', de: 'T.VERT.2S' },
	{ en: 'T.DIST.RT', de: 'T.VERT.RE' },
	{ en: 'T.INV', de: 'T.INV' },
	{ en: 'T.INV.2T', de: 'T.INV.2S' },
	{ en: 'T.TEST', de: 'T.TEST' },
	{ en: 'TDIST', de: 'TVERT' },
	{ en: 'TINV', de: 'TINV' },
	{ en: 'TRIMMEAN', de: 'GESTUTZTMITTEL' },
	{ en: 'TTEST', de: 'TTEST' },
	{ en: 'VAR', de: 'VARIANZ' },
	{ en: 'VAR.P', de: 'VAR.P' },
	{ en: 'VAR.S', de: 'VAR.S' },
	{ en: 'VARA', de: 'VARIANZA' },
	{ en: 'VARP', de: 'VARIANZEN' },
	{ en: 'VARPA', de: 'VARIANZENA' },
	{ en: 'WEIBULL', de: 'WEIBULL' },
	{ en: 'WEIBULL.DIST', de: 'WEIBULL.VERT' },
	{ en: 'Z.TEST', de: 'G.TEST' },
	{ en: 'ZTEST', de: 'GTEST' },
];

const databaseFunctions: Array<FunctionNameAlias> = [
	{ en: 'DAVERAGE', de: 'DBMITTELWERT' },
	{ en: 'DCOUNT', de: 'DBANZAHL' },
	{ en: 'DCOUNTA', de: 'DBANZAHL2' },
	{ en: 'DGET', de: 'DBAUSZUG' },
	{ en: 'DMAX', de: 'DBMAX' },
	{ en: 'DMIN', de: 'DBMIN' },
	{ en: 'DPRODUCT', de: 'DBPRODUKT' },
	{ en: 'DSTDEV', de: 'DBSTDABW' },
	{ en: 'DSUM', de: 'DBSUMME' },
	{ en: 'DVAR', de: 'DBVARIANZ' },
	{ en: 'DVARP', de: 'DBVARIANZEN' },
];

const informationFunctions: Array<FunctionNameAlias> = [
	{ en: 'CELL', de: 'ZELLE' },
	{ en: 'CURRENT', de: 'AKTUELL' },
	{ en: 'FORMULA', de: 'FORMEL' },
	{ en: 'INFO', de: 'INFO' },
	{ en: 'ISBLANK', de: 'ISTLEER' },
	{ en: 'ISERR', de: 'ISTFEHL' },
	{ en: 'ISERROR', de: 'ISTFEHLER' },
	{ en: 'ISEVEN', de: 'ISTGERADE' },
	{ en: 'ISEVEN_ADD', de: 'ISTGERADE_ADD' },
	{ en: 'ISFORMULA', de: 'ISTFORMEL' },
	{ en: 'ISLOGICAL', de: 'ISTLOGISCH' },
	{ en: 'ISNA', de: 'ISTNV' },
	{ en: 'ISNONTEXT', de: 'ISTKEINTEXT' },
	{ en: 'ISNUMBER', de: 'ISTZAHL' },
	{ en: 'ISODD', de: 'ISTUNGERADE' },
	{ en: 'ISODD_ADD', de: 'ISTUNGERADE_ADD' },
	{ en: 'ISTEXT', de: 'ISTTEXT' },
	{ en: 'N', de: 'N' },
	{ en: 'N', de: 'Potenz' },
	{ en: 'N', de: 'Ordnung' },
	{ en: 'NA', de: 'NV' },
	{ en: 'TYPE', de: 'TYP' },
];

const arrayFunctions: Array<FunctionNameAlias> = [
	{ en: 'FOURIER', de: 'FOURIER' },
	{ en: 'FREQUENCY', de: 'HÄUFIGKEIT' },
	{ en: 'GROWTH', de: 'VARIATION' },
	{ en: 'LINEST', de: 'RGP' },
	{ en: 'LOGEST', de: 'RKP' },
	{ en: 'MDETERM', de: 'MDET' },
	{ en: 'MINVERSE', de: 'MINV' },
	{ en: 'MMULT', de: 'MMULT' },
	{ en: 'MUNIT', de: 'EINHEITSMATRIX' },
	{ en: 'SEQUENCE', de: 'FOLGE' },
	{ en: 'SUMPRODUCT', de: 'SUMMENPRODUKT' },
	{ en: 'SUMX2MY2', de: 'SUMMEX2MY2' },
	{ en: 'SUMX2PY2', de: 'SUMMEX2PY2' },
	{ en: 'SUMXMY2', de: 'SUMMEXMY2' },
	{ en: 'TRANSPOSE', de: 'MTRANS' },
	{ en: 'TREND', de: 'TREND' },
];

const spreadsheetFunctions: Array<FunctionNameAlias> = [
	{ en: 'ADDRESS', de: 'ADRESSE' },
	{ en: 'AREAS', de: 'BEREICHE' },
	{ en: 'CHOOSE', de: 'WAHL' },
	{ en: 'COLUMN', de: 'SPALTE' },
	{ en: 'COLUMNS', de: 'SPALTEN' },
	{ en: 'DDE', de: 'DDE' },
	{ en: 'ERROR.TYPE', de: 'FEHLER.TYP' },
	{ en: 'ERRORTYPE', de: 'FEHLERTYP' },
	{ en: 'FILTER', de: 'FILTERN' },
	{ en: 'GETPIVOTDATA', de: 'PIVOTDATENZUORDNEN' },
	{ en: 'HYPERLINK', de: 'HYPERLINK' },
	{ en: 'INDEX', de: 'INDEX' },
	{ en: 'INDIRECT', de: 'INDIREKT' },
	{ en: 'LET', de: 'LET' },
	{ en: 'MATCH', de: 'VERGLEICH' },
	{ en: 'OFFSET', de: 'VERSCHIEBUNG' },
	{ en: 'ROW', de: 'ZEILE' },
	{ en: 'ROWS', de: 'ZEILEN' },
	{ en: 'SHEET', de: 'TABELLE' },
	{ en: 'SHEETS', de: 'TABELLEN' },
	{ en: 'SORT', de: 'SORTIEREN' },
	{ en: 'SORTBY', de: 'SORTIERENNACH' },
	{ en: 'STYLE', de: 'VORLAGE' },
	{ en: 'UNIQUE', de: 'EINZIGARTIG' },
];

function getLocalizedFuncName(funcNameList: FunctionNameAlias): string {
	if (String.locale === 'de' && funcNameList.de) return funcNameList.de;
	else return funcNameList.en;
}

function getFunctionsMenuArray(
	funcs: Array<FunctionNameAlias>,
	category: number,
): Array<MenuDefinition> {
	var functionsMenu: Array<MenuDefinition> = [];
	for (var func of funcs) {
		const localizedFunc = getLocalizedFuncName(func);
		functionsMenu.push({
			text: localizedFunc,
			uno:
				'.uno:InsertFunction?FunctionName:string=' +
				localizedFunc +
				'&FunctionCategory:short=' +
				category,
		} as MenuDefinition);
	}
	return functionsMenu;
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
