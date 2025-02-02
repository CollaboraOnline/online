## Decimal separators
For native elements number format can change based on the browser and its settings regardless of what strings are sent by core and what language we set through URL or through lang parameter in HTML tag.

Example:\
System language: English\
Chrome language: unchanged(system)\
Firefox Language: unchanged(system)\
Online Language: German

For the sidebar, which uses native HTML elements, the Core may send the input field value "125.658,6" in German as requested.\
+ In Firefox, it will be displayed according to the lang attribute set by the HTML tag (German in this case), so it will display "125.658,6." \
+ In Chrome, the HTML attribute for lang is ignored and LANGUAGE_CODE(System/English) of the broswer setting is used. So it will display "125,658.6"

#### Note:
```
Currently, there is no way to override the chrome language setting to render numbers in our preferred language.
```

## Keyboard shortcuts specific for user locale
See dev-notes/keyboard-shortcuts.md
