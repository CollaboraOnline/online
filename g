#!/bin/bash -e
#
# './g pull -r' just forwards to 'git pull -r'.
#
# './g review [name]' to submit a pull request, assuming:
# 1) You have 'gh' installed.
# 2) You are a committer, so you have the permission to push to a private/nick/name branch.
# 3) "name" is the name of part of the private/user/name remote branch, defaults to the current
#    branch. You have to specify this explicitly if you want to update an existing PR.
#
# './g backport <branch> <PR number> [name]' to submit a pull request for a different branch:
# 1) Checks out a local branch for the remote <branch>.
# 2) Cherry-picks commits from <PR number>
# 3) Uses './g review' to submit a pull request against <branch>.
#
# './g rebase-pr <PR number>' to rebase a PR from CollaboraOnline/online:
# 1) Fetches PR info (base branch, head branch, contributor).
# 2) Checks out the PR branch locally.
# 3) Rebases it against the target branch.
# 4) Pushes the result back to the contributor's fork if rebase succeeds.
#

# not_in_standard_branches $BRANCH $REMOTE
not_in_standard_branches() {
    # e.g., with $1 = co-4-2, and $2 = origin
    # check for origin/co-4-2 branch
    if git rev-parse --quiet --verify $2/$1 >/dev/null; then
        return 1 # indicate failure - there's a top-level branch named that way
    fi
    # check for origin/distro/*/co-4-2 branches
    local distro_branch
    for distro_branch in $(git branch --remotes --list "$2/distro/*/$1"); do
        return 2 # indicate failure - there's a distro branch named that way
    done
    return 0
}

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

if [ "$1" == "review" ]; then
    # e.g. distro/collabora/co-4-2
    TRACKED_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name HEAD@{upstream}|sed "s|${REMOTE}/||")
    REMOTE_BRANCH=private/$USER/$TRACKED_BRANCH
    CUSTOM_BRANCH=
    if [ -n "$2" ]; then
        REMOTE_BRANCH=private/$USER/$2
        CUSTOM_BRANCH=y
    elif [ "$TRACKED_BRANCH" != "$BRANCH" ]; then
        if not_in_standard_branches "$BRANCH" "$REMOTE"; then
            # there's no top-level or distro-specific remote branch named as local branch: use its name
            REMOTE_BRANCH=private/$USER/$BRANCH
            CUSTOM_BRANCH=y
        fi
    fi

    # So that we have an up to date view on what remote branches exist.
    git fetch --prune $REMOTE

    HAS_REMOTE_BRANCH=
    if git rev-parse --quiet --verify $REMOTE/$REMOTE_BRANCH >/dev/null; then
        HAS_REMOTE_BRANCH=y
    fi
    if [ -n "$HAS_REMOTE_BRANCH" ] && [ -z "$CUSTOM_BRANCH" ]; then
        echo "Error: default remote branch would be '$REMOTE_BRANCH', but it already exists."
        # Use $TRACKED_BRANCH, because we push to $REMOTE_BRANCH, which derives from
        # $TRACKED_BRANCH, not $BRANCH.
        echo "To update the existing PR: type './g review $TRACKED_BRANCH' explicitly."
        exit 1
    elif [ -n "$HAS_REMOTE_BRANCH" ] && [ -n "$CUSTOM_BRANCH" ]; then
        # PR is open, same branch is explicitly specified, just update it.
        git push --force-with-lease $REMOTE HEAD:$REMOTE_BRANCH
    else
        # Open a new PR.
        git push $REMOTE HEAD:$REMOTE_BRANCH
        git branch $REMOTE_BRANCH
        gh pr create --base $TRACKED_BRANCH --head $REMOTE_BRANCH --fill
        git branch -D $REMOTE_BRANCH
    fi
    exit 0
fi

if [ "$1" == "backport" ]; then
    if [ -z "$(type -p jq)" ]; then
        echo "'jq' not found, install it with your package manager."
        exit 1
    fi

    BACKPORT_BRANCH=$2
    if [ -z "$BACKPORT_BRANCH" ]; then
        echo "Error: backport branch is not specified"
        echo "Usage: './g backport <branch> <PR number> [name]'"
        echo "Example: './g backport distro/collabora/co-6-4 42'"
        exit 1
    fi
    if ! git rev-parse --quiet --verify $REMOTE/$BACKPORT_BRANCH >/dev/null; then
        echo "Error: backport branch does not exist"
        exit 1
    fi

    PRNUM=$3
    if [ -z "$PRNUM" ]; then
        echo "Error: PR number is not specified"
        exit 1
    fi

    # Optional.
    CUSTOM_BRANCH=$4

    JSON=$(mktemp)
    gh api graphql --field owner=":owner" --field repo=":repo" -f query='
