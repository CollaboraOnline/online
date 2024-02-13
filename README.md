<p align="right"><a href="#gitpod"><img alt="Open in Gitpod" src="https://gitpod.io/button/open-in-gitpod.svg"></a></p>

# Collabora Online
<!--
[![Master: Pull request policy](https://img.shields.io/badge/Master-PRs%20can%20be%20merge%20without%20approval-42BC00?logoColor=42BC00&logo=git "Main release is still distant. Thanks for your support and contributions! :)")](https://github.com/CollaboraOnline/online/blob/master/CONTRIBUTING.md#contributing-to-source-code)
-->
[![Master: Pull request policy](https://img.shields.io/badge/Master-protected%2C%20PRs%20need%20approval-red?logoColor=lightred&logo=git "Collabora Team is preparing for the next release, therefore 'master' branch is protected now, PRs need 1 review before merging. Thanks for your support and contributions! :)")](https://github.com/CollaboraOnline/online/blob/master/CONTRIBUTING.md#contributing-to-source-code)


[![Matrix](https://img.shields.io/badge/Matrix-%23cool--dev-turquoise.svg)](https://matrix.to/#/#cool-dev:clicks.codes)
[![Telegram](https://img.shields.io/badge/Telegram-Collabora%20Online-green.svg)](https://t.me/CollaboraOnline)
[![Forum](https://img.shields.io/badge/Forum-Discourse-blue.svg)](https://forum.collaboraonline.com/)
[![Website](https://img.shields.io/badge/Website-collaboraonline.github.io-blueviolet.svg)](https://collaboraonline.github.io/)
[![L10n](https://img.shields.io/badge/L10n-Weblate-lightgrey.svg)](https://hosted.weblate.org/projects/collabora-online/)
[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/CollaboraOnline/online)


**Your own private Office in the Cloud**

![](https://raw.githubusercontent.com/CollaboraOnline/CollaboraOnline.github.io/master/static/images/homepage-image.png)


## Get in touch 💬

* [📋 Forum](https://forum.collaboraonline.com/)
* [👥 Facebook](https://www.facebook.com/collaboraoffice/)
* [🐣 𝕏(Twitter)](https://twitter.com/CollaboraOffice)
* [🐘 Mastodon](https://mastodon.social/@CollaboraOffice)

## Key features
* View and edit text documents, spreadsheets, presentations & more
* Collaborative editing features
* Works in any modern browser – no plugin needed
* Open Source – primarily under the [MPLv2](http://mozilla.org/MPL/2.0/) license. Some parts are under other open source licences, see e.g. [browser/LICENSE](https://github.com/CollaboraOnline/online/blob/master/browser/LICENSE).

## Website

For many more details, build instructions, downloads and more please visit https://collaboraonline.github.io/

## Developer assistance
Please ask your questions on any of the bridged Matrix/Telegram rooms
* Matrix: [#cool-dev:clicks.codes](https://matrix.to/#/#cool-dev:clicks.codes)
* Telegram: [CollaboraOnline](https://t.me/CollaboraOnline)

Join the conversation on our Discourse server at https://forum.collaboraonline.com/

Watch the tinderbox status (if it's green) at
https://cpci.cbg.collabora.co.uk:8080/job/Tinderbox%20for%20online%20master%20against%20co-22.05/

## Development bits

This project has several components:
* **wsd/**
  * The Web Services Daemon - which accepts external connections
* **kit/**
  * The client which lives in its own chroot and renders documents
* **common/**
  * Shared code between these processes
* **browser/**
  * The client side JavaScript component
* **test/**
  * C++ based unit tests
* **cypress_test/**
  * JavaScript based integration tests

## Further recommended reading with build details

Please consult the README files in the component's directory for more details:
- **[wsd/README](wsd)**
- **[browser/README](browser)**

## iOS and Android apps

See the corresponding READMEs:
* **[ios/README](ios)**
* **[android/README](android)**

## GitPod

Head over to https://collaboraonline.github.io/post/build-code/#build-code-on-gitpod and follow the steps.

## Enjoy!
