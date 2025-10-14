/* -*- tab-width: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// TypeScript declarations for the global scope (e.g., window, document, etc.)

interface COOLTouch {
	isTouchEvent: (e: Event | HammerInput) => boolean;
	touchOnly: <F extends (e: Event | HammerInput) => void>(
		f: F,
	) => (e: Event | HammerInput) => ReturnType<F> | undefined;
	mouseOnly: <F extends (e: Event | HammerInput) => void>(
		f: F,
	) => (e: Event | HammerInput) => ReturnType<F> | undefined;
	hasPrimaryTouchscreen: () => boolean;
	hasAnyTouchscreen: () => boolean;
	lastEventWasTouch: boolean | null;
	lastEventTime: Date | null;
	currentlyUsingTouchscreen: () => boolean;
}

interface Window {
	touch: COOLTouch;
	setLogging(value: boolean): void;
}

/*
// Extend the JSDialog namespace
declare namespace JSDialog {
    class StatusBar {
        constructor();
        show(text: string, timeout?: number): void;
        hide(): void;
        setText(text: string): void;
        showProgress(text: string, progress: number): void;
        hideProgress(): void;
    }
}

// Extend the global L namespace
declare namespace L {
    class Map {
        constructor(element: string | HTMLElement, options?: any);
        setView(center: [number, number], zoom: number): this;
        addLayer(layer: any): this;
        removeLayer(layer: any): this;
        fire(type: string, data?: any, propagate?: boolean): this;
        on(type: string, fn: (event: any) => void, context?: any): this;
        off(type: string, fn?: (event: any) => void, context?: any): this;
        once(type: string, fn: (event: any) => void, context?: any): this;
        hasEventListeners(type: string): boolean;
        addEventListener(type: string, fn: (event: any) => void, context?: any): this;
        removeEventListener(type: string, fn?: (event: any) => void, context?: any): this;
        eachLayer(fn: (layer: any) => void, context?: any): this;
        invalidateSize(options?: boolean, oldSize?: any): this;
        getBounds(): any; // Replace 'any' with the appropriate type if known
        getZoom(): number;
        getCenter(): [number, number];
        fitBounds(bounds: any, options?: any): this; // Replace 'any' with the appropriate type if known
        panTo(center: [number, number]): this;
        zoomIn(delta?: number, options?: any): this;
        zoomOut(delta?: number, options?: any): this;

        statusBar: JSDialog.StatusBar
    }

    class Control {
        protected _map: window.L.Map; // Expose _map as a protected property

        constructor(options?: any);
        addTo(map: window.L.Map): this;
        remove(): this;
        // Add other methods and properties as needed
        getPosition(): string;
        setPosition(position: string): this;
        getContainer(): HTMLElement | undefined;
        onAdd(map: window.L.Map): HTMLElement;
        onRemove(map: window.L.Map): void;

            // Properties
            options: any; // Replace 'any' with the appropriate type if known
            _container: HTMLElement | undefined;
            _position: string;

            // Methods
            addControl(control: window.L.Control): this;
            removeControl(control: window.L.Control): this;
            getContainer(): HTMLElement | undefined;
            setContainer(container: HTMLElement): void;
            getOptions(): any;
            setOptions(options: any): void;
            getMap(): window.L.Map | undefined;
            setMap(map: window.L.Map): void;
            menubar(): void; // Add menubar functionality if applicable

        static extend(props: any): any;
    }

    const control: Control;
    const map: window.L.Map;
}
*/
// Add the app declaration
declare const app: {
	sectionContainer: CanvasSectionContainer;
	[key: string]: any; // other properties as needed
};

// Extend the global Document interface
interface Document {
	mozFullscreenElement: Element | null;
	msFullscreenElement: Element | null;
	webkitFullscreenElement: Element | null;
}

// Extend StringConstructor
interface StringConstructor {
	locale: string; // from cool-src.js
}

