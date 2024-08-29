/* -*- tab-width: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var app: any;
declare var SlideShow: any;

type AGConstructor<T> = abstract new (...args: any[]) => T;

type Handler0 = () => void;
type Handler1 = (x: any) => void;

function assert(object: any, message: string) {
	if (!object) {
		window.app.console.trace();
		throw new Error(message);
	}
}

function getCurrentSystemTime() {
	return performance.now();
}

// Remove any whitespace inside a string
function removeWhiteSpaces(str: string) {
	if (!str) return '';

	const re = / */;
	const aSplitString = str.split(re);
	return aSplitString.join('');
}

function clampN(nValue: number, nMinimum: number, nMaximum: number) {
	return Math.min(Math.max(nValue, nMinimum), nMaximum);
}

function booleanParser(sValue: string) {
	sValue = sValue.toLowerCase();
	return sValue === 'true';
}

// makeScaler is used in aPropertyGetterSetterMap:
// eslint-disable-next-line no-unused-vars
function makeScaler(nScale: number) {
	if (typeof nScale !== typeof 0 || !isFinite(nScale)) {
		window.app.console.log('makeScaler: not valid param passed: ' + nScale);
		return null;
	}

	return function (nValue: number) {
		return nScale * nValue;
	};
}

class PriorityQueue {
	private aSequence: any[];
	private aCompareFunc: (a: any, b: any) => number;

	constructor(aCompareFunc: (a: any, b: any) => number) {
		this.aSequence = [];
		this.aCompareFunc = aCompareFunc;
	}

	clone() {
		const aCopy = new PriorityQueue(this.aCompareFunc);
		const src = this.aSequence;
		const dest = [];
		for (let i = 0, l = src.length; i < l; ++i) {
			if (i in src) {
				dest.push(src[i]);
			}
		}
		aCopy.aSequence = dest;
		return aCopy;
	}

	top() {
		return this.aSequence[this.aSequence.length - 1];
	}

	isEmpty() {
		return this.aSequence.length === 0;
	}

	push(aValue: any) {
		this.aSequence.unshift(aValue);
		this.aSequence.sort(this.aCompareFunc);
	}

	clear() {
		this.aSequence = [];
	}

	pop() {
		return this.aSequence.pop();
	}
}

/** class PriorityEntry
 *  It provides an entry type for priority queues.
 *  Higher is the value of nPriority higher is the priority of the created entry.
 *
 *  @param aValue
 *      The object to be prioritized.
 *  @param nPriority
 *      An integral number representing the object priority.*
 */
class PriorityEntry {
	public aValue: any;
	private nPriority: number;

	constructor(aValue: any, nPriority: number) {
		this.aValue = aValue;
		this.nPriority = nPriority;
	}

	/** PriorityEntry.compare
	 *  Compare priority of two entries.
	 *
	 *  @param aLhsEntry
	 *      An instance of type PriorityEntry.
	 *  @param aRhsEntry
	 *      An instance of type PriorityEntry.
	 *  @return Integer
	 *      -1 if the left entry has lower priority of the right entry,
	 *       1 if the left entry has higher priority of the right entry,
	 *       0 if the two entry have the same priority
	 */
	static compare(aLhsEntry: PriorityEntry, aRhsEntry: PriorityEntry) {
		if (aLhsEntry.nPriority < aRhsEntry.nPriority) {
			return -1;
		} else if (aLhsEntry.nPriority > aRhsEntry.nPriority) {
			return 1;
		} else {
			return 0;
		}
	}
}

class DebugPrinter {
	private bEnabled = false;

	on() {
		this.bEnabled = true;
	}

	off() {
		this.bEnabled = false;
	}

	isEnabled() {
		return this.bEnabled;
	}

	print(sMessage: string, nTime?: number) {
		if (this.isEnabled()) {
			var sInfo = 'DBG: ' + sMessage;
			if (nTime) sInfo += ' (at: ' + String(nTime / 1000) + 's)';
			window.app.console.log(sInfo);
		}
	}
}

const aGenericDebugPrinter = new DebugPrinter();
aGenericDebugPrinter.on();

const NAVDBG = new DebugPrinter();
NAVDBG.on();

const ANIMDBG = new DebugPrinter();
ANIMDBG.on();

const aRegisterEventDebugPrinter = new DebugPrinter();
aRegisterEventDebugPrinter.on();

const aTimerEventQueueDebugPrinter = new DebugPrinter();
aTimerEventQueueDebugPrinter.on();

const aEventMultiplexerDebugPrinter = new DebugPrinter();
aEventMultiplexerDebugPrinter.on();

const aNextEffectEventArrayDebugPrinter = new DebugPrinter();
aNextEffectEventArrayDebugPrinter.on();

const aActivityQueueDebugPrinter = new DebugPrinter();
aActivityQueueDebugPrinter.on();

const aAnimatedElementDebugPrinter = new DebugPrinter();
aAnimatedElementDebugPrinter.on();
