# Collabora Online

[![irc](https://img.shields.io/badge/IRC-%23cool--dev%20on%20freenode-orange.svg)](https://webchat.freenode.net/?channels=cool-dev)
[![Telegram](https://img.shields.io/badge/Telegram-Collabora%20Online-green.svg)](https://t.me/CollaboraOnline)
[![Forum](https://img.shields.io/badge/Forum-Discourse-blue.svg)](https://forum.collaboraonline.com/)
[![Website](https://img.shields.io/badge/Website-collaboraonline.github.io-blueviolet.svg)](https://collaboraonline.github.io/)
[![L10n](https://img.shields.io/badge/L10n-Weblate-lightgrey.svg)](https://hosted.weblate.org/projects/collabora-online/)
[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/CollaboraOnline/online)

**LibreOffice in the Cloud on your Own Terms**

![](https://raw.githubusercontent.com/CollaboraOnline/CollaboraOnline.github.io/source/static/images/homepage-image.jpg)

## Key features
* View and edit text documents, spreadsheets, presentations & more
* Collaborative editing features
* Works in any modern browser – no plugin needed
* Open Source

## Website

For many more details, build instructions, downloads and more please visit https://collaboraonline.github.io/

## Developer assistance
Please ask your questions on `irc.freenode.net` in our `#cool-dev` channel

Join the conversation on our Discourse server at https://forum.collaboraonline.com/

## Development bits

This project has several components:
* **wsd/**
  * The Web Services Daemon - which accepts external connections
* **kit/**
  * The client which lives in its own chroot and renders documents
* **common/**
  * Shared code between these processes
* **loleaflet/**
  * The client side JavaScript component
* **test/**
  * C++ based unit tests
* **cypress_test/**
  * JavaScript based integration tests

## Further recommended reading with build details

Please consult the README files in the component's directory for more details:
- wsd/README
- loleaflet/README

## iOS and Android apps

See the corresponding READMEs:
* **ios/README**
* **android/README**

## Enjoy!
