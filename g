#!/bin/bash -e
#
# './g pull -r' just forwards to 'git pull -r'.
#
# './g review [name]' to submit a pull request, assuming:
# 1) You have 'gh' installed.
# 2) You are a committer, so you have the permission to push to a private/nick/name branch.
# 3) You delete this branch after the PR is merged.
# 4) "name" is the name of part of the private/user/name remote branch, defaults to the current
#    branch. You have to specify this explicitly if you want to update an existing PR.
#

if [ "$1" == "review" ]; then
    if [ -z "$(type -p gh)" ]; then
        echo "'gh' not found, install it from <https://github.com/cli/cli/blob/trunk/docs/install_linux.md>."
        exit 1
    fi

    if ! gh auth status &>/dev/null; then
        echo "'gh' thinks you are not logged into any GitHub hosts. Run 'gh auth login' to authenticate."
        exit 1
    fi

    # e.g. co-4-2
    BRANCH=$(git symbolic-ref HEAD|sed 's|refs/heads/||')
    # e.g. origin
    REMOTE=$(git config branch.$BRANCH.remote)
    # e.g. distro/collabora/co-4-2
    TRACKED_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name HEAD@{upstream}|sed "s|${REMOTE}/||")
    REMOTE_BRANCH=private/$USER/$TRACKED_BRANCH
    CUSTOM_BRANCH=
    if [ -n "$2" ]; then
        REMOTE_BRANCH=private/$USER/$2
        CUSTOM_BRANCH=y
    fi

    # So that we have an up to date view on what remote branches exist.
    git fetch --prune $REMOTE

    HAS_REMOTE_BRANCH=
    if git rev-parse --quiet --verify $REMOTE/$REMOTE_BRANCH >/dev/null; then
        HAS_REMOTE_BRANCH=y
    fi
    if [ -n "$HAS_REMOTE_BRANCH" ] && [ -z "$CUSTOM_BRANCH" ]; then
        echo "Error: default remote branch would be '$REMOTE_BRANCH', but it already exists."
        echo "To update the existing PR: type './g review $BRANCH' explicitly."
        exit 1
    elif [ -n "$HAS_REMOTE_BRANCH" ] && [ -n "$CUSTOM_BRANCH" ]; then
        # PR is open, same branch is explicitly specified, just update it.
        git push -f $REMOTE HEAD:$REMOTE_BRANCH
    else
        # Open a new PR.
        git push $REMOTE HEAD:$REMOTE_BRANCH
        git branch $REMOTE_BRANCH
        gh pr create --base $TRACKED_BRANCH --head $REMOTE_BRANCH --fill
        git branch -D $REMOTE_BRANCH
    fi
    exit 0
fi

if [ "$1" == "pull" ]; then
    shift
    git pull "$@"
    exit 0
fi

# vim:set shiftwidth=4 softtabstop=4 expandtab:
