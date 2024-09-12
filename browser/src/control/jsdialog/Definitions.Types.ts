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

/*
 * Definitions.Types - types and interfaces for JSDialog
 */

// common for all widgets
interface WidgetJSON {
	id: string; // unique id of a widget
	type: string; // type of widget
	enabled?: boolean; // enabled state
	visible?: boolean; // visibility state
	children: Array<WidgetJSON>; // child nodes
	title?: string;
	top?: string; // placement in the grid - row
	left?: string; // placement in the grid - column
	width?: string; // inside grid - width in number of columns
}

interface DialogResponse {
	id: string;
	response: number;
}

interface DialogJSON extends WidgetJSON {
	dialogid: string; // unique id for a dialog type, not instance
	responses?: Array<DialogResponse>;
}

// JSDialog message (full, update or action)
interface JSDialogJSON extends DialogJSON {
	id: string; // unique windowId
	jsontype: string; // specifies target componenet, on root level only
	action?: string; // optional name of an action
	control?: WidgetJSON;
}

// JSDialog message for popup
interface PopupData extends JSDialogJSON {
	isAutoCompletePopup?: boolean;
	cancellable?: boolean;
	canHaveFocus: boolean;
	noOverlay: boolean;
	popupParent?: string;
	clickToClose?: string;
	posx: number;
	posy: number;
}

// callback triggered by user actions
type JSDialogCallback = (
	objectType: string,
	eventType: string,
	object: any,
	data: any,
	builder: any,
) => void;

// used to define menus
type MenuDefinition = {
	id: string; // unique identifier
	type?: 'action' | 'menu' | 'separator' | 'html'; // type of entry
	text: string; // displayed text
	hint: string; // hint text
	uno: string; // uno command
	action: string; // dispatch command
	htmlId: string; // id of HTMLContent
	img: string; // icon name
	icon: string; // icon name FIXME: duplicated property, used in exportMenuButton
	checked: boolean; // state of check mark
	items: Array<any>; // submenu
};

interface ContainerWidgetJSON extends WidgetJSON {
	layoutstyle?: string | 'start' | 'end'; // describes alignment of the elements
	vertical?: boolean; // is horizontal or vertical container
}

interface GridWidgetJSON extends ContainerWidgetJSON {
	cols: number; // number of grid columns
	rows: number; // numer of grid rows
}

interface PanelWidgetJSON extends WidgetJSON {
	hidden: boolean; // is hidden
	command: string; // command to trigger options for a panel
	text: string; // panel title
}

type ExpanderWidgetJSON = any;

interface TextWidget extends WidgetJSON {
	text: string;
}

interface TreeEntryJSON {
	row: number | string; // unique id of the entry
	text: string; // deprecated: simple text for an entry
	columns: Array<{ text: any } | { collapsed: string }>; // entry data
}
interface TreeWidget extends WidgetJSON {
	text: string;
	singleclickactivate: boolean; // activates element on single click instead of just selection
	fireKeyEvents: boolean;
	entries: Array<TreeEntryJSON>;
}

interface IconViewEntry {
	row: number | string; // unique id of the entry
	separator: boolean; // is separator
	selected: boolean; // is currently selected
	image: string; // base64 encoded image
	text: string; // label of an entry
	tooltip: string; // tooltip of an entry
	ondemand: boolean; // if true then we ignore image property and request it on demand (when shown)
}
interface IconViewJSON extends WidgetJSON {
	entries: Array<IconViewEntry>;
	singleclickactivate: boolean; // activates element on single click instead of just selection
	textWithIconEnabled: boolean; // To identify if we should add text below the icon or not.
}
