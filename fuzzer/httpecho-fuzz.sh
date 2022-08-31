set -x
set -e

DATADIR=./fuzzer/httpecho-data

TMPDIR=/tmp/httpecho_fuzzer_output
mkdir -p $TMPDIR

export LLVM_PROFILE_FILE="httpecho_fuzzer.profraw.%p.%6m"


function h2o()
{
    (cd /tmp/h2o && git pull -r) || (cd /tmp && git clone https://github.com/h2o/h2o.git)
    H2O='/tmp/h2o/fuzz/http1-corpus /tmp/h2o/fuzz/http2-corpus /tmp/h2o/fuzz/http3-corpus'
}

# Uncomment to download the h2o fuzzing corpus.
#h2o

./httpecho_fuzzer -verbosity=1 -timeout=1 -max_len=16384 -dict=${DATADIR}/http.dict -jobs=5 -detect_leaks=1 $* $TMPDIR ${DATADIR}/corpus/ $H2O

# To merge, run:
#./httpecho_fuzzer -verbosity=1 -timeout=10 -max_len=16384 $* -merge=1 ${DATADIR}/corpus/ $TMPDIR

