## Keyboard shortcuts
Current approach for adding keyboard shortcuts is by using:
browser/src/map/handler/Map.KeyboardShortcuts.ts

It allows to define shortcut (also specific for user locale or user permissions) and command which will be executed.
We can execute:
- UNO command - handled by the core (LOKit).
- dispatch command - handled by the online in browser/src/docdispatcher.ts

## Legacy shortcuts
In the past shortcuts were added using if-conditions in browser/src/map/handler/Map.Keyboard.js
