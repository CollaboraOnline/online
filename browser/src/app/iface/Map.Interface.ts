/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
interface MapInterface extends Evented {
	_docLayer: DocLayerInterface;
	uiManager: {
		toggleDarkMode(): void;
		showInfoModal(
			id: string,
			title: string,
			msg1: string,
			msg2: string,
			buttonText: string,
		): void;
	};
	_textInput: { debug(value: boolean): void };

	removeLayer(layer: any): void;
	addLayer(layer: any): void;
	setZoom(
		targetZoom: number,
		options: { [key: string]: any },
		animate: boolean,
	): void;

	stateChangeHandler: {
		getItemValue(unoCmd: string): string;
	};

	sendUnoCommand(unoCmd: string): void;

	getDocSize(): cool.Point;
	getSize(): cool.Point;
	getCenter(): { lat: number; lng: number };

	_docLoadedOnce: boolean;

	sidebar: Sidebar;

	_debug: DebugManager;
}
