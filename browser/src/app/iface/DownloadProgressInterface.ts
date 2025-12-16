interface DownloadProgressInterface {
	isClosed(): boolean;
	startProgressMode(): void;
	_onComplete(): void;
	_onClose(): void;
	_onUpdateProgress(e: { statusType: string; value: number }): void;
}
