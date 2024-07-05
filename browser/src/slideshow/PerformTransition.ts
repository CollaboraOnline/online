app.definitions.PerformTransition = function (
	canvas: HTMLCanvasElement,
	image1: HTMLImageElement,
	image2: HTMLImageElement,
    type: string,
) {

    switch (type) {
        case 'FADE':
            new FadeTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;
        case 'WIPE':
            new WipeTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;
        default:
            console.error('Unknown transition type');
            break;
    }

	return;
};
