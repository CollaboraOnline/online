## Cursor following
Feature which allows to automatically track other editors in collaborative session.
It also defines when we want to jump the view to our own cursor on content change.

Modes:
- OFF - don't jump or follow anyone, even our own cursor - needed to avoid unexpected jumps or updates. Example: we are in USER mode and we scrolled down so our own cursor is not visible (then switch to OFF). After that someone adds a row on the top - we want to not jump to our cursor but stay where we currently look.
- USER - follow me or others based on specified view id.
- EDITOR - follow cursor which currently moves around.

Any user interaction with the UI / Keyboard / Mouse / Touch should switch to USER mode with our own id so we can jump to our cursor after selection update comes from the server.

All following functions (see very important updateFollowingUsers) live in the app object.
See browser/src/docstatefunctions.js

We want centralized place to manage it, the only source of truth. We still need to move some code from map object and possibly browser/src/control/Control.UserList.ts widget.
