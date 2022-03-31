#!/usr/bin/perl -w
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# At some stage, the hope is that the functionality of
# start-collabora-online.sh will be moved here; for the moment
# it only rewrites the alias_groups in coolwsd.xml according to
# the envvar settings

use strict;

# create the part of the config that contains aliases based on the aliasgroupN envvars
sub generate_aliases() {
    my $output = '';
    foreach (sort keys(%ENV)) {
        if (/^aliasgroup/) {
            my $value = $ENV{$_};
            my @aliases = split(',', $value);

            if (@aliases) {
                $output .= "                <group>\n";

                my $first = 1;
                foreach (@aliases) {
                    if ($first) {
                        $output .= "                    <host desc=\"hostname to allow or deny.\" allow=\"true\">$_</host>\n";
                        $first = 0;
                    }
                    else {
                        $output .= "                    <alias desc=\"regex pattern of aliasname\">$_</alias>\n";
                    }
                }

                $output .= "                </group>\n";
            }
        }
    }

    return $output;
}

# Update the /etc/coolwsd/coolwsd.xml according to the env. variables from the YAML file
sub rewrite_config($) {
    my ($config) = @_;
    my $output = '';

    open(CONFIG, '<', $config) or die $!;

    my $in_aliases = 0;
    while (<CONFIG>) {
        if (/<alias_groups/) {
            $in_aliases = 1;

            my $groups = generate_aliases();

            # add the aliases if there are any
            if ($groups ne "") {
                s/mode="[^"]*"/mode="groups"/;
                $output .= $_;
                $output .= $groups;
            }
            else {
                s/mode="[^"]*"/mode="first"/;
                $output .= $_;
            }
        }
        elsif ($in_aliases && /<\/alias_groups>/) {
            $in_aliases = 0;
            $output .= $_;
        }
        elsif (!$in_aliases) {
            $output .= $_;
        }
    }

    close(CONFIG);

    open(CONFIG, '>', $config) or die $!;
    print(CONFIG $output);
    close(CONFIG);
}

rewrite_config('/etc/coolwsd/coolwsd.xml');
