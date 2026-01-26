#!/bin/perl -w
#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

use strict;
use warnings;
use File::Basename;

my ($decode_json, $encode_json, $json_pretty);

# Find the JSON module
BEGIN {
    # Prefer XS, fall back to pure-Perl JSON::PP
    eval {
        require Cpanel::JSON::XS;
        Cpanel::JSON::XS->import(qw(decode_json encode_json));
        $json_pretty = Cpanel::JSON::XS->new->utf8->canonical->pretty;
        1;
    } or eval {
        require JSON::XS;
        JSON::XS->import(qw(decode_json encode_json));
        $json_pretty = JSON::XS->new->utf8->canonical->pretty;
        1;
    } or eval {
        require JSON::PP;
        JSON::PP->import(qw(decode_json encode_json));
        $json_pretty = JSON::PP->new->utf8->canonical->pretty;
        1;
    } or die "Need a JSON module (Cpanel::JSON::XS / JSON::XS / JSON::PP)\n";
}

my $path = dirname(dirname($0)) . "/";

sub readwhole($) {
    my ($file) = @_;
    local $/;
    open(my $fh, '<', $file) || die "Cannot open $file";
    return <$fh>;
}

# Merge one or more JSON translation files into a single JSON object.
# Later files win on key collisions; we warn only when the value actually changes.
sub insert(@) {
    my (@relfiles) = @_;
    die "insert(): no files specified\n" unless @relfiles;

    my %merged;
    my %seen_in;   # key -> first file where it appeared

    for my $rel (@relfiles) {
        my $raw = readwhole($path . $rel);
        my $obj = decode_json($raw);

        die "insert(): $rel is not a JSON object\n" unless ref($obj) eq 'HASH';

        for my $k (keys %$obj) {
            # Warn if/when we've seen the key already in another file
            if (exists $merged{$k}) {
                my $prev = $seen_in{$k} // '(unknown)';

                # Also, warn only if the value changes (stringify via JSON for a simple deep-ish compare).
                my $old_json = encode_json($merged{$k});
                my $new_json = encode_json($obj->{$k});

                if ($old_json ne $new_json) {
                    my $old_s = _short($old_json, 140);
                    my $new_s = _short($new_json, 140);
                    warn "insert(): key '$k' overwritten ($prev -> $rel): $old_s -> $new_s\n";
                }
            } else {
                $seen_in{$k} = $rel;
            }

            $merged{$k} = $obj->{$k};
        }
    }

    # Stable output helps diffs and reproducibility across platforms.
    return $json_pretty->encode(\%merged);
}

# Make a string safe for one-line warnings by escaping newlines and truncating.
sub _short($$) {
    my ($s, $max) = @_;

    # Normalize CRLF/CR/LF to a literal "\n" so warn() stays on one line.
    $s =~ s/\r\n|\r|\n/\\n/g;

    return (length($s) > $max) ? (substr($s, 0, $max) . '…') : $s;
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
    my $lang_hyphen = $lang;
    $lang_hyphen =~ s/_/-/g;

    print "else if (onlylang == '$lang') {\n";
    print "    window.LOCALIZATIONS = " . insert("po/ui-$lang.po.json", "l10n/uno/$lang_hyphen.json", "l10n/locore/$lang_hyphen.json") . ";\n";
    print "    window.LOCALIZATIONS_HELP = " . insert("po/help-$lang.po.json") . ";\n";
    print "}\n";
}

for my $lang (sort keys %aliases) {
    my $cond = join(' || ', map { "window.LANG == '$_'" } @{$aliases{$lang}});
    my $lang_hyphen = $lang;
    $lang_hyphen =~ s/_/-/g;

    print "else if ($cond) {\n";
    print "    window.LOCALIZATIONS = " . insert("po/ui-$lang.po.json", "l10n/uno/$lang_hyphen.json", "l10n/locore/$lang_hyphen.json") . ";\n";
    print "    window.LOCALIZATIONS_HELP = " . insert("po/help-$lang.po.json") . ";\n";
    print "}\n";
}

print "
else {
    window.LOCALIZATIONS = {};
}
";
