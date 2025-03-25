interface MapInterface extends Evented {
	_docLayer: DocLayerInterface;
	uiManager: {
		toggleDarkMode(): void;
		showInfoModal(
			id: string,
			title: string,
			msg1: string,
			msg2: string,
			buttonText: string,
		): void;
	};
	_textInput: { debug(value: boolean): void };

	removeLayer(layer: any): void;
	addLayer(layer: any): void;
	setZoom(
		targetZoom: number,
		options: { [key: string]: any },
		animate: boolean,
	): void;

	stateChangeHandler: {
		getItemValue(unoCmd: string): string;
	};

	sendUnoCommand(unoCmd: string): void;

	getDocSize(): cool.Point;
	getSize(): cool.Point;
	getCenter(): { lat: number; lng: number };

	_docLoadedOnce: boolean;

	sidebar: Sidebar;

	_debug: DebugManager;
}
