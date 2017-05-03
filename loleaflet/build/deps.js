var deps = {
	Core: {
		src: ['Leaflet.js',
		      'core/Log.js',
		      'core/Util.js',
		      'core/LOUtil.js',
		      'core/Class.js',
		      'core/Events.js',
		      'core/Socket.js',
		      'core/Browser.js',
		      'geometry/Point.js',
		      'geometry/Bounds.js',
		      'geometry/Transformation.js',
		      'dom/DomUtil.js',
		      'geo/LatLng.js',
		      'geo/LatLngBounds.js',
		      'geo/projection/Projection.LonLat.js',
		      'geo/projection/Projection.SphericalMercator.js',
		      'geo/crs/CRS.js',
		      'geo/crs/CRS.Simple.js',
		      'geo/crs/CRS.Earth.js',
		      'geo/crs/CRS.EPSG3857.js',
		      'geo/crs/CRS.EPSG4326.js',
		      'map/Map.js',
		      'layer/Layer.js'
		      ],
		desc: 'The core of the library, including OOP, events, DOM facilities, basic units, projections (EPSG:3857 and EPSG:4326) and the base Map class.'
	},

	EPSG3395: {
		src: ['geo/projection/Projection.Mercator.js',
		      'geo/crs/CRS.EPSG3395.js'],
		desc: 'EPSG:3395 projection (used by some map providers).',
		heading: 'Additional projections'
	},

	GridLayer: {
		src: ['layer/tile/GridLayer.js'],
		desc: 'Used as base class for grid-like layers like TileLayer.',
		heading: 'Layers'
	},

	TileLayer: {
		src: ['layer/tile/TileLayer.js'],
		desc: 'The base class for displaying tile layers on the map.',
		deps: ['GridLayer']
	},

	TileLayerWMS: {
		src: ['layer/tile/TileLayer.WMS.js'],
		desc: 'WMS tile layer.',
		deps: ['TileLayer']
	},

	WriterTileLayer: {
		src: ['layer/tile/WriterTileLayer.js'],
		desc: 'Writer tile layer.',
		deps: ['TileLayer']
	},

	ImpressTileLayer: {
		src: ['layer/tile/ImpressTileLayer.js'],
		desc: 'Impress tile layer.',
		deps: ['TileLayer']
	},

	CalcTileLayer: {
		src: ['layer/tile/CalcTileLayer.js'],
		desc: 'Calc tile layer.',
		deps: ['TileLayer']
	},

	ImageOverlay: {
		src: ['layer/ImageOverlay.js'],
		desc: 'Used to display an image over a particular rectangular area of the map.'
	},

	ProgressOverlay: {
		src: ['layer/marker/ProgressOverlay.js'],
		desc: 'Used to display a progress image over rectangular are of the map.'
	},

	Marker: {
		src: ['layer/marker/Icon.js',
		      'layer/marker/Icon.Default.js',
		      'layer/marker/Marker.js',
		      'layer/marker/Cursor.js'],
		desc: 'Markers to put on the map.'
	},

	DivIcon: {
		src: ['layer/marker/DivIcon.js'],
		deps: ['Marker'],
		desc: 'Lightweight div-based icon for markers.'
	},

	Popup: {
		src: [
			'layer/Popup.js',
			'layer/Layer.Popup.js',
			'layer/marker/Marker.Popup.js'
		],
		deps: ['Marker'],
		desc: 'Used to display the map popup (used mostly for binding HTML data to markers and paths on click).'
	},

	LayerGroup: {
		src: ['layer/LayerGroup.js'],
		desc: 'Allows grouping several layers to handle them as one.'
	},

	FeatureGroup: {
		src: ['layer/FeatureGroup.js'],
		deps: ['LayerGroup', 'Popup'],
		desc: 'Extends LayerGroup with mouse events and bindPopup method shared between layers.'
	},


	Path: {
		src: [
			'layer/vector/Renderer.js',
			'layer/vector/Path.js',
			'layer/vector/Path.Popup.js'
		],
		desc: 'Vector rendering core.',
		heading: 'Vector layers'
	},

	Polyline: {
		src: ['geometry/LineUtil.js',
		      'layer/vector/Polyline.js'],
		deps: ['Path'],
		desc: 'Polyline overlays.'
	},

	Polygon: {
		src: ['geometry/PolyUtil.js',
		      'layer/vector/Polygon.js'],
		deps: ['Polyline'],
		desc: 'Polygon overlays.'
	},

	Rectangle: {
		src: ['layer/vector/Rectangle.js'],
		deps: ['Polygon'],
		desc: ['Rectangle overlays.']
	},

	CircleMarker: {
		src: ['layer/vector/CircleMarker.js'],
		deps: ['Path'],
		desc: 'Circle overlays with a constant pixel radius.'
	},

	Circle: {
		src: ['layer/vector/Circle.js'],
		deps: ['CircleMarker'],
		desc: 'Circle overlays (with radius in meters).'
	},

	SVG: {
		src: ['layer/vector/SVG.js'],
		deps: ['Path'],
		desc: 'SVG backend for vector layers.'
	},

	VML: {
		src: ['layer/vector/SVG.VML.js'],
		deps: ['SVG'],
		desc: 'VML fallback for vector layers in IE7-8.'
	},

	Canvas: {
		src: ['layer/vector/Canvas.js'],
		deps: ['Path'],
		desc: 'Canvas backend for vector layers.'
	},

	GeoJSON: {
		src: ['layer/GeoJSON.js'],
		deps: ['Polygon', 'Circle', 'CircleMarker', 'Marker', 'FeatureGroup'],
		desc: 'GeoJSON layer, parses the data and adds corresponding layers above.'
	},


	MapDrag: {
		src: ['dom/DomEvent.js',
		      'dom/Draggable.js',
		      'core/Handler.js',
		      'map/handler/Map.Drag.js'],
		desc: 'Makes the map draggable (by mouse or touch).',
		heading: 'Interaction'
	},

	MapScroll: {
		src: ['dom/DomEvent.js',
		      'core/Handler.js',
		      'map/handler/Map.Scroll.js'],
		desc: 'Handles the mouse wheel scroll',
	},

	MouseZoom: {
		src: ['dom/DomEvent.js',
		      'core/Handler.js',
		      'map/handler/Map.DoubleClickZoom.js'],
		desc: 'Scroll wheel zoom and double click zoom on the map.'
	},

	TouchZoom: {
		src: ['dom/DomEvent.js',
		      'dom/DomEvent.DoubleTap.js',
		      'dom/DomEvent.Pointer.js',
		      'core/Handler.js',
		      'map/handler/Map.TouchZoom.js',
		      'map/handler/Map.Tap.js'],
		deps: ['AnimationZoom'],
		desc: 'Enables smooth touch zoom / tap / longhold / doubletap on iOS, IE10, Android.'
	},

	BoxZoom: {
		src: ['map/handler/Map.BoxZoom.js'],
		desc: 'Enables zooming to bounding box by shift-dragging the map.'
	},

	Keyboard: {
		src: ['map/handler/Map.Keyboard.js'],
		desc: 'Handles keyboard interaction with the document.'
	},

	Mouse: {
		src: ['dom/DomEvent.MultiClick.js',
		      'map/handler/Map.Mouse.js'],
		desc: 'Handles mouse interaction with the document.'
	},

	Print: {
		src: ['map/handler/Map.Print.js'],
		desc: 'Handles the print action (ctrl + P).'
	},

	SlideShow: {
		src: ['map/handler/Map.SlideShow.js'],
		desc: 'Creates a presentation slide show.'
	},

	FileInserter: {
		src: ['map/handler/Map.FileInserter.js'],
		desc: 'Handles inserting a file (image) in the document.'
	},

	StateChanges: {
		src: ['map/handler/Map.StateChanges.js'],
		desc: 'Handles state changes for the opened document'
	},

	WOPI: {
		src: ['map/handler/Map.WOPI.js'],
		desc: 'Handles WOPI related logic.'
	},

	MarkerDrag: {
		src: ['layer/marker/Marker.Drag.js'],
		deps: ['Marker'],
		desc: 'Makes markers draggable (by mouse or touch).'
	},

	ControlPartsPreview: {
		src: ['control/Control.js',
		      'control/Control.PartsPreview.js'],
		heading: 'Controls',
		desc: 'Parts preview sidebar'
	},

	ControlHeader: {
		src: ['control/Control.js',
		      'control/Control.Header.js'],
		heading: 'Controls',
		desc: 'Header Item'
	},

	ControlColumnHeader: {
		src: ['control/Control.js',
		      'control/Control.ColumnHeader.js'],
		heading: 'Controls',
		desc: 'Column Header bar'
	},

	ControlRowHeader: {
		src: ['control/Control.js',
		      'control/Control.RowHeader.js'],
		heading: 'Controls',
		desc: 'Row Header bar'
	},

	ControlMetricInput: {
		src: ['control/Control.js',
		      'control/Control.MetricInput.js'],
		heading: 'Controls',
		desc: 'Metric Input'
	},

	ControlDocumentRepair: {
		src: ['control/Control.js',
		      'control/Control.DocumentRepair.js'],
		heading: 'Controls',
		desc: 'Document Repair'
	},

	ControlCharacterMap: {
		src: ['control/Control.js',
		      'control/Control.CharacterMap.js'],
		heading: 'Controls',
		desc: 'Character Map'
	},

	ControlContextmenu: {
		src: ['control/Control.js',
		      'control/Control.ContextMenu.js'],
		heading: 'Controls',
		desc: 'Context Menu'
	},

	ControlMenubar: {
		src: ['control/Control.js',
		      'control/Control.Menubar.js'],
		heading: 'Controls',
		desc: 'Menu bar'
	},

	ControlTabs: {
		src: ['control/Control.js',
		      'control/Control.Tabs.js'],
		heading: 'Controls',
		desc: 'Tabs for switching sheets'
	},

	ControlPermissionSwitch: {
		src: ['control/Control.js',
		      'control/Control.Permission.js'],
		heading: 'Controls',
		desc: 'Switches edit, view and readOnly modes'
	},

	ControlSelection: {
		src: ['control/Control.js',
		      'control/Control.Selection.js'],
		heading: 'Controls',
		desc: 'Enables selection in view mode'
	},

	ControlScroll: {
		src: ['control/Control.js',
		      'control/Control.Scroll.js'],
		heading: 'Controls',
		desc: 'Creates and handles the scrollbar'
	},

	ControlDialog: {
		src: ['control/Control.js',
		      'control/Control.Dialog.js'],
		heading: 'Controls',
		desc: 'Handles vex dialogs for displaying alerts'
	},

	ControlAttrib: {
		src: ['control/Control.js',
		      'control/Control.Attribution.js'],
		desc: 'Attribution control.'
	},

	ControlScale: {
		src: ['control/Control.js',
		      'control/Control.Scale.js'],
		desc: 'Scale control.'
	},

	ControlLayers: {
		src: ['control/Control.js',
		      'control/Control.Layers.js'],
		desc: 'Layer Switcher control.'
	},

	Search: {
		src: ['control/Search.js'],
		desc: 'Search command handler.'
	},

	Permission: {
		src: ['control/Permission.js'],
		desc: 'Permission change handler (edit, view, readonly).'
	},

	Toolbar: {
		src: ['control/Toolbar.js'],
		desc: 'Toolbar handler.'
	},

	Parts: {
		src: ['control/Parts.js'],
		desc: 'Parts change handler.'
	},

	Scroll: {
		src: ['control/Scroll.js'],
		desc: 'Scroll handler.'
	},

	Styles: {
		src: ['control/Styles.js'],
		desc: 'Contains LibreOffice programmatic to UI name style mappings'
	},

	AnimationPan: {
		src: [
			'dom/DomEvent.js',
			'dom/PosAnimation.js',
			'map/anim/Map.PanAnimation.js'
			],
		heading: 'Animation',
		desc: 'Core panning animation support.'
	},

	AnimationTimer: {
		src: ['dom/PosAnimation.Timer.js'],
		deps: ['AnimationPan'],
		desc: 'Timer-based pan animation fallback for browsers that don\'t support CSS3 transitions.'
	},

	AnimationZoom: {
		src: [
			'map/anim/Map.ZoomAnimation.js',
			'map/anim/Map.FlyTo.js'
			],
		deps: ['AnimationPan'],
		desc: 'Smooth zooming animation. Works only on browsers that support CSS3 Transitions.'
	},

	Geolocation: {
		src: ['map/ext/Map.Geolocation.js'],
		desc: 'Adds Map#locate method and related events to make geolocation easier.',
		heading: 'Misc'
	},

	AnnotationManager: {
		src: ['layer/AnnotationManager.js'],
		desc: 'Group Annotations to put on the map.'
	},

	AnnotationScroll: {
		src: ['control/Control.js',
		      'control/Control.Scroll.Annotation.js'],
		desc: 'Basic scroll control'
	},

	Annotation: {
		src: ['layer/marker/Annotation.js'],
		desc: 'Annotation to put on the map.'
	},

	DivOverlay: {
		src: ['layer/marker/DivOverlay.js'],
		desc: 'Div overlay to put on the map.'
	}
};

if (typeof exports !== 'undefined') {
	exports.deps = deps;
}
