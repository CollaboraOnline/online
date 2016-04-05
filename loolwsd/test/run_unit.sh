#!/bin/sh

export LOOL_LOGLEVEL=trace

for test in prefork; do
    echo "Running test: $test";
    if ../loolwsd --systemplate=${systemplate} --lotemplate="$1" --childroot="${jails}" --unitlib=".libs/unit-$test.so" >& "${jails}/$test.log"; then
    else
    fi
done


