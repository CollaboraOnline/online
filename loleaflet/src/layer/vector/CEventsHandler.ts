/* eslint-disable */

// Type of the data passed to event handlers.
interface EventData {
	position?: cool.Point;
}

// Used as base class for classes that needs to setup
// event handlers for real or synthetic events.
abstract class CEventsHandler {

	protected supportedEventNames = [
		'add',
		'remove',
		'mouseenter',
		'mouseleave'
	];

	private handlers = new Map<string, Set<Function>>();

	constructor() {
		var handlers = this.handlers;
		this.supportedEventNames.forEach(function (eName) {
			handlers.set(eName, new Set<Function>());
		});
	}

	protected addSupportedEvents(eventNames: string[]) {
		for (var i = 0; i < eventNames.length; ++i) {
			var eName = eventNames[i];
			if (this.handlers.has(eName))
				continue;

			this.supportedEventNames.push(eName);
			this.handlers.set(eName, new Set<Function>());
		}
	}

	on(eventName: string, handler: Function): boolean {
		var handlerSet = this.handlers.get(eventName);
		if (handlerSet === undefined) {
			console.warn('Unknown event type: ' + eventName + ' used to register a handler');
			return false;
		}

		handlerSet.add(handler);
	}

	off(eventName: string, handler: Function): boolean {
		var handlerSet = this.handlers.get(eventName);
		if (handlerSet === undefined) {
			console.warn('Unknown event type: ' + eventName + ' used to unregister a handler');
			return false;
		}

		var removed = handlerSet.delete(handler);
		if (!removed) {
			console.warn('Unregistered handler!');
			return false;
		}

		return true;
	}

	fire(eventName: string, eventData: EventData): boolean {
		var handlerSet = this.handlers.get(eventName);
		if (handlerSet === undefined) {
			console.warn('Unknown event type: ' + eventName);
			return false;
		}

		var that = this;
		handlerSet.forEach(function (handler) {
			handler.call(that, eventData);
		});
	}
}