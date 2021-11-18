#!/usr/bin/perl -w
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

use strict;

my @input = <STDIN>;

my %emitters;
my $log_start_date;
my $log_start_time;
my @log_start;
my @events;

my %last_times;     # $time for last key
my %last_event_idx; # $events[$idx] for last key

# Google Chrome Trace Event Format if set
my $json = 1;

sub escape($)
{
    my $str = shift;
    $str =~ s/\\/\\\\/g;

    if ($json)
    {
	$str =~ s/\t/\\t/g;
	$str =~ s/\"/\\"/g; # json - and html
    }
    else
    {
	$str =~ s/\$/\\\$/g;
	$str =~ s/\'/\\'/g;
	$str =~ s/\"/\\"/g;
	$str =~ s/\&/&amp;/g;
	$str =~ s/\#/&#35;/g;
	$str =~ s/\>/&gt;/g;
	$str =~ s/\</&lt;/g;
    }
    $str =~ s/[\r\n]+/\\n/g;
    return $str;
}

# 23:34:16.123456
sub splittime($$)
{
    my $lineno = shift;
    my $time = shift;
    $time =~ m/^(\d\d):(\d\d):(\d\d)\.(\d+)$/ || die "Invalid time at line $lineno: '$time'";
    return ($1, $2, $3, $4);
}

sub offset_microsecs($$)
{
    my @time = splittime(shift, shift);

    my $usec = 0  + $time[0] - $log_start[0];
    $usec = $usec * 60;
    $usec = $usec + $time[1] - $log_start[1];
    $usec = $usec * 60;
    $usec = $usec + $time[2] - $log_start[2];
    $usec = $usec * 1000 * 1000;
    $usec = $usec + $time[3];

    return $usec;
}

# Important things that happen in pairs
my @event_pairs = (
    {
      name => 'Initialize wsd.',
      type => 'INF',
      emitter => '^coolwsd$',
      start => 'Initializing wsd.\.*',
      end => 'Listening to prisoner connections.*' },
    {
      name => 'initialize forkit',
      type => 'INF',
      emitter => '^forkit$',
      start => 'Initializing frk.\.*',
      end => 'ForKit process is ready.*' },
    { # Load
      emitter => "^lokit_",
      start => 'Loading url.*for session',
      end => '^Document loaded in .*ms$' },
    { # Save - save to a local file.
      name => 'save to local',
      emitter => '^docbroker',
      start => '^Saving doc',
      end => 'unocommandresult:.*commandName.*\.uno:Save.*success'
    },
    { # Save - to storage
      name => 'save to storage',
      emitter => '^docbroker',
      start => '^Saving to storage docKey',
      end => '^(Saved docKey.* to URI)|(Save skipped as document)',
    }
    );

# Idle events
my @idleend_types = (
    '^Poll completed'
    );

my @idlestart_types = (
    '^Document::ViewCallback end\.'
    );

my %pair_starts;
my %proc_names;

sub match_list($@)
{
    my $message = shift;
    while (my $match =  shift) {
	if ($message =~ m/$match/) {
	    return 1;
	}
    }
    return 0;
}

sub get_event_type($$$)
{
    my ($type, $emitter, $message) = @_;
    return 'idle_end' if (match_list($message, @idleend_types));
    return 'idle_start' if (match_list($message, @idlestart_types));
    return '';
}

