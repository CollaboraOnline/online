/// <reference path="../../src/app/BaseClass.ts"/>
/// <reference path="../../src/app/Events.ts" />

class HandlerData {

	public numCalls: number;
	public event?: EventBaseType;

	constructor() {
		this.numCalls = 0;
		this.event = null;
	}
}

class DerivedEvented extends Evented {

	public first: HandlerData;
	public second: HandlerData;

	constructor() {
		super();
		this.reset();
	}

	public reset(): void {
		this.first = new HandlerData();
		this.second = new HandlerData();
	}

	public handler1(e: EventBaseType): void {
		this.first.numCalls++;
		this.first.event = e;
	}

	public handler2(e: EventBaseType): void {
		this.second.numCalls++;
		this.second.event = e;
	}
}

class ForeignContext {

	public first: HandlerData;
	public second: HandlerData;

	constructor() {
		this.reset();
	}

	public reset(): void {
		this.first = new HandlerData();
		this.second = new HandlerData();
	}

	public handler1(e: EventBaseType): void {
		this.first.numCalls++;
		this.first.event = e;
	}

	public handler2(e: EventBaseType): void {
		this.second.numCalls++;
		this.second.event = e;
	}
}

interface EventRegistrationData {
	eventList: string;
	handler: CEventListener;
}
