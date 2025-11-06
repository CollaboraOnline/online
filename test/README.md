# how to run a specific unit test locally

run `run-wsdunit` from the scripts directory with the test name.
`make check` to run all the tests. by default it uses only one
thread. you can add `-j $(nproc)` to run it on all threads
parallely.

```bash
# command to run unit-insert-delete test
scripts/run-wsdunit unit-insert-delete
```
