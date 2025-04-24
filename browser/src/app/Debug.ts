// @ts-strict-ignore
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
 * DebugManager contains debugging tools and support for toggling them.
 * Open the Debug Menu with
 * - Ctrl+Shift+Alt+D (Map.Keyboard.js _handleCtrlCommand)
 * - Help > About > D (Toolbar.js aboutDialogKeyHandler)
 * - Help > About > Triple Click (Toolbar.js aboutDialogClickHandler)
 * - &debug=true URL parameter (Map.js initialize)
 * - &randomUser=true URL parameter (global.js)
 */

/* global app L _ InvalidationRectangleSection TileManager */

type TimeoutHdl = ReturnType<typeof setTimeout>;

interface DebugTool {
	name: string;
	category: string;
	startsOn: boolean;
	onAdd: () => void;
	onRemove: () => void;
}

interface DebugTimeArray {
	count: number;
	ms: number;
	best: number;
	worst: number;
	date: number;
}

type AutomatedTaskFn = (pn: number) => number;

interface AutomatedTaskSet {
	[name: string]: AutomatedTaskFn;
}

class DebugManager {
	private _map: MapInterface;
	private _docLayer: DocLayerInterface;
	private _painter: PainterInterface;
	private debugOn: boolean;
	private debugNeverStarted: boolean;
	private _controls: ControlsInterface;
	private _toolLayers: BaseClass[];

	private overlayOn: boolean;
	private _overlayData: OverlaysInterface;

	private tileOverlaysOn: boolean;

	private tileInvalidationsOn: boolean;
	private _tileInvalidationMessages: Map<number, string>;
	private _tileInvalidationId: number;
	private _tileInvalidationKeypressQueue: number[];
	private _tileInvalidationKeypressTimes: DebugTimeArray;
	private _tileInvalidationTimeoutId: TimeoutHdl;

	private tileDataOn: boolean;
	private _tileDataTotalMessages: number;
	private _tileDataTotalLoads: number;
	private _tileDataTotalUpdates: number;
	private _tileDataTotalDeltas: number;
	private _tileDataTotalInvalidates: number;

	private pingOn: boolean;
	private _pingQueue: number[];
	private _pingTimes: DebugTimeArray;
	private _pingTimeoutId: TimeoutHdl;

	private logIncomingMessages: boolean;
	private logOutgoingMessages: boolean;
	private logKeyboardEvents: boolean;

	private eventDelayWatchdog: boolean;
	private _eventDelayTimeout: TimeoutHdl;
	private _lastEventDelayTime: number;
	private _lastEventDelay: number;
	private _eventDelayWatchStart: number;

	private _typerLorem: string;
	private _typerLoremPos: number;
	private _typerTimeoutId: TimeoutHdl;

	private _automatedUserTimeoutId: TimeoutHdl;
	private _automatedUserTask: string;
	private _automatedUserTasks: AutomatedTaskSet;
	private _automatedUserQueue: string[];
	private _automatedUserPhase: number;

	constructor(map: MapInterface) {
		this._map = map;
		this._docLayer = null;
		this._painter = null;
		this.debugOn = false;
		this.debugNeverStarted = true;
	}

	public toggle(): void {
		if (!this.debugOn) {
			this._start();
		} else {
			this._stop();
		}

		// redraw canvas with changed debug overlays
		this._painter.update();
	}

	private _start(): void {
		this._docLayer = this._map._docLayer;
		this._painter = this._map._docLayer._painter;

		this.debugOn = true;
		this.debugNeverStarted = false;

		this._controls = {};
		// Add header
		this._controls['header'] = L.control
			.layers({}, {}, { collapsed: false })
			.addTo(this._map);
		const b = document.createElement('b');
		b.append(_('Debug Tools'));
		this._controls['header']._container.prepend(b);
		this._controls['header']._container.append(_('Ctrl+Shift+Alt+D to exit'));

		this._toolLayers = [];
		this._addDebugTools();

		// Initialize here because tasks can add themselves to the queue even
		// if the user is not active
		this._automatedUserQueue = [];
		this._automatedUserTasks = {};

		// Display debug info in About box
		const wopiHostId = document.getElementById('wopi-host-id-cloned');
		if (wopiHostId) wopiHostId.style.display = 'block';

		const servedBy = document.getElementById('served-by-cloned');
		if (servedBy) servedBy.style.display = 'flex';
	}

