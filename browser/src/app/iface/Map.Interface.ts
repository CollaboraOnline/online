interface ParsedJSONResult {
	[name: string]: any;
}

interface CRSInterface {
	scale(zoom: number): number;
}

interface MapInterface extends Evented {
	_docLayer: DocLayerInterface;
	uiManager: UIManager;
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
	_fatal: boolean;
	_docPassword: string;

	options: {
		timestamp: number;
		doc: string;
		docParams: {
			access_token?: string;
			access_token_ttl?: string;
			no_auth_header?: string;
			permission?: 'edit' | 'readonly' | 'view';
		};
		renderingOptions: string;
		tileWidthTwips: number;
		tileHeightTwips: number;
		wopiSrc: string;
		previousWopiSrc: string;
		zoom: number;
		defaultZoom: number;
		crs: CRSInterface;
	};

	wopi: {
		resetAppLoaded(): void;
		DisableInactiveMessages: boolean;
		UserCanNotWriteRelative: boolean;
		BaseFileName: string;
	};

	loadDocument(socket?: SockInterface): void;
	getCurrentPartNumber(): number;
	getZoom(): number;
	showBusy(label: string, bar: boolean): void;
	hideBusy(): void;

	_clip: ClipboardInterface;

	setPermission(permission: 'edit' | 'readonly' | 'view'): void;
	onLockFailed(reason: string): void;
	updateModificationIndicator(newModificationTime: string): void;
	isEditMode(): boolean;
	isReadOnlyMode(): boolean;
	remove(): MapInterface;

	welcome: WelcomeInterface;
	_setLockProps(lockInfo: ParsedJSONResult): void;
	_setRestrictions(restrictionInfo: ParsedJSONResult): void;
	openUnlockPopup(cmd: ParsedJSONResult): void;

	_fireInitComplete(condition: string): void;
	sendInitUNOCommands(): void;
	initTextInput(docType: string): void;
	saveAs(filenme: string, format?: string, options?: string): void;

	menubar: Menubar;
}
