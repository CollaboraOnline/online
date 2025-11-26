# Offline build

To build the flatpak offline like it is required in Flathub, `npm i`
has to work offline.

Due to an issue with `flatpak-builder-tool` generating a manifest to
populate the npm cache doesn't work.

The work around is to vendor the `node_modules` directory by running
`npm install` on a clean tree and creating an archive of it. It is
then extracted in place, in `browser/node_modules`.

This versionned module tarball is attached to the assets "releases":

https://github.com/CollaboraOnline/online/releases/tag/for-code-assets