query($owner: String!, $repo: String!)
{
  repository(owner: $owner, name: $repo)
  {
    pullRequest(number: '$PRNUM')
    {
     baseRefOid
     headRefOid
    }
  }
}' > $JSON
    BASE_COMMIT=$(cat $JSON | jq --raw-output ".data.repository.pullRequest.baseRefOid")
    HEAD_COMMIT=$(cat $JSON | jq --raw-output ".data.repository.pullRequest.headRefOid")
    rm $JSON
    COMMIT_RANGE=$BASE_COMMIT..$HEAD_COMMIT

    # Create local branch if needed.
    BRANCH_CREATED=
    if git rev-parse --quiet --verify $BACKPORT_BRANCH >/dev/null; then
        git checkout $BACKPORT_BRANCH
    else
        git checkout --track $REMOTE/$BACKPORT_BRANCH
        BRANCH_CREATED=y
    fi

    git cherry-pick $COMMIT_RANGE

    $0 review $CUSTOM_BRANCH

    git checkout $BRANCH

    if [ -n "$BRANCH_CREATED" ]; then
        git branch -D $BACKPORT_BRANCH
    fi

    exit 0
fi

if [ "$1" == "rebase-pr" ]; then
    if [ -z "$(type -p jq)" ]; then
        echo "'jq' not found, install it with your package manager."
        exit 1
    fi

    PRNUM=$2
    if [ -z "$PRNUM" ]; then
        echo "Error: PR number is not specified"
        echo "Usage: './g rebase-pr <PR number>'"
        echo "Example: './g rebase-pr 42'"
        exit 1
    fi

    # Get PR info: base branch, head branch, head repo owner and name
    JSON=$(mktemp)
    gh api graphql --field owner="CollaboraOnline" --field repo="online" -f query='
query($owner: String!, $repo: String!)
{
  repository(owner: $owner, name: $repo)
  {
    pullRequest(number: '$PRNUM')
    {
     baseRefName
     headRefName
     headRepository
     {
       name
       owner
       {
         login
       }
     }
    }
  }
}' > $JSON
    BASE_BRANCH=$(cat $JSON | jq --raw-output ".data.repository.pullRequest.baseRefName")
    HEAD_BRANCH=$(cat $JSON | jq --raw-output ".data.repository.pullRequest.headRefName")
    HEAD_OWNER=$(cat $JSON | jq --raw-output ".data.repository.pullRequest.headRepository.owner.login")
    HEAD_REPO=$(cat $JSON | jq --raw-output ".data.repository.pullRequest.headRepository.name")
    rm $JSON

    if [ "$BASE_BRANCH" == "null" ] || [ "$HEAD_BRANCH" == "null" ] || [ "$HEAD_OWNER" == "null" ] || [ "$HEAD_REPO" == "null" ]; then
        echo "Error: Could not fetch PR #$PRNUM info. Check if the PR exists."
        exit 1
    fi

    echo "PR #$PRNUM: rebasing '$HEAD_OWNER:$HEAD_BRANCH' onto '$BASE_BRANCH'"

    # Fetch the latest from the target branch
    git fetch $REMOTE $BASE_BRANCH

    # Determine the remote for the PR branch
    # If the PR is from CollaboraOnline/online itself, reuse the existing remote
    if [ "$HEAD_OWNER" == "CollaboraOnline" ]; then
        PR_REMOTE=$REMOTE
    else
        PR_REMOTE="git@github.com:$HEAD_OWNER/$HEAD_REPO.git"
    fi

    # Fetch the PR branch
    git fetch $PR_REMOTE $HEAD_BRANCH

    # Save the original HEAD for --force-with-lease (needed when pushing to URL without named remote)
    ORIGINAL_HEAD=$(git rev-parse FETCH_HEAD)

    # Create a local branch for the PR
    LOCAL_BRANCH="rebase-pr-$PRNUM"
    git checkout -B $LOCAL_BRANCH FETCH_HEAD

    # Rebase onto the target branch
    if git rebase $REMOTE/$BASE_BRANCH; then
        echo "Rebase successful. Pushing to $HEAD_OWNER:$HEAD_BRANCH..."
        git push --force-with-lease=$HEAD_BRANCH:$ORIGINAL_HEAD $PR_REMOTE $LOCAL_BRANCH:$HEAD_BRANCH
        echo "Push complete."
    else
        echo "Rebase failed. Resolve conflicts and run 'git rebase --continue', then push manually."
        echo "When done, you can push with: git push --force-with-lease=$HEAD_BRANCH:$ORIGINAL_HEAD $PR_REMOTE $LOCAL_BRANCH:$HEAD_BRANCH"
        echo "To clean up: git checkout $BRANCH && git branch -D $LOCAL_BRANCH"
        exit 1
    fi

    # Return to original branch and clean up
    git checkout $BRANCH
    git branch -D $LOCAL_BRANCH

    exit 0
fi

if [ "$1" == "pull" ]; then
    shift
    git pull "$@"
    exit 0
fi

# vim:set shiftwidth=4 softtabstop=4 expandtab:
