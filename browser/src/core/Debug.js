/* -*- js-indent-level: 8; fill-column: 100 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * L.DebugManager contains debugging tools and support for toggling them.
 * Open the Debug Menu with
 * - Ctrl+Shift+Alt+D (Map.Keyboard.js _handleCtrlCommand)
 * - Help > About > D (Toolbar.js aboutDialogKeyHandler)
 * - Help > About > Triple Click (Toolbar.js aboutDialogClickHandler)
 */

/* global app L */

L.DebugManager = L.Class.extend({
	initialize: function(map) {
		this._map = map;
		this.debugOn = false;
	},

	toggle: function() {
		if (!this.debugOn) {
			this._start();
		} else {
			this._stop();
		}

		// redraw canvas with changed debug overlays
		this._painter.update();
	},

	_start: function() {
		this._docLayer = this._map._docLayer;
		this._painter = this._map._docLayer._painter;

		this.debugOn = true;
		this._controls = {};
		this._toolLayers = [];
		this._addDebugTools();

		// Initialize state that we build in debug mode whether visible or not
		// TODO: Associate to specific tools
		this._debugInvalidBounds = {};
		this._debugInvalidBoundsMessage = {};
		this._debugId = 0;
		this._debugLoadTile = 0;
		this._debugLoadDelta = 0;
		this._debugLoadUpdate = 0;
		this._debugInvalidateCount = 0;
		this._debugTimeKeypress = this.getTimeArray();
		this._debugKeypressQueue = [];
		this._debugRenderCount = 0;
		this._debugTimePING = this.getTimeArray();
		this._debugPINGQueue = [];

		// Initialize here because tasks can add themselves to the queue even
		// if the user is not active
		this._automatedUserQueue = [];
		this._automatedUserTasks = {};

		// TODO: Extract to named tool
		if (this._docLayer.isCalc()) {
			this._painter._addSplitsSection();
			this._painter._sectionContainer.reNewAllSections(true /* redraw */);
		}
	},

	_stop: function() {
		this.debugOn = false;

		// Remove layers
		for (var i in this._toolLayers) {
			this._map.removeLayer(this._toolLayers[i]);
		}

		// Remove controls
		for (var category in this._controls) {
			this._controls[category].remove();
		}
		this._controls = {};

		// TODO: Extract to named tool
		if (this._docLayer.isCalc()) {
			var section = this._painter._sectionContainer.getSectionWithName('calc grid');
			if (section) {
				section.setDrawingOrder(L.CSections.CalcGrid.drawingOrder);
				section.sectionProperties.strokeStyle = '#c0c0c0';
			}
			this._painter._sectionContainer.removeSection('splits');
			this._painter._sectionContainer.reNewAllSections(true /* redraw */);
		}
	},

	_addDebugTool: function (tool) {
		// Create control if it doesn't exist
		if (!(tool.category in this._controls)) {
			this._controls[tool.category] = L.control.layers({}, {}, {collapsed: false, sortLayers: true}).addTo(this._map);
			// Add a title
			var b = document.createElement('b');
			b.append(tool.category);
			this._controls[tool.category]._container.prepend(b);
		}

		// Create layer
		var layer = new L.LayerGroup();
		this._toolLayers.push(layer);
		this._controls[tool.category]._addLayer(layer, tool.name, true);
		this._controls[tool.category]._update();

		this._map.on('layeradd', function(e) {
			if (e.layer === layer) {
				tool.onAdd();
			}
		}, this);
		this._map.on('layerremove', function(e) {
			if (e.layer === layer) {
				tool.onRemove();
			}
		}, this);
		if (tool.startsOn) {
			this._map.addLayer(layer);
		}
	},

	_addDebugTools: function () {
		var self = this; // easier than using (function (){}).bind(this) each time

		this._addDebugTool({
			name: 'Data Overlay',
			category: 'Display',
			startsOn: true,
			onAdd: function () {
				self.overlayOn = true;
				self.overlayData = {};
				var names = ['canonicalViewId', 'tileCombine', 'fromKeyInputToInvalidate', 'ping', 'loadCount', 'postMessage'];
				for (var i = 0; i < names.length; i++) {
					self.overlayData[names[i]] = L.control.attribution({prefix: '', position: 'bottomleft'}).addTo(self._map);
					self.overlayData[names[i]].addTo(self._map);
				}
				names = ['nullUpdateMetric', 'newTileMetric'];
				for (var i = 0; i < names.length; i++) {
					self.overlayData[names[i]] = L.control.attribution({prefix: '', position: 'topleft'}).addTo(self._map);
					self.overlayData[names[i]].addTo(self._map);
					self.overlayData[names[i]]._container.style.fontSize = '14px';
				}
			},
			onRemove: function () {
				self.overlayOn = false;
				for (var i in self.overlayData) {
					self.overlayData[i].remove();
				}
				delete self.overlayData;
			},
		});

		this._addDebugTool({
			name: 'Tile Overlays',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self.tileOverlaysOn = true;
				self._painter.update();
			},
			onRemove: function () {
				self.tileOverlaysOn = false;
				self._painter.update();
			},
		});

		this._addDebugTool({
			name: 'Tile Invalidations',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self.tileInvalidationsOn = true;
				self._tileInvalidationTimeout();
				self._tileInvalidationLayer = new L.LayerGroup();
				self._map.addLayer(self._tileInvalidationLayer);
			},
			onRemove: function () {
				self.tileInvalidationsOn = false;
				clearTimeout(self._tileInvalidationTimeoutId);
				self._map.removeLayer(self._tileInvalidationLayer);
				self._painter.update();
			},
		});

		/*
		 * Doesn't seem to do anything
		 * TODO: Reenable
		this._addDebugTool({
			name: 'Always Active',
			category: 'Functionality',
			startsOn: false,
			onAdd: function () {
				self._map._debugAlwaysActive = true;
			},
			onRemove: function () {
				self._map._debugAlwaysActive = false;
			},
		});
		*/

		this._addDebugTool({
			name: 'Show Clipboard',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self._map._textInput.debug(true);
			},
			onRemove: function () {
				self._map._textInput.debug(false);
			},
		});

		this._addDebugTool({
			name: 'Tiles device pixel grid',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self._painter._addTilePixelGridSection();
				self._painter._sectionContainer.reNewAllSections(true);
			},
			onRemove: function () {
				self._painter._sectionContainer.removeSection('tile pixel grid');
				self._painter._sectionContainer.reNewAllSections(true);
			},
		});

		this._addDebugTool({
			name: 'Performance Tracing',
			category: 'Logging',
			startsOn: app.socket.traceEventRecordingToggle,
			onAdd: function () {
				app.socket.setTraceEventLogging(true);
			},
			onRemove: function () {
				app.socket.setTraceEventLogging(false);
			},
		});

		this._addDebugTool({
			name: 'Protocol Logging',
			category: 'Logging',
			startsOn: true,
			onAdd: function () {
				window.setLogging(true);
				L.Log.print();
			},
			onRemove: function () {
				window.setLogging(false);
			},
		});

		this._addDebugTool({
			name: 'Tile Dumping',
			category: 'Logging',
			startsOn: false,
			onAdd: function () {
				app.socket.sendMessage('toggletiledumping true');
			},
			onRemove: function () {
				app.socket.sendMessage('toggletiledumping false');
			},
		});

		this._addDebugTool({
			name: 'Debug Deltas',
			category: 'Logging',
			startsOn: false,
			onAdd: function () {
				self._docLayer._debugDeltas = true;
				self._docLayer._debugDeltasDetail = true;
			},
			onRemove: function () {
				self._docLayer._debugDeltas = false;
				self._docLayer._debugDeltasDetail = false;
			},
		});

		this._addDebugTool({
			name: 'Typer',
			category: 'Automated User',
			startsOn: false,
			onAdd: function () {
				self._typerLorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n';
				self._typerLoremPos = 0;
				self._typerTimeout();
			},
			onRemove: function () {
				clearTimeout(self._typerTimeoutId);
			},
		});

		this._addDebugTool({
			name: 'Randomize user settings',
			category: 'Automated User',
			startsOn: false,
			onAdd: function () {
				self._randomizeSettings();
			},
			onRemove: function () {
				// do nothing
			},
		});

		this._addDebugTool({
			name: 'Automated user input',
			category: 'Automated User',
			startsOn: false,
			onAdd: function () {
				self._automatedUserTimeout();
			},
			onRemove: function () {
				clearTimeout(self._automatedUserTimeoutId);
				self._automatedUserTask = undefined;
				self._automatedUserPhase = 0;
			},
		});

		if (this._docLayer.isCalc()) {
			this._addDebugTool({
				name: 'Click, type, delete, cells & formulas',
				category: 'Automated User',
				startsOn: false,
				onAdd: function () {
					self._automatedUserAddTask(this.name, L.bind(self._automatedUserTypeCellFormula, self));
				},
				onRemove: function () {
					self._automatedUserRemoveTask(this.name);
				},
			});
		}

		this._addDebugTool({
			name: 'Insert and delete shape',
			category: 'Automated User',
			startsOn: false,
			onAdd: function () {
				self._automatedUserAddTask(this.name, L.bind(self._automatedUserInsertTypeShape, self));
			},
			onRemove: function () {
				self._automatedUserRemoveTask(this.name);
			},
		});
	},

	_randomizeSettings: function() {
		// Toggle dark mode
		var isDark = this._map.uiManager.getDarkModeState();
		if (Math.random() < 0.5) {
			window.app.console.log('Randomize Settings: Toggle dark mode to ' + (isDark?'Light':'Dark'));
			this._map.uiManager.toggleDarkMode();
		} else {
			window.app.console.log('Randomize Settings: Leave dark mode as ' + (isDark?'Dark':'Light'));
		}

		// Set zoom
		var targetZoom = Math.floor(Math.random() * 18) + 1;
		window.app.console.log('Randomize Settings: Set zoom to '+targetZoom);
		this._map.setZoom(targetZoom, null, false);

		// Toggle spell check
		var isSpellCheck = this._map['stateChangeHandler'].getItemValue('.uno:SpellOnline');
		if (Math.random() < 0.5) {
			window.app.console.log('Randomize Settings: Toggle spell check to ' + (isSpellCheck=='true'?'off':'on'));
			this._map.sendUnoCommand('.uno:SpellOnline');
		} else {
			window.app.console.log('Randomize Settings: Leave spell check as ' + (isSpellCheck=='true'?'on':'off'));
		}

		// Move to different part of sheet
		if (this._docLayer.isCalc()) {
			// Select random position
			var docSize = this._map.getDocSize();
			var maxX = docSize.x; //Math.min(docSize.x, 10000);
			var maxY = docSize.y; //Math.min(docSize.y, 10000);
			var positions = [
				{x: maxX, y: 0}, // top right
				{x: 0, y: maxY}, // bottom left
				{x: maxX, y: maxY}, // bottom right
				{x: maxX/2, y: maxY/2}, // center
			];
			var pos = positions[Math.floor(Math.random()*positions.length)];

			// Calculate mouse click position
			var viewSize = this._map.getSize();
			var centerPos = {x: pos.x + viewSize.x/2, y: pos.y + viewSize.y/2};
			var centerTwips = this._docLayer._pixelsToTwips(centerPos);

			// Perform action
			window.app.console.log('Randomize Settings: Move to ',pos,' click at ', centerPos, centerTwips);
			this._map.fire('scrollto', pos);
			this._docLayer._postMouseEvent('buttondown', centerTwips.x, centerTwips.y, 1, 1, 0);
			this._docLayer._postMouseEvent('buttonup', centerTwips.x, centerTwips.y, 1, 1, 0);
		}

		// Toggle sidebar
		if (Math.random() < 0.5) {
			window.app.console.log('Randomize Settings: Toggle sidebar');
			this._map.sendUnoCommand('.uno:SidebarDeck.PropertyDeck');
		} else {
			window.app.console.log('Randomize Settings: Leave sidebar');
		}

		this._painter.update();
	},

	_automatedUserAddTask: function(name, taskFn) {
		// task function takes phase number, returns waitTime
		// When waitTime == 0, task is done.

		// Save taskFn
		this._automatedUserTasks[name] = taskFn;
		// Add to queue
		if (!this._automatedUserQueue.includes(name)) {
			this._automatedUserQueue.push(name);
		}
	},

	_automatedUserRemoveTask: function(name) {
		// Don't bother deleting function from _debugAutomatedUserTasks
		// Remove from queue
		if (this._automatedUserQueue.includes(name)) {
			this._automatedUserQueue.splice(
				this._automatedUserQueue.indexOf(name),
				1);
		}
	},

	_automatedUserTimeout: function () {
		if (!this._automatedUserTask) {
			// Not in the middle of a task, pick a new one
			window.app.console.log('Automated User: Pick a new task. Current queue: ',this._automatedUserQueue);
			this._automatedUserTask = this._automatedUserQueue.shift();
			this._automatedUserPhase = 0;
		}

		if (this._automatedUserTask && this._automatedUserPhase == 0) {
			window.app.console.log('Automated User: Starting task ' + this._automatedUserTask);
			// Re-enqueue task
			this._automatedUserQueue.push(this._automatedUserTask);
		}

		if (this._automatedUserTask) {
			window.app.console.log('Automated User: Current task: ' + this._automatedUserTask + ' Current phase: ' + this._automatedUserPhase);
			var taskFn = this._automatedUserTasks[this._automatedUserTask];
			var waitTime = taskFn(this._automatedUserPhase);
			this._automatedUserPhase++;
			if (waitTime == 0) {
				window.app.console.log('Automated User: Task complete: ' + this._automatedUserTask);
				this._automatedUserTask = undefined;
				this._automatedUserPhase = 0;
			}
			this._automatedUserTimeoutId = setTimeout(L.bind(this._automatedUserTimeout, this), waitTime);
		} else {
			window.app.console.log('Automated User: Waiting for tasks');
			// Nothing in queue, check again in 1s
			this._automatedUserTimeoutId = setTimeout(L.bind(this._automatedUserTimeout, this), 1000);
		}
	},

	_automatedUserTypeCellFormula: function (phase) {
		var waitTime = 0;
		switch (phase) {
			case 0:
				window.app.console.log('Automated User: Click somewhere visible');
				var pos = this._docLayer._pixelsToTwips(this._map._getCenterLayerPoint());
				this._docLayer._postMouseEvent('buttondown',pos.x,pos.y,1,1,0);
				this._docLayer._postMouseEvent('buttonup',pos.x,pos.y,1,1,0);
				waitTime = 500;
				break;
			case 1:
				window.app.console.log('Automated User: Type text');
				this._typeText('asdf\nqwer\n', 100);
				waitTime = 1000;
				break;
			case 2:
				window.app.console.log('Automated User: Click formula bar');
				this._map.sendUnoCommand('.uno:StartFormula');
				waitTime = 500;
				break;
			case 3:
				window.app.console.log('Automated User: Type formula');
				this._typeText('A1\n', 100);
				waitTime = 1000;
				break;
			case 4:
				window.app.console.log('Automated User: Delete row');
				this._docLayer.postKeyboardEvent('input', 0, 1025); //up
				this._docLayer.postKeyboardEvent('input', 0, 1025); //up
				this._map.sendUnoCommand('.uno:DeleteRows');
				waitTime = 1000;
				break;
			case 5:
				window.app.console.log('Automated User: Delete cells');
				app.socket.sendMessage('removetextcontext id=0 before=0 after=1'); //delete
				this._docLayer.postKeyboardEvent('input', 0, 1025); //up
				app.socket.sendMessage('removetextcontext id=0 before=0 after=1'); //delete
				waitTime = 500;
				break;
		}
		return waitTime;
	},

	_automatedUserInsertTypeShape: function (phase) {
		var waitTime = 0;
		switch (phase) {
			case 0:
				window.app.console.log('Automated User: Insert Shape');
				var shapes = ['rectangle','circle','diamond','pentagon'];
				var shape = shapes[Math.floor(Math.random() * shapes.length)];
				this._map.sendUnoCommand('.uno:BasicShapes.'+shape);
				// app.socket.sendMessage('removetextcontext id=0 before=0 after=1');
				waitTime = 1000;
				break;
			case 1:
				window.app.console.log('Automated User: Type in Shape');
				this._docLayer.postKeyboardEvent('input',0, 1280); // enter to select text
				this._typeText('textinshape', 100);
				waitTime = 1500;
				break;
			case 2:
				window.app.console.log('Automated User: Type Escape');
				this._docLayer.postKeyboardEvent('input',0, 1281); // esc
				waitTime = 500;
				break;
		}
		return waitTime;
	},

	_typerTimeout: function() {
		var letter = this._typerLorem.charCodeAt(this._typerLoremPos % this._typerLorem.length);
		this._typeChar(letter);
		this._typerLoremPos++;
		this._typerTimeoutId = setTimeout(L.bind(this._typerTimeout, this), 50);
	},

	_typeText: function(text, delayMs) {
		for (var i=0; i<text.length; i++) {
			if (delayMs) {
				setTimeout(L.bind(this._typeChar, this, text.charCodeAt(i)), i*delayMs);
			} else {
				this._typeChar(text.charCodeAt(i));
			}
		}
	},

	_typeChar: function(charCode) {
		if (this.tileInvalidationsOn) {
			this._debugKeypressQueue.push(+new Date());
		}
		if (charCode === '\n'.charCodeAt(0)) {
			this._docLayer.postKeyboardEvent('input', 0, 1280);
		} else {
			this._docLayer.postKeyboardEvent('input', charCode, 0);
		}
	},

	setOverlayPostMessage: function(type,msg) {
		if (this.overlayOn) {
			this.overlayData['postMessage'].setPrefix(type+': '+ msg);
		}
	},

	getTimeArray: function() {
		return {count: 0, ms: 0, best: Number.MAX_SAFE_INTEGER, worst: 0, date: 0};
	},

	updateTimeArray: function(times, value) {
		if (value < times.best) {
			times.best = value;
		}
		if (value > times.worst) {
			times.worst = value;
		}
		times.ms += value;
		times.count++;
		return 'best: ' + times.best + ' ms, avg: ' + Math.round(times.ms/times.count) + ' ms, worst: ' + times.worst + ' ms, last: ' + value + ' ms';
	},


	_overlayShowTileData: function() {
		this.overlayData['loadCount'].setPrefix(
			'Total of requested tiles: ' + this._debugInvalidateCount + ', ' +
			'recv-tiles: ' + this._debugLoadTile + ', ' +
			'recv-delta: ' + this._debugLoadDelta + ', ' +
			'recv-update: ' + this._debugLoadUpdate);
		var allDeltas = this._debugLoadDelta + this._debugLoadUpdate;
		this.overlayData['nullUpdateMetric'].setPrefix(
			'<b>Tile update waste: ' + Math.round(100.0 * this._debugLoadUpdate / allDeltas) + '%</b>'
		);
		this.overlayData['newTileMetric'].setPrefix(
			'<b>New Tile ratio: ' + Math.round(100.0 * this._debugLoadTile / (allDeltas + this._debugLoadTile)) + '%</b>'
		);
	},

	_tileInvalidationTimeout: function() {
		for (var key in this._debugInvalidBounds) {
			var rect = this._debugInvalidBounds[key];
			var opac = rect.options.fillOpacity;
			if (opac <= 0.04) {
				if (key < this._debugId - 5) {
					this._tileInvalidationLayer.removeLayer(rect);
					delete this._debugInvalidBounds[key];
					delete this._debugInvalidBoundsMessage[key];
				} else {
					rect.setStyle({fillOpacity: 0, opacity: 1 - (this._debugId - key) / 7});
				}
			} else {
				rect.setStyle({fillOpacity: opac - 0.04});
			}
		}
		this._tileInvalidationTimeoutId = setTimeout(L.bind(this._tileInvalidationTimeout, this), 50);
	},

	addInvalidationMessage: function(message) {
		this._debugInvalidBoundsMessage[this._debugId - 1] = message;
		var messages = '';
		for (var i = this._debugId - 1; i > this._debugId - 6; i--) {
			if (i >= 0 && this._debugInvalidBoundsMessage[i]) {
				messages += '' + i + ': ' + this._debugInvalidBoundsMessage[i] + ' <br>';
			}
		}
		if (this.overlayOn) {
			this.overlayData['tileCombine'].setPrefix(messages);
			this._overlayShowTileData();
		}
	},


	addInvalidationRectangle: function(topLeftTwips, bottomRightTwips, command) {
		var now = +new Date();

		var signX =  this._docLayer.isCalcRTL() ? -1 : 1;

		var absTopLeftTwips = L.point(topLeftTwips.x * signX, topLeftTwips.y);
		var absBottomRightTwips = L.point(bottomRightTwips.x * signX, bottomRightTwips.y);

		var invalidBoundCoords = new L.LatLngBounds(
			this._docLayer._twipsToLatLng(absTopLeftTwips, this._docLayer._tileZoom),
			this._docLayer._twipsToLatLng(absBottomRightTwips, this._docLayer._tileZoom)
		);
		var rect = L.rectangle(invalidBoundCoords, {color: 'red', weight: 1, opacity: 1, fillOpacity: 0.4, pointerEvents: 'none'});
		this._debugInvalidBounds[this._debugId] = rect;
		this._debugInvalidBoundsMessage[this._debugId] = command;
		this._debugId++;
		this._tileInvalidationLayer.addLayer(rect);

		var oldestKeypress = this._debugKeypressQueue.shift();
		if (oldestKeypress) {
			var timeText = this.updateTimeArray(this._debugTimeKeypress, now - oldestKeypress);
			this.overlayData['fromKeyInputToInvalidate'].setPrefix(
				'Elapsed time between key input and next invalidate: ' + timeText
			);
		}

		// query server ping time after invalidation messages
		// pings will be paired with the pong messages
		this._debugPINGQueue.push(+new Date());
		app.socket.sendMessage('ping');
	},


});
