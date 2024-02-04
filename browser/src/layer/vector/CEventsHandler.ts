import { Point } from '../../geometry/Point';

// Type of the data passed to event handlers.
export interface EventData {
	position?: Point;
}

type EventHandlerType = (data: EventData) => void;

// Used as base class for classes that needs to setup
// event handlers for real or synthetic events.
export abstract class CEventsHandler {

	protected supportedEventNames = [
		'add',
		'remove',
		'mouseenter',
		'mouseleave'
	];

	private handlers = new Map<string, Set<EventHandlerType>>();

	constructor() {
		var handlers = this.handlers;
		this.supportedEventNames.forEach(function (eName) {
			handlers.set(eName, new Set<EventHandlerType>());
		});
	}

	protected addSupportedEvents(eventNames: string[]) {
		for (var i = 0; i < eventNames.length; ++i) {
			var eName = eventNames[i];
			if (this.handlers.has(eName))
				continue;

			this.supportedEventNames.push(eName);
			this.handlers.set(eName, new Set<EventHandlerType>());
		}
	}

	on(eventName: string, handler: EventHandlerType): boolean {
		var handlerSet = this.handlers.get(eventName);
		if (handlerSet === undefined) {
			console.warn('Unknown event type: ' + eventName + ' used to register a handler');
			return false;
		}

		handlerSet.add(handler);
	}

	off(eventName: string, handler: EventHandlerType): boolean {
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

		handlerSet.forEach(function (handler: EventHandlerType) {
			handler.call(this, eventData);
		}, this);
	}
}
