#!/usr/bin/env python3
import os
from pathlib import Path


BASE_PATH = Path(__file__).resolve().parent.parent


def readwhole(file_path: Path) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def insert(locale: str) -> str:
    #read UI json 
    ui = readwhole(BASE_PATH / f"po/ui-{locale}.po.json")

    #Change underscore to hyphen
    locale_dash = locale.replace("_", "-")

    uno = readwhole(BASE_PATH / f"l10n/uno/{locale_dash}.json")
    locore = readwhole(BASE_PATH / f"l10n/locore/{locale_dash}.json")

    
    part_ui = ui[:-1]

    
    part_uno = uno[2:-4]

    
    part_locore = locore[2:-3]

    return part_ui + ",\n" + part_uno + ",\n" + part_locore


def main():
    print("""
var onlylang = window.LANG;
var hyphen = onlylang.indexOf('-');
if (hyphen > 0) {
    onlylang = onlylang.substring(0, hyphen);
}
var underscore = onlylang.indexOf('_');
if (underscore > 0) {
    onlylang = onlylang.substring(0, underscore);
}

if (false) {
    ;
}""", end="")

    #Locale dispatch
    print("""
else if (onlylang == 'ar') {
    window.LOCALIZATIONS = """ + insert("ar") + """;
} else if (onlylang == 'cs') {
    window.LOCALIZATIONS = """ + insert("cs") + """;
} else if (onlylang == 'da') {
    window.LOCALIZATIONS = """ + insert("da") + """;
} else if (onlylang == 'de') {
    window.LOCALIZATIONS = """ + insert("de") + """;
} else if (onlylang == 'el') {
    window.LOCALIZATIONS = """ + insert("el") + """;
} else if (window.LANG == 'en-GB' || window.LANG == 'en_GB') {
    window.LOCALIZATIONS = """ + insert("en_GB") + """;
} else if (onlylang == 'es') {
    window.LOCALIZATIONS = """ + insert("es") + """;
} else if (onlylang == 'fr') {
    window.LOCALIZATIONS = """ + insert("fr") + """;
} else if (onlylang == 'he') {
    window.LOCALIZATIONS = """ + insert("he") + """;
} else if (onlylang == 'hu') {
    window.LOCALIZATIONS = """ + insert("hu") + """;
} else if (onlylang == 'is') {
    window.LOCALIZATIONS = """ + insert("is") + """;
} else if (onlylang == 'it') {
    window.LOCALIZATIONS = """ + insert("it") + """;
} else if (onlylang == 'ja') {
    window.LOCALIZATIONS = """ + insert("ja") + """;
} else if (onlylang == 'ko') {
    window.LOCALIZATIONS = """ + insert("ko") + """;
} else if (onlylang == 'nb') {
    window.LOCALIZATIONS = """ + insert("nb") + """;
} else if (onlylang == 'nl') {
    window.LOCALIZATIONS = """ + insert("nl") + """;
} else if (onlylang == 'nn') {
    window.LOCALIZATIONS = """ + insert("nn") + """;
} else if (onlylang == 'pl') {
    window.LOCALIZATIONS = """ + insert("pl") + """;
} else if (window.LANG == 'pt-BR' || window.LANG == 'pt_BR') {
    window.LOCALIZATIONS = """ + insert("pt_BR") + """;
} else if (onlylang == 'pt') {
    window.LOCALIZATIONS = """ + insert("pt") + """;
} else if (onlylang == 'ru') {
    window.LOCALIZATIONS = """ + insert("ru") + """;
} else if (onlylang == 'sk') {
    window.LOCALIZATIONS = """ + insert("sk") + """;
} else if (onlylang == 'sl') {
    window.LOCALIZATIONS = """ + insert("sl") + """;
} else if (onlylang == 'sv') {
    window.LOCALIZATIONS = """ + insert("sv") + """;
} else if (onlylang == 'tr') {
    window.LOCALIZATIONS = """ + insert("tr") + """;
} else if (onlylang == 'uk') {
    window.LOCALIZATIONS = """ + insert("uk") + """;
} else if (window.LANG == 'zh-CN' || window.LANG == 'zh-Hans-CN' || window.LANG == 'zh_CN' || window.LANG == 'zh_Hans_CN') {
    window.LOCALIZATIONS = """ + insert("zh_CN") + """;
} else if (window.LANG == 'zh-TW' || window.LANG == 'zh-Hant-TW' || window.LANG == 'zh_TW' || window.LANG == 'zh_Hant_TW') {
    window.LOCALIZATIONS = """ + insert("zh_TW") + """;
} else {
    window.LOCALIZATIONS = {};
}
""")


if __name__ == "__main__":
    main()
