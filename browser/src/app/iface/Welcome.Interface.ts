interface HandlerInterface {
	enable(): void;
	disable(): void;
	enabled(): boolean;
}

interface WelcomeInterface extends HandlerInterface {
	addHooks(): void;
	isGuest(): boolean;
	onUpdateList(): void;
	shouldWelcome(): boolean;
	showWelcomeDialog(): void;
	removeHooks(): void;
	remove(): void;
	onMessage(e: { data: any }): void;
}
