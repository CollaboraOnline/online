#!/usr/bin/perl -w

use strict;

while (<STDIN>) {
    my $line = $_;
    $line =~ s/\r*\n*//g;

    $line =~ m/Fatal signal received: (.*)$/ || next;
    my $signal = $1;

    # 2016-04-12T20:06:49.626770+00:00 ip-172-31-34-231 coolwsd[5918]: kit-02721 Fatal signal received: SIGSEGV

    $line =~ m/(\d+-\d+-\d+)T(\d+:\d+:\d+\.)\S+\s+\S+\s+(\S+)\s+(.*)$/ || die "bad line: '$line'";
    my ($day, $time, $process, $msg) = ($1, $2, $3, $4);

    print "$day $time $process $signal\n";
}
# 2016-04-12T20:06:49.627111+00:00 ip-172-31-34-231 coolwsd[5918]: Backtrace:
# 2016-04-12T20:06:49.627455+00:00 ip-172-31-34-231 coolwsd[5918]: /usr/bin/coolforkit() [0x43e86d]
# 2016-04-12T20:06:49.627795+00:00 ip-172-31-34-231 coolwsd[5918]: /lib64/libpthread.so.0(+0xf890) [0x7f9389f97890]

