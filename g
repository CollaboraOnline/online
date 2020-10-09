#!/bin/bash -e
#
# './g pull -r' just forwards to 'git pull -r'.
#
# './g review' to submit a pull request, assuming:
# 1) You have 'gh' installed.
# 2) You are a committer, so you have the permission to push to a private/nick/name branch.
# 3) You delete this branch after the PR is merged.
#

if [ "$1" == "review" ]; then
    if [ -z "$(type -p gh)" ]; then
        echo "'gh' not found, install it from <https://github.com/cli/cli/blob/trunk/docs/install_linux.md>."
        exit 1
    fi

    BRANCH=$(git symbolic-ref HEAD|sed 's|refs/heads/||')
    REMOTE=$(git config branch.$BRANCH.remote)
    if git rev-parse --quiet --verify $REMOTE/private/$USER/$BRANCH >/dev/null; then
        # PR is open, just update it.
        git push -f $REMOTE HEAD:private/$USER/$BRANCH
    else
        # Open a new PR.
        git push $REMOTE HEAD:private/$USER/$BRANCH
        git branch private/$USER/$BRANCH
        gh pr create --base $BRANCH --head private/$USER/$BRANCH --fill
        git branch -D private/$USER/$BRANCH
    fi
    exit 0
fi

if [ "$1" == "pull" ]; then
    shift
    git pull "$@"
    exit 0
fi

# vim:set shiftwidth=4 softtabstop=4 expandtab:
