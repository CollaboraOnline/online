/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var brandProductFAQURL: string | undefined;

namespace cool {
	export namespace Util {
		let lastId = 0;
		export function nextId(): number {
			return ++lastId;
		}

		export interface IDAble {
			_leaflet_id: number;
			[name: string]: any;
		}

		/// Returns the id of the object. Initializes it if necessary.
		export function stamp(obj: IDAble): number {
			if (obj._leaflet_id > 0) {
				return obj._leaflet_id;
			}
			obj._leaflet_id = cool.Util.nextId();
			return obj._leaflet_id;
		}

		export type CallbackFunctionVariadic = (...args: any[]) => void;

		// return a function that won't be called more often than the given interval
		export function throttle(
			fn: cool.Util.CallbackFunctionVariadic,
			time: number,
			// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
			context: any,
		): CallbackFunctionVariadic {
			let lock: boolean = false;
			// eslint-disable-next-line prefer-const
			let wrapperFn: CallbackFunctionVariadic;
			let args: any[] | boolean = false;

			const later = function () {
				// reset lock and call if queued.
				lock = false;
				if (args) {
					wrapperFn.apply(context, args);
					args = false;
				}
			};

			wrapperFn = function (...args_: any[]) {
				if (lock) {
					// called too soon, queue to call later
					args = args_;
				} else {
					// call and lock until later
					fn.apply(context, args_);
					setTimeout(later, time);
					lock = true;
				}
			};

			return wrapperFn;
		}

		// wrap the given number to lie within a certain range (used for wrapping longitude)
		export function wrapNum(
			x: number,
			range: Array<number>,
			includeMax: boolean,
		): number {
			const max = range[1];
			const min = range[0];
			const d = max - min;
			return x === max && includeMax ? x : ((((x - min) % d) + d) % d) + min;
		}

		// do nothing (used as a noop throughout the code)
		export function falseFn(): boolean {
			return false;
		}

		// round a given number to a given precision
		export function formatNum(num: number, digits: number): number {
			var pow = Math.pow(10, digits || 5);
			return Math.round(num * pow) / pow;
		}

		// removes prefix from string if string starts with that prefix
		export function trimStart(str: string, prefix: string): string {
			if (str.indexOf(prefix) === 0) return str.substring(prefix.length);
			return str;
		}

		// removes suffix from string if string ends with that suffix
		export function trimEnd(str: string, suffix: string): string {
			var suffixIndex = str.lastIndexOf(suffix);
			if (suffixIndex !== -1 && str.length - suffix.length === suffixIndex)
				return str.substring(0, suffixIndex);
			return str;
		}

		// removes given prefix and suffix from the string if exists
		// if suffix is not specifed prefix is trimmed from both end of string
		// trim whitespace from both sides of a string if prefix and suffix are not given
		export function trim(
			str: string,
			prefix?: string,
			suffix?: string,
		): string {
			if (!prefix) return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
			let result = cool.Util.trimStart(str, prefix);
			result = cool.Util.trimEnd(result, suffix);
			return result;
		}

		// split a string into words
		export function splitWords(str: string): string[] {
			return cool.Util.trim(str).split(/\s+/);
		}

		export function round(x: number, e: number): number {
			if (!e) {
				return Math.round(x);
			}
			var f = 1.0 / e;
			return Math.round(x * f) * e;
		}

		export const templateRe = /\{ *([\w_]+) *\}/g;

		// super-simple templating facility, used for TileLayer URLs
		// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
		export function template(str: string, data: any): string {
			return str.replace(cool.Util.templateRe, function (str, key) {
				let value: any = data[key];

				if (value === undefined) {
					throw new Error('No value provided for variable ' + str);
				} else if (typeof value === 'function') {
					value = value(data);
				}
				return value;
			});
		}

		export const isArray =
			Array.isArray ||
			function (obj) {
				return Object.prototype.toString.call(obj) === '[object Array]';
			};

		// minimal image URI, set to an image when disposing to flush memory
		export const emptyImageUrl =
			'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

		export function toggleFullScreen(): void {
			const doc = document as any;
			if (
				!doc.fullscreenElement &&
				!doc.mozFullscreenElement &&
				!doc.msFullscreenElement &&
				!doc.webkitFullscreenElement
			) {
				if (doc.documentElement.requestFullscreen) {
					doc.documentElement.requestFullscreen();
				} else if (doc.documentElement.msRequestFullscreen) {
					doc.documentElement.msRequestFullscreen();
				} else if (doc.documentElement.mozRequestFullScreen) {
					doc.documentElement.mozRequestFullScreen();
				} else if (doc.documentElement.webkitRequestFullscreen) {
					doc.documentElement.webkitRequestFullscreen(
						(Element as any).ALLOW_KEYBOARD_INPUT,
					);
				}
			} else if (doc.exitFullscreen) {
				doc.exitFullscreen();
			} else if (doc.msExitFullscreen) {
				doc.msExitFullscreen();
			} else if (doc.mozCancelFullScreen) {
				doc.mozCancelFullScreen();
			} else if (doc.webkitExitFullscreen) {
				doc.webkitExitFullscreen();
			}
		}

		// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
		export function isEmpty(o: any): boolean {
			return !(o && o.length);
		}

		export function mm100thToInch(mm: number): number {
			return mm / 2540;
		}

		let _canvas: HTMLCanvasElement | null = null;

		export function getTempCanvas(): HTMLCanvasElement {
			if (_canvas) {
				return _canvas;
			}
			_canvas = document.createElement('canvas');
			return _canvas;
		}

		export function getTextWidth(text: string, font: string): number {
			const canvas = cool.Util.getTempCanvas();
			const context = canvas.getContext('2d');
			context.font = font;
			const metrics = context.measureText(text);
			return Math.floor(metrics.width);
		}

		export function getProduct(): string {
			let brandFAQURL =
				typeof brandProductFAQURL !== 'undefined'
					? brandProductFAQURL
					: 'https://collaboraonline.github.io/post/faq/';
			const customWindow = window as any;
			if (customWindow.feedbackUrl && customWindow.buyProductUrl) {
				const integratorUrl = encodeURIComponent(customWindow.buyProductUrl);
				brandFAQURL = customWindow.feedbackUrl;
				brandFAQURL =
					brandFAQURL.substring(0, brandFAQURL.lastIndexOf('/')) +
					'/product.html?integrator=' +
					integratorUrl;
			}
			return brandFAQURL;
		}

		export function replaceCtrlAltInMac(msg: string): string {
			if (L.Browser.mac) {
				var ctrl = /Ctrl/g;
				var alt = /Alt/g;
				const CustomString = String as any;
				if (
					CustomString.locale.startsWith('de') ||
					CustomString.locale.startsWith('dsb') ||
					CustomString.locale.startsWith('hsb')
				) {
					ctrl = /Strg/g;
				}
				if (CustomString.locale.startsWith('lt')) {
					ctrl = /Vald/g;
				}
				if (CustomString.locale.startsWith('sl')) {
					ctrl = /Krmilka/gi;
					alt = /Izmenjalka/gi;
				}
				return msg.replace(ctrl, '⌘').replace(alt, '⌥');
			}
			return msg;
		}

		export function randomString(len: number): string {
			let result = '';
			const ValidCharacters =
				'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
			for (let i = 0; i < len; i++) {
				result += ValidCharacters.charAt(
					Math.floor(Math.random() * ValidCharacters.length),
				);
			}
			return result;
		}
	}
}
