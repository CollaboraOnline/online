interface PainterInterface {
	update(): void;
	_addTilePixelGridSection(): void;
	_removeTilePixelGridSection(): void;
	_addPreloadMap(): void;
	_removePreloadMap(): void;
	_addSplitsSection(): void;
	_removeSplitsSection(): void;
	_addDebugOverlaySection(): void;
	_removeDebugOverlaySection(): void;
}

interface DocLayerInterface {
	_painter: PainterInterface;

	isCalc(): boolean;
	isWriter(): boolean;
	isImpress(): boolean;
	isCalcRTL(): boolean;

	_pixelsToTwips(cssPix: cool.PointLike): cool.PointLike;
	_latLngToTwips(latlng: { lat: number; lng: number }): cool.Point;

	_postMouseEvent(
		typ: string,
		x: number,
		y: number,
		count: number,
		buttons: number,
		modifier: number,
	): void;
	postKeyboardEvent(typ: string, charCode: number, unoKeyCode: number): void;
}
