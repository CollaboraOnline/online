#!/bin/sh

export LOOL_LOGLEVEL=trace

mkdir -p test_output

# result logging
echo > run_unit.sh.trs

for tst in prefork; do
    tst_log="test_output/$tst.log"
    echo "Running test: $tst | $tst_log";
    if ../loolwsd --systemplate=${systemplate} --lotemplate="${LO_PATH}" --childroot="${jails}" --unitlib=".libs/unit-$tst.so" >& "$tst_log"; then
	echo "Test $tst passed."
	echo ":test-result: PASS $tst" >> run_unit.sh.trs
    else
	cat "$tst_log"
        echo "============================================================="
	echo "Test failed on unit: $tst re-run with:"
	echo "   $ gdb --args ../loolwsd --systemplate=${systemplate} --lotemplate=\"${LO_PATH}\" --childroot=\"${jails}\" --unitlib=\".libs/unit-$tst.so\""
        echo "============================================================="
	echo ":test-result: FAIL $tst" >> run_unit.sh.trs
    fi
done

