# Collabora Online

[![irc](https://img.shields.io/badge/IRC-%23cool--dev%20on%20libera-orange.svg)](https://web.libera.chat/?channels=cool-dev)
[![Telegram](https://img.shields.io/badge/Telegram-Collabora%20Online-green.svg)](https://t.me/CollaboraOnline)
[![Forum](https://img.shields.io/badge/Forum-Discourse-blue.svg)](https://forum.collaboraonline.com/)
[![Website](https://img.shields.io/badge/Website-collaboraonline.github.io-blueviolet.svg)](https://collaboraonline.github.io/)
[![L10n](https://img.shields.io/badge/L10n-Weblate-lightgrey.svg)](https://hosted.weblate.org/projects/collabora-online/)
[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/CollaboraOnline/online)

**LibreOffice in the Cloud on your own Terms**

![](https://raw.githubusercontent.com/CollaboraOnline/CollaboraOnline.github.io/source/static/images/homepage-image.jpg)

## Key features
* View and edit text documents, spreadsheets, presentations & more
* Collaborative editing features
* Works in any modern browser – no plugin needed
* Open Source – primarily under the [MPLv2](http://mozilla.org/MPL/2.0/) license. Some parts are under other open source licences, see e.g. [browser/LICENSE](https://github.com/CollaboraOnline/online/blob/master/browser/LICENSE).

## Website

For many more details, build instructions, downloads and more please visit https://collaboraonline.github.io/

## Developer assistance
Please ask your questions on `irc.libera.chat` in our `#cool-dev` channel

Join the conversation on our Discourse server at https://forum.collaboraonline.com/

Watch the tinderbox status (if it's green) at
https://cpci.cbg.collabora.co.uk:8080/view/Tinderbox/job/Tinderbox%20for%20online%20master/

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
- wsd/README
- browser/README

## iOS and Android apps

See the corresponding READMEs:
* **ios/README**
* **android/README**

## Enjoy!
