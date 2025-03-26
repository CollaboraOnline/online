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

interface OverlayControlInterface extends ControlInterface {
	setPrefix(prefix: string): OverlayControlInterface;
}

interface OverlaysInterface {
	[name: string]: OverlayControlInterface;
}
