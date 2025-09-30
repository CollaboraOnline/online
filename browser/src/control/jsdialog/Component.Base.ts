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
 * Component.Base - base class for JSDialog components, wrappers which encapsulate
 *                  target DOM container and it's dedicated JSBuilder, it also receives
 *                  messages from JSDialogMessageRouter
 */

abstract class JSDialogComponent {
	protected map: any;
	protected name: string;
	protected builder?: JSBuilder;
	protected container?: HTMLElement;
	protected allowedJsonType: string;
	protected model: JSDialogModelState;

	constructor(map: any, name: string, allowedJsonType: string) {
		this.map = map;
		this.name = name;
		this.allowedJsonType = allowedJsonType;
		this.model = new JSDialogModelState(name);
	}

	/// connects component to the JSDialogMessageRouter
	protected registerMessageHandlers() {
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
	}

	/// disconnects component from JSDialogMessageRouter
	protected unregisterMessageHandlers() {
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	}

	/// create JSBuilder instance for this component
	protected abstract createBuilder(): void;

	/// assign or create container for the component
	protected abstract setupContainer(parentContainer?: HTMLElement): void;

	/// hanlde update message
	protected onJSUpdate(e: any) {
		var data = e.data;

		if (data.jsontype !== this.allowedJsonType) return;

		if (!this.container) return;

		if (!this.builder) return;

		app.console.debug(
			'Component ' + this.name + ' handles update message: ' + JSDialog.verbose
				? JSON.stringify(data.control)
				: data.control.id,
		);

		this.model.widgetUpdate(data);
		this.builder.updateWidget(this.container, data.control);

		return true;
	}

	/// handle action message
	protected onJSAction(e: any) {
		var data = e.data;

		if (data.jsontype !== this.allowedJsonType) return;

		if (!this.builder) return;

		if (!this.container) return;

		app.console.debug(
			'Component ' + this.name + ' handles action message: ' + JSDialog.verbose
				? JSON.stringify(data.data)
				: data.data.control_id,
		);

		this.model.widgetAction(data);
		this.builder.executeAction(this.container, data.data);

		return true;
	}
}