	private _stop(): void {
		this.debugOn = false;

		// Remove layers
		for (const tool of this._toolLayers) {
			this._map.removeLayer(tool);
		}

		// Remove controls
		const keys = Object.keys(this._controls);
		for (const category of keys) {
			this._controls[category].remove();
		}
		this._controls = {};

		// Hide debug info in About box
		const wopiHostId = document.getElementById('wopi-host-id-cloned');
		if (wopiHostId) wopiHostId.style.display = 'none';

		const servedBy = document.getElementById('served-by-cloned');
		if (servedBy) servedBy.style.display = 'none';
	}

	private _addDebugTool(tool: DebugTool) {
		// Create control if it doesn't exist
		if (!(tool.category in this._controls)) {
			this._controls[tool.category] = L.control
				.layers({}, {}, { collapsed: false })
				.addTo(this._map);
			// Add a title
			const b = document.createElement('b');
			b.append(tool.category);
			this._controls[tool.category]._container.prepend(b);
		}

		// Create layer
		const layer = new L.LayerGroup();
		this._toolLayers.push(layer);
		this._controls[tool.category]._addLayer(layer, tool.name, true);
		this._controls[tool.category]._update();

		this._map.on(
			'layeradd',
			function (e: EventBaseType) {
				if (e.layer === layer) {
					tool.onAdd();
				}
			},
			this,
		);
		this._map.on(
			'layerremove',
			function (e: EventBaseType) {
				if (e.layer === layer) {
					tool.onRemove();
				}
			},
			this,
		);
		if (tool.startsOn) {
			this._map.addLayer(layer);
		}
	}

	private _addDebugTools(): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this; // easier than using (function (){}).bind(this) each time

		this._addDebugTool({
			name: 'Data Overlay',
			category: 'Display',
			startsOn: true,
			onAdd: function () {
				self.overlayOn = true;
				self._overlayData = {};
				self._painter._addDebugOverlaySection();
			},
			onRemove: function () {
				self.overlayOn = false;
				self._overlayData = {};
				self._painter._removeDebugOverlaySection();
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
				self._tileInvalidationMessages = new Map();
				self._tileInvalidationId = 0;
				self._tileInvalidationKeypressQueue = [];
				self._tileInvalidationKeypressTimes = self.getTimeArray();
				self._tileInvalidationTimeout();
			},
			onRemove: function () {
				self.tileInvalidationsOn = false;
				self.clearOverlayMessage('tileInvalidationMessages');
				self.clearOverlayMessage('tileInvalidationTime');
				clearTimeout(self._tileInvalidationTimeoutId);
				self._painter.update();
			},
		});

		this._addDebugTool({
			name: 'Tile data',
			category: 'Display',
			startsOn: true,
			onAdd: function () {
				self.tileDataOn = true;
				self._tileDataTotalMessages = 0;
				self._tileDataTotalLoads = 0;
				self._tileDataTotalUpdates = 0;
				self._tileDataTotalDeltas = 0;
				self._tileDataTotalInvalidates = 0;
			},
			onRemove: function () {
				self.tileDataOn = false;
				self.clearOverlayMessage('top-tileData');
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
			name: 'Tile pixel grid section',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self._painter._addTilePixelGridSection();
			},
			onRemove: function () {
				self._painter._removeTilePixelGridSection();
			},
		});

