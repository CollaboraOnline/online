## Debugging in CODE docker image

To debug within the container, --cap-add=SYS_PTRACE is needed.

A sample invocation is:

$ docker run --network=host --cap-add=SYS_PTRACE -t -d collabora/code

Then to get a shell in the container to debug that from we want to use
--user root so we can install additional debugging packages:

$ docker exec -i -t --user root `docker ps -f ancestor=collabora/code -q` /bin/bash

At which point you have a shell as root. The version of collabora online in the
docker image is installed from packages, so to get debugging symbols and source we
can install matching debuginfo packages with:

$ apt-get update && apt-get install coolwsd-dbgsym collaboraoffice-debugsource collaboraoffice-debuginfo collaboraofficebasis-core-debuginfo collaboraofficebasis-calc-debuginfo collaboraofficebasis-writer-debuginfo collaboraofficebasis-impress-debuginfo collaboraoffice-ure-debuginfo collaboraofficebasis-graphicfilter-debuginfo collaboraofficebasis-math-debuginfo gdb

And debug as normal.