sub consume($$$$$$$$$)
{
    my ($lineno, $proc, $pid, $tid, $time, $emitter, $type, $message, $line) = @_;

    $pid = int($pid);
    $tid = int($tid);

    # print STDERR "$emitter, $type, $time, $message, $line\n";

    $time = offset_microsecs($lineno, $time) if ($json); # microseconds from start

    # accumulate all threads / processes
    if (!defined $emitters{$emitter}) {
	$emitters{$emitter} = (scalar keys %emitters) + 1;
	if ($json) {
	    push @events, "{\"name\": \"thread_name\", \"thread_sort_index\": -$tid, \"ph\": \"M\", \"pid\": $pid, \"tid\": $tid, \"args\": { \"name\" : \"$emitter\" } }";
	}
    }
    if (!defined $proc_names{$pid}) {
	$proc_names{$pid} = 1;
	if ($json) {
	    push @events, "{\"name\": \"process_name\", \"process_sort_index\": -$pid, \"ph\": \"M\", \"pid\": $pid, \"args\": { \"name\" : \"$proc\" } }";
	}
    }

    if ($type eq 'PROF') {
	# sw::DocumentTimerManager m_aFireIdleJobsTimer: stop 0.047 ms
	if ($message =~ m/^(.*): stop ([\d\.]+) ms$/) {
	    my $dur_ms = $2;
	    my $dur_us = $dur_ms * 1000.0;
	    my $msg = $1;
	    $time = $time - $dur_us;
	    push @events, "{\"pid\":$pid, \"tid\":$tid, \"ts\":$time, \"dur\":$dur_us, \"ph\":\"X\", \"name\":\"$msg\", \"args\":{ \"ms\":$dur_ms } }";
	} else {
	    die "Unknown prof message: '$message' at line $lineno";
	}
	return;
    }

    my $handled = 0;
    foreach my $match (@event_pairs) {
       next if (defined $match->{type} && $type ne $match->{type});
       next if (defined $match->{emitter} && !($emitter =~ m/$match->{emitter}/));

       my $start = $match->{start};
       my $end = $match->{end};
       my $key;
       $key = $type if (defined $match->{type});
       $key .= $emitter.$start;
       if ($message =~ m/$start/s) {
#	   print STDERR "matched start $key -> $message vs. $start\n";
           defined $pair_starts{$key} && die "key $key - event $start ($end) starts and fails to finish at line: $lineno";
           $pair_starts{$key} = $time;
           last;
       } elsif ($message =~ m/$end/s) {
#	   print STDERR "matched end $key -> $message vs. $end\n";
           defined $pair_starts{$key} || die "key $key - event $start ($end) ends but failed to start at line: $lineno";

           my $content_e = escape($start . $line);
           my $title_e = escape($match->{name});
           my $start_time = $pair_starts{$key};
           my $end_time = $time;

           if ($json)
           {
               my $dur = $end_time - $start_time;
               my $ms = int ($dur / 1000.0);
               push @events, "{\"pid\":$pid, \"tid\":$tid, \"ts\":$start_time, \"dur\":$dur, \"ph\":\"X\", \"name\":\"$title_e\", \"args\":{ \"ms\":$ms } }";
           }
           else
           {
               my $id = (scalar @events) + 1;
               push @events, "{id: $id, group: $emitters{$emitter}, ".
                   "start: new Date('$log_start_date $start_time'), ".
                   "end: new Date('$log_start_date $end_time'), ".
                   "content: '$content_e', title: '$title_e'}";
           }
	   $pair_starts{$key} = undef;
           last;
       }
    }

    my $content_e = escape($message. " " . $line);
    if ($json)
    {
	my $event_type = get_event_type($type, $emitter, $message);

	# join events to the last time
	my $dur = 100; # 0.1ms default
	my $key = "$pid-$tid";
	if (defined($last_times{$key})) {
	    $dur = $time - $last_times{$key};
	    my $idx = $last_event_idx{$key};

	    $dur = 1 if ($event_type eq 'idle_end' && $dur > 1);
	    $events[$idx] =~ s/\"dur\":10/\"dur\":$dur/;
	}
	$last_times{$key} = $time;
	$last_event_idx{$key} = scalar @events;

	my $json_type = "\"ph\":\"X\", \"s\":\"p\"";
	my $replace_dur = 10;
	$replace_dur = 1 if ($event_type eq 'idle_start'); # miss the regexp
	push @events, "{\"pid\":$pid, \"tid\":$tid, \"ts\":$time, \"dur\":$replace_dur, $json_type, \"name\":\"$content_e\" }";
    }
    else
    {
	my $id = (scalar @events) + 1;
	push @events, "{id: $id, group: $emitters{$emitter}, ".
	    "start: new Date('$log_start_date $time'), ".
	    "end: new Date('$log_start_date $time)') + new Date(1), ".
	    "content: '$content_e', title: ''}";
    }
}

