#!/bin/perl -w

use strict;
use File::Basename;

my $path = dirname(dirname($0)) . "/";

sub readwhole($) {
    my ($file) = @_;
    local $/;
    open(my $fh, '<', $file) || die "Cannot open $file";
    return <$fh>;
}

sub insert($) {
    my ($locale) = @_;
    my $ui = readwhole($path . "po/ui-$locale.po.json");
    # Different convention: Change underscore to hyphen.
    $locale =~ s/_/-/;
    my $uno = readwhole($path . "l10n/uno/$locale.json");
    my $locore = readwhole($path . "l10n/locore/$locale.json");
    # Merge the fields of all three objects into one. The result of
    # po2json.py starts with "{" not followed by a newline and ends
    # with a "}" without any final newline. The json files that are in
    # the repo start with "{\n" and end with "}\n".
    return substr($ui, 0, length($ui)-1) . ",\n" . substr($uno, 2, length($uno)-4) . ",\n" . substr($locore, 2, length($locore)-3);
}

# The list of locales handled in the JavaScript we output below is
# based on a quick glance at the sizes of the translations. Only
# translations that are "large enough" (more complete) are included. A
# woefully incomplete translation is worse than no translation at all.

print "\

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
} else if (onlylang == 'cs') {
    window.LOCALIZATIONS = " . insert('cs') . ";
} else if (onlylang == 'da') {
    window.LOCALIZATIONS = " . insert('da') . ";
} else if (onlylang == 'de') {
    window.LOCALIZATIONS = " . insert('de') . ";
} else if (onlylang == 'el') {
    window.LOCALIZATIONS = " . insert('el') . ";
} else if (window.LANG == 'en_GB') {
    window.LOCALIZATIONS = " . insert('en_GB') . ";
} else if (onlylang == 'es') {
    window.LOCALIZATIONS = " . insert('es') . ";
} else if (onlylang == 'fr') {
    window.LOCALIZATIONS = " . insert('fr') . ";
} else if (onlylang == 'hu') {
    window.LOCALIZATIONS = " . insert('hu') . ";
} else if (onlylang == 'is') {
    window.LOCALIZATIONS = " . insert('is') . ";
} else if (onlylang == 'it') {
    window.LOCALIZATIONS = " . insert('it') . ";
} else if (onlylang == 'ja') {
    window.LOCALIZATIONS = " . insert('ja') . ";
} else if (onlylang == 'ko') {
    window.LOCALIZATIONS = " . insert('ko') . ";
} else if (onlylang == 'nb') {
    window.LOCALIZATIONS = " . insert('nb') . ";
} else if (onlylang == 'nl') {
    window.LOCALIZATIONS = " . insert('nl') . ";
} else if (onlylang == 'nn') {
    window.LOCALIZATIONS = " . insert('nn') . ";
} else if (onlylang == 'pl') {
    window.LOCALIZATIONS = " . insert('pl') . ";
} else if (window.LANG == 'pt_BR') {
    window.LOCALIZATIONS = " . insert('pt_BR') . ";
} else if (onlylang == 'pt') {
    window.LOCALIZATIONS = " . insert('pt') . ";
} else if (onlylang == 'ru') {
    window.LOCALIZATIONS = " . insert('ru') . ";
} else if (onlylang == 'sk') {
    window.LOCALIZATIONS = " . insert('sk') . ";
} else if (onlylang == 'sv') {
    window.LOCALIZATIONS = " . insert('sv') . ";
} else if (onlylang == 'tr') {
    window.LOCALIZATIONS = " . insert('tr') . ";
} else if (onlylang == 'uk') {
    window.LOCALIZATIONS = " . insert('uk') . ";
} else if (window.LANG == 'zh_TW') {
    window.LOCALIZATIONS = " . insert('zh_TW') . ";
} else {
    window.LOCALIZATIONS = {};
}
";
