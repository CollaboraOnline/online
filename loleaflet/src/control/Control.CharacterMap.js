/*
 * L.Control.CharacterMap.
 */

L.Control.CharacterMap = L.Control.extend({
	options: {
		position: 'topright'
	},

	unicodeBlocks : [
		{ innerHTML: _('None'),					start: 0x0000, end: 0x0000 }, /*UBLOCK_NO_BLOCK=0*/
		{ innerHTML: _('Basic Latin'),				start: 0x0021, end: 0x007F }, /*UBLOCK_BASIC_LATIN=1*/
		{ innerHTML: _('Latin-1'),				start: 0x0080, end: 0x00FF }, /*UBLOCK_LATIN_1_SUPPLEMENT=2*/
		{ innerHTML: _('Latin Extended-A'),			start: 0x0100, end: 0x017F }, /*UBLOCK_LATIN_EXTENDED_A=3*/
		{ innerHTML: _('Latin Extended-B'),			start: 0x0180, end: 0x024F }, /*UBLOCK_LATIN_EXTENDED_B=4*/
		{ innerHTML: _('IPA Extensions'),			start: 0x0250, end: 0x02AF }, /*UBLOCK_IPA_EXTENSIONS=5*/
		{ innerHTML: _('Spacing Modifier Letters'),		start: 0x02B0, end: 0x02FF }, /*UBLOCK_SPACING_MODIFIER_LETTERS=6*/
		{ innerHTML: _('Combining Diacritical Marks'),		start: 0x0300, end: 0x036F }, /*UBLOCK_COMBINING_DIACRITICAL_MARKS=7*/
		{ innerHTML: _('Basic Greek'),				start: 0x0370, end: 0x03FF }, /*UBLOCK_GREEK=8*/
		{ innerHTML: _('Cyrillic'),				start: 0x0400, end: 0x04FF }, /*UBLOCK_CYRILLIC=9*/
		{ innerHTML: _('Armenian'),				start: 0x0530, end: 0x058F }, /*UBLOCK_ARMENIAN=10*/
		{ innerHTML: _('Basic Hebrew'),				start: 0x0590, end: 0x05FF }, /*UBLOCK_HEBREW=11*/
		{ innerHTML: _('Basic Arabic'),				start: 0x0600, end: 0x06FF }, /*UBLOCK_ARABIC=12*/
		{ innerHTML: _('Syriac'),				start: 0x0700, end: 0x074F }, /*UBLOCK_SYRIAC=13*/
		{ innerHTML: _('Thaana'),				start: 0x0780, end: 0x07BF }, /*UBLOCK_THAANA =14*/
		{ innerHTML: _('Devanagari'),				start: 0x0900, end: 0x097F }, /*UBLOCK_DEVANAGARI=15*/
		{ innerHTML: _('Bengali'),				start: 0x0980, end: 0x09FF }, /*UBLOCK_BENGALI=16*/
		{ innerHTML: _('Gurmukhi'),				start: 0x0A00, end: 0x0A7F }, /*UBLOCK_GURMUKHI=17*/
		{ innerHTML: _('Gujarati'),				start: 0x0A80, end: 0x0AFF }, /*UBLOCK_GUJARATI=18*/
		{ innerHTML: _('Odia'),					start: 0x0B00, end: 0x0B7F }, /*UBLOCK_ORIYA=19*/
		{ innerHTML: _('Tamil'),				start: 0x0B80, end: 0x0BFF }, /*UBLOCK_TAMIL=20*/
		{ innerHTML: _('Telugu'),				start: 0x0C00, end: 0x0C7F }, /*UBLOCK_TELUGU=21*/
		{ innerHTML: _('Kannada'),				start: 0x0C80, end: 0x0CFF }, /*UBLOCK_KANNADA=22*/
		{ innerHTML: _('Malayalam'),				start: 0x0D00, end: 0x0D7F }, /*UBLOCK_MALAYALAM=23*/
		{ innerHTML: _('Sinhala'),				start: 0x0D80, end: 0x0DFF }, /*UBLOCK_SINHALA=24*/
		{ innerHTML: _('Thai'),					start: 0x0E00, end: 0x0E7F }, /*UBLOCK_THAI=25*/
		{ innerHTML: _('Lao'),					start: 0x0E80, end: 0x0EFF }, /*UBLOCK_LAO=26*/
		{ innerHTML: _('Tibetan'),				start: 0x0F00, end: 0x0FFF }, /*UBLOCK_TIBETAN=27*/
		{ innerHTML: _('Myanmar'),				start: 0x1000, end: 0x109F }, /*UBLOCK_MYANMAR=28*/
		{ innerHTML: _('Basic Georgian'),			start: 0x10A0, end: 0x10FF }, /*UBLOCK_GEORGIAN=29*/
		{ innerHTML: _('Hangul Jamo'),				start: 0x1100, end: 0x11FF }, /*UBLOCK_HANGUL_JAMO=30*/
		{ innerHTML: _('Ethiopic'),				start: 0x1200, end: 0x137F }, /*UBLOCK_ETHIOPIC=31*/
		{ innerHTML: _('Cherokee'),				start: 0x13A0, end: 0x13FF }, /*UBLOCK_CHEROKEE=32*/
		{ innerHTML: _('Canadian Aboriginal Syllables'),	start: 0x1400, end: 0x167F }, /*UBLOCK_UNIFIED_CANADIAN_ABORIGINAL_SYLLABICS=33*/
		{ innerHTML: _('Ogham'),				start: 0x1680, end: 0x169F }, /*UBLOCK_OGHAM=34*/
		{ innerHTML: _('Runic'),				start: 0x16A0, end: 0x16FF }, /*UBLOCK_RUNIC=35*/
		{ innerHTML: _('Khmer'),				start: 0x1780, end: 0x17FF }, /*UBLOCK_KHMER=36*/
		{ innerHTML: _('Mongolian'),				start: 0x1800, end: 0x18AF }, /*UBLOCK_MONGOLIAN=37*/
		{ innerHTML: _('Latin Extended Additional'),		start: 0x1E00, end: 0x1EFF }, /*UBLOCK_LATIN_EXTENDED_ADDITIONAL=38*/
		{ innerHTML: _('Greek Extended'),			start: 0x1F00, end: 0x1FFF }, /*UBLOCK_GREEK_EXTENDED=39*/
		{ innerHTML: _('General Punctuation'),			start: 0x2000, end: 0x206F }, /*UBLOCK_GENERAL_PUNCTUATION=40*/
		{ innerHTML: _('Superscripts and Subscripts'),		start: 0x2070, end: 0x209F }, /*UBLOCK_SUPERSCRIPTS_AND_SUBSCRIPTS=41*/
		{ innerHTML: _('Currency Symbols'),			start: 0x20A0, end: 0x20CF }, /*UBLOCK_CURRENCY_SYMBOLS=42*/
		{ innerHTML: _('Combining Diacritical Symbols'),	start: 0x20D0, end: 0x20FF }, /*UBLOCK_COMBINING_MARKS_FOR_SYMBOLS=43*/
		{ innerHTML: _('Letterlike Symbols'),			start: 0x2100, end: 0x214F }, /*UBLOCK_LETTERLIKE_SYMBOLS=44*/
		{ innerHTML: _('Number Forms'),				start: 0x2150, end: 0x218F }, /*UBLOCK_NUMBER_FORMS=45*/
		{ innerHTML: _('Arrows'),				start: 0x2190, end: 0x21FF }, /*UBLOCK_ARROWS=46*/
		{ innerHTML: _('Mathematical Operators'),		start: 0x2200, end: 0x22FF }, /*UBLOCK_MATHEMATICAL_OPERATORS=47*/
		{ innerHTML: _('Miscellaneous Technical'),		start: 0x2300, end: 0x23FF }, /*UBLOCK_MISCELLANEOUS_TECHNICAL=48*/
		{ innerHTML: _('Control Pictures'),			start: 0x2400, end: 0x243F }, /*UBLOCK_CONTROL_PICTURES=49*/
		{ innerHTML: _('Optical Character Recognition'),	start: 0x2440, end: 0x245F }, /*UBLOCK_OPTICAL_CHARACTER_RECOGNITION=50*/
		{ innerHTML: _('Enclosed Alphanumerics'),		start: 0x2460, end: 0x24FF }, /*UBLOCK_ENCLOSED_ALPHANUMERICS=51*/
		{ innerHTML: _('Box Drawing'),				start: 0x2500, end: 0x257F }, /*UBLOCK_BOX_DRAWING=52*/
		{ innerHTML: _('Block Elements'),			start: 0x2580, end: 0x259F }, /*UBLOCK_BLOCK_ELEMENTS=53*/
		{ innerHTML: _('Geometric Shapes'),			start: 0x25A0, end: 0x25FF }, /*UBLOCK_GEOMETRIC_SHAPES=54*/
		{ innerHTML: _('Miscellaneous Symbols'),		start: 0x2600, end: 0x26FF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS=55*/
		{ innerHTML: _('Dingbats'),				start: 0x2700, end: 0x27BF }, /*UBLOCK_DINGBATS=56*/
		{ innerHTML: _('Braille Patterns'),			start: 0x2800, end: 0x28FF }, /*UBLOCK_BRAILLE_PATTERNS=57*/
		{ innerHTML: _('CJK Radicals Supplement'),		start: 0x2E80, end: 0x2EFF }, /*UBLOCK_CJK_RADICALS_SUPPLEMENT=58*/
		{ innerHTML: _('Kangxi Radicals'),			start: 0x2F00, end: 0x2FDF }, /*UBLOCK_KANGXI_RADICALS=59*/
		{ innerHTML: _('Ideographic Description Characters'),	start: 0x2FF0, end: 0x2FFF }, /*UBLOCK_IDEOGRAPHIC_DESCRIPTION_CHARACTERS=60*/
		{ innerHTML: _('CJK Symbols and Punctuation'),		start: 0x3000, end: 0x303F }, /*UBLOCK_CJK_SYMBOLS_AND_PUNCTUATION=61*/
		{ innerHTML: _('Hiragana'),				start: 0x3040, end: 0x309F }, /*UBLOCK_HIRAGANA=62*/
		{ innerHTML: _('Katakana'),				start: 0x30A0, end: 0x30FF }, /*UBLOCK_KATAKANA=63*/
		{ innerHTML: _('Bopomofo'),				start: 0x3100, end: 0x312F }, /*UBLOCK_BOPOMOFO=64*/
		{ innerHTML: _('Hangul Compatability Jamo'),		start: 0x3130, end: 0x318F }, /*UBLOCK_HANGUL_COMPATIBILITY_JAMO=65*/
		{ innerHTML: _('Kanbun'),				start: 0x3190, end: 0x319F }, /*UBLOCK_KANBUN=66*/
		{ innerHTML: _('Bopomofo Extended'),			start: 0x31A0, end: 0x31BF }, /*UBLOCK_BOPOMOFO_EXTENDED=67*/
		{ innerHTML: _('Enclosed CJK Letters and Months'),	start: 0x3200, end: 0x32FF }, /*UBLOCK_ENCLOSED_CJK_LETTERS_AND_MONTHS=68*/
		{ innerHTML: _('CJK Compatibility'),			start: 0x3300, end: 0x33FF }, /*UBLOCK_CJK_COMPATIBILITY=69*/
		{ innerHTML: _('CJK Unified Ideographs Extension A'),	start: 0x3400, end: 0x4DB5 }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A=70*/
		{ innerHTML: _('CJK Unified Ideographs'),		start: 0x4E00, end: 0x9FFF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS=71*/
		{ innerHTML: _('Yi Syllables'),				start: 0xA000, end: 0xA48F }, /*UBLOCK_YI_SYLLABLES=72*/
		{ innerHTML: _('Yi Radicals'),				start: 0xA490, end: 0xA4CF }, /*UBLOCK_YI_RADICALS=73*/
		{ innerHTML: _('Hangul'),				start: 0xAC00, end: 0xD7AF }, /*UBLOCK_HANGUL_SYLLABLES=74*/
		{ innerHTML: _('High Surrogates'),                      start: 0xD800, end: 0xDB7F }, /*UBLOCK_HIGH_SURROGATES =75*/
		{ innerHTML: _('High Private Use Surrogates'),          start: 0xDB80, end: 0xDBFF }, /*UBLOCK_HIGH_PRIVATE_USE_SURROGATES=76*/
		{ innerHTML: _('Low Surrogates'),                       start: 0xDC00, end: 0xDFFF }, /*UBLOCK_LOW_SURROGATES=77*/
		{ innerHTML: _('Private Use Area'),			start: 0xE000, end: 0xF8FF }, /*UBLOCK_PRIVATE_USE_AREA=78*/
		{ innerHTML: _('CJK Compatibility Ideographs'),		start: 0xF900, end: 0xFAFF }, /*UBLOCK_CJK_COMPATIBILITY_IDEOGRAPHS=79*/
		{ innerHTML: _('Alphabetic Presentation Forms'),	start: 0xFB00, end: 0xFB4F }, /*UBLOCK_ALPHABETIC_PRESENTATION_FORMS=80*/
		{ innerHTML: _('Arabic Presentation Forms-A'),		start: 0xFB50, end: 0xFDFF }, /*UBLOCK_ARABIC_PRESENTATION_FORMS_A=81*/
		{ innerHTML: _('Combining Half Marks'),			start: 0xFE20, end: 0xFE2F }, /*UBLOCK_COMBINING_HALF_MARKS=82*/
		{ innerHTML: _('CJK Compatibility Forms'),		start: 0xFE30, end: 0xFE4F }, /*UBLOCK_CJK_COMPATIBILITY_FORMS=83*/
		{ innerHTML: _('Small Form Variants'),			start: 0xFE50, end: 0xFE6F }, /*UBLOCK_SMALL_FORM_VARIANTS=84*/
		{ innerHTML: _('Arabic Presentation Forms-B'),		start: 0xFE70, end: 0xFEEE }, /*UBLOCK_ARABIC_PRESENTATION_FORMS_B=85*/
		{ innerHTML: _('Specials'),				start: 0xFEFF, end: 0xFEFF }, /*UBLOCK_SPECIALS=86*/
		{ innerHTML: _('Halfwidth and Fullwidth Forms'),	start: 0xFF00, end: 0xFFEF }, /*UBLOCK_HALFWIDTH_AND_FULLWIDTH_FORMS=87*/
		{ innerHTML: _('Old Italic'),				start: 0x10300, end: 0x1032F }, /*UBLOCK_OLD_ITALIC= 88*/
		{ innerHTML: _('Gothic'),				start: 0x10330, end: 0x1034F }, /*UBLOCK_GOTHIC=89*/
		{ innerHTML: _('Deseret'),				start: 0x10400, end: 0x1044F }, /*UBLOCK_DESERET=90*/
		{ innerHTML: _('Byzantine Musical Symbols'),		start: 0x1D000, end: 0x1D0FF }, /*UBLOCK_BYZANTINE_MUSICAL_SYMBOLS=91*/
		{ innerHTML: _('Musical Symbols'),			start: 0x1D100, end: 0x1D1FF }, /*UBLOCK_MUSICAL_SYMBOLS=92*/
		{ innerHTML: _('Musical Symbols'),			start: 0x1D400, end: 0x1D7FF }, /*UBLOCK_MATHEMATICAL_ALPHANUMERIC_SYMBOLS=93*/
		{ innerHTML: _('CJK Unified Ideographs Extension B'),	start: 0x20000, end: 0x2A6DF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B=94*/
		{ innerHTML: _('CJK Compatibility Ideographs Supplement'), start: 0x2F800, end: 0x2FA1F }, /*UBLOCK_CJK_COMPATIBILITY_IDEOGRAPHS_SUPPLEMENT=95*/
		{ innerHTML: _('Tags'),					start: 0xE0000, end: 0xE007F }, /*UBLOCK_TAGS=96*/
		{ innerHTML: _('Cyrillic Supplement'),			start: 0x0500, end: 0x052F }, /*UBLOCK_CYRILLIC_SUPPLEMENTARY=97*/
		{ innerHTML: _('Tagalog'),				start: 0x1700, end: 0x171F }, /*UBLOCK_TAGALOG=98*/
		{ innerHTML: _('Hanunoo'),				start: 0x1720, end: 0x173F }, /*UBLOCK_HANUNOO=99*/
		{ innerHTML: _('Buhid'),				start: 0x1740, end: 0x175F }, /*UBLOCK_BUHID=100*/
		{ innerHTML: _('Tagbanwa'),				start: 0x1760, end: 0x177F }, /*UBLOCK_TAGBANWA=101*/
		{ innerHTML: _('Miscellaneous Mathematical Symbols-A'),	start: 0x27C0, end: 0x27EF }, /*UBLOCK_MISCELLANEOUS_MATHEMATICAL_SYMBOLS_A=102*/
		{ innerHTML: _('Supplemental Arrows-A'),		start: 0x27F0, end: 0x27FF }, /*UBLOCK_SUPPLEMENTAL_ARROWS_A=103*/
		{ innerHTML: _('Supplemental Arrows-B'),		start: 0x2900, end: 0x297F }, /*UBLOCK_SUPPLEMENTAL_ARROWS_B=104*/
		{ innerHTML: _('Miscellaneous Mathematical Symbols-B'),	start: 0x2980, end: 0x29FF }, /*UBLOCK_MISCELLANEOUS_MATHEMATICAL_SYMBOLS_B=105*/
		{ innerHTML: _('Supplemental Mathematical Operators'),	start: 0x2A00, end: 0x2AFF }, /*UBLOCK_SUPPLEMENTAL_MATHEMATICAL_OPERATORS=106*/
		{ innerHTML: _('Katakana Phonetics Extensions'),	start: 0x31F0, end: 0x31FF }, /*UBLOCK_KATAKANA_PHONETIC_EXTENSIONS=107*/
		{ innerHTML: _('Variation Selectors'),			start: 0xFE00, end: 0xFE0F }, /*UBLOCK_VARIATION_SELECTORS=108*/
		{ innerHTML: _('Supplementary Private Use Area-A'),	start: 0xF0000, end: 0xFFFFF }, /*UBLOCK_SUPPLEMENTARY_PRIVATE_USE_AREA_A=109*/
		{ innerHTML: _('Supplementary Private Use Area-B'),	start: 0x100000, end: 0x10FFFF }, /*UBLOCK_SUPPLEMENTARY_PRIVATE_USE_AREA_B=110*/
		{ innerHTML: _('Limbu'),				start: 0x1900, end: 0x194F }, /*UBLOCK_LIMBU=111*/
		{ innerHTML: _('Tai Le'),				start: 0x1950, end: 0x197F }, /*UBLOCK_TAI_LE=112*/
		{ innerHTML: _('Khmer Symbols'),			start: 0x19E0, end: 0x19FF }, /*UBLOCK_KHMER_SYMBOLS=113*/
		{ innerHTML: _('Phonetic Extensions'),			start: 0x1D00, end: 0x1D7F }, /*UBLOCK_PHONETIC_EXTENSIONS=114*/
		{ innerHTML: _('Miscellaneous Symbols And Arrows'),	start: 0x2B00, end: 0x2BFF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS_AND_ARROWS=115*/
		{ innerHTML: _('Yijing Hexagram Symbols'),		start: 0x4DC0, end: 0x4DFF }, /*UBLOCK_YIJING_HEXAGRAM_SYMBOLS=116*/
		{ innerHTML: _('Linear B Syllabary'),			start: 0x10000, end: 0x1007F }, /*UBLOCK_LINEAR_B_SYLLABARY=117*/
		{ innerHTML: _('Linear B Ideograms'),			start: 0x10080, end: 0x100FF }, /*UBLOCK_LINEAR_B_IDEOGRAMS=118*/
		{ innerHTML: _('Aegean Numbers'),			start: 0x10100, end: 0x1013F }, /*UBLOCK_AEGEAN_NUMBERS=119*/
		{ innerHTML: _('Ugaritic'),				start: 0x10380, end: 0x1039F }, /*UBLOCK_UGARITIC=120*/
		{ innerHTML: _('Shavian'),				start: 0x10450, end: 0x1047F }, /*UBLOCK_SHAVIAN=121*/
		{ innerHTML: _('Osmanya'),				start: 0x10480, end: 0x104AF }, /*UBLOCK_OSMANYA=122*/
		{ innerHTML: _('Cypriot Syllabary'),			start: 0x10800, end: 0x1083F }, /*UBLOCK_CYPRIOT_SYLLABARY=123*/
		{ innerHTML: _('Tai Xuan Jing Symbols'),		start: 0x1D300, end: 0x1D35F }, /*UBLOCK_TAI_XUAN_JING_SYMBOLS=124*/
		{ innerHTML: _('Variation Selectors Supplement'),	start: 0xE0100, end: 0xE01EF }, /*UBLOCK_VARIATION_SELECTORS_SUPPLEMENT=125*/
		{ innerHTML: _('Ancient Greek Musical Notation'),	start: 0x1D200, end: 0x1D24F }, /*UBLOCK_ANCIENT_GREEK_MUSICAL_NOTATION=126*/
		{ innerHTML: _('Ancient Greek Numbers'),		start: 0x10140, end: 0x1018F }, /*UBLOCK_ANCIENT_GREEK_NUMBERS=127*/
		{ innerHTML: _('Arabic Supplement'),			start: 0x0750, end: 0x077F }, /*UBLOCK_ARABIC_SUPPLEMENT=128*/
		{ innerHTML: _('Buginese'),				start: 0x1A00, end: 0x1A1F }, /*UBLOCK_BUGINESE=129*/
		{ innerHTML: _('CJK Strokes'),				start: 0x31C0, end: 0x31EF }, /*UBLOCK_CJK_STROKES=130*/
		{ innerHTML: _('Combining Diacritical Marks Supplement'), start: 0x1DC0, end: 0x1DFF }, /*UBLOCK_COMBINING_DIACRITICAL_MARKS_SUPPLEMENT=131*/
		{ innerHTML: _('Coptic'),				start: 0x2C80, end: 0x2CFF }, /*UBLOCK_COPTIC=132*/
		{ innerHTML: _('Ethiopic Extended'),			start: 0x2D80, end: 0x2DDF }, /*UBLOCK_ETHIOPIC_EXTENDED=133*/
		{ innerHTML: _('Ethiopic Supplement'),			start: 0x1380, end: 0x139F }, /*UBLOCK_ETHIOPIC_SUPPLEMENT=134*/
		{ innerHTML: _('Georgian Supplement'),			start: 0x2D00, end: 0x2D2F }, /*UBLOCK_GEORGIAN_SUPPLEMENT=135*/
		{ innerHTML: _('Glagolitic'),				start: 0x2C00, end: 0x2C5F }, /*UBLOCK_GLAGOLITIC=136*/
		{ innerHTML: _('Kharoshthi'),				start: 0x10A00, end: 0x10A5F }, /*UBLOCK_KHAROSHTHI=137*/
		{ innerHTML: _('Modifier Tone Letters'),		start: 0xA700, end: 0xA71F }, /*UBLOCK_MODIFIER_TONE_LETTERS=138*/
		{ innerHTML: _('"New Tai Lue'),				start: 0x1980, end: 0x19DF }, /*UBLOCK_NEW_TAI_LUE=139*/
		{ innerHTML: _('Old Persian'),				start: 0x103A0, end: 0x103DF }, /*UBLOCK_OLD_PERSIAN=140*/
		{ innerHTML: _('Phonetic Extensions Supplement'),	start: 0x1D80, end: 0x1DBF }, /*UBLOCK_PHONETIC_EXTENSIONS_SUPPLEMENT=141*/
		{ innerHTML: _('Supplemental Punctuation'),		start: 0x2E00, end: 0x2E7F }, /*UBLOCK_SUPPLEMENTAL_PUNCTUATION=142*/
		{ innerHTML: _('Syloti Nagri'),				start: 0xA800, end: 0xA82F }, /*UBLOCK_SYLOTI_NAGRI=143*/
		{ innerHTML: _('Tifinagh'),				start: 0x2D30, end: 0x2D7F }, /*UBLOCK_TIFINAGH=144*/
		{ innerHTML: _('Vertical Forms'),			start: 0xFE10, end: 0xFE1F }, /*UBLOCK_VERTICAL_FORMS=145*/
		{ innerHTML: _('Nko'),					start: 0x07C0, end: 0x07FF }, /*UBLOCK_NKO=146*/
		{ innerHTML: _('Balinese'),				start: 0x1B00, end: 0x1B7F }, /*UBLOCK_BALINESE=147*/
		{ innerHTML: _('Latin Extended-C'),			start: 0x2C60, end: 0x2C7F }, /*UBLOCK_LATIN_EXTENDED_C=148*/
		{ innerHTML: _('Latin Extended-D'),			start: 0xA720, end: 0xA7FF }, /*UBLOCK_LATIN_EXTENDED_D=149*/
		{ innerHTML: _('Phags-Pa'),				start: 0xA840, end: 0xA87F }, /*UBLOCK_PHAGS_PA=150*/
		{ innerHTML: _('Phoenician'),				start: 0x10900, end: 0x1091F }, /*UBLOCK_PHOENICIAN=151*/
		{ innerHTML: _('Cuneiform'),				start: 0x12000, end: 0x123FF }, /*UBLOCK_CUNEIFORM=152*/
		{ innerHTML: _('Cuneiform Numbers And Punctuation'),	start: 0x12400, end: 0x1247F }, /*UBLOCK_CUNEIFORM_NUMBERS_AND_PUNCTUATION=153*/
		{ innerHTML: _('Counting Rod Numerals'),		start: 0x1D360, end: 0x1D37F }, /*UBLOCK_COUNTING_ROD_NUMERALS=154*/
		{ innerHTML: _('Sundanese'),				start: 0x1B80, end: 0x1BBF }, /*UBLOCK_SUNDANESE=155*/
		{ innerHTML: _('Lepcha'),				start: 0x1C00, end: 0x1C4F }, /*UBLOCK_LEPCHA=156*/
		{ innerHTML: _('Ol Chiki'),				start: 0x1C50, end: 0x1C7F }, /*UBLOCK_OL_CHIKI=157*/
		{ innerHTML: _('Cyrillic Extended-A'),			start: 0x2DE0, end: 0x2DFF }, /*UBLOCK_CYRILLIC_EXTENDED_A=158*/
		{ innerHTML: _('Vai'),					start: 0xA500, end: 0xA63F }, /*UBLOCK_VAI=159*/
		{ innerHTML: _('Cyrillic Extended-B'),			start: 0xA640, end: 0xA69F }, /*UBLOCK_CYRILLIC_EXTENDED_B=160*/
		{ innerHTML: _('Saurashtra'),				start: 0xA880, end: 0xA8DF }, /*UBLOCK_SAURASHTRA=161*/
		{ innerHTML: _('Kayah Li'),				start: 0xA900, end: 0xA92F }, /*UBLOCK_KAYAH_LI=162*/
		{ innerHTML: _('Rejang'),				start: 0xA930, end: 0xA95F }, /*UBLOCK_REJANG=163*/
		{ innerHTML: _('Cham'),					start: 0xAA00, end: 0xAA5F }, /*UBLOCK_CHAM=164*/
		{ innerHTML: _('Ancient Symbols'),			start: 0x10190, end: 0x101CF }, /*UBLOCK_ANCIENT_SYMBOLS=165*/
		{ innerHTML: _('Phaistos Disc'),			start: 0x101D0, end: 0x101FF }, /*UBLOCK_PHAISTOS_DISC=166*/
		{ innerHTML: _('Lycian'),				start: 0x10280, end: 0x1029F }, /*UBLOCK_LYCIAN=167*/
		{ innerHTML: _('Carian'),				start: 0x102A0, end: 0x102DF }, /*UBLOCK_CARIAN=168*/
		{ innerHTML: _('Lydian'),				start: 0x10920, end: 0x1093F }, /*UBLOCK_LYDIAN=169*/
		{ innerHTML: _('Mahjong Tiles'),			start: 0x1F000, end: 0x1F02F }, /*UBLOCK_MAHJONG_TILES=170*/
		{ innerHTML: _('Domino Tiles'),				start: 0x1F030, end: 0x1F09F }, /*UBLOCK_DOMINO_TILES=171*/
		{ innerHTML: _('Samaritan'),				start: 0x0800, end: 0x083F }, /*UBLOCK_SAMARITAN=172*/
		{ innerHTML: _('Canadian Aboriginal Syllabics Extended'), start: 0x18B0, end: 0x18FF }, /*UBLOCK_UNIFIED_CANADIAN_ABORIGINAL_SYLLABICS_EXTENDED=173*/
		{ innerHTML: _('Tai Tham'),				start: 0x1A20, end: 0x1AAF }, /*UBLOCK_TAI_THAM=174*/
		{ innerHTML: _('Vedic Extensions'),			start: 0x1CD0, end: 0x1CFF }, /*UBLOCK_VEDIC_EXTENSIONS=175*/
		{ innerHTML: _('Lisu'),					start: 0xA4D0, end: 0xA4FF }, /*UBLOCK_LISU=176*/
		{ innerHTML: _('Bamum'),				start: 0xA6A0, end: 0xA6FF }, /*UBLOCK_BAMUM=177*/
		{ innerHTML: _('Common Indic Number Forms'),		start: 0xA830, end: 0xA83F }, /*UBLOCK_COMMON_INDIC_NUMBER_FORMS=178*/
		{ innerHTML: _('Devanagari Extended'),			start: 0xA8E0, end: 0xA8FF }, /*UBLOCK_DEVANAGARI_EXTENDED=179*/
		{ innerHTML: _('Hangul Jamo Extended-A'),		start: 0xA960, end: 0xA97F }, /*UBLOCK_HANGUL_JAMO_EXTENDED_A=180*/
		{ innerHTML: _('Javanese'),				start: 0xA980, end: 0xA9DF }, /*UBLOCK_JAVANESE=181*/
		{ innerHTML: _('Myanmar Extended-A'),			start: 0xAA60, end: 0xAA7F }, /*UBLOCK_MYANMAR_EXTENDED_A=182*/
		{ innerHTML: _('Tai Viet'),				start: 0xAA80, end: 0xAADF }, /*UBLOCK_TAI_VIET=183*/
		{ innerHTML: _('Meetei Mayek'),				start: 0xABC0, end: 0xABFF }, /*UBLOCK_MEETEI_MAYEK=184*/
		{ innerHTML: _('Hangul Jamo Extended-B'),		start: 0xD7B0, end: 0xD7FF }, /*UBLOCK_HANGUL_JAMO_EXTENDED_B=185*/
		{ innerHTML: _('Imperial Aramaic'),			start: 0x10840, end: 0x1085F }, /*UBLOCK_IMPERIAL_ARAMAIC=186*/
		{ innerHTML: _('Old South Arabian'),			start: 0x10A60, end: 0x10A7F }, /*UBLOCK_OLD_SOUTH_ARABIAN=187*/
		{ innerHTML: _('Avestan'),				start: 0x10B00, end: 0x10B3F }, /*UBLOCK_AVESTAN=188*/
		{ innerHTML: _('Inscriptional Parthian'),		start: 0x10B40, end: 0x10B5F }, /*UBLOCK_INSCRIPTIONAL_PARTHIAN=189*/
		{ innerHTML: _('Inscriptional Pahlavi'),		start: 0x10B60, end: 0x10B7F }, /*UBLOCK_INSCRIPTIONAL_PAHLAVI=190*/
		{ innerHTML: _('Old Turkic'),				start: 0x10C00, end: 0x10C4F }, /*UBLOCK_OLD_TURKIC=191*/
		{ innerHTML: _('Rumi Numeral Symbols'),			start: 0x10E60, end: 0x10E7F }, /*UBLOCK_RUMI_NUMERAL_SYMBOLS=192*/
		{ innerHTML: _('Kaithi'),				start: 0x11080, end: 0x110CF }, /*UBLOCK_KAITHI=193*/
		{ innerHTML: _('Egyptian Hieroglyphs'),			start: 0x13000, end: 0x1342F }, /*UBLOCK_EGYPTIAN_HIEROGLYPHS=194*/
		{ innerHTML: _('Enclosed Alphanumeric Supplement'),	start: 0x1F100, end: 0x1F1FF }, /*UBLOCK_ENCLOSED_ALPHANUMERIC_SUPPLEMENT=195*/
		{ innerHTML: _('Enclosed Ideographic Supplement'),	start: 0x1F200, end: 0x1F2FF }, /*UBLOCK_ENCLOSED_IDEOGRAPHIC_SUPPLEMENT=196*/
		{ innerHTML: _('CJK Unified Ideographs Extension C'),	start: 0x2A700, end: 0x2B73F }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_C=197*/
		{ innerHTML: _('Mandaic'),				start: 0x0840, end: 0x085F }, /*UBLOCK_MANDAIC=198*/
		{ innerHTML: _('Batak'),				start: 0x1BC0, end: 0x1BFF }, /*UBLOCK_BATAK=199*/
		{ innerHTML: _('Ethiopic Extended-A'),			start: 0xAB00, end: 0xAB2F }, /*UBLOCK_ETHIOPIC_EXTENDED_A=200*/
		{ innerHTML: _('Brahmi'),				start: 0x11000, end: 0x1107F }, /*UBLOCK_BRAHMI=201*/
		{ innerHTML: _('Bamum Supplement'),			start: 0x16800, end: 0x16A3F }, /*UBLOCK_BAMUM_SUPPLEMENT=202*/
		{ innerHTML: _('Kana Supplement'),			start: 0x1B000, end: 0x1B0FF }, /*UBLOCK_KANA_SUPPLEMENT=203*/
		{ innerHTML: _('Playing Cards'),			start: 0x1F0A0, end: 0x1F0FF }, /*UBLOCK_PLAYING_CARDS=204*/
		{ innerHTML: _('Miscellaneous Symbols And Pictographs'), start: 0x1F300, end: 0x1F5FF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS_AND_PICTOGRAPHS=205*/
		{ innerHTML: _('Emoticons'),				start: 0x1F600, end: 0x1F64F }, /*UBLOCK_EMOTICONS=206*/
		{ innerHTML: _('Transport And Map Symbols'),		start: 0x1F680, end: 0x1F6FF }, /*UBLOCK_TRANSPORT_AND_MAP_SYMBOLS=207*/
		{ innerHTML: _('Alchemical Symbols'),			start: 0x1F700, end: 0x1F77F }, /*UBLOCK_ALCHEMICAL_SYMBOLS=208*/
		{ innerHTML: _('CJK Unified Ideographs Extension D'),	start: 0x2B740, end: 0x2B81F }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_D=209*/
		{ innerHTML: _('Arabic Extended-A'),			start: 0x08A0, end: 0x08FF }, /*UBLOCK_ARABIC_EXTENDED_A=210*/
		{ innerHTML: _('Arabic Mathematical Alphabetic Symbols'), start: 0x1EE00, end: 0x1EEFF }, /*UBLOCK_ARABIC_MATHEMATICAL_ALPHABETIC_SYMBOLS=211*/
		{ innerHTML: _('Chakma'),				start: 0x11100, end: 0x1114F }, /*UBLOCK_CHAKMA=212*/
		{ innerHTML: _('Meetei Mayek Extensions'),		start: 0xAAE0, end: 0xAAFF }, /*UBLOCK_MEETEI_MAYEK_EXTENSIONS=213*/
		{ innerHTML: _('Meroitic Cursive'),			start: 0x109A0, end: 0x109FF }, /*UBLOCK_MEROITIC_CURSIVE=214*/
		{ innerHTML: _('Meroitic Hieroglyphs'),			start: 0x10980, end: 0x1099F }, /*UBLOCK_MEROITIC_HIEROGLYPHS=215*/
		{ innerHTML: _('Miao'),					start: 0x16F00, end: 0x16F9F }, /*UBLOCK_MIAO=216*/
		{ innerHTML: _('Sharada'),				start: 0x11180, end: 0x111DF }, /*UBLOCK_SHARADA=217*/
		{ innerHTML: _('Sora Sompeng'),				start: 0x110D0, end: 0x110FF }, /*UBLOCK_SORA_SOMPENG=218*/
		{ innerHTML: _('Sundanese Supplement'),			start: 0x1CC0, end: 0x1CCF }, /*UBLOCK_SUNDANESE_SUPPLEMENT=219*/
		{ innerHTML: _('Takri'),				start: 0x11680, end: 0x116CF }, /*UBLOCK_TAKRI=220*/
		{ innerHTML: _('Bassa Vah'),				start: 0x16AD0, end: 0x16AFF }, /*UBLOCK_BASSA_VAH=221*/
		{ innerHTML: _('Caucasian Albanian'),			start: 0x10530, end: 0x1056F }, /*UBLOCK_CAUCASIAN_ALBANIAN=222*/
		{ innerHTML: _('Coptic Epact Numbers'),			start: 0x102E0, end: 0x102FF }, /*UBLOCK_COPTIC_EPACT_NUMBERS=223*/
		{ innerHTML: _('Combining Diacritical Marks Extended'),	start: 0x1AB0, end: 0x1AFF }, /*UBLOCK_COMBINING_DIACRITICAL_MARKS_EXTENDED=224*/
		{ innerHTML: _('Duployan'),				start: 0x1BC00, end: 0x1BC9F }, /*UBLOCK_DUPLOYAN=225*/
		{ innerHTML: _('Elbasan'),				start: 0x10500, end: 0x1052F }, /*UBLOCK_ELBASAN=226*/
		{ innerHTML: _('Geometric Shapes Extended'),		start: 0x1F780, end: 0x1F7FF }, /*UBLOCK_GEOMETRIC_SHAPES_EXTENDED=227*/
		{ innerHTML: _('Grantha'),				start: 0x11300, end: 0x1137F }, /*UBLOCK_GRANTHA=228*/
		{ innerHTML: _('Khojki'),				start: 0x11200, end: 0x1124F }, /*UBLOCK_KHOJKI=229*/
		{ innerHTML: _('Khudawadi'),				start: 0x112B0, end: 0x112FF }, /*UBLOCK_KHUDAWADI=230*/
		{ innerHTML: _('Latin Extended-E'),			start: 0xAB30, end: 0xAB6F }, /*UBLOCK_LATIN_EXTENDED_E=231*/
		{ innerHTML: _('Linear A'),				start: 0x10600, end: 0x1077F }, /*UBLOCK_LINEAR_A=232*/
		{ innerHTML: _('Mahajani'),				start: 0x11150, end: 0x1117F }, /*UBLOCK_MAHAJANI=233*/
		{ innerHTML: _('Manichaean'),				start: 0x10AC0, end: 0x10AFF }, /*UBLOCK_MANICHAEAN=234*/
		{ innerHTML: _('Mende Kikakui'),			start: 0x1E800, end: 0x1E8DF }, /*UBLOCK_MENDE_KIKAKUI=235*/
		{ innerHTML: _('Modi'),					start: 0x11600, end: 0x1165F }, /*UBLOCK_MODI=236*/
		{ innerHTML: _('Mro'),					start: 0x16A40, end: 0x16A6F }, /*UBLOCK_MRO=237*/
		{ innerHTML: _('Myanmar Extended-B'),			start: 0xA9E0, end: 0xA9FF }, /*UBLOCK_MYANMAR_EXTENDED_B=238*/
		{ innerHTML: _('Nabataean'),				start: 0x10880, end: 0x108AF }, /*UBLOCK_NABATAEAN=239*/
		{ innerHTML: _('Old North Arabian'),			start: 0x10A80, end: 0x10A9F }, /*UBLOCK_OLD_NORTH_ARABIAN=240*/
		{ innerHTML: _('Old Permic'),				start: 0x10350, end: 0x1037F }, /*UBLOCK_OLD_PERMIC=241*/
		{ innerHTML: _('Ornamental Dingbats'),			start: 0x1F650, end: 0x1F67F }, /*UBLOCK_ORNAMENTAL_DINGBATS=242*/
		{ innerHTML: _('Pahawh Hmong'),				start: 0x16B00, end: 0x16B8F }, /*UBLOCK_PAHAWH_HMONG=243*/
		{ innerHTML: _('Palmyrene'),				start: 0x10860, end: 0x1087F }, /*UBLOCK_PALMYRENE=244*/
		{ innerHTML: _('Pau Cin Hau'),				start: 0x11AC0, end: 0x11AFF }, /*UBLOCK_PAU_CIN_HAU=245*/
		{ innerHTML: _('Psalter Pahlavi'),			start: 0x10B80, end: 0x10BAF }, /*UBLOCK_PSALTER_PAHLAVI=246*/
		{ innerHTML: _('Shorthand Format Controls'),		start: 0x1BCA0, end: 0x1BCAF }, /*UBLOCK_SHORTHAND_FORMAT_CONTROLS=247*/
		{ innerHTML: _('Siddham'),				start: 0x11580, end: 0x115FF }, /*UBLOCK_SIDDHAM=248*/
		{ innerHTML: _('Sinhala Archaic Numbers'),		start: 0x111E0, end: 0x111FF }, /*UBLOCK_SINHALA_ARCHAIC_NUMBERS=249*/
		{ innerHTML: _('Supplemental Arrows-C'),		start: 0x1F800, end: 0x1F8FF }, /*UBLOCK_SUPPLEMENTAL_ARROWS_C=250*/
		{ innerHTML: _('Tirhuta'),				start: 0x11480, end: 0x114DF }, /*UBLOCK_TIRHUTA=251*/
		{ innerHTML: _('Warang Citi'),				start: 0x118A0, end: 0x118FF }, /*UBLOCK_WARANG_CITI=252*/
		{ innerHTML: _('Ahom'),					start: 0x11700, end: 0x1173F }, /*UBLOCK_AHOM=253*/
		{ innerHTML: _('Anatolian Hieroglyphs'),		start: 0x14400, end: 0x1467F }, /*UBLOCK_ANATOLIAN_HIEROGLYPHS=254*/
		{ innerHTML: _('Cherokee Supplement'),			start: 0xAB70, end: 0xABBF }, /*UBLOCK_CHEROKEE_SUPPLEMENT=255*/
		{ innerHTML: _('CJK Unified Ideographs Extension E'),	start: 0x2B820, end: 0x2CEAF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_E=256*/
		{ innerHTML: _('Early Dynastic Cuneiform'),		start: 0x12480, end: 0x1254F }, /*UBLOCK_EARLY_DYNASTIC_CUNEIFORM=257*/
		{ innerHTML: _('Hatran'),				start: 0x108E0, end: 0x108FF }, /*UBLOCK_HATRAN=258*/
		{ innerHTML: _('Multani'),				start: 0x11280, end: 0x112AF }, /*UBLOCK_MULTANI=259*/
		{ innerHTML: _('Old Hungarian'),			start: 0x10C80, end: 0x10CFF }, /*UBLOCK_OLD_HUNGARIAN=260*/
		{ innerHTML: _('Supplemental Symbols And Pictographs'),	start: 0x1F900, end: 0x1F9FF }, /*UBLOCK_SUPPLEMENTAL_SYMBOLS_AND_PICTOGRAPHS=261*/
		{ innerHTML: _('Sutton Signwriting'),			start: 0x1D800, end: 0x1DAAF }, /*UBLOCK_SUTTON_SIGNWRITING=262*/
	],

	fillCharacters: function (index) {
		var start = this.unicodeCharts[index].start;
		var end = this.unicodeCharts[index].end;
		var it = 0;
		var tr, td;
		L.DomUtil.empty(this._tbody);
		while (start <= end) {
			if (it % 20 === 0) {
				tr = L.DomUtil.create('tr', '', this._tbody);
			}
			td = L.DomUtil.create('td', '', tr);
			td.innerHTML = '&#x' + start.toString(16);
			td.data = start;
			L.DomEvent.on(td, 'click', this._onSymbolClick, this);
			start++;
			it++;
		}
	},

	fillDropDown: function(element, list, selectedIndex) {
		for (var iterator = 0, len = list.length, option; iterator < len; iterator++) {
			option = document.createElement('option');
			option.innerHTML = list[iterator].innerHTML;
			element.appendChild(option);
		}
		element.selectedIndex = selectedIndex;
	},

	fillFontNames: function (fontList, selectedIndex) {
		this.fillDropDown(this._fontNames, fontList, selectedIndex);
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._initLayout();

		map.on('renderfont', this._onRenderFontPreview, this);
		return this._container;
	},

	onRemove: function (map) {
		map.off('renderfont', this._onRenderFontPreview, this);
	},


	show: function () {
		this._tbody.setAttribute('style', 'max-height:' + this._map.getSize().y / 2 + 'px');
		this._container.style.visibility = '';
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';
		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseClick, this);
		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + _('Special Characters') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		this._unicodeChart = L.DomUtil.create('select', 'loleaflet-controls', content);
		L.DomEvent.on(this._unicodeChart, 'change', this._onUnicodeChartChange, this);
		content.appendChild(document.createElement('br'));
		var table = L.DomUtil.create('table', 'loleaflet-character', content);
		this._tbody = L.DomUtil.create('tbody', '', table);
		content.appendChild(document.createElement('br'));
		var label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Font Name:') + '</b>';
		this._fontNames = L.DomUtil.create('select', 'loleaflet-controls', content);
		L.DomEvent.on(this._fontNames, 'change', this._onFontNamesChange, this);
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Hexadecimal:') + '</b>';
		this._hexa = L.DomUtil.create('span', 'loleaflet-controls', content);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Preview:') + '</b>';
		this._preview = L.DomUtil.create('img', '', content);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var button = L.DomUtil.create('input', 'loleaflet-controls', content);
		button.type = 'button';
		button.value = _('Insert');
		L.DomEvent.on(button, 'click', this._onInsertClick, this);
		button = L.DomUtil.create('input', 'loleaflet-controls', content);
		button.type = 'button';
		button.value = _('Cancel');
		L.DomEvent.on(button, 'click', this._onCancelClick, this);
		this.fillDropDown(this._unicodeChart, this.unicodeCharts, 0);
		this.fillCharacters(this._unicodeChart.selectedIndex);
	},

	_onCancelClick: function (e) {
		this._onCloseClick(e);
	},

	_onCloseClick: function (e) {
		this._map.enable(true);
		this._refocusOnMap();
		this.remove();
	},

	_onFontNamesChange: function (e) {
		if (this._hexa.data) {
			this._map._socket.sendMessage('renderfont font=' +
				window.encodeURIComponent(this._fontNames.options[this._fontNames.selectedIndex].value) +
				' char=' + String.fromCharCode(this._hexa.data));
		}
	},

	_onInsertClick: function (e) {
		if (this._hexa.data) {
			var command = {
				Symbols: {
					type: 'string',
					value: String.fromCharCode(this._hexa.data)
				},
				FontName: {
					type: 'string',
					value: this._fontNames.options[this._fontNames.selectedIndex].value
				}
			};
			this._map.sendUnoCommand('.uno:InsertSymbol', command);
			this._onCloseClick(e);
		}
	},

	_onRenderFontPreview: function (e) {
		this._preview.src = e.img;
	},

	_onSymbolClick: function (e) {
		var target = e.target || e.srcElement;
		this._hexa.data = target.data;
		this._hexa.innerHTML = 'U+' + target.data.toString(16).toUpperCase();
		this._map._socket.sendMessage('renderfont font=' +
			window.encodeURIComponent(this._fontNames.options[this._fontNames.selectedIndex].value) +
			' char=' + String.fromCharCode(this._hexa.data));
	},

	_onUnicodeChartChange: function (e) {
		var target = e.target || e.srcElement;
		this.fillCharacters(target.selectedIndex);
	}
});

L.control.characterMap = function (options) {
	return new L.Control.CharacterMap(options);
};
