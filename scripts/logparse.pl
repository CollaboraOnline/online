#!/usr/bin/perl -w

use strict;

sub check_sessions($)
{
    my $sessions = shift;
    my @names = keys %{$sessions};
    if (@names > 0) {
	print "Leaked sessions:\n\t";
	for my $s (@names) {
	    print "$s, ";
	}
	print "\n";
    }
}

my @input = <STDIN>;

my $total_blocks = 0;

# live state:
my $inodes = 0;
my $blocks = 0;
my $running = 0;
my $mem_used = 0;
my $load_avg = 0;
my $cpu_user = 0;
my $cpu_sys = 0;
my %sessions;
my $printed_header = 0;

while (my $line = shift @input) {
    my ($pevent, $pdetail);

    $line =~ s/\r*\n*//g;

    # df -i /dev/sda1 | logger
    # df /dev/sda1 | logger
    # root: /dev/sda1      655360 77457 577903   12% /
    if ($line =~ /root: \S+\s+(\d+)\s+(\d+)/) {
	my ($total, $used) = ($1, $2);
	$total_blocks = $total if ($total_blocks < $total);
	if ($total == $total_blocks) {
	    $blocks = $used;
	} else {
	    $inodes = $used;
	}
    }

    # top -b -n1 | head -4 | logger
    # root: top - 15:38:01 up 5 days,  1:56,  1 user,  load average: 0.00, 0.05, 0.06
    # root: Tasks:  82 total,   1 running,  81 sleeping,   0 stopped,   0 zombie
    # root: %Cpu(s):  0.2 us,  0.1 sy,  0.0 ni, 99.7 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
    # root: KiB Mem:   7870968 total,  3202484 used,  4668484 free,   181104 buffers
    $load_avg = $1 if ($line =~ m/top.*load average: (\d+\.\d+)/);
    $mem_used = $1 if ($line =~ m/KiB Mem:.*\s(\d+)\s+used,/);
    if ($line =~ m/%Cpu(s):\s+(\d+\.\d+) us,\s+(\d+\.\d+) sy,/) {
	$cpu_user = $1;
	$cpu_sys = $2;
    }
    $running = $1 if ($line =~ m/Tasks:.*\s+(\d+) running,/);
    $mem_used = $1 if ($line =~ m/KiB Mem:.*\s(\d+)\s+used,/);
    $mem_used = $1 if ($line =~ m/KiB Mem:.*\s(\d+)\s+used,/);

# Session 000d is loading. 0 views loaded.
# Session 000e is unloading. 0 views will remain.
    if ($line =~ m/Session (\S+) is (\S*)loading. (\d+) views/) {
	my ($skey, $type, $count) = ($1, $2, $3);
	if ($type eq 'un') {
	    $pevent = "unload\t$skey";
	    if (defined $sessions{$skey}) {
		$pdetail = $sessions{$skey};
	    } else {
		# setup - somewhere earlier in the logs.
		$pdetail = 'pre-existing';
	    }
	    delete $sessions{$skey};
	} else {
	    $sessions{$skey} = 1;
	}
    }

    if ($line =~/Initializing wsd/) {
	print "Re-started\n";
	check_sessions(\%sessions);
    }

    # loolwsd:
    if ($line =~ m/Loading new document from URI: \[([^\]]+)\].*for session \[([^\]]+)\]/) {
	my ($doc_uri, $session) = ($1, $2);
	$sessions{$session} = $doc_uri;
	$pevent = "load\t$session";
	$pdetail = $doc_uri;
    }

    if (defined $pevent)
    {
	my $session_count = keys %sessions;
	if ($printed_header++ == 0) {
	    print "event\tsession\tinodes\tfs_blk\trun\tloadavg\tmem/Kb\tsess\tfile\t\n";
	}
	print "$pevent\t$inodes\t$blocks\t$running\t";
	print "$load_avg\t$mem_used\t";
	print "$session_count\t$pdetail\n";
    }
}

check_sessions(\%sessions);

