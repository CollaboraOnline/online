#Leaflet.contextmenu
====================
A context menu for Leaflet. See the [demo](http://aratcliffe.github.io/Leaflet.contextmenu/examples/index.html).

##Usage
The context menu is implemented as a map interaction handler.  To use the plugin include the script and enable using the map `contextmenu` option.

````javascript
var map = L.map('map', {
	contextmenu: true,
    contextmenuWidth: 140,
	contextmenuItems: [{
	    text: 'Show coordinates',
	    callback: showCoordinates
	}, {
	    text: 'Center map here',
	    callback: centerMap
	}, '-', {
	    text: 'Zoom in',
	    icon: 'images/zoom-in.png',
	    callback: zoomIn
	}, {
	    text: 'Zoom out',
	    icon: 'images/zoom-out.png',
	    callback: zoomOut
	}]
});    
````

The context menu mixin allows markers and vector features to extend the map context menu with their own menu items. In addition to the menu item options available for the map context menu marker's also accept an `index` option that specifies where the menu item should be inserted relative to the existing map menu items.

````javascript
L.marker(ll, {
    contextmenu: true,
    contextmenuItems: [{
        text: 'Marker item',
        index: 0
    }, {
        separator: true,
        index: 1
    }]
}).addTo(map);
````

###All Options
####Map Context Menu Options

| Option | Type | Default | Description
| --- | --- | --- | ---
| contextmenu | Bool | `false` | Enables the context menu.
| contextmenuWidth | Number | `undefined` | If defined sets the context menu width, if `undefined` the menu will be sized by the maximum width of its menu items.
| contextmenuAnchor | L.Point/Array | `undefined` | An offset applied to the click point to control the context menu position.
| contextmenuItems | Array | `[]` | Specification for the context menu items. See following options for individual menu items. A separator may also be added with a dash character `'-'`.

####Menu Item Options

| Option | Type | Default | Description
| --- | --- | --- | ---
| text | String | `undefined` | The label to use for the menu item (required).
| icon | String | `undefined` | Url for a 16x16px icon to display to the left of the label.
| iconCls | String | `undefined` | A CSS class which sets the background image for the icon (exclusive of the `icon` option).
| callback | Function | `undefined` | A callback function to be invoked when the menu item is clicked. The callback is passed an object with properties identifying the location the menu was opened at: `latlng`, `layerPoint` and `containerPoint`.
| context | Object | The map | The scope the callback will be executed in.
| disabled | Bool | `false` | If `true` the menu item will initially be in a disabled state and will not respond to click events.
| separator | Bool | `undefined` | If `true` a separator will be created instead of a menu item.
| hideOnSelect | Bool | `true` | If `true` the context menu will be automatically hidden when a menu item is selected

####Mixin Options

| Option | Type | Default | Description
| --- | --- | --- | ---
| contextmenu | Bool | `false` | Enables the context menu.
| contextmenuItems | Array | `[]` | Specification for the context menu items.
| contextmenuInheritItems | Bool | `true` | If `true` (the default) the feature menu items are displayed in addition to the map's context menu items.


###Methods

A reference to the map's context menu can be obtained through the map variable e.g. `map.contextmenu`.

````javascript
showAt(L.Point/L.LatLng, [data])
````
Opens the map's context menu at the specified point. `data` is an optional hash of key/value pairs that will be included on the map's `contextmenu.show` event.

````javascript
hide()
````
Hides the map's context menu if showing.

````javascript
addItem(options)
````
Adds a new menu item to the context menu.

````javascript
insertItem(options, index)
````
Adds a new menu item to the context menu at the specified index. If the index is invalid the menu item will be appended to the menu.

````javascript
removeItem(HTMLElement/index)
````
Removes a menu item.

````javascript
removeAllItems()
````
Removes all menu items.

````javascript
setDisabled(HTMLElement/index, disabled)
````
Set's the disabled state of a menu item.

````javascript
isVisible()
````
Returns `true` if the context menu is currently visible.

###Mixin Methods
The following methods are available on supported layer types when using the context menu mixin.

````javascript
bindContextMenu(contextMenuOptions)    
````
Binds a context menu to the feature the method is called on.

````javascript
unbindContextMenu()
````
Unbinds the context menu previously bound to the feature with the bindContextMenu() method.
    
###Events

The following events are triggered on the map:

####contextmenu.show

Fired when the context menu is shown.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.
| relatedTarget | L.Marker/L.Path/undefined | If the context menu was opened for a map feature this property will contain a reference to that feature.

####contextmenu.hide

Fired when the context menu is hidden.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.

####contextmenu.select

Fired when a context menu item is selected.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.
| el | HTMLElement | The context menu item element that was selected.

####contextmenu.additem

Fired when a menu item is added to the context menu.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.
| el | HTMLElement | The context menu item element.
| index | Number | The index at which the menu item was added.

####contextmenu.removeitem

Fired when a menu item is removed from the context menu.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.
| el | HTMLElement | The context menu item element.

####contextmenu.enableitem

Fired when a menu item is enabled.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.
| el | HTMLElement | The context menu item element.

####contextmenu.disableitem

Fired when a menu item is disabled.

| Property | Type | Description
| --- | --- | ---
| contextmenu | Map.ContextMenu | The context menu.
| el | HTMLElement | The context menu item element.

##License
This software is released under the [MIT licence](http://www.opensource.org/licenses/mit-license.php). Icons used in the example are from [http://glyphicons.com](http://glyphicons.com).

