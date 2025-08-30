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
	_getViewId(): string;
	_painter: PainterInterface;
	_docType: string;

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

	filterSlurpedMessage(e: SlurpMessageEvent): boolean;
	_documentInfo?: string;

	removeAllViews(): void;
	_resetClientVisArea(): void;

	_onMessage(textMsg: string, img?: CoolHTMLImageElement): void;
	_resetCanonicalIdStatus(): void;
	_resetViewId(): void;
	_resetDocumentInfo(): void;

	options: {
		tileWidthTwips: number;
	};
}
