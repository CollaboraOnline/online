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

class ViewLayoutDocumentCompare extends ViewLayoutBase {
    public readonly type: string = 'ViewLayoutDocumentCompare';
    private halfWidth = 0; // Half width of the view.
    private viewGap = Math.round(20 / app.dpiScale); // The gap between the 2 views.
    private yStart = Math.round(20 / app.dpiScale); // The space above the first page.

    constructor() {
        super();

        app.events.on('resize', this.reset.bind(this));
        app.map.on('zoomend', this.reset.bind(this));

        this.reset();
    }

    public sendClientVisibleArea() {
        const visibleAreaCommand =
            'clientvisiblearea x=' +
            this.viewedRectangle.x1 +
            ' y=' +
            this.viewedRectangle.y1 +
            ' width=' +
            this.viewedRectangle.width +
            ' height=' +
            this.viewedRectangle.height;

        app.socket.sendMessage(visibleAreaCommand);

        return new cool.Bounds(
            new cool.Point(this.viewedRectangle.pX1, this.viewedRectangle.pY1),
            new cool.Point(this.viewedRectangle.pX2, this.viewedRectangle.pY2),
        );
    }

    private refreshCurrentCoordList() {
        this.currentCoordList.length = 0;
        const zoom = app.map.getZoom();

        const columnCount = Math.ceil(
            this._viewedRectangle.pWidth / TileManager.tileSize,
        );
        const rowCount = Math.ceil(
            this._viewedRectangle.pHeight / TileManager.tileSize,
        );
        const startX =
            Math.floor(this._viewedRectangle.pX1 / TileManager.tileSize) *
            TileManager.tileSize;
        const startY =
            Math.floor(this._viewedRectangle.pY1 / TileManager.tileSize) *
            TileManager.tileSize;

        for (let i = 0; i < columnCount; i++) {
            for (let j = 0; j < rowCount; j++) {
                let coords = new TileCoordData(
                    startX + i * TileManager.tileSize,
                    startY + j * TileManager.tileSize,
                    zoom,
                    0,
                    1
                );

                if (coords.x >= 0 && coords.y >= 0) {
                    this.currentCoordList.push(coords);

                    coords = new TileCoordData(
                        startX + i * TileManager.tileSize,
                        startY + j * TileManager.tileSize,
                        zoom,
                        0,
                        2 // This is different here.
                    );

                    this.currentCoordList.push(coords); // Second push.
                }

            }
        }
    }

    private refreshVisibleAreaRectangle(): void {
        const documentAnchor = this.getDocumentAnchorSection();

        this._viewedRectangle = cool.SimpleRectangle.fromCorePixels([
            this.scrollProperties.viewX,
            this.scrollProperties.viewY - this.yStart,
            this.halfWidth - this.viewGap,
            documentAnchor.size[1],
        ]);
    }

    private updateViewData() {
        if (!app.file.writer.pageRectangleList.length) return;

        const anchorSection = this.getDocumentAnchorSection();
        this.halfWidth = Math.round(anchorSection.size[0] * 0.5);

        this._viewSize = cool.SimplePoint.fromCorePixels(
            [
                Math.max(this.halfWidth, app.activeDocument.fileSize.pX + 2 * this.viewGap),
                Math.max(anchorSection.size[1], app.activeDocument.fileSize.pY + this.yStart)
            ]
        );

        this.refreshVisibleAreaRectangle();

        if (app.map._docLayer?._cursorMarker)
            app.map._docLayer._cursorMarker.update();

        this.sendClientVisibleArea();

        this.refreshCurrentCoordList();
        TileManager.checkRequestTiles(this.currentCoordList);
    }

    public documentToViewX(point: cool.SimplePoint): number {
        if (point.mode === 1)
            return this.halfWidth - app.activeDocument.fileSize.pX + point.pX - this.scrollProperties.viewX - this.viewGap;
        else
            return point.pX - this.scrollProperties.viewX + this.halfWidth + this.viewGap;
    }

    public documentToViewY(point: cool.SimplePoint): number {
        return point.pY + this.yStart - this.scrollProperties.viewY;
    }

    public canvasToDocumentPoint(point: cool.SimplePoint): cool.SimplePoint {
        const result = point.clone();

        if (this.scrollProperties.viewX)

        result.pX += this.scrollProperties.viewX;
        result.pY += this.scrollProperties.viewY;

        return result;
    }

    public refreshScrollProperties(): any {
        const documentAnchor = this.getDocumentAnchorSection();

        // The length of the railway that the scroll bar moves on up & down or left & right.
        this.scrollProperties.horizontalScrollLength = documentAnchor.size[0];
        this.scrollProperties.verticalScrollLength = documentAnchor.size[1];

        // Sizes of the scroll bars.
        this.calculateTheScrollSizes();

        // Properties for quick scrolling.
        this.scrollProperties.verticalScrollStep = documentAnchor.size[1] / 2;
        this.scrollProperties.horizontalScrollStep = documentAnchor.size[0] / 2;
    }

    public scroll(pX: number, pY: number): void {
        this.refreshScrollProperties();
        const documentAnchor = this.getDocumentAnchorSection();
        let scrolled = false;

        if (pX !== 0 && this.canScrollHorizontal(documentAnchor)) {
            const max =
                this.scrollProperties.horizontalScrollLength -
                this.scrollProperties.horizontalScrollSize;
            const min = 0;
            const current = this.scrollProperties.startX + pX;
            const endPosition = Math.max(min, Math.min(max, current));

            if (endPosition !== this.scrollProperties.startX) {
                this.scrollProperties.startX = endPosition;
                this.scrollProperties.viewX = Math.round(
                    (endPosition / this.scrollProperties.horizontalScrollLength) *
                    this.viewSize.pX,
                );
                scrolled = true;
            }
        }

        if (pY !== 0 && this.canScrollVertical(documentAnchor)) {
            const max =
                this.scrollProperties.verticalScrollLength -
                this.scrollProperties.verticalScrollSize;
            const min = 0;
            const current = this.scrollProperties.startY + pY;
            const endPosition = Math.max(min, Math.min(max, current));

            if (endPosition !== this.scrollProperties.startY) {
                this.scrollProperties.startY = endPosition;
                this.scrollProperties.viewY = Math.round(
                    (endPosition / this.scrollProperties.verticalScrollLength) *
                    this.viewSize.pY,
                );
                scrolled = true;
            }
        }

        if (scrolled) {
            this.sendClientVisibleArea();
            this.updateViewData();
            app.sectionContainer.requestReDraw();
        }
    }

    public scrollTo(pX: number, pY: number): void {
        const point = cool.SimplePoint.fromCorePixels([pX, pY]);
        if (!this.viewedRectangle.containsPoint(point.toArray())) {
            return;
        }
    }

    public reset() {
        if (!app.file.writer.pageRectangleList.length) return;

        this.updateViewData();
    }

    public get viewSize() {
        return this._viewSize;
    }

    public set viewSize(size: cool.SimplePoint) {
        return; // Disable setting the size externally.
    }

    public get viewedRectangle() {
        return this._viewedRectangle;
    }

    public set viewedRectangle(rectangle: cool.SimpleRectangle) {
        return; // Disable setting the viewed rectangle externally.
    }
}
