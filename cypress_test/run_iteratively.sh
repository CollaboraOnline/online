#!/bin/bash

if [ "$#" -ne 2 ]; then
    echo "Illegal number of parameters"
    echo "Usage: ./run_iteratively <test_type> <test_suite>"
    echo "e.g: ./run_iteratively mobile writer/shape_properties_spec.js"
    exit 1
fi

loop_count=10

if [ $1 = "mobile" ]
then
    command="make check-mobile spec="$2
else
    command="make check-desktop spec="$2
fi

i=0
while $command
do
    if [ $i -ge $loop_count ]
    then
        break
    fi
    i=$((i+1))
done
