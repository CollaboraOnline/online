#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
CYPRESS_BINARY="${DIR}/node_modules/cypress/bin/cypress"
DESKTOP_TEST_FOLDER="${DIR}/integration_tests/desktop/"
MOBILE_TEST_FOLDER="${DIR}/integration_tests/mobile/"
MULTIUSER_TEST_FOLDER="${DIR}/integration_tests/multiuser/"
ERROR_LOG="${DIR}/workdir/error.log"

print_help ()
{
    echo "Usage: run_parallel.sh --spec <name_spec.js> OPTIONS"
    echo "Runs a specified cypress test"
    echo ""
    echo "   --spec <file>              The test file we need to run"
    echo "   --log-file <file>          Log output to this test"
    echo "   --config <string>          Configure options passed to cypress"
    echo "   --env <string>             Cypress own environment variables"
    echo "   --type <string>            Type of the test (e.g. mobile, desktop)"
    echo "   --browser <file>           Path to the browser binary"
    echo "   --second-chance            Enable second chance"
    exit 1
}

TEST_FILE=
TEST_LOG=
TEST_CONFIG=
TEST_ENV=
TEST_TYPE=
BROWSER=
SECOND_CHANCE=false
while test $# -gt 0; do
  case $1 in
      --spec)             TEST_FILE=$2; shift;;
      --log-file)         TEST_LOG=$2; shift;;
      --config)           TEST_CONFIG=$2; shift;;
      --env)              TEST_ENV=$2; shift;;
      --type)             TEST_TYPE=$2; shift;;
      --browser)          BROWSER=$2; shift;;
      --second-chance)    SECOND_CHANCE=true; shift;;
      --help)             print_help ;;
  -*) ;; # ignore
  esac
  shift
done

TEST_FILE_PATH=
if [ "${TEST_TYPE}" = "desktop" ]; then
    TEST_FILE_PATH=${DESKTOP_TEST_FOLDER}${TEST_FILE};
elif [ "${TEST_TYPE}" = "multi-user" ]; then
    TEST_FILE_PATH=${MULTIUSER_TEST_FOLDER}${TEST_FILE};
else
    TEST_FILE_PATH=${MOBILE_TEST_FOLDER}${TEST_FILE};
fi

RUN_COMMAND="${CYPRESS_BINARY} run \
    --browser ${BROWSER} \
    --headless \
    --config ${TEST_CONFIG}\
    --env ${TEST_ENV}\
    --spec=${TEST_FILE_PATH}"

ERROR_MATCHER="Error:\|Command failed:\|Timed out retrying\|The error was:"

print_error() {
    echo -e "\n\
    CypressError: a test failed, please do one of the following:\n\n\
    Run the failing test in headless mode:\n\
    \tcd cypress_test && make check-${TEST_TYPE} spec=${TEST_FILE}\n\n\
    Open the failing test in the interactive test runner:\n\
    \tcd cypress_test && make run-${TEST_TYPE} spec=${TEST_FILE}\n" >> ${ERROR_LOG}
}

mkdir -p `dirname ${TEST_LOG}`
touch ${TEST_LOG}
echo "`echo ${RUN_COMMAND} && ${RUN_COMMAND}`" > ${TEST_LOG} 2>&1
if [ -z `grep -o -m 1 "${ERROR_MATCHER}" ${TEST_LOG}` ];
    then cat ${TEST_LOG};
    elif [ ${SECOND_CHANCE} = true ];
    then echo "Second chance!" > ${TEST_LOG} && \
        echo "`echo ${RUN_COMMAND} && ${RUN_COMMAND}`" >> ${TEST_LOG} 2>&1 && \
        if [ -z `grep -o -m 1 "${ERROR_MATCHER}" ${TEST_LOG}` ];\
            then cat ${TEST_LOG};\
            else cat ${TEST_LOG} >> ${ERROR_LOG} && \
                 print_error; \
        fi;
    else cat ${TEST_LOG} >> ${ERROR_LOG} && \
        print_error;
fi;

# vim:set shiftwidth=4 expandtab:
