set -e

if [ "$#" -ne 1 ]; then
    echo Expected exactly 1 argument
    exit 1
fi

if [ -f "$1" ]; then
    extension="${1##*.}"
    if [ "$extension" != "data" ]; then
        echo Expected file extension to be ".data"
        exit 1
    fi
    name="${1%.*}"
    set -x
    perf script -i "$name.data" --no-inline > "$name.trace"
    ~/FlameGraph/stackcollapse-perf.pl "$name.trace" > "$name.log"
    ~/FlameGraph/flamegraph.pl "$name.log" > "$name.svg"
    set +x
    echo Created "$name.svg"
else
    echo Expected argument \""$1"\" to be a file
    exit 1
fi
