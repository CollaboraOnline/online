interface COOLTouch {
	isTouchEvent: (e: Event | HammerInput) => boolean;
	touchOnly: <F extends (e: Event | HammerInput) => void>(
		f: F,
	) => (e: Event | HammerInput) => ReturnType<F> | undefined;
	mouseOnly: <F extends (e: Event | HammerInput) => void>(
		f: F,
	) => (e: Event | HammerInput) => ReturnType<F> | undefined;
	hasPrimaryTouchscreen: () => boolean;
	hasAnyTouchscreen: () => boolean;
	lastEventWasTouch: boolean | null;
	lastEventTime: Date | null;
	currentlyUsingTouchscreen: () => boolean;
}

interface Window {
	touch: COOLTouch;
}
