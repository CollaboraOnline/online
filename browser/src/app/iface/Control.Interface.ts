interface ControlInterface {
	addTo(map: MapInterface): ControlInterface;
	remove(): void;
}

interface ControlLayerInterface extends ControlInterface {
	_container: HTMLDivElement;
	_addLayer(layer: BaseClass, name: string, overlay: boolean): void;
	_update(): void;
}

interface ControlsInterface {
	[name: string]: ControlLayerInterface;
}

interface OverlaysInterface {
	[name: string]: string;
}
