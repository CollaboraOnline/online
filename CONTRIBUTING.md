# Contributing to Collabora Online
:+1::tada: First off, thanks for taking the time to contribute! :tada::+1:

The following is a set of rules and guidelines for contributing to Collabora Online. Please feel free to propose changes to this document in a pull request.


## Submitting issues

If you have questions about how to install or use Collabora Online, please direct these to our [forum][forum].
If you have issues or questions about Collabora Online development, you may join us on [IRC][irc] or [Telegram][telegram].

### Guidelines
* Please search the existing issues first, it's likely that your issue was already reported or even fixed.
  - Go to the main page of the repository, click "issues" and type any word in the top search/command bar.
  - You can also filter by appending e. g. "state:open" to the search string.
  - More info on [search syntax within github](https://help.github.com/articles/searching-issues)
* __SECURITY__: Report any potential security bug to us following our [security policy](https://github.com/CollaboraOnline/online/security/policy) instead of filing an issue in our bug tracker.

* [Report the issue][report] using one of our templates, they include all the information we need to track down the issue.

Help us to maximize the effort we can spend fixing issues and adding new features, by not reporting duplicate issues.

[report]: https://github.com/CollaboraOnline/online/issues/new/choose
[forum]: https://forum.collaboraonline.com/
[irc]: https://web.libera.chat/?channels=cool-dev
[telegram]: https://t.me/CollaboraOnline

## Contributing to Source Code

Thanks for wanting to contribute source code to Collabora Online. You rock!

1. Just [fork the main repo](https://github.com/CollaboraOnline/online/fork)
2. Build it ([on Linux](https://collaboraonline.github.io/post/build-code/) or [on any platform](https://forum.collaboraonline.com/t/start-developing-cool-on-any-platform-in-5-minutes/52))
3. Grab one of our newcomer-friendly [easy hacks](https://collaboraonline.github.io/post/easyhacks/)
4. Send your [first pull request](https://forum.collaboraonline.com/t/your-first-pull-request/41)
5. Check main branch [current status](https://github.com/CollaboraOnline/online#readme)
  - ![Main: Pull request policy](https://img.shields.io/badge/Main-PRs%20can%20be%20merged%20without%20approval-42BC00?logoColor=42BC00&logo=git "Main release is still distant. Thanks for your support and contributions! :)") Try to get at least one +1 as a reaction, comment or approval from someone else before merging it
  - ![Main: Pull request policy](https://img.shields.io/badge/Main-protected%2C%20PRs%20need%20approval-red?logoColor=lightred&logo=git "Collabora Team is preparing for the next release, therefore 'main' branch is protected now, PRs need 1 review before merging. Thanks for your support and contributions! :)") It's required to have approval from someone before your PR can be merged

And if you get stuck at any point, just drop by one of our [communication channels](https://collaboraonline.github.io/post/communicate/).

### Sign your work

We use the Developer Certificate of Origin (DCO) as a additional safeguard for the Collabora Online project. This is a well established and widely used mechanism to assure contributors have confirmed their right to license their contribution under the project's license. Please read [README.CONTRIBUTING.md](README.CONTRIBUTING.md). If you can certify it, then just add a line to every git commit message:

````
  Signed-off-by: Random J Developer <random@developer.example.org>
````

Use your real name (sorry, no pseudonyms or anonymous contributions). If you set your `user.name` and `user.email` git configs, you can sign your commit automatically with `git commit -s`.

### Change-Id

We use [change-ids concept](https://gerrit-review.googlesource.com/Documentation/user-changeid.html) in Collabora Online. For more information see [.git-hooks/commit-msg](https://github.com/CollaboraOnline/online/blob/main/.git-hooks/commit-msg). Change-id will be automatically added with the sign-off line if the following script is ran `./scripts/refresh-git-hooks`.

### For non-technical people

Hello, and thanks for stopping by! Do you want to work on an icon or perhaps fix a label but have no technical background? Follow the steps:

1. Install GitHub Desktop App
2. Clone this repository to your computer. [Follow the instructions at docs.github](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop)
3. Generate a Change-Id. Before you commit, you need to generate a unique Change-Id. It must be a 40-character hex string (like a SHA-1 hash) with a capital `I` in front. Here's the easiest way:
    1. Use an online generate random sha1 hash tool such as: https://emn178.github.io/online-tools/sha1.html
    2. In the input box, type something unique — for example, today's date and time and your commit topic, like: `2025-02-16 14:35 fix sidebar dropdown`
    3. The tool will show a 40-character result like `a7f1d92e4b083c56d1f2e9a4b5c6d7e8f9012345`
    4. Copy that result and add a capital `I` at the beginning

So your Change-Id would look like:
```
Ia1b2c3d4e5f67890abcdef1234567890
```
4. Write Your Commit Message in GitHub Desktop. When you're ready to commit in GitHub Desktop, you'll see two text boxes at the bottom-left:
- **Summary** (the small box) — This is your short commit title
- **Description** (the larger box) — This is where you add the extra lines, write your description (if any), then leave **one blank line** and add these two lines:

```
Change-Id: I<your-generated-id>
Signed-off-by: Pedro Silva <pedro.silva@collabora.com>
```

Replace `Pedro Silva` with your name and `<pedro.silva@collabora.com>` with your email address.

Example

**Summary box:**
```
sidebar: fix dropdown not closing on click
```

**Description box:**
```
Fixed the issue where the dropdown menu in the sidebar
would not close when clicking outside of it.

Change-Id: Ia1b2c3d4e5f67890abcdef1234567890
Signed-off-by: Pedro Silva <pedro.silva@collabora.com>
```

### AI Policy

We consider AI tools that help programming just one more tool that, if used judiciously, can help
developers learn to code.  Volunteers using such AI tools are permitted to get good ideas, but you
are responsible for the resulting code: you should be able to explain each hunk of the diff you have
written based on the generated samples. Submitting patches without understanding their content,
copying AI generated code verbatim, or not testing the result before submitting would create risk,
and waste reviewer time and is forbidden.

## Translations
Please submit translations via [Weblate](https://hosted.weblate.org/projects/collabora-online).
