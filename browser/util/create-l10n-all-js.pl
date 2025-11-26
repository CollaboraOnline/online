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
    my $help = readwhole($path . "po/help-$locale.po.json");
    # Different convention: Change underscore to hyphen.
    $locale =~ s/_/-/;
    my $uno = readwhole($path . "l10n/uno/$locale.json");
    my $locore = readwhole($path . "l10n/locore/$locale.json");
    # Merge the fields of all three objects into one. The result of
    # po2json.py starts with "{" not followed by a newline and ends
    # with a "}" without any final newline. The json files that are in
    # the repo start with "{\n" and end with "}\n".
    return substr($ui, 0, length($ui)-1) . ",\n" . substr($help, 1, length($help)-2) . ",\n" . substr($uno, 2, length($uno)-4) . ",\n" . substr($locore, 2, length($locore)-3);
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
}
";

# Simple languages that use onlylang == 'xx'
my @simple = qw(
   ar ca cs cy da de el es eu fi fr ga gl he hr hu hy id is it ja kk ko nl pl pt ro ru sk sl sq sv tr uk
);

# Languages that use window.LANG alias matching
my %aliases = (
    en_GB => [ 'en-GB', 'en_GB' ],
    pt_BR => [ 'pt-BR', 'pt_BR' ],
    zh_CN => [ 'zh-CN', 'zh-Hans-CN', 'zh_CN', 'zh_Hans_CN' ],
    zh_TW => [ 'zh-TW', 'zh-Hant-TW', 'zh_TW', 'zh_Hant_TW' ],
);

for my $lang (@simple) {
    print "else if (onlylang == '$lang') {\n";
    print "    window.LOCALIZATIONS = " . insert($lang) . ";\n";
    print "}\n";
}

for my $lang (sort keys %aliases) {
    my $cond = join(' || ', map { "window.LANG == '$_'" } @{$aliases{$lang}});
    print "else if ($cond) {\n";
    print "    window.LOCALIZATIONS = " . insert($lang) . ";\n";
    print "}\n";
}

print "
else {
    window.LOCALIZATIONS = {};
}
";
