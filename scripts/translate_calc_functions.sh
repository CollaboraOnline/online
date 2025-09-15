#!/bin/bash
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -euo pipefail

source=https://raw.githubusercontent.com/LibreOffice/translations/refs/heads/master/source
script_exec_dir="$LOCOREPATH/workdir/function_translations"
source_translation_files_dir="${script_exec_dir}/source"
generated_translation_files_dir="${script_exec_dir}/generated"

files=(
    "sc/messages.po"
    "scaddins/messages.po"
    "formula/messages.po"
)

languages=(
    "de"
    "fr"
    "es"
)

financialFunctions=(
    'ACCRINT'
    'ACCRINTM'
    'AMORDEGRC'
    'AMORLINC'
    'COUPDAYBS'
    'COUPDAYS'
    'COUPDAYSNC'
    'COUPNUM'
    'COUPPCD'
    'CUMIPMT'
    'CUMIPMT_ADD'
    'CUMPRINC'
    'CUMPRINC_ADD'
    'DB'
    'DDB'
    'DISC'
    'DOLLARDE'
    'DOLLARFR'
    'DURATION'
    'EFFECT'
    'EFFECT_ADD'
    'FV'
    'FVSCHEDULE'
    'INTRATE'
    'IPMT'
    'IRR'
    'ISPMT'
    'MDURATION'
    'MIRR'
    'NOMINAL'
    'NOMINAL_ADD'
    'NPER'
    'NPV'
    'ODDFPRICE'
    'ODDFYIELD'
    'ODDLPRICE'
    'ODDLYIELD'
    'OPT_BARRIER'
    'OPT_PROB_HIT'
    'OPT_PROB_INMONEY'
    'OPT_TOUCH'
    'PDURATION'
    'PMT'
    'PPMT'
    'PRICE'
    'PRICEDISC'
    'PRICEMAT'
    'PV'
    'RATE'
    'RECEIVED'
    'RRI'
    'SLN'
    'SYD'
    'TBILLEQ'
    'TBILLPRICE'
    'TBILLYIELD'
    'XIRR'
    'XNPV'
    'YIELD'
    'YIELDDISC'
    'YIELDMAT'
)

logicalFunctions=(
    'AND'
    'FALSE'
    'IF'
    'IFERROR'
    'IFNA'
    'IFS'
    'NOT'
    'OR'
    'SWITCH'
    'TRUE'
    'XOR'
)

textFunctions=(
    'ARABIC'
    'ASC'
    'BAHTTEXT'
    'BASE'
    'CHAR'
    'CLEAN'
    'CODE'
    'CONCAT'
    'CONCATENATE'
    'DECIMAL'
    'DOLLAR'
    'ENCODEURL'
    'FILTERXML'
    'FIND'
    'FINDB'
    'FIXED'
    'JIS'
    'LEFT'
    'LEFTB'
    'LEN'
    'LENB'
    'LOWER'
    'MID'
    'MIDB'
    'NUMBERVALUE'
    'PROPER'
    'REGEX'
    'REPLACE'
    'REPLACEB'
    'REPT'
    'RIGHT'
    'RIGHTB'
    'ROMAN'
    'ROT13'
    'SEARCH'
    'SEARCHB'
    'SUBSTITUTE'
    'T'
    'TEXT'
    'TEXTJOIN'
    'TRIM'
    'UNICHAR'
    'UNICODE'
    'UPPER'
    'VALUE'
    'WEBSERVICE'
)

dateAndTimeFunctions=(
    'DATE'
    'DATEDIF'
    'DATEVALUE'
    'DAY'
    'DAYS'
    'DAYS360'
    'DAYSINMONTH'
    'DAYSINYEAR'
    'EASTERSUNDAY'
    'EDATE'
    'EOMONTH'
    'HOUR'
    'ISLEAPYEAR'
    'ISOWEEKNUM'
    'MINUTE'
    'MONTH'
    'MONTHS'
    'NETWORKDAYS'
    'NETWORKDAYS.INTL'
    'NOW'
    'SECOND'
    'TIME'
    'TIMEVALUE'
    'TODAY'
    'WEEKDAY'
    'WEEKNUM'
    'WEEKNUM_EXCEL2003'
    'WEEKNUM_OOO'
    'WEEKS'
    'WEEKSINYEAR'
    'WORKDAY'
    'WORKDAY.INTL'
    'YEAR'
    'YEARFRAC'
    'YEARS'
)