		this._addDebugTool({
			name: 'Tile preload map',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self._painter._addPreloadMap();
			},
			onRemove: function () {
				self._painter._removePreloadMap();
			},
		});

		if (this._docLayer.isCalc()) {
			this._addDebugTool({
				name: 'Splits section',
				category: 'Display',
				startsOn: false,
				onAdd: function () {
					self._painter._addSplitsSection();
				},
				onRemove: function () {
					self._painter._removeSplitsSection();
				},
			});
		}

		this._addDebugTool({
			name: 'Ping',
			category: 'Display',
			startsOn: false,
			onAdd: function () {
				self.pingOn = true;
				self._pingQueue = [];
				self._pingTimes = self.getTimeArray();
				self._pingTimeout();
			},
			onRemove: function () {
				self.pingOn = false;
				self.clearOverlayMessage('rendercount');
				self.clearOverlayMessage('ping');
				clearTimeout(self._pingTimeoutId);
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
				app.Log.print();
			},
			onRemove: function () {
				window.setLogging(false);
			},
		});

		this._addDebugTool({
			name: 'Log incoming messages',
			category: 'Logging',
			startsOn: true,
			onAdd: function () {
				self.logIncomingMessages = true;
			},
			onRemove: function () {
				self.logIncomingMessages = false;
			},
		});

		this._addDebugTool({
			name: 'Log outgoing messages',
			category: 'Logging',
			startsOn: true,
			onAdd: function () {
				self.logOutgoingMessages = true;
			},
			onRemove: function () {
				self.logOutgoingMessages = false;
			},
		});

		this._addDebugTool({
			name: 'Log keyboard events',
			category: 'Logging',
			startsOn: true,
			onAdd: function () {
				self.logKeyboardEvents = true;
			},
			onRemove: function () {
				self.logKeyboardEvents = false;
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
				TileManager.setDebugDeltas(true);
			},
			onRemove: function () {
				TileManager.setDebugDeltas(false);
			},
		});

		this._addDebugTool({
			name: 'Event delay watchdog',
			category: 'Logging',
			startsOn: true,
			onAdd: function () {
				self.eventDelayWatchdog = true;
				self._eventDelayTimeout = null;
				self._lastEventDelayTime = 0;
				self._lastEventDelay = 0;
			},
			onRemove: function () {
				self.eventDelayWatchdog = false;
				self.clearOverlayMessage('eventDelayTime');

				if (self._eventDelayTimeout) clearTimeout(self._eventDelayTimeout);
				delete self._eventDelayTimeout;
				delete self._eventDelayWatchStart;
				delete self._lastEventDelayTime;
				delete self._lastEventDelay;
			},
		});

		this._addDebugTool({
			name: 'Typer',
			category: 'Functionality',
			startsOn: false,
			onAdd: function () {
				self._typerLorem =
					'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n';
				self._typerLoremPos = 0;
				self._typerTimeout();
			},
			onRemove: function () {
				clearTimeout(self._typerTimeoutId);
			},
		});

		this._addDebugTool({
			name: 'Randomize user settings',
			category: 'Functionality',
			startsOn: !!window.coolParams.get('randomUser'),
			onAdd: function () {
				self._randomizeSettings();
			},
			onRemove: function () {
				// do nothing
			},
		});

		this._addDebugTool({
			name: 'Enable automated user',
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
					self._automatedUserAddTask(
						this.name,
						self._automatedUserTypeCellFormula.bind(self),
					);
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
				self._automatedUserAddTask(
					this.name,
					self._automatedUserInsertTypeShape.bind(self),
				);
			},
			onRemove: function () {
				self._automatedUserRemoveTask(this.name);
			},
		});

		if (this._docLayer.isCalc()) {
			this._addDebugTool({
				name: 'Resize rows and columns',
				category: 'Automated User',
				startsOn: false,
				onAdd: function () {
					self._automatedUserAddTask(
						this.name,
						self._automatedUserResizeRowsColumns.bind(self),
					);
				},
				onRemove: function () {
					self._automatedUserRemoveTask(this.name);
				},
			});
		}

		if (this._docLayer.isCalc()) {
			this._addDebugTool({
				name: 'Insert rows and columns',
				category: 'Automated User',
				startsOn: false,
				onAdd: function () {
					self._automatedUserAddTask(
						this.name,
						self._automatedUserInsertRowsColumns.bind(self),
					);
				},
				onRemove: function () {
					self._automatedUserRemoveTask(this.name);
				},
			});
		}

		if (this._docLayer.isCalc()) {
			this._addDebugTool({
				name: 'Delete rows and columns',
				category: 'Automated User',
				startsOn: false,
				onAdd: function () {
					self._automatedUserAddTask(
						this.name,
						self._automatedUserDeleteRowsColumns.bind(self),
					);
				},
				onRemove: function () {
					self._automatedUserRemoveTask(this.name);
				},
			});
		}
	}

	private _randomizeSettings(): void {
		// Toggle dark mode
		const isDark = window.prefs.getBoolean('darkTheme');
		if (Math.random() < 0.5) {
			window.app.console.log(
				'Randomize Settings: Toggle dark mode to ' +
					(isDark ? 'Light' : 'Dark'),
			);
			this._map.uiManager.toggleDarkMode();
		} else {
			window.app.console.log(
				'Randomize Settings: Leave dark mode as ' + (isDark ? 'Dark' : 'Light'),
			);
		}

		// Set zoom
		const targetZoom = Math.floor(Math.random() * 9) + 6; // 6 to 14, 50% to 200%
		window.app.console.log('Randomize Settings: Set zoom to ' + targetZoom);
		this._map.setZoom(targetZoom, null, false);

		// Toggle spell check
		const isSpellCheck =
			this._map['stateChangeHandler'].getItemValue('.uno:SpellOnline');
		if (Math.random() < 0.5) {
			window.app.console.log(
				'Randomize Settings: Toggle spell check to ' +
					(isSpellCheck == 'true' ? 'off' : 'on'),
			);
			this._map.sendUnoCommand('.uno:SpellOnline');
		} else {
			window.app.console.log(
				'Randomize Settings: Leave spell check as ' +
					(isSpellCheck == 'true' ? 'on' : 'off'),
			);
		}

		// Toggle formatting marks
		if (this._docLayer.isWriter()) {
			if (Math.random() < 0.5) {
				window.app.console.log('Randomize Settings: Toggle formatting marks');
				this._map.sendUnoCommand('.uno:ControlCodes');
			} else {
				window.app.console.log('Randomize Settings: Leave formatting marks');
			}
		}

		// Move to different part of sheet
		if (this._docLayer.isCalc()) {
			// Select random position
			const docSize = this._map.getDocSize();
			const maxX = docSize.x; //Math.min(docSize.x, 10000);
			const maxY = docSize.y; //Math.min(docSize.y, 10000);
			const positions = [
				{ x: maxX, y: 0 }, // top right
				{ x: 0, y: maxY }, // bottom left
				{ x: maxX, y: maxY }, // bottom right
				{ x: maxX / 2, y: maxY / 2 }, // center
			];
			const pos = positions[Math.floor(Math.random() * positions.length)];

			// Calculate mouse click position
			const viewSize = this._map.getSize();
			const centerPos = {
				x: pos.x + viewSize.x / 2,
				y: pos.y + viewSize.y / 2,
			};
			const centerTwips = this._docLayer._pixelsToTwips(centerPos);

			// Perform action
			window.app.console.log(
				'Randomize Settings: Move to ',
				pos,
				' click at ',
				centerPos,
				centerTwips,
			);
			app.map._docLayer.scrollToPos(pos);
			this._docLayer._postMouseEvent(
				'buttondown',
				centerTwips.x,
				centerTwips.y,
				1,
				1,
				0,
			);
			this._docLayer._postMouseEvent(
				'buttonup',
				centerTwips.x,
				centerTwips.y,
				1,
				1,
				0,
			);
		}

		// Toggle sidebar
		if (!this._map._docLoadedOnce) {
			// When first opening the document, initializeSidebar is called
			// 200ms after setup, which would overwrite our randomization.
			// So in this case, wait for sidebar initialization and the
			// response to complete so that we know the current state
			setTimeout(this._randomizeSidebar.bind(this), 1000);
		} else {
			this._randomizeSidebar();
		}

		this._painter.update();
	}

	private _randomizeSidebar(): void {
		let sidebars = ['none', '.uno:SidebarDeck.PropertyDeck', '.uno:Navigator'];
		if (this._docLayer.isImpress()) {
			sidebars = sidebars.concat([
				'.uno:SlideChangeWindow',
				'.uno:CustomAnimation',
				'.uno:MasterSlidesPanel',
				'.uno:ModifyPage',
			]);
		}
		const sidebar = sidebars[Math.floor(Math.random() * sidebars.length)];
		window.app.console.log('Randomize Settings: Target sidebar: ' + sidebar);
		if (this._map.sidebar && this._map.sidebar.isVisible()) {
			// There is currently a sidebar
			const currentSidebar = this._map.sidebar.getTargetDeck();
			if (sidebar == 'none') {
				window.app.console.log('Randomize Settings: Remove sidebar');
				// Send message for existing sidebar to remove it
				this._map.sendUnoCommand(currentSidebar);
			} else if (sidebar == currentSidebar) {
				window.app.console.log(
					'Randomize Settings: Leave sidebar as ' + sidebar,
				);
			} else {
				window.app.console.log(
					'Randomize Settings: Switch sidebar to ' + sidebar,
				);
				this._map.sendUnoCommand(sidebar);
			}
		} else {
			// Sidebar currently hidden
			// eslint-disable-next-line no-lonely-if
			if (sidebar == 'none') {
				window.app.console.log('Randomize Settings: Leave sidebar off');
			} else {
				window.app.console.log('Randomize Settings: Open sidebar ' + sidebar);
				this._map.sendUnoCommand(sidebar);
			}
		}
	}

	private _automatedUserAddTask(
		name: string,
		taskFn: (pn: number) => number,
	): void {
		// task function takes phase number, returns waitTime
		// When waitTime == 0, task is done.

		// Save taskFn
		this._automatedUserTasks[name] = taskFn;
		// Add to queue
		if (!this._automatedUserQueue.includes(name)) {
			this._automatedUserQueue.push(name);
		}
	}

	private _automatedUserRemoveTask(name: string): void {
		// Don't bother deleting function from _debugAutomatedUserTasks
		// Remove from queue
		if (this._automatedUserQueue.includes(name)) {
			this._automatedUserQueue.splice(
				this._automatedUserQueue.indexOf(name),
				1,
			);
		}
	}

	private _automatedUserTimeout(): void {
		if (!this._automatedUserTask) {
			// Not in the middle of a task, pick a new one
			window.app.console.log(
				'Automated User: Pick a new task. Current queue: ',
				this._automatedUserQueue,
			);
			this._automatedUserTask = this._automatedUserQueue.shift();
			this._automatedUserPhase = 0;
		}

		if (this._automatedUserTask && this._automatedUserPhase == 0) {
			window.app.console.log(
				'Automated User: Starting task ' + this._automatedUserTask,
			);
			// Re-enqueue task
			this._automatedUserQueue.push(this._automatedUserTask);
		}

		if (this._automatedUserTask) {
			window.app.console.log(
				'Automated User: Current task: ' +
					this._automatedUserTask +
					' Current phase: ' +
					this._automatedUserPhase,
			);
			const taskFn = this._automatedUserTasks[this._automatedUserTask];
			const waitTime = taskFn(this._automatedUserPhase);
			this._automatedUserPhase++;
			if (waitTime == 0) {
				window.app.console.log(
					'Automated User: Task complete: ' + this._automatedUserTask,
				);
				this._automatedUserTask = undefined;
				this._automatedUserPhase = 0;
			}
			this._automatedUserTimeoutId = setTimeout(
				this._automatedUserTimeout.bind(this),
				waitTime,
			);
		} else {
			window.app.console.log('Automated User: Waiting for tasks');
			// Nothing in queue, check again in 1s
			this._automatedUserTimeoutId = setTimeout(
				this._automatedUserTimeout.bind(this),
				1000,
			);
		}
	}

	private _automatedUserTypeCellFormula(phase: number): number {
		let waitTime = 0;
		switch (phase) {
			case 0:
				{
					window.app.console.log('Automated User: Click in center');
					const pos = this._docLayer._latLngToTwips(this._map.getCenter());
					this._docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
					this._docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);
					waitTime = 500;
				}
				break;
			case 1:
				{
					window.app.console.log('Automated User: Type text');
					this._typeText('asdf\nqwer\n', 100);
					waitTime = 1000;
				}
				break;
			case 2:
				{
					window.app.console.log('Automated User: Click formula bar');
					this._map.sendUnoCommand('.uno:StartFormula');
					waitTime = 500;
				}
				break;
			case 3:
				{
					window.app.console.log('Automated User: Type formula');
					this._typeText('A1\n', 100);
					waitTime = 1000;
				}
				break;
			case 4:
				{
					window.app.console.log('Automated User: Delete row');
					this._docLayer.postKeyboardEvent('input', 0, 1025); //up
					this._docLayer.postKeyboardEvent('input', 0, 1025); //up
					this._map.sendUnoCommand('.uno:DeleteRows');
					waitTime = 1000;
				}
				break;
			case 5:
				{
					window.app.console.log('Automated User: Delete cells');
					app.socket.sendMessage('removetextcontext id=0 before=0 after=1'); //delete
					this._docLayer.postKeyboardEvent('input', 0, 1025); //up
					app.socket.sendMessage('removetextcontext id=0 before=0 after=1'); //delete
					waitTime = 500;
				}
				break;
		}
		return waitTime;
	}

	private _automatedUserInsertTypeShape(phase: number): number {
		let waitTime = 0;
		switch (phase) {
			case 0:
				{
					window.app.console.log('Automated User: Insert Shape');
					const shapes = ['rectangle', 'circle', 'diamond', 'pentagon'];
					const shape = shapes[Math.floor(Math.random() * shapes.length)];
					this._map.sendUnoCommand('.uno:BasicShapes.' + shape);
					waitTime = 1000;
				}
				break;
			case 1:
				{
					window.app.console.log('Automated User: Type in Shape');
					this._docLayer.postKeyboardEvent('input', 0, 1280); // enter to select text
					this._typeText('textinshape', 100);
					waitTime = 1500;
				}
				break;
			case 2:
				{
					window.app.console.log('Automated User: Type Escape');
					this._docLayer.postKeyboardEvent('input', 0, 1281); // esc
					waitTime = 500;
				}
				break;
			case 3:
				{
					window.app.console.log('Automated User: Select Shape');
					const pos = this._docLayer._latLngToTwips(this._map.getCenter());
					this._docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
					this._docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);
					waitTime = 1000;
				}
				break;
			case 4:
				{
					window.app.console.log('Automated User: Delete Shape');
					app.socket.sendMessage('removetextcontext id=0 before=0 after=1');
					waitTime = 1000;
				}
				break;
		}
		return waitTime;
	}

	private _automatedUserResizeRowsColumns(phase: number): number {
		let waitTime = 0;
		switch (phase) {
			case 0:
				{
					window.app.console.log('Automated User: Resize row smaller');
					// Not necessary here, but nice to highlight the row being changed
					app.sectionContainer
						.getSectionWithName('row header')
						._selectRow(1, 0);
					this._map.sendUnoCommand(
						'.uno:RowHeight {"RowHeight":{"type":"unsigned short","value":200},"Row":{"type":"long","value":2}}',
					);
					waitTime = 2000;
				}
				break;
			case 1:
				{
					window.app.console.log('Automated User: Resize row larger');
					// Not necessary here, but nice to highlight the row being changed
					app.sectionContainer
						.getSectionWithName('row header')
						._selectRow(1, 0);
					this._map.sendUnoCommand(
						'.uno:RowHeight {"RowHeight":{"type":"unsigned short","value":2000},"Row":{"type":"long","value":2}}',
					);
					waitTime = 2000;
				}
				break;
			case 2:
				{
					window.app.console.log('Automated User: Resize row auto');
					// Selecting row is necessary here
					app.sectionContainer
						.getSectionWithName('row header')
						._selectRow(1, 0);
					this._map.sendUnoCommand(
						'.uno:SetOptimalRowHeight {"aExtraHeight":{"type":"unsigned short","value":0}}',
					);
					waitTime = 2000;
				}
				break;
			case 3:
				{
					window.app.console.log('Automated User: Resize column smaller');
					// Not necessary here, but nice to highlight the column being changed
					app.sectionContainer
						.getSectionWithName('column header')
						._selectColumn(1, 0);
					this._map.sendUnoCommand(
						'.uno:ColumnWidth {"ColumnWidth":{"type":"unsigned short","value":400},"Column":{"type":"long","value":2}}',
					);
					waitTime = 2000;
				}
				break;
			case 4:
				{
					window.app.console.log('Automated User: Resize column larger');
					// Not necessary here, but nice to highlight the column being changed
					app.sectionContainer
						.getSectionWithName('column header')
						._selectColumn(1, 0);
					this._map.sendUnoCommand(
						'.uno:ColumnWidth {"ColumnWidth":{"type":"unsigned short","value":8000},"Column":{"type":"long","value":2}}',
					);
					waitTime = 2000;
				}
				break;
			case 5:
				{
					window.app.console.log('Automated User: Resize column auto');
					// Selecting column is necessary here
					app.sectionContainer
						.getSectionWithName('column header')
						._selectColumn(1, 0);
					this._map.sendUnoCommand(
						'.uno:SetOptimalColumnWidthDirect {"aExtraHeight":{"type":"unsigned short","value":0}}',
					);
					waitTime = 2000;
				}
				break;
		}
		return waitTime;
	}

	private _automatedUserInsertRowsColumns(phase: number): number {
		let waitTime = 0;
		switch (phase) {
			case 0:
				{
					window.app.console.log('Automated User: Insert row');
					// Select just this row first, doesn't work if multiple rows are selected
					app.sectionContainer
						.getSectionWithName('row header')
						._selectRow(1, 0);
					app.sectionContainer
						.getSectionWithName('row header')
						.insertRowAbove(1);
					waitTime = 2000;
				}
				break;
			case 1:
				{
					window.app.console.log('Automated User: Delete column');
					// Select just this column first, doesn't work if multiple columns are selected
					app.sectionContainer
						.getSectionWithName('column header')
						._selectColumn(1, 0);
					app.sectionContainer
						.getSectionWithName('column header')
						.insertColumnBefore(1);
					waitTime = 2000;
				}
				break;
		}
		return waitTime;
	}

	private _automatedUserDeleteRowsColumns(phase: number): number {
		let waitTime = 0;
		switch (phase) {
			case 0:
				{
					window.app.console.log('Automated User: Delete row');
					// Select just this row first, otherwise multiple rows could get deleted
					app.sectionContainer
						.getSectionWithName('row header')
						._selectRow(1, 0);
					app.sectionContainer.getSectionWithName('row header').deleteRow(1);
					waitTime = 2000;
				}
				break;
			case 1:
				{
					window.app.console.log('Automated User: Delete column');
					// Select just this column first, otherwise multiple columns could get deleted
					app.sectionContainer
						.getSectionWithName('column header')
						._selectColumn(1, 0);
					app.sectionContainer
						.getSectionWithName('column header')
						.deleteColumn(1);
					waitTime = 2000;
				}
				break;
		}
		return waitTime;
	}

	private _typerTimeout() {
		const letter = this._typerLorem.charCodeAt(
			this._typerLoremPos % this._typerLorem.length,
		);
		this._typeChar(letter);
		this._typerLoremPos++;
		this._typerTimeoutId = setTimeout(this._typerTimeout.bind(this), 50);
	}

	private _typeText(text: string, delayMs: number) {
		for (let i = 0; i < text.length; i++) {
			if (delayMs) {
				setTimeout(
					L.bind(this._typeChar, this, text.charCodeAt(i)),
					i * delayMs,
				);
			} else {
				this._typeChar(text.charCodeAt(i));
			}
		}
	}

	private _typeChar(charCode: number): void {
		if (this.tileInvalidationsOn) {
			this.addTileInvalidationKeypress();
		}
		if (charCode === '\n'.charCodeAt(0)) {
			this._docLayer.postKeyboardEvent('input', 0, 1280);
		} else {
			this._docLayer.postKeyboardEvent('input', charCode, 0);
		}
	}

	public setOverlayMessage(id: string, message: string): void {
		if (this.overlayOn) {
			this._overlayData[id] = message;
		}
	}

	public clearOverlayMessage(id: string): void {
		if (this.overlayOn && this._overlayData[id]) {
			delete this._overlayData[id];
		}
	}

	public getOverlayMessages(): any {
		if (this.tileDataOn) this._tileDataUpdateOverlay();

		return this._overlayData;
	}

	public getTimeArray(): DebugTimeArray {
		return {
			count: 0,
			ms: 0,
			best: Number.MAX_SAFE_INTEGER,
			worst: 0,
			date: 0,
		};
	}

	public updateTimeArray(times: DebugTimeArray, value: number) {
		if (value < times.best) {
			times.best = value;
		}
		if (value > times.worst) {
			times.worst = value;
		}
		times.ms += value;
		times.count++;
		return (
			'best: ' +
			times.best +
			' ms, worst: ' +
			times.worst +
			' ms, avg: ' +
			Math.round(times.ms / times.count) +
			' ms, last: ' +
			value +
			' ms'
		);
	}

	private _tileDataUpdateOverlay(): void {
		const messages = this._tileDataTotalMessages;
		const loads = this._tileDataTotalLoads;
		const deltas = this._tileDataTotalDeltas;
		const updates = this._tileDataTotalUpdates;
		const invalidates = this._tileDataTotalInvalidates;
		this.setOverlayMessage(
			'top-tileData',
			'Total tile messages: ' +
				messages +
				'\n' +
				'loads: ' +
				loads +
				' ' +
				'deltas: ' +
				deltas +
				' ' +
				'updates: ' +
				updates +
				'\n' +
				'invalidates: ' +
				invalidates +
				'\n' +
				'Tile update waste: ' +
				Math.round((100.0 * updates) / (updates + deltas)) +
				'%\n' +
				'New Tile ratio: ' +
				Math.round((100.0 * loads) / (loads + updates + deltas)) +
				'%',
		);
	}

	public tileDataAddMessage(): void {
		this._tileDataTotalMessages++;
	}

	public tileDataAddLoad(): void {
		this._tileDataTotalLoads++;
	}

	public tileDataAddUpdate(): void {
		this._tileDataTotalUpdates++;
	}

	public tileDataAddDelta(): void {
		this._tileDataTotalDeltas++;
	}

	public tileDataAddInvalidate(): void {
		this._tileDataTotalInvalidates++;
	}

	private _tileInvalidationTimeout(): void {
		const keys = this._tileInvalidationMessages.keys();
		for (const key of keys) {
			if (key < this._tileInvalidationId - 5) {
				this._tileInvalidationMessages.delete(key);
			}
		}
		this._tileInvalidationTimeoutId = setTimeout(
			L.bind(this._tileInvalidationTimeout, this),
			50,
		);
	}

	// key press times will be paired with the invalidation messages
	public addTileInvalidationKeypress(): void {
		if (!this.tileInvalidationsOn) {
			return;
		}
		this._tileInvalidationKeypressQueue.push(+new Date());
	}

	public addTileInvalidationMessage(message: string): void {
		if (!this.tileInvalidationsOn) {
			return;
		}

		this._tileInvalidationMessages.set(this._tileInvalidationId - 1, message);

		let messages = '';
		for (
			let i = this._tileInvalidationId - 1;
			i > this._tileInvalidationId - 6;
			i--
		) {
			if (i >= 0 && this._tileInvalidationMessages.has(i)) {
				messages +=
					'' + i + ': ' + this._tileInvalidationMessages.get(i) + '\n';
			}
		}
		this.setOverlayMessage('tileInvalidationMessages', messages);
	}

	public addTileInvalidationRectangle(
		rectangleArray: number[] /* [x, y, width, height] in twips */,
		command: string,
	): void {
		if (!this.tileInvalidationsOn) {
			return;
		}

		const signX = this._docLayer.isCalcRTL() ? -1 : 1;

		const absTopLeftTwips = L.point(
			rectangleArray[0] * signX,
			rectangleArray[1],
		);
		const absBottomRightTwips = L.point(
			(rectangleArray[0] + rectangleArray[2]) * signX,
			rectangleArray[1] + rectangleArray[3],
		);

		this._tileInvalidationMessages.set(this._tileInvalidationId, command);
		this._tileInvalidationId++;

		const x = absTopLeftTwips.x * app.twipsToPixels;
		const y = absTopLeftTwips.y * app.twipsToPixels;
		const w = (absBottomRightTwips.x - absTopLeftTwips.x) * app.twipsToPixels;
		const h = (absBottomRightTwips.y - absTopLeftTwips.y) * app.twipsToPixels;
		InvalidationRectangleSection.setRectangle(x, y, w, h);

		// There is not always an invalidation for every keypress.
		// Keypresses at the front of the queue that are older than 1s
		// are probably stale and should be ignored.
		const now = +new Date();
		let oldestKeypress: number;
		do {
			oldestKeypress = this._tileInvalidationKeypressQueue.shift();
		} while (oldestKeypress && now - oldestKeypress > 1000);
		if (oldestKeypress) {
			const timeText = this.updateTimeArray(
				this._tileInvalidationKeypressTimes,
				now - oldestKeypress,
			);
			this.setOverlayMessage(
				'tileInvalidationTime',
				'Tile invalidation time: ' + timeText,
			);
		}
	}

	private _pingTimeout(): void {
		// pings will be paired with the pong messages
		this._pingQueue.push(+new Date());
		app.socket.sendMessage('ping');
		this._pingTimeoutId = setTimeout(this._pingTimeout.bind(this), 2000);
	}

	public reportPong(rendercount: number): void {
		if (!this.pingOn) {
			return;
		}

		// TODO: move rendercount from pong to tile data tool
		this.setOverlayMessage(
			'rendercount',
			'Server rendered tiles: ' + rendercount,
		);

		const oldestPing = this._pingQueue.shift();
		if (oldestPing) {
			const now = +new Date();
			const timeText = this._map._debug.updateTimeArray(
				this._pingTimes,
				now - oldestPing,
			);
			this.setOverlayMessage('ping', 'Server ping time: ' + timeText);
		}
	}

	public timeEventDelay(): void {
		if (!this.eventDelayWatchdog || this._eventDelayTimeout !== null) return;

		this._eventDelayWatchStart = performance.now();
		this._eventDelayTimeout = setTimeout(() => {
			this._eventDelayTimeout = null;
			this.reportEventDelay(performance.now() - this._eventDelayWatchStart);
		}, 0);
	}

	public reportEventDelay(delayMs: number): void {
		if (!this.eventDelayWatchdog) return;

		// Time in ms to prefer showing a large, slow event handling time
		const slow_time_display_timeout = 3000;

		// Threshold above which event handling is considered 'slow', in ms
		const slow_time_threshold = 50;

		// Threshold above which event handling is considered to be catastrophically slow, in ms
		const very_slow_time_threshold = 250;

		const currentTime = performance.now();
		if (
			this._lastEventDelay < slow_time_threshold ||
			delayMs > this._lastEventDelay ||
			currentTime - this._lastEventDelayTime > slow_time_display_timeout
		) {
			this._lastEventDelayTime = currentTime;
			this._lastEventDelay = delayMs;
			this.setOverlayMessage(
				'top-eventDelayTime',
				'Event handling delay: ' + Math.ceil(delayMs) + 'ms',
			);

			if (delayMs > very_slow_time_threshold) {
				const msg = _(
					'Event handling has been delayed for an unexpectedly long time: {0}ms',
				);
				this._map.uiManager.showInfoModal(
					'cool_alert',
					'',
					msg.replace('{0}', delayMs.toString()),
					'',
					_('OK'),
				);
			}
		}
	}
}

app.DebugManager = DebugManager;
