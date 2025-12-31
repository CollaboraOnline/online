interface DownloadProgressInterface {
	isClosed(): boolean;
	isStarted(): boolean;
	isComplete(): boolean;
	currentStatus(): string;
	startProgressMode(): void;
	_onComplete(): void;
	_onClose(): void;
	_onUpdateProgress(e: { statusType: string; value: number }): void;
	setURI(uri: string): void;
	show(isLargeCopy: boolean): void;
}