lookupFunctions=(
    'HLOOKUP'
    'LOOKUP'
    'VLOOKUP'
    'XLOOKUP'
)

refFunctions=(
    'ISREF'
)

mathAndTrigFunctions=(
    'ABS'
    'ACOS'
    'ACOSH'
    'ACOT'
    'ACOTH'
    'AGGREGATE'
    'ASIN'
    'ASINH'
    'ATAN'
    'ATAN2'
    'ATANH'
    'BITAND'
    'BITLSHIFT'
    'BITOR'
    'BITRSHIFT'
    'BITXOR'
    'CEILING'
    'CEILING.MATH'
    'CEILING.PRECISE'
    'CEILING.XCL'
    'COLOR'
    'COMBIN'
    'COMBINA'
    'CONVERT_OOO'
    'COS'
    'COSH'
    'COT'
    'COTH'
    'CSC'
    'CSCH'
    'DEGREES'
    'EUROCONVERT'
    'EVEN'
    'EXP'
    'FACT'
    'FLOOR'
    'FLOOR.MATH'
    'FLOOR.PRECISE'
    'FLOOR.XCL'
    'GCD'
    'GCD_EXCEL2003'
    'INT'
    'ISO.CEILING'
    'LCM'
    'LCM_EXCEL2003'
    'LN'
    'LOG'
    'LOG10'
    'MOD'
    'MROUND'
    'MULTINOMIAL'
    'ODD'
    'PI'
    'POWER'
    'PRODUCT'
    'QUOTIENT'
    'RADIANS'
    'RAND'
    'RAND.NV'
    'RANDARRAY'
    'RANDBETWEEN'
    'RANDBETWEEN.NV'
    'ROUND'
    'ROUNDDOWN'
    'ROUNDSIG'
    'ROUNDUP'
    'SEC'
    'SECH'
    'SERIESSUM'
    'SIGN'
    'SIN'
    'SINH'
    'SQRT'
    'SQRTPI'
    'SUBTOTAL'
    'SUM'
    'SUMIF'
    'SUMIFS'
    'SUMSQ'
    'TAN'
    'TANH'
    'TRUNC'
)

