#!/usr/bin/perl -w
#
# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

use strict;

my @input = <STDIN>;

my %emitters;
my $log_date;
my @events;

sub escape($)
{
    my $str = shift;
    $str =~ s/\\/\\\\/g;
    $str =~ s/\$/\\\$/g;
    $str =~ s/\'/\\'/g;
    $str =~ s/\"/\\"/g;
    $str =~ s/\&/&amp;/g;
    $str =~ s/\#/&#35;/g;
    $str =~ s/\>/&gt;/g;
    $str =~ s/\</&lt;/g;
    $str =~ s/[\r\n]+/\\n/g;
    return $str;
}

# Delimit spans of time:
my @pairs = (
    { type => 'INF',
      emitter => 'loolwsd',
      start => 'Initializing wsd.\.*',
      end => 'Listening to prisoner connections.*' },
    { type => 'INF',
      emitter => 'forkit',
      start => 'Initializing frk.\.*',
      end => 'ForKit process is ready.*'
    }
);
my %pair_starts;

sub consume($$$$$)
{
    my ($time, $emitter, $type, $message, $line) = @_;

    # print STDERR "$emitter, $type, $time, $message, $line\n";

    # accumulate all threads / processes
    if (!defined $emitters{$emitter}) {
	$emitters{$emitter} = (scalar keys %emitters) + 1;
    }

    my $handled = 0;
    foreach my $match (@pairs) {
	next if ($type ne $match->{type});
	next if (!($emitter =~ m/$match->{emitter}/));

	my $start = $match->{start};
	my $end = $match->{end};
	my $key = $type.$emitter.$start;
	if ($message =~ m/$start/) {
	    defined $pair_starts{$key} && die "event $start ($end) starts and fails to finish";
	    $pair_starts{$key} = $time;
	    last;
	} elsif ($message =~ m/$end/) {
	    defined $pair_starts{$key} || die "event $start ($end) ends but failed to start";

	    my $id = (scalar @events) + 1;

	    my $content_e = escape($start);
	    my $title_e = escape($line);
	    my $start_time = $pair_starts{$key};
	    my $end_time = $time;
	    push @events, "{id: $id, group: $emitters{$emitter}, ".
		"start: new Date('$log_date $start_time'), ".
		"end: new Date('$log_date $end_time'), ".
		"content: '$content_e', title: '$title_e'}";
	    last;
	}
    }

    my $content_e = escape($message. " " . $line);
    my $id = (scalar @events) + 1;
    push @events, "{id: $id, group: $emitters{$emitter}, ".
	"start: new Date('$log_date $time'), ".
	"end: new Date('$log_date $time)') + new Date(1), ".
	"content: '$content_e', title: ''}";
}

sub emit()
{
    my @groups;
    foreach my $emitter (sort { $emitters{$a} <=> $emitters{$b} } keys %emitters) {
	push @groups, "{id: $emitters{$emitter}, content: '$emitter'}";
    }

    my $groups_json = join(",\n", @groups);
    my $items_json = join(",\n", @events);

    my $start_time = "2019-03-27 04:34:57.807344";
    my $end_time = "2019-03-27 04:35:28.911621";

    print STDOUT <<"HTMLEND"
<html>
<head>
  <title>Online timeline / profile</title>
  <script src="http://visjs.org/dist/vis.js"></script>
  <link href="http://visjs.org/dist/vis-timeline-graph2d.min.css" rel="stylesheet" type="text/css" />
</head>

<body onresize="/*timeline.checkResize();*/">

<h1>Online timeline / profile</h1>

<div id="profile"></div>

<script>
  var groups = new vis.DataSet([ $groups_json ]);
  var items = new vis.DataSet([ $items_json ]);

  var options = {
    stack: false,
    start: new Date('$start_time'),
    end: new Date('$end_time'),
    editable: false,
    margin: { item: 10, axis: 5 },
    orientation: 'top'
  };

  var container = document.getElementById('profile');
  timeline = new vis.Timeline(container, null, options);
  timeline.setGroups(groups);
  timeline.setItems(items);

</script>
</body>
</html>
HTMLEND
;
}

# wsd-29885-29885 2019-03-27 ...
if ($input[0] =~ m/^\S+\s([\d-]+)\s+/)
{
    $log_date = $1;
    print STDERR "reading log from $log_date\n";
} else {
    die "Malformed log line: $input[0]";
}

# parse all the lines
while (my $line = shift @input) {
    my ($pevent, $pdetail);

    $line =~ s/\r*\n*//g;

    # wsd-26974-26974 2019-03-27 03:45:46.735736 [ loolwsd ] INF  Initializing wsd. Local time: Wed 2019-03-27 03:45:46+0000. Log level is [8].| common/Log.cpp:191
    if ($line =~ m/^\S+\s+\S+\s+(\S+)\s+\[\s+(\S+)\s+\]\s+(\S+)\s+(.+)\|\s+(\S+)$/) {
	consume($1, $2, $3, $4, $5);

    } elsif ($line =~ m/^\S+\s+\S+\s+(\S+)\s+\[\s+(\S+)\s+\]\s+(\S+)\s+(.+)$/) { # split lines ...
	my ($time, $emitter, $type, $message, $line) = ($1, $2, $3, $4);
	while (my $next =  shift @input) {
	    # ... | kit/Kit.cpp:1272
	    if ($next =~ m/^(.*)\|\s+(\S+)$/)
	    {
		$message = $message . $1;
		$line = $2;
		last;
	    } else {
		$message = $message . $next;
	    }
	}
	consume($time, $emitter, $type, $message, $line);
    } else {
	die "Poorly formed line - is logging.file.flush set to true ? '$line'\n";
    }
}

emit();
