/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/app/Util.ts"/>
/// <reference path="../src/app/BaseClass.ts"/>
/// <reference path="../src/app/Events.ts" />

var assert = require('assert').strict;

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

describe('Evented: Register handler with event names as a string', function () {
	it('no fire() => no handler calls', function () {
		const obj = new DerivedEvented();
		obj.on('e1 e2', obj.handler1, obj);
		obj.on('e3 e4', obj.handler2, obj);

		obj.off('e1 e2', obj.handler1, obj);
		obj.off('e3 e4', obj.handler2, obj);

		assert.equal(0, obj.first.numCalls);
		assert.equal(null, obj.first.event);

		assert.equal(0, obj.second.numCalls);
		assert.equal(null, obj.second.event);
	});

	it('fire() called after off() must have no effect', function () {
		const obj = new DerivedEvented();
		obj.on('e1 e2', obj.handler1, obj);
		obj.on('e3 e4', obj.handler2, obj);


		obj.off('e1 e2', obj.handler1, obj);
		obj.off('e3 e4', obj.handler2, obj);

		obj.fire('e1');
		obj.fire('e4');

		assert.equal(0, obj.first.numCalls);
		assert.equal(null, obj.first.event);

		assert.equal(0, obj.second.numCalls);
		assert.equal(null, obj.second.event);
	});

	it('fire() e1 and e4', function () {
		const obj = new DerivedEvented();
		obj.on('e1 e2', obj.handler1, obj);
		obj.on('e3 e4', obj.handler2, obj);

		obj.fire('e1');
		obj.fire('e4');

		obj.off('e1 e2', obj.handler1, obj);
		obj.off('e3 e4', obj.handler2, obj);

		assert.equal(1, obj.first.numCalls);
		assert.equal('e1', obj.first.event.type);
		assert.equal(obj, obj.first.event.target);

		assert.equal(1, obj.second.numCalls);
		assert.equal('e4', obj.second.event.type);
		assert.equal(obj, obj.second.event.target);
	});

	it('fire() all four events', function () {
		const obj = new DerivedEvented();
		obj.on('e1 e2', obj.handler1, obj);
		obj.on('e3 e4', obj.handler2, obj);

		obj.fire('e1');
		obj.fire('e2');
		obj.fire('e3');
		obj.fire('e4');

		obj.off('e1 e2', obj.handler1, obj);
		obj.off('e3 e4', obj.handler2, obj);

		assert.equal(2, obj.first.numCalls);
		assert.equal('e2', obj.first.event.type);
		assert.equal(obj, obj.first.event.target);

		assert.equal(2, obj.second.numCalls);
		assert.equal('e4', obj.second.event.type);
		assert.equal(obj, obj.second.event.target);
	});

	it('fire() e4 multiple times', function () {
		const obj = new DerivedEvented();
		obj.on('e1 e2', obj.handler1, obj);
		obj.on('e3 e4', obj.handler2, obj);

		obj.fire('e4');
		obj.fire('e4');
		obj.fire('e4');

		obj.off('e1 e2', obj.handler1, obj);
		obj.off('e3 e4', obj.handler2, obj);

		assert.equal(0, obj.first.numCalls);
		assert.equal(null, obj.first.event);

		assert.equal(3, obj.second.numCalls);
		assert.equal('e4', obj.second.event.type);
		assert.equal(obj, obj.second.event.target);
	});

	it('fire() e2 then e1, ensure order of handler calls', function () {
		const obj = new DerivedEvented();
		obj.on('e1 e2', obj.handler1, obj);
		obj.on('e3 e4', obj.handler2, obj);

		obj.fire('e2');
		obj.fire('e1');

		obj.off('e1 e2', obj.handler1, obj);
		obj.off('e3 e4', obj.handler2, obj);

		assert.equal(2, obj.first.numCalls);
		// last called event type is captured.
		assert.equal('e1', obj.first.event.type);
		assert.equal(obj, obj.first.event.target);

		assert.equal(0, obj.second.numCalls);
		assert.equal(null, obj.second.event);
	});

	it('fire() with data object', function () {
		const obj = new DerivedEvented();
		obj.on('e1', obj.handler1, obj);

		obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}});

		obj.off('e1', obj.handler1, obj);

		assert.equal(1, obj.first.numCalls);
		assert.equal('e1', obj.first.event.type);
		const eventData = obj.first.event as any;
		assert.equal(42, eventData.key1);
		assert.equal('innerValue', eventData.key2.inner);

		assert.equal(0, obj.second.numCalls);
		assert.equal(null, obj.second.event);
	});

});
