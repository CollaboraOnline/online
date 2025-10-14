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

		if (data.jsontype !== this.allowedJsonType) return false;

		if (this.model) this.model.widgetUpdate(data);

		if (!this.container) return false;

		if (!this.builder) return false;

		app.console.debug(
			'Component ' + this.name + ' handles update message: ' + JSDialog.verbose
				? this.model.safeStringify(data.control)
				: data.control.id,
		);

		this.builder.updateWidget(this.container, data.control);

		return true;
	}

	/// handle action message
	protected onJSAction(e: any) {
		var data = e.data;

		if (data.jsontype !== this.allowedJsonType) return false;

		if (this.model) this.model.widgetAction(data);

		if (!this.builder) return false;

		if (!this.container) return false;

		app.console.debug(
			'Component ' + this.name + ' handles action message: ' + JSDialog.verbose
				? this.model.safeStringify(data.data)
				: data.data.control_id,
		);

		this.builder.executeAction(this.container, data.data);

		return true;
	}

	// tabs related - JSBuilder might want to put tabs into component

	public getTabs(): any[] {
		return [];
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public setTabs(tabs: any[]) {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public showTabs() {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public hideTabs() {}

	// customization

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public showItem(id: string, show?: boolean) {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public hideItem(id: string) {}
}
