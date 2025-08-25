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
        protected _map: L.Map; // Expose _map as a protected property

        constructor(options?: any);
        addTo(map: L.Map): this;
        remove(): this;
        // Add other methods and properties as needed
        getPosition(): string;
        setPosition(position: string): this;
        getContainer(): HTMLElement | undefined;
        onAdd(map: L.Map): HTMLElement;
        onRemove(map: L.Map): void;

            // Properties
            options: any; // Replace 'any' with the appropriate type if known
            _container: HTMLElement | undefined;
            _position: string;

            // Methods
            addControl(control: L.Control): this;
            removeControl(control: L.Control): this;
            getContainer(): HTMLElement | undefined;
            setContainer(container: HTMLElement): void;
            getOptions(): any;
            setOptions(options: any): void;
            getMap(): L.Map | undefined;
            setMap(map: L.Map): void;
            menubar(): void; // Add menubar functionality if applicable

        static extend(props: any): any;
    }

    const control: Control;
    const map: L.Map;
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

// Common interface of all types of sockets created by createWebSocket().
interface SockInterface {
	onclose: (event: CloseEvent) => void;
	onerror: (event: Event) => void;
	onmessage: (event: MessageEvent) => void;
	onopen: (event: Event) => void;
	close: (code?: number, reason?: string) => void;
	send: (data: MessageInterface) => void;
	setUnloading?: () => void;

	readyState: 0 | 1 | 2 | 3;
	binaryType: 'blob' | 'arraybuffer';
}

interface ErrorMessages {
	diskfull: string;
	emptyhosturl: string;
	limitreached: string;
	infoandsupport: string;
	limitreachedprod: string;
	serviceunavailable: string;
	unauthorized: string;
	verificationerror: string;
	wrongwopisrc: string;
	sessionexpiry: string;
	sessionexpired: string;
	faileddocloading: string;
	invalidLink: string;
	leavind: string;
	docloadtimeout: string;
	docunloadingretry: string;
	docunloadinggiveup: string;
	clusterconfiguration: string;
	websocketproxyfailure: string;
	websocketgenericfailure: string;

	storage: {
		loadfailed: string;
		savediskfull: string;
		savetoolarge: string;
		saveunauthorized: string;
		savefailed: string;
		renamefailed: string;
		saveasfailed?: string;
	};

	uploadfile: {
		notfound: string;
		toolarge: string;
	};
}

// Extend the global Window interface
// Defined in: js/global.js
interface Window {
	// app defined in: js/bundle.js
	app: {
		colorPalettes: any; // TODO declare according to Widget.ColorPicker.ts
		colorNames: any; // TODO declare according to Widget.ColorPicker.ts
		console: Console;
		map: any; // TODO should be L.Map
		// file defined in: src/docstate.js
		file: {
			disableSidebar: boolean;
		};
		roundedDpiScale: number;
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
		useBrowserSetting: boolean;
		getBoolean(key: string, defaultValue?: boolean): boolean;
		get(key: string, defaultValue?: any): any;
		_initializeBrowserSetting(msg: string): void;
		set(key: string, value: any): void;
		setMultiple(prefs: Record<string, string>): void;
		sendPendingBrowserSettingsUpdate(): void;
	};

	allowUpdateNotification: boolean;
	autoShowWelcome: boolean;
	bundlejsLoaded: boolean;
	deeplEnabled: boolean;
	documentSigningEnabled: boolean;
	deviceFormFactor?: string;
	enableAccessibility: boolean;
	enableDebug: boolean;
	enableMacrosExecution: boolean;
	enableWelcomeMessage: boolean;
	expectedServerId: string;
	extraExportFormats: string[];
	fullyLoadedAndReady: boolean;
	imgDatas: string[];
	indirectSocket: boolean;
	migrating: boolean;
	mobileMenuWizard: boolean;
	pageMobileWizard: boolean;
	protocolDebug: boolean;
	routeToken: string;
	sidebarId: number;
	userInterfaceMode: string;
	ThisIsAMobileApp: boolean;
	ThisIsTheEmscriptenApp: boolean;
	ThisIsTheGtkApp: boolean;
	wopiSrc: string;
	zoteroEnabled: boolean;

	socket: SockInterface;
	errorMessages: ErrorMessages;
	queueMsg: MessageInterface[];

	makeWsUrlWopiSrc(
		path: string,
		docUrlParams: string,
		suffix?: string,
		wopiSrcParam?: string,
	): string;
	createShapesPanel(shapeType: string): HTMLDivElement;
	initializedUI?: () => void; // initializedUI is an optional function, potentially defined in branding
	setupToolbar(map: any): void; // TODO should be L.Map
	createWebSocket(url: string): SockInterface;
	getAccessibilityState(): boolean;
	makeClientVisibleArea(): string;
	postMobileDebug(msg: string): void;
}

// For localization
declare function _(text: string): string;
