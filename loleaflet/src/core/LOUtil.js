/*
 * L.LOUtil contains various LO related utility functions used throughout the code
 */

L.LOUtil = {
	// Based on core.git's colordata.hxx: COL_AUTHOR1_DARK...COL_AUTHOR9_DARK
	// consisting of arrays of RGB values
	// Maybe move the color logic to separate file when it becomes complex
	darkColors: [
		[198, 146, 0],
		[6,  70, 162],
		[87, 157,  28],
		[105,  43, 157],
		[197,   0,  11],
		[0, 128, 128],
		[140, 132,  0],
		[53,  85, 107],
		[209, 118,   0]
	],

	startSpinner: function (spinnerCanvas, spinnerSpeed) {
		var spinnerInterval;
		spinnerCanvas.width = 50;
		spinnerCanvas.height = 50;

		var context = spinnerCanvas.getContext('2d');
		context.lineWidth = 8;
		context.strokeStyle = 'grey';
		var x = spinnerCanvas.width / 2;
		var y = spinnerCanvas.height / 2;
		var radius = y - context.lineWidth / 2;
		spinnerInterval = setInterval(function() {
			context.clearRect(0, 0, x * 2, y * 2);
			// Move to center
			context.translate(x, y);
			context.rotate(spinnerSpeed * Math.PI / 180);
			context.translate(-x, -y);
			context.beginPath();
			context.arc(x, y, radius, 0, Math.PI * 1.3);
			context.stroke();
		}, 1);

		return spinnerInterval;
	},

	getViewIdHexColor: function(viewId) {
		var color = this.darkColors[(viewId + 1) % this.darkColors.length];
		return (color[2] | (color[1] << 8) | (color[0] << 16));
	},

	rgbToHex: function(color) {
		return '#' + ('000000' + color.toString(16)).slice(-6);
	}
};
