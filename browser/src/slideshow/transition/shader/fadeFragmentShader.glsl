#version 300 es
precision mediump float;

uniform sampler2D leavingSlideTexture;
uniform sampler2D enteringSlideTexture;
uniform float time;
uniform int effectType; // 0: Fade through black, 1: Fade through white, 2: Smooth fade

in vec2 v_texCoord;
out vec4 outColor;

void main() {
    vec4 color0 = texture(leavingSlideTexture, v_texCoord);
    vec4 color1 = texture(enteringSlideTexture, v_texCoord);
    vec4 transitionColor;

    if (effectType == 0) {
        // Fade through black
        transitionColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (effectType == 1) {
        // Fade through white
        transitionColor = vec4(1.0, 1.0, 1.0, 1.0);
    }

    if (effectType == 2) {
        // Smooth fade
        float smoothTime = smoothstep(0.0, 1.0, time);
        outColor = mix(color0, color1, smoothTime);
    } else {
        if (time < 0.5) {
            outColor = mix(color0, transitionColor, time * 2.0);
        } else {
            outColor = mix(transitionColor, color1, (time - 0.5) * 2.0);
        }
    }
}