statisticalFunctions=(
    'AVEDEV'
    'AVERAGE'
    'AVERAGEA'
    'AVERAGEIF'
    'AVERAGEIFS'
    'B'
    'BETA.DIST'
    'BETA.INV'
    'BETADIST'
    'BETAINV'
    'BINOM.DIST'
    'BINOM.INV'
    'BINOMDIST'
    'CHIDIST'
    'CHIINV'
    'CHISQ.DIST'
    'CHISQ.DIST.RT'
    'CHISQ.INV'
    'CHISQ.INV.RT'
    'CHISQ.TEST'
    'CHISQDIST'
    'CHISQINV'
    'CHITEST'
    'CONFIDENCE'
    'CONFIDENCE.NORM'
    'CONFIDENCE.T'
    'CORREL'
    'COUNT'
    'COUNTA'
    'COUNTBLANK'
    'COUNTIF'
    'COUNTIFS'
    'COVAR'
    'COVARIANCE.P'
    'COVARIANCE.S'
    'CRITBINOM'
    'DEVSQ'
    'ERF.PRECISE'
    'ERFC.PRECISE'
    'EXPON.DIST'
    'EXPONDIST'
    'F.DIST'
    'F.DIST.RT'
    'F.INV'
    'F.INV.RT'
    'F.TEST'
    'F.DIST'
    'F.INV'
    'FISHER'
    'FISHERINV'
    'FORECAST'
    'FORECAST.ETS.ADD'
    'FORECAST.ETS.MULT'
    'FORECAST.ETS.PI.ADD'
    'FORECAST.ETS.PI.MULT'
    'FORECAST.ETS.SEASONALITY'
    'FORECAST.ETS.STAT.ADD'
    'FORECAST.ETS.STAT.MULT'
    'FORECAST.LINEAR'
    'FTEST'
    'GAMMA'
    'GAMMA.DIST'
    'GAMMA.INV'
    'GAMMADIST'
    'GAMMAINV'
    'GAMMALN'
    'GAMMALN.PRECISE'
    'GAUSS'
    'GEOMEAN'
    'HARMEAN'
    'HYPGEOM.DIST'
    'HYPGEOMDIST'
    'INTERCEPT'
    'KURT'
    'LARGE'
    'LOGINV'
    'LOGNORM.DIST'
    'LOGNORM.INV'
    'LOGNORMDIST'
    'MAX'
    'MAXA'
    'MAXIFS'
    'MEDIAN'
    'MIN'
    'MINA'
    'MINIFS'
    'MODE'
    'MODE.SNGL'
    'NEGBINOM.DIST'
    'NEGBINOMDIST'
    'NORMSDIST'
    'NORM.DIST'
    'NORMSDIST'
    'NORMSINV'
    'NORM.INV'
    'NORMSINV'
    'NORM.S.DIST'
    'NORM.S.INV'
    'NORMDIST'
    'NORMINV'
    'NORMSDIST'
    'NORMSINV'
    'PEARSON'
    'PERCENTILE'
    'PERCENTILE.EXC'
    'PERCENTILE.INC'
    'PERCENTRANK'
    'PERCENTRANK.EXC'
    'PERCENTRANK.INC'
    'PERMUT'
    'PERMUTATIONA'
    'PHI'
    'PROB'
    'QUARTILE'
    'QUARTILE.EXC'
    'QUARTILE.INC'
    'RANK'
    'RANK.AVG'
    'RANK.EQ'
    'RSQ'
    'SKEW'
    'SKEWP'
    'SLOPE'
    'SMALL'
    'STANDARDIZE'
    'STDEV'
    'STDEV.P'
    'STDEV.S'
    'STDEVA'
    'STDEVP'
    'STDEVPA'
    'STEYX'
    'T.DIST'
    'T.DIST.2T'
    'T.DIST.RT'
    'T.INV'
    'T.INV.2T'
    'T.TEST'
    'TDIST'
    'TINV'
    'TRIMMEAN'
    'TTEST'
    'VAR'
    'VAR.P'
    'VAR.S'
    'VARA'
    'VARP'
    'VARPA'
    'WEIBULL'
    'WEIBULL.DIST'
    'Z.TEST'
    'ZTEST'
)

databaseFunctions=(
    'DAVERAGE'
    'DCOUNT'
    'DCOUNTA'
    'DGET'
    'DMAX'
    'DMIN'
    'DPRODUCT'
    'DSTDEV'
    'DSUM'
    'DVAR'
    'DVARP'
)

informationFunctions=(
    'CELL'
    'CURRENT'
    'FORMULA'
    'INFO'
    'ISBLANK'
    'ISERR'
    'ISERROR'
    'ISEVEN'
    'ISEVEN_ADD'
    'ISFORMULA'
    'ISLOGICAL'
    'ISNA'
    'ISNONTEXT'
    'ISNUMBER'
    'ISODD'
    'ISODD_ADD'
    'ISTEXT'
    'N'
    'NA'
    'TYPE'
)

arrayFunctions=(
    'FOURIER'
    'FREQUENCY'
    'GROWTH'
    'LINEST'
    'LOGEST'
    'MDETERM'
    'MINVERSE'
    'MMULT'
    'MUNIT'
    'SEQUENCE'
    'SUMPRODUCT'
    'SUMX2MY2'
    'SUMX2PY2'
    'SUMXMY2'
    'TRANSPOSE'
    'TREND'
)

spreadsheetFunctions=(
    'ADDRESS'
    'AREAS'
    'CHOOSE'
    'COLUMN'
    'COLUMNS'
    'DDE'
    'ERROR.TYPE'
    'ERRORTYPE'
    'FILTER'
    'GETPIVOTDATA'
    'HYPERLINK'
    'INDEX'
    'INDIRECT'
    'LET'
    'MATCH'
    'OFFSET'
    'ROW'
    'ROWS'
    'SHEET'
    'SHEETS'
    'SORT'
    'SORTBY'
    'STYLE'
    'UNIQUE'
)

