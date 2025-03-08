/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/app/Util.ts"/>
/// <reference path="helper/EventTypes.ts"/>

var assert = require('assert').strict;

describe('Evented: Register handler with event names as a string', function () {
	const contextTypes = ['self', 'foreign'];
	const callTypes = ['eventlist-string', 'event+handler-object'];
	for (const contextType of contextTypes) {
		for (const callType of callTypes) {
			runTestsForContextType(contextType, callType);
		}
	}
});

function runTestsForContextType(contextType: string, callType: string) {

	const obj = new DerivedEvented();
	const foreignContext = new ForeignContext();
	let context: DerivedEvented | ForeignContext = null;
	function getContext() {
		return contextType === 'self' ? obj : foreignContext;
	}

	function getEventRegObject(regData: EventRegistrationData[]): any{
		const object: any = {};
		for (const item of regData) {
			const parts = Util.splitWords(item.eventList);
			for (const evt of parts) {
				object[evt] = item.handler;
			}
		}

		return object;
	}

	function registerEvents(eventObj: Evented, regData: EventRegistrationData[], thisContext: any) {
		if (callType == 'eventlist-string') {

			for (const item of regData) {
				eventObj.on(item.eventList, item.handler, thisContext);
			}

		} else if (callType == 'event+handler-object') {

			const object: any = getEventRegObject(regData);
			eventObj.on(object, thisContext);

		} else {

			assert.fail('Invalid callType "' + callType + '"');

		}
	}

	function unregisterEvents(eventObj: Evented, regData: EventRegistrationData[], thisContext: any) {
		if (callType == 'eventlist-string') {

			for (const item of regData) {
				eventObj.off(item.eventList, item.handler, thisContext);
			}

		} else if (callType == 'event+handler-object') {

			const object: any = getEventRegObject(regData);
			eventObj.off(object, thisContext);

		} else {

			assert.fail('Invalid callType "' + callType + '"');

		}
	}

	function registerForOnce(eventObj: Evented, regData: EventRegistrationData[], thisContext: any) {
		if (callType == 'eventlist-string') {

			for (const item of regData) {
				eventObj.once(item.eventList, item.handler, thisContext);
			}

		} else if (callType == 'event+handler-object') {

			const object: any = getEventRegObject(regData);
			eventObj.once(object, thisContext);

		} else {

			assert.fail('Invalid callType "' + callType + '"');

		}
	}

	describe('with contextType = ' + contextType + ' callType = ' + callType, function() {
		beforeEach(function () {
			obj.reset();
			obj.off();
			foreignContext.reset();
			context = getContext();
		});

		it('no fire() => no handler calls', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1 e2', handler: context.handler1 },
				{ eventList: 'e3 e4', handler: context.handler2 },
			];

			registerEvents(obj, regData, context);

			unregisterEvents(obj, regData, context);

			assert.equal(0, context.first.numCalls);
			assert.equal(null, context.first.event);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});

		it('fire() called after off() must have no effect', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1 e2', handler: context.handler1 },
				{ eventList: 'e3 e4', handler: context.handler2 },
			];

			registerEvents(obj, regData, context);

			unregisterEvents(obj, regData, context);

			obj.fire('e1');
			obj.fire('e4');

			assert.equal(0, context.first.numCalls);
			assert.equal(null, context.first.event);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});

		it('fire() e1 and e4', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1 e2', handler: context.handler1 },
				{ eventList: 'e3 e4', handler: context.handler2 },
			];

			registerEvents(obj, regData, context);

			obj.fire('e1');
			obj.fire('e4');

			unregisterEvents(obj, regData, context);

			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);

			assert.equal(1, context.second.numCalls);
			assert.equal('e4', context.second.event.type);
			assert.equal(obj, context.second.event.target);
		});

		it('fire() all four events', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1 e2', handler: context.handler1 },
				{ eventList: 'e3 e4', handler: context.handler2 },
			];

			registerEvents(obj, regData, context);

			obj.fire('e1');
			obj.fire('e2');
			obj.fire('e3');
			obj.fire('e4');

			unregisterEvents(obj, regData, context);

			assert.equal(2, context.first.numCalls);
			assert.equal('e2', context.first.event.type);
			assert.equal(obj, context.first.event.target);

			assert.equal(2, context.second.numCalls);
			assert.equal('e4', context.second.event.type);
			assert.equal(obj, context.second.event.target);
		});

		it('fire() e4 multiple times', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1 e2', handler: context.handler1 },
				{ eventList: 'e3 e4', handler: context.handler2 },
			];

			registerEvents(obj, regData, context);

			obj.fire('e4');
			obj.fire('e4');
			obj.fire('e4');

			unregisterEvents(obj, regData, context);

			assert.equal(0, context.first.numCalls);
			assert.equal(null, context.first.event);

			assert.equal(3, context.second.numCalls);
			assert.equal('e4', context.second.event.type);
			assert.equal(obj, context.second.event.target);
		});

		it('fire() e2 then e1, ensure order of handler calls', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1 e2', handler: context.handler1 },
				{ eventList: 'e3 e4', handler: context.handler2 },
			];

			registerEvents(obj, regData, context);

			obj.fire('e2');
			obj.fire('e1');

			unregisterEvents(obj, regData, context);

			assert.equal(2, context.first.numCalls);
			// last called event type is captured.
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});

		it('fire() with data object', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerEvents(obj, regData, context);

			obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}});
			unregisterEvents(obj, regData, context);

			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);
			const eventData = context.first.event as any;
			assert.equal(42, eventData.key1);
			assert.equal('innerValue', eventData.key2.inner);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});

		it('fire() with no propagate but has parent object', function () {
			const parentObj = new DerivedEvented();

			const regDataChild: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];
			const regDataParent: EventRegistrationData[] = [
				{ eventList: 'e1', handler: parentObj.handler1 },
			];

			registerEvents(obj, regDataChild, context);
			registerEvents(parentObj, regDataParent, parentObj);

			// Register parent object.
			obj.addEventParent(parentObj);

			obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}});

			unregisterEvents(obj, regDataChild, context);
			unregisterEvents(parentObj, regDataParent, parentObj);

			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);
			const eventData = context.first.event as any;
			assert.equal(42, eventData.key1);
			assert.equal('innerValue', eventData.key2.inner);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);

			// No calls should have been made to parent object handlers.
			assert.equal(0, parentObj.first.numCalls);
			assert.equal(null, parentObj.first.event);

			assert.equal(0, parentObj.second.numCalls);
			assert.equal(null, parentObj.second.event);

			// Deregister parent object.
			obj.removeEventParent(parentObj);
		});

		it('fire() with propagate and has parent object', function () {
			const parentObj = new DerivedEvented();

			const regDataChild: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];
			const regDataParent: EventRegistrationData[] = [
				{ eventList: 'e1', handler: parentObj.handler1 },
			];

			registerEvents(obj, regDataChild, context);
			registerEvents(parentObj, regDataParent, parentObj);

			// Register parent object.
			obj.addEventParent(parentObj);

			obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}}, true);

			unregisterEvents(obj, regDataChild, context);
			unregisterEvents(parentObj, regDataParent, parentObj);

			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			const eventData = context.first.event as any;
			assert.equal(42, eventData.key1);
			assert.equal('innerValue', eventData.key2.inner);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);

			// Parent object must also have received the call.
			assert.equal(1, parentObj.first.numCalls);
			assert.equal('e1', parentObj.first.event.type);
			const eventData2 = parentObj.first.event as any;
			assert.equal(42, eventData2.key1);
			assert.equal('innerValue', eventData2.key2.inner);
			assert.deepEqual(obj, eventData2.layer);

			assert.equal(0, parentObj.second.numCalls);
			assert.equal(null, parentObj.second.event);

			// Deregister parent object.
			obj.removeEventParent(parentObj);
		});

		it('fire() with propagate but with removed parent object', function () {
			const parentObj = new DerivedEvented();

			const regDataChild: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];
			const regDataParent: EventRegistrationData[] = [
				{ eventList: 'e1', handler: parentObj.handler1 },
			];

			registerEvents(obj, regDataChild, context);
			registerEvents(parentObj, regDataParent, parentObj);

			// Register parent object.
			obj.addEventParent(parentObj);
			// Deregister the same parent.
			obj.removeEventParent(parentObj);

			obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}}, true);

			unregisterEvents(obj, regDataChild, context);
			unregisterEvents(parentObj, regDataParent, parentObj);

			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);
			const eventData = context.first.event as any;
			assert.equal(42, eventData.key1);
			assert.equal('innerValue', eventData.key2.inner);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);

			// No calls should have been made to parent object handlers.
			assert.equal(0, parentObj.first.numCalls);
			assert.equal(null, parentObj.first.event);

			assert.equal(0, parentObj.second.numCalls);
			assert.equal(null, parentObj.second.event);
		});

		it('listens() when object is not listening', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerEvents(obj, regData, context);

			assert.equal(false, obj.listens('e2'));

			unregisterEvents(obj, regData, context);
		});

		it('listens() when object stopped listening', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerEvents(obj, regData, context);
			unregisterEvents(obj, regData, context);

			assert.equal(false, obj.listens('e1'));
		});

		it('listens() when object is listening', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerEvents(obj, regData, context);

			assert.equal(true, obj.listens('e1'));

			unregisterEvents(obj, regData, context);
		});

		it('once() without firing', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerForOnce(obj, regData, context)

			unregisterEvents(obj, regData, context);

			assert.equal(0, context.first.numCalls);
			assert.equal(null, context.first.event);

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});

		it('once() with single fire()', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerForOnce(obj, regData, context)

			obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}});

			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);
			const eventData = context.first.event as any;
			assert.equal(42, eventData.key1);
			assert.equal('innerValue', eventData.key2.inner);
			// off() should have been called automatically
			// so listens() should return false.
			assert.equal(false, obj.listens('e1'));

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});

		it('once() with multiple fire()', function () {

			const regData: EventRegistrationData[] = [
				{ eventList: 'e1', handler: context.handler1 },
			];

			registerForOnce(obj, regData, context)

			obj.fire('e1', {key1: 42, key2: { inner: 'innerValue'}});
			obj.fire('e1', {key1: 4242, key2: { inner: 'innerValue'}});
			obj.fire('e1', {key1: 424242, key2: { inner: 'innerValue'}});

			// despite the multiple fire() calls, handler must have been
			// called just once.
			assert.equal(1, context.first.numCalls);
			assert.equal('e1', context.first.event.type);
			assert.equal(obj, context.first.event.target);
			const eventData = context.first.event as any;
			assert.equal(42, eventData.key1);
			assert.equal('innerValue', eventData.key2.inner);
			// off() should have been called automatically
			// so listens() should return false.
			assert.equal(false, obj.listens('e1'));

			assert.equal(0, context.second.numCalls);
			assert.equal(null, context.second.event);
		});
	});
}
