/* -*- js-indent-level: 8 -*- */
/*
 * Extends the event handling code with triple and quadruple click support
 * This is vaguely based on the DomEvent.DoubleTap implementation.
 */

L.extend(L.DomEvent, {

	addMultiClickListener: function (obj, handler, id) {
		var last = [],
		    delay = 250;

		function onClick(e) {
			var now = Date.now();
			var delta = 0;
			if (last) {
				delta = now - (last[last.length - 1] || now);
			}

			var doubleTap = (delta > 0 && delta <= delay);

			var tripleTap = false;
			if (last.length > 1 && doubleTap) {
				var delta2 = last[last.length - 1] - last[last.length - 2];
				tripleTap = (delta2 > 0 && delta2 <= delay);
			}

			if (tripleTap) {

				var quadTap = false;
				if (last.length > 2 && tripleTap) {
					var delta3 = last[last.length - 2] - last[last.length - 3];
					quadTap = (delta3 > 0 && delta3 <= delay);
				}

				// We can't modify e as it's a native DOM object, hence we copy
				// what we need instead. (I am however unable to actually find any
				// documentation regarding this anywhere.)
				var eOut = {
					type: quadTap ? 'qdrplclick' : 'trplclick',
					clientX: e.clientX,
					clientY: e.clientY,
					button: e.button,
					target: e.target,
					pointerType: e.pointerType,
					isMouseEvent: e instanceof MouseEvent
				};

				handler(eOut);
			}

			last.push(now);
			while (last.length > 3) {
				last.shift();
			}
		}

		obj['_leaflet_click' + id] = onClick;

		obj.addEventListener('click', onClick, false);
		return this;
	},

	removeMultiClickListener: function (obj, id) {
		obj.removeEventListener('click', obj['_leaflet_click' + id], false);

		return this;
	}
});
