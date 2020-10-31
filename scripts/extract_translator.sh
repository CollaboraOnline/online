#!/bin/bash

#
# author {
#  name "kuesji koesnu"
#  email "kuesji@koesnu.com"
#  website "kuesji.koesnu.com"
# }
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#



SINCE=$(date +%s --date="-1 month")
TEXT='Translated using Weblate'
INPUT_FILE=""
OUTPUT_FILE=""

set -ef

print_help(){
	usage='
 options
	--full	generate translator list from beginning ( only last month generated without this )
	-i file	give input file for previous contributors
	-o file	give output file for latest contributors list including previous
	'

	echo "$usage"
}

find_hashs(){
	git log --since="$SINCE" --pretty=format:"%h %s" | grep -w "$TEXT" | cut -d ' ' -f1
}

collect_authors(){
	for hash in $(find_hashs)
	do
		info=$(git show "$hash" --pretty=format:'%an %ae' | head -n 1)
		echo $info
	done
}


# show help if no argument passed
if [ $# -lt 1 ]
then
	print_help
	exit 1
fi


# parsing arguments
while [ $# -gt 1 ];
do
	case "$1" in
		'--full')
			shift; SINCE="1970-00-00T00:00:00"; shift;
			;;
		'-i')
			shift; INPUT_FILE="$1"; shift;
			;;
		'-o')
			shift; OUTPUT_FILE="$1"; shift;
			;;
		*)
			shift;
			;;
	esac
done

# we need an output list
if [ -z "$OUTPUT_FILE" ]
then
	echo 'error: please give output file with "-o filename" format' >&2
	exit 1
fi

# read input list if given
if [ ! -z "$INPUT_FILE" ] && [ -f "$INPUT_FILE" ]
then
	cat "$INPUT_FILE" > 'tmp.txt'
fi
# generate latest list and combine
collect_authors >> 'tmp.txt'
# read all, sort all, make unique and write to output file
cat 'tmp.txt' | sort | uniq > "$OUTPUT_FILE"
# thanks for service tmp.txt, but we dont need you anymore
rm 'tmp.txt'
