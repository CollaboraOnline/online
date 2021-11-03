/* eslint-disable */

/// Available types: info, warning, danger, link, success, primary. Works with bulma.css.

// Every "set" function returns the instance. So you can do this:
// (new DlgYesNo).Title('some title').Text('some text').YesButtonText('yes').NoButtonText('no').YesFunction(function () {/* */}).NoFunction(function() {/** */});
// "Yes" and "No" buttons call callback function, close the modal and destroy the modal.

class DlgYesNo {
    static _instanceCount: number = 0;
    _instance: DlgYesNo;
    _modalID: number;

    constructor() {
        this._instance = this;
        DlgYesNo._instanceCount++;
        this._modalID = DlgYesNo._instanceCount;
        this.initialize();
    }

    private initialize() {
        let html: string = this.getModalHTML();
        let element: HTMLDivElement = document.createElement('div');
        element.innerHTML = html;
        document.getElementsByTagName('body')[0].appendChild(element);
        this.initializeBackgroundClick();
        this.initializeCrossButton();
        this.initializeYesButton();
        this.initializeNoButton();
    }

    private initializeCrossButton() {
        let element = document.getElementById('modal-' + String(this._modalID));
        document.getElementById('modal-cross-button-' + String(this._modalID)).onclick = function() {
            element.classList.remove('is-active');
            element.parentNode.removeChild(element);
        };
    }

    private initializeBackgroundClick() {
        let element = document.getElementById('modal-' + String(this._modalID));
        document.getElementById('modal-background-' + String(this._modalID)).onclick = function() {
            element.classList.remove('is-active');
            element.parentNode.removeChild(element);
        };
    }

    private initializeYesButton() {
        let element = document.getElementById('modal-' + String(this._modalID));
        document.getElementById('modal-yes-button-' + String(this._modalID)).onclick = function() {
            element.classList.remove('is-active');
            element.parentNode.removeChild(element);
        };
    }

    private initializeNoButton() {
        let element = document.getElementById('modal-' + String(this._modalID));
        document.getElementById('modal-no-button-' + String(this._modalID)).onclick = function() {
            element.classList.remove('is-active');
            element.parentNode.removeChild(element);
        };
    }

    private getModalHTML(): string {
        let html: string = ' \
<div class="modal" id="modal-__created_id__"> \
    <div class="modal-background" id="modal-background-__created_id__"></div> \
    <div class="modal-card"> \
        <header class="modal-card-head" id="modal-head-__created_id__"> \
            <p class="modal-card-title" id="modal-title-__created_id__">Yes / No Modal Template</p> \
            <button class="delete" id="modal-cross-button-__created_id__"></button> \
        </header> \
        <section class="modal-card-body" id="modal-body-__created_id__">Yes / No Modal Body</section> \
        <footer class="modal-card-foot is-fullwidth" id="modal-foot-__created_id__"> \
            <button type="button" class="button is-pulled-left" id="modal-no-button-__created_id__" style="min-width:120px;">Cancel</button> \
            <button type="button" class="button is-pulled-right" id="modal-yes-button-__created_id__" style="min-width:120px;">OK</button> \
        </footer> \
    </div> \
</div>';

        html = html.split('__created_id__').join(String(this._modalID));
        return html;
    }

    yesButtonText(text: string): DlgYesNo {
        let button: HTMLButtonElement = <HTMLButtonElement>document.getElementById('modal-yes-button-' + String(this._modalID));
        button.innerText = text;
        return this._instance;
    }

    noButtonText(text: string): DlgYesNo {
        let button: HTMLButtonElement = <HTMLButtonElement>document.getElementById('modal-no-button-' + String(this._modalID));
        button.innerText = text;
        return this._instance;
    }

    title(text: string): DlgYesNo {
        let p: HTMLParagraphElement = <HTMLParagraphElement>document.getElementById('modal-title-' + String(this._modalID));
        p.innerText = text;
        return this._instance;
    }

    text(text: string): DlgYesNo {
        let d: HTMLDivElement = <HTMLDivElement>document.getElementById('modal-body-' + String(this._modalID));
        d.innerText = text;
        return this._instance;
    }

    type(type: string): DlgYesNo {
        let header: HTMLDivElement = <HTMLDivElement>document.getElementById('modal-head-' + String(this._modalID));
        header.className = 'modal-card-head has-background-' + type;
        return this._instance;
    }

    yesFunction(f: any): DlgYesNo {
        let element = document.getElementById('modal-' + String(this._modalID));
        document.getElementById('modal-yes-button-' + String(this._modalID)).onclick = function(e: MouseEvent) {
            f(e);
            element.classList.remove('is-active');
            element.parentNode.removeChild(element);
        };
        return this._instance;
    }

    noFunction(f: any): DlgYesNo {
        let element = document.getElementById('modal-' + String(this._modalID));
        document.getElementById('modal-no-button-' + String(this._modalID)).onclick = function(e: MouseEvent) {
            f(e);
            element.classList.remove('is-active');
            element.parentNode.removeChild(element);
        };
        return this._instance;
    }

    open() {
        document.getElementById('modal-' + String(this._modalID)).classList.add('is-active');
    }
}