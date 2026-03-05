interface ClipboardInterface {
	setKey(key: string): void;
	onComplexSelection(text?: string): void;
	[key: string]: any;
}
