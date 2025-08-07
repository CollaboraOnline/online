/* -*- js-indent-level: 8; indent-tabs-mode: t -*- */

// Including adapted sample code from
// <https://github.com/allotropia/zetajs/blob/main/examples/simple-examples/simple.js>:

/* global Module */

Module.zetajs.then((zetajs) => {
	const css = zetajs.uno.com.sun.star;
	const context = zetajs.getUnoComponentContext();
	const desktop = css.frame.Desktop.create(context);
	let awaitedFrame;
	const awaitingFrame = new Promise((resolve) => (awaitedFrame = resolve));
	// We need to wait until the sample.docx has been loaded and desktop.getCurrentFrame() will
	// retrun a non-null value.  But there appears to be no direct way to listen for that.  And
	// listening for online's docloaded event would not work reliably, as that gets fired (on
	// the browser main thread; via _emitSlurpedEvents -> _onMessage -> _onStatusMsg in
	// browser/src/core/Socket.js) in parallel with the relevant
	// framework::Desktop::setActiveFrame call being made (on the thread runnig soffice_main and
	// _emscripten_set_main_loop_arg; via SvpSalInstance::ImplYield -> ... ->
	// ImplHandleUserEvent -> ... -> vcl::Window::GrabFocus -> ... ->
	// framework::Desktop::setActiveFrame).  But that vcl::Window::GrabFocus ->
	// Window::ImplGrabFocus -> Window::ImplCallActivateListeners (in
	// vcl/source/window/window.cxx) will first CallEventListeners (which leads to the relevant
	// call of framework::Desktop::setActiveFrame) before
	// ImplGetParent()->ImplCallActivateListeners (which leads to the call of windowActivated on
	// the below XTopWindowListener; there are also earlier calls to that, before the frame has
	// become available; all we know is that there will be a call after the frame has become
	// available):
	const listener = zetajs.unoObject([css.awt.XTopWindowListener], {
		disposing() {},
		windowOpened() {},
		windowClosing() {},
		windowClosed() {},
		windowMinimized() {},
		windowNormalized() {},
		windowActivated() {
			const frame = desktop.getCurrentFrame();
			if (frame) {
				awaitedFrame(frame);
			}
		},
		windowDeactivated() {},
	});
	const toolkit = css.awt.Toolkit.create(context);
	toolkit.addTopWindowListener(listener);
	const frame = desktop.getCurrentFrame();
	if (frame) {
		awaitedFrame(frame);
	}
	awaitingFrame.then((frame) => {
		toolkit.removeTopWindowListener(listener);
		const xModel = frame.getController().getModel();
		const xText = xModel.getText();

		// insert string
		const xTextCursor = xText.createTextCursor();
		xTextCursor.setString('string here!');

		// colorize paragraphs
		const xParaEnumeration = xText.createEnumeration();
		for (const xParagraph of xParaEnumeration) {
			const color = Math.floor(Math.random() * 0xffffff);
			try {
				xParagraph.setPropertyValue('CharColor', color);
			} catch (e) {
				if (
					zetajs.getAnyType(zetajs.catchUnoException(e)) !=
					'com.sun.star.lang.IllegalArgumentException'
				) {
					throw e;
				}
			}
		}
	});
});
