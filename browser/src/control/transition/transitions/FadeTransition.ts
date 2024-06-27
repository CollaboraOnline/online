class FadeTransition extends Transition2d {
    private effectTransition : number = 0;
    constructor(canvas: HTMLCanvasElement, vertexShaderSource: string, fragmentShaderSource: string, image1: HTMLImageElement, image2: HTMLImageElement) {
        super(canvas, vertexShaderSource, fragmentShaderSource, image1, image2);
        this.prepareTransition();
        this.animationTime = 1500;  
    }

    public renderUniformValue(): void {
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'effectType'), this.effectTransition);
    }

    public start(selectedEffectType : number): void {
        this.effectTransition = selectedEffectType;
        this.startTransition();
    }
}