sub parseProfileFrames($$$$$)
{
    my ($lineno, $proc, $pid, $emitter, $message) = @_;
    my @lines = split(/\n/, $message);

    foreach my $line (@lines) {
	next if ($line =~ m/start$/); # all data we need is in the end.
	if ($line =~ m/^(\d+)\s+(\d+)\.(\d+)\s+(.*$)/) {
	    my ($tid, $secs, $fractsecs, $realmsg) = ($1, $2, $3, $4);
	    #	    print STDERR "Profile frame '$line'\n";
	    # FIXME: silly to complicate and then re-parse this I guess ...
	    my ($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = gmtime($secs);
	    my $time = sprintf("%.2d:%.2d:%09.6f", $hour, $min, "$sec.$fractsecs");
#	    print STDERR "time '$time' from '$secs' - " . time() . "\n";
	    consume($lineno, $proc, $pid, $tid, $time, $emitter, 'PROF', $realmsg, '');
	}
    }
}

# Open in chrome://tracing
sub emit_json()
{
    my $events_json = join(",\n", @events);

    print STDOUT << "JSONEND"
{
"traceEvents": [
   $events_json
],
"displayTimeUnit":"ms",
"meta_user": "online",
"meta_cpu_count" : 8
}
JSONEND
;
}

sub emit_js()
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
if ($input[0] =~ m/^\S+\s([\d-]+)\s+([\d:\.]+)\s+/)
{
    $log_start_date = $1;
    $log_start_time = $2;
    @log_start = splittime(0, $2);
    print STDERR "reading log from $log_start_date / $log_start_time\n";
} else {
    die "Malformed log line or no input: $input[0]";
}

# parse all the lines
my $lineno = 0;
while (my $line = $input[$lineno++]) {
    my ($pevent, $pdetail);

    $line =~ s/\r*\n*//g;

    # wsd-26974-26974 2019-03-27 03:45:46.735736 [ coolwsd ] INF  Initializing wsd. Local time: Wed 2019-03-27 03:45:46+0000. Log level is [8].| common/Log.cpp:191
    if ($line =~ m/^(\w+)-(\d+)-(\d+)\s+\S+\s+(\S+)\s+\[\s+(\S+)\s+\]\s+(\S+)\s+(.+)\|\s+(\S+)$/) {
	consume($lineno, $1, $2, $3, $4, $5, $6, $7, $8);

    } elsif ($line =~ m/^(\w+)-(\d+)-(\d+)\s+\S+\s+(\S+)\s+\[\s+(\S+)\s+\]\s+(\S+)\s+(.+)$/) { # split lines ...
	my ($proc, $pid, $tid, $time, $emitter, $type, $message, $line) = ($1, $2, $3, $4, $5, $6, $7);
	while (my $next = $input[$lineno++]) {
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

	# Profile frames are special
	if ($type eq 'TRC' && $emitter eq 'lo_startmain' &&
	    $message =~ /.*Document::GlobalCallback PROFILE_FRAME.*/) {
	    parseProfileFrames($lineno, $proc, $pid, $emitter, $message);
	} else {
	    consume($lineno, $proc, $pid, $tid, $time, $emitter, $type, $message, $line);
	}
    } else {
	die "Poorly formed line on " . ($lineno - 1) . " - is logging.file.flush set to true ? '$line'\n";
    }
}

if ($json) {
    emit_json();
} else {
    emit_js();
}

