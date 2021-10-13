/* eslint-disable */

/*
 * CDarkOverlay is used to render a dark overlay around an OLE object when selected
 */

class CDarkOverlay {

    private overlay: CanvasOverlay;
    private rectangles: CRectangle[] = [];

    constructor(canvasOverlay : CanvasOverlay) {
        this.overlay = canvasOverlay;
    }

    private invertOleBounds(oleBounds: CBounds) {
        var rectanglesBounds = [];

        var minWidth = 0;
        var minHeight = 0;
        var fullWidth = 1000000;
        var fullHeight = 1000000;

        rectanglesBounds.push(new CBounds(new CPoint(minWidth, minHeight), new CPoint(fullWidth, oleBounds.min.y)));
        rectanglesBounds.push(new CBounds(new CPoint(minWidth, oleBounds.min.y), oleBounds.getBottomLeft()));
        rectanglesBounds.push(new CBounds(oleBounds.getTopRight(), new CPoint(fullWidth, oleBounds.max.y)));
        rectanglesBounds.push(new CBounds(new CPoint(minWidth, oleBounds.max.y), new CPoint(fullWidth, fullHeight)));

        return rectanglesBounds;
    }

    private createRectangles(rectanglesBounds: CBounds[]){
        for (var i = 0; i < rectanglesBounds.length; i++){
            this.rectangles.push(new CRectangle(rectanglesBounds[i], {
                pointerEvents: 'none',
                fillColor: 'black',
                fillOpacity: 0.25,
                weight: 0,
                opacity: 0.25
            }));
        }
    }

    hasObjectFocusDarkOverlay() : boolean{
        return this.rectangles.length > 0;
    }

    show(oleBounds: CBounds){
        var rectanglesBounds = this.invertOleBounds(oleBounds);
        this.createRectangles(rectanglesBounds);

        for (var i = 0; i < this.rectangles.length; i++){
            this.overlay.initPath(this.rectangles[i]);
        }
    }

    remove(){
        for (var i = 0; i < this.rectangles.length; i++){
            this.overlay.removePath(this.rectangles[i]);
        }
        this.rectangles = [];
    }
}