// Extend the global Window interface
// Defined in: js/global.js
interface Window {
	// app defined in: js/bundle.js
	app: {
		CSections: any;
		activeDocument: null | DocumentBase;
		definitions: any;
		dpiScale: number;
		canvasSize: null | cool.SimplePoint;
		viewId: null | number;
		isAdminUser: null | boolean;
		calc: {
			cellAddress: null | cool.SimplePoint;
			cellCursorVisible: boolean;
			cellCursorRectangle: null | cool.SimpleRectangle;
			decimalSeparator: null | string; // Current cell's decimal separator.
			otherCellCursors: any;
			splitCoordinate: null | cool.SimplePoint;
			partHashes: null | Array<any>; // hashes used to distinguish parts (we use sheet name)
			autoFilterCell: any; // The cell of the current autofilter popup.
			pivotTableFilterCell: any; // The cell of the current pivot table filter popup.
		};
		impress: {
			partList: any; // Info for parts.
			notesMode: boolean;
			twipsCorrection: number;
		};
		util: any;
		LOUtil: any;
		IconUtil: any;
		Evented: any;
		Log: any;
		DebugManager: any;
		dispatcher: any;
		layoutingService: any;
		serverConnectionService: any;
		twipsToPixels: number;
		pixelsToTwips: number;
		accessibilityState: boolean;
		UI: {
			language: {
				fromURL: string;
				fromBrowser: string;
				notebookbarAccessibility: any;
			};
		};
		colorPalettes: any; // TODO declare according to Widget.ColorPicker.ts
		colorNames: any; // TODO declare according to Widget.ColorPicker.ts
		console: Console;
		map: any; // TODO should be window.L.Map
		// file defined in: src/docstate.ts
		file: {
			editComment: boolean;
			allowManageRedlines: boolean;
			readOnly: boolean;
			permission: string;
			disableSidebar: boolean;
			textCursor: {
				visible: boolean;
				rectangle: null | cool.SimpleRectangle;
			};
			fileBasedView: boolean;
			writer: {
				pageRectangleList: Array<any>;
				multiPageView: boolean;
			};
			exportFormats: Array<any>;
		};
		roundedDpiScale: number;
		following: {
			mode: string;
			viewId: number;
		};
		tile: {
			size: null | cool.SimplePoint;
		};
		socket: any;
		languages: Array<string>;
		favouriteLanguages: Array<string>;
		colorLastSelection: any;
		serverAudit: any;
		events: any;
		showNavigator: boolean;
	};
	// coolParams defined in: js/global.js
	coolParams: {
		p: URLSearchParams;

		get(name: string): string;
	};
	mode: {
		isMobile(): boolean;
		isDesktop(): boolean;
		isTablet(): boolean;
		getDeviceFormFactor(): string;
	};
	prefs: {
		getBoolean(key: string, defaultValue?: boolean): boolean;
		get(key: string, defaultValue?: any): any;
		set(key: string, value: any): void;
		setMultiple(prefs: Record<string, string>): void;
		sendPendingBrowserSettingsUpdate(): void;
		canPersist: boolean;
	};

	allowUpdateNotification: boolean;
	deeplEnabled: boolean;
	documentSigningEnabled: boolean;
	enableAccessibility: boolean;
	enableMacrosExecution: boolean;
	enableWelcomeMessage: boolean;
	extraExportFormats: string[];
	mobileMenuWizard: boolean;
	pageMobileWizard: boolean;
	sidebarId: number;
	userInterfaceMode: string;
	ThisIsAMobileApp: boolean;
	ThisIsTheEmscriptenApp: boolean;
	zoteroEnabled: boolean;
	accessToken: string;
	accessTokenTTL: string;
	wopiSettingBaseUrl: string;
	socketProxy: boolean;
	langParam: string;

	createShapesPanel(shapeType: string): HTMLDivElement;
	initializedUI?: () => void; // initializedUI is an optional function, potentially defined in branding
	setupToolbar(map: any): void; // TODO should be L.Map
	makeWsUrl: (url: string) => string;
	getBorderStyleUNOCommand: (
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
		g: number,
	) => string;
	L: any;
}

// For localization
declare function _(text: string): string;
