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
        invalidateSize(options?: boolean | { animate: boolean }): this;
        getBounds(): any; // Replace 'any' with the appropriate type if known
        getZoom(): number;
        getCenter(): [number, number];
        fitBounds(bounds: any, options?: any): this; // Replace 'any' with the appropriate type if known
        panTo(center: [number, number], options?: any): this;
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

// Add the app declaration
declare const app: {
    sectionContainer: HTMLElement;
    [key: string]: any; // Add other properties as needed
}
*/
// Extend the global Window interface
// Defined in: js/global.js
interface Window {
	mode: {
		isMobile(): boolean;
		isDesktop(): boolean;
		isTablet(): boolean;
		getDeviceFormFactor(): string;
	};
	prefs: {
		getBoolean(key: string, defaultValue?: boolean): boolean;
		get(key: string, defaultValue?: string | undefined): string | undefined;
		set(key: string, value: string): void;
	};
	userInterfaceMode: string;
	ThisIsTheEmscriptenApp: boolean;
}

// For localization
declare function _(text: string): string;
