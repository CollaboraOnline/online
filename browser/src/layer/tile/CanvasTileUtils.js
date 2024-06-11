/* -*- js-indent-level: 8; fill-column: 100 -*- */

// eslint-disable-next-line no-unused-vars
function unpremultiply(rawDelta, byteLength, byteOffset = 0) {
	for (var i8 = byteOffset; i8 < byteLength + byteOffset; i8 += 4) {
		// premultiplied rgba -> unpremultiplied rgba
		var alpha = rawDelta[i8 + 3];
		if (alpha < 255) {
			if (alpha === 0) {
				rawDelta[i8] = 0;
				rawDelta[i8 + 1] = 0;
				rawDelta[i8 + 2] = 0;
			} else {
				// forced to do the math
				rawDelta[i8] = Math.ceil((rawDelta[i8] * 255) / alpha);
				rawDelta[i8 + 1] = Math.ceil((rawDelta[i8 + 1] * 255) / alpha);
				rawDelta[i8 + 2] = Math.ceil((rawDelta[i8 + 2] * 255) / alpha);
			}
		}
	}
}