function_categories=(
    financialFunctions
    logicalFunctions
    textFunctions
    dateAndTimeFunctions
    lookupFunctions
    refFunctions
    mathAndTrigFunctions
    statisticalFunctions
    databaseFunctions
    informationFunctions
    arrayFunctions
    spreadsheetFunctions
)

# curl translation files from core
for language in "${languages[@]}"; do
    for file in "${files[@]}"; do
        translation_file="$source_translation_files_dir/$language/$file"
        if ! [ -f "$translation_file" ]; then
            mkdir -p "$(dirname "$translation_file")"
            curl -L "$source/$language/$file" -o "$translation_file"
        fi
    done
done

function_name_alias_t="
type FunctionNameAlias = {
    en: string;
    de?: string;
    fr?: string;
    es?: string;
};
"

# create various output/processor files
typescript_file="$script_exec_dir/processor.ts"
javascript_file="$script_exec_dir/processor.js"
output_file="$script_exec_dir/output.ts"
echo "$function_name_alias_t" > "$typescript_file"

# create javascript arrays
for category in "${function_categories[@]}"; do
    declare -n functions="$category"
    for language in "${languages[@]}"; do

        translation_results_file="$generated_translation_files_dir/$language/$category"
        mkdir -p "$(dirname "$translation_results_file")"
        echo "" > "$translation_results_file"

        for function in "${functions[@]}"; do
            grep -A 1 -he "msgid \"$function\"" -r "$source_translation_files_dir/$language" >> "$translation_results_file" || :
        done

        # transform the grep results to { en: "ENGLISH_WORD", lang: "TRANSLATED_WORD" },
        tmp_translation_results_file="${translation_results_file}-tmp"
        cat "$translation_results_file" | sed 's/--//g' | awk 'NF' > "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"
        cat "$translation_results_file" | sed 'N; s/\nmsgstr/ msgstr/g' > "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"
        cat "$translation_results_file" | uniq > "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"
        cat "$translation_results_file" | sed "s/msgid / { en: /g" > "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"
        cat "$translation_results_file" | sed "s/ msgstr /, ${language}: /g" > "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"
        cat "$translation_results_file" | sed "s/$/ },/g" > "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"

        # add entries to javascript array
        echo "const ${category}_${language}: Array<FunctionNameAlias> = [" > "$tmp_translation_results_file"
        cat "$translation_results_file" >> "$tmp_translation_results_file"
        echo "];" >> "$tmp_translation_results_file" && mv "$tmp_translation_results_file" "$translation_results_file"

        cat "$translation_results_file" >> "$typescript_file"
    done
done

# create an english functions array
for category in "${function_categories[@]}"; do
    declare -n functions="$category"
    echo "const ${category}: Array<FunctionNameAlias> = [" >> "$typescript_file"
    for function in "${functions[@]}"; do
        echo "{ en: \"$function\" }," >> "$typescript_file"
    done
    echo "];" >> "$typescript_file"
done

# add logic to combine the separate maps into one
for category in "${function_categories[@]}"; do
    processor_string="
{
    console.log('const ${category}: Array<FunctionNameAlias> = [')
    "
    processor_string="${processor_string}
    for (const func of ${category}) {
        var funcNameObject: FunctionNameAlias = {en: func.en}"
    for language in "${languages[@]}"; do
        processor_string="${processor_string}
        for (const func_${language} of ${category}_${language}) {
            if (func_${language}.en === funcNameObject.en && func_${language}.${language}) {
                funcNameObject.${language} = func_${language}.${language}
            }
        }"
    done
    processor_string="${processor_string}
        console.log(funcNameObject, ',')
    }"
    processor_string="${processor_string}
    console.log('];\n')
}
    "
    echo "$processor_string" >> "$typescript_file"
done

tsc "$typescript_file"
node "$javascript_file" > "$output_file"
echo "finished writing to $output_file"
