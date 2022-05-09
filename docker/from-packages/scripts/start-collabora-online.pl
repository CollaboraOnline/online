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
    if ($ENV{'domain'} && $ENV{'aliasgroup1'}) {
        print "WARNING: Both aliasgroupX and domain are provided, aliasgroupX takes the precedence where X=1,2,3...\n";
    }

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
    if ($output ne "") {
        return $output;
    }

    my $message = '';
    my $domain = $ENV{'domain'};
    if ($domain) {
        $message .= "WARNING: The 'domain=$domain' is deprecated.\n For your convenience, we interpret it as the following:\n";
        my @hosts = split('\|', $domain);
        if (@hosts) {
            my $i = 0;
            foreach (@hosts) {
                if ($_ =~ /[^a-zA-Z0-9\_.\-\/]/)
                {
                    print "WARNING: $_ seems to be regex, If you want to use regex please use aliasgroupX env variable where X=1,2,3... \nMore information:\n    https://sdk.collaboraonline.com/docs/installation/CODE_Docker_image.html\n";
                    exit 1;
                }
                $i++;
                $message .= "   aliasgroup".$i."=https://$_:443\n";
                $output .= "                <group>\n";
                $output .= "                    <host desc=\"hostname to allow or deny.\" allow=\"true\">https://$_:443</host>\n";
                $output .= "                </group>\n";
            }
            if (@hosts >= 2) {
                $message .= "This means that people from $hosts[0] will not be able to access documents from ";
                for ($b = 1; $b < @hosts; $b = $b + 1)
                {
                    $message .= "$hosts[$b], ";
                }
                $message .= " and vice versa";
            }
            $message .= ". If you want to allow the access instead, use this configuration instead:\n     aliasgroup1=";
            $i = 0;
            foreach(@hosts) {
                $i++;
                $message .= "https://$_:443";
                if ($i != @hosts)
                {
                    $message .= ",";
                }
            }
        }
        $message .= "\nPlease update your Docker configuration to stop seeing this message.\nMore information:\n    https://sdk.collaboraonline.com/docs/installation/CODE_Docker_image.html\n" ;
    }
    print $message;
    return $output;
}

# Update the /etc/coolwsd/coolwsd.xml according to the env. variables from the YAML file
sub rewrite_config($) {
    my ($config) = @_;
    my $output = '';

    open(CONFIG, '<', $config) or die $!;

    my $in_aliases = 0;
    while (<CONFIG>) {
        if (/<remote_url (.*)>.*<\/remote_url>/) {
            my $remoteurl = $ENV{'remoteconfigurl'};
            if ($remoteurl) {
                s/<remote_url (.*)>.*<\/remote_url>/<remote_url $1>$remoteurl<\/remote_url>/;
                $output .= $_;
            }
            else {
                $output .= $_;
            }
        }
        elsif (/<alias_groups/) {
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
