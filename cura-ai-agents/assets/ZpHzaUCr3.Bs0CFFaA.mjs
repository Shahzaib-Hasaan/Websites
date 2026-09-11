import{t as e}from"./rolldown-runtime.Dh6celcD.mjs";import{A as t,O as n,P as r,_ as i,c as a,j as o,l as s,o as c,w as l,y as u}from"./react.Dma17R77.mjs";import{T as d,a as f,r as p,t as m}from"./motion.Di19_wo7.mjs";import{A as h,B as g,D as _,E as v,K as y,M as b,V as x,ct as S,d as C,gt as w,ht as T,j as ee,m as E,nt as D,r as O,rt as k,x as te}from"./framer.Dp0svOgn.mjs";import{a as A,i as ne,o as re,r as j}from"./shared-lib.DxXQ-1FW.mjs";var M,N=e((()=>{y(),M=ee({title:`Liquid Gradient`,resolutionScale:`consistent`,mouse:`disabledByDefault`,buffers:[{name:`push`,resolutionScale:.5,format:`rgba16f`,fragment:`
void main() {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 aspectFix = vec2(aspect, 1.0);

    vec2 texel = 1.0 / u_resolution;

    // --- Read own previous frame + neighbours ---
    vec4 prev = texture(u_push_buffer, v_uv);
    vec2 c  = prev.xy;
    vec2 nl = texture(u_push_buffer, v_uv - vec2(texel.x, 0.0)).xy;
    vec2 nr = texture(u_push_buffer, v_uv + vec2(texel.x, 0.0)).xy;
    vec2 nd = texture(u_push_buffer, v_uv - vec2(0.0, texel.y)).xy;
    vec2 nu = texture(u_push_buffer, v_uv + vec2(0.0, texel.y)).xy;

    vec2 blurred = (nl + nr + nd + nu) * 0.25;
    vec2 field = mix(c, blurred, 0.12);

    float r = clamp(u_deltaTime * 60.0, 0.0, 3.0);
    float decay = pow(mix(0.86, 0.985, clamp(u_mousePersist, 0.0, 1.0)), r);
    field *= decay;

    // --- Smooth the cursor velocity (EMA) ---
    // Raw .zw arrives in uneven per-frame pulses at low speeds; the EMA
    // spreads each pulse over a few frames so the deposit reads as a
    // continuous stream. ~0.25 blend per 60fps frame, frame-rate independent.
    vec2 rawVel = u_mousePosition.zw * aspectFix * u_mouseHover;
    float smoothK = 1.0 - pow(0.75, r); //or smoothK = 1. for original no smooth feeling
    vec2 mouseVel = mix(prev.zw, rawVel, smoothK);

    float speed    = length(mouseVel);
    float brush    = max(u_mouseRadius * 0.1, 0.001);

    float speedPerSec = speed / max(u_deltaTime, 1e-4);
    float moving      = 1.0 - exp(-speedPerSec * 0.5);

    vec2 dir       = speed > 1e-5 ? mouseVel / speed : vec2(1.0, 0.0);
    vec2 ortho     = vec2(-dir.y, dir.x);

    vec2 toMouse   = (v_uv - u_mousePosition.xy) * aspectFix;
    //toMouse       += dir * brush * 0.2 * moving;

    float along    = dot(toMouse, dir);
    float across   = dot(toMouse, ortho);
    float ra       = brush * (1.0 + u_mouseStretch * moving);
    float rb       = brush;
    float d2       = (along * along) / (ra * ra) + (across * across) / (rb * rb);
    float falloff  = exp(-d2);

    field += mouseVel * falloff * (u_mousePush * 0.1) * u_mouseHover;

    field = clamp(field, -1.0, 1.0);

    fragColor = vec4(field, mouseVel);
}
`}],fragment:`
// === CONSTANTS ===
const float GOLDEN_ANGLE = 2.3999632;
const float TAU = 6.28318530;

// === PCG hash - https://www.jcgt.org/published/0009/03/02/
uvec3 hash3(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z;
    v.y += v.z * v.x;
    v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z;
    v.y += v.z * v.x;
    v.z += v.x * v.y;
    return v;
}

// Seed
vec3 seedRandom(float seedVal) {
    uvec3 s = uvec3(
        floatBitsToUint(seedVal),
        floatBitsToUint(seedVal * 1.5 + 7.31),
        floatBitsToUint(seedVal * 2.7 + 13.37)
    );
    s = hash3(s);
    return vec3(s) / float(0xFFFFFFFFu);
}

// === COLOR SPACE UTILITIES ===
vec3 toLinear(vec3 c) {
    return pow(c, vec3(2.2));
}

vec3 toSrgb(vec3 c) {
    return pow(clamp(c, 0.0, 1.0), vec3(0.4545));
}

vec3 linearToOklab(vec3 c) {
    float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
    
    l = pow(max(l, 0.0), 1.0/3.0);
    m = pow(max(m, 0.0), 1.0/3.0);
    s = pow(max(s, 0.0), 1.0/3.0);
    
    return vec3(
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    );
}

vec3 oklabToLinear(vec3 c) {
    float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
    float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
    float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
    
    l = l * l * l;
    m = m * m * m;
    s = s * s * s;
    
    return vec3(
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
}

vec3 oklabToLch(vec3 lab) {
    return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y));
}

vec3 lchToOklab(vec3 lch) {
    return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));
}

vec3 mixLch(vec3 lab0, vec3 lab1, float t) {
    vec3 lch0 = oklabToLch(lab0);
    vec3 lch1 = oklabToLch(lab1);
    
    if (lch0.y < 0.05) lch0.z = lch1.z;
    if (lch1.y < 0.05) lch1.z = lch0.z;
    
    float dh = lch1.z - lch0.z;
    if (dh > 3.14159265) dh -= 6.28318530;
    if (dh < -3.14159265) dh += 6.28318530;
    
    return lchToOklab(vec3(
        mix(lch0.x, lch1.x, t),
        mix(lch0.y, lch1.y, t),
        lch0.z + dh * t
    ));
}

// === PALETTE SAMPLING ===
vec3 getColor(int idx) {
    if (u_colors_length < 1) return vec3(0.0);
    int safeIdx = clamp(idx, 0, u_colors_length - 1);
    return u_colors[safeIdx].rgb;
}

vec3 paletteN(float t, int count) {
    if (count < 1) return vec3(0.0);
    if (count < 2) return toLinear(getColor(0));
    
    float segmentSize = 1.0 / float(count - 1);
    t = clamp(t, 0.0, 1.0);
    int idx = min(int(floor(t / segmentSize)), count - 2);
    float localT = clamp((t - float(idx) * segmentSize) / segmentSize, 0.0, 1.0);
    
    vec3 lab0 = linearToOklab(toLinear(getColor(idx)));
    vec3 lab1 = linearToOklab(toLinear(getColor(idx + 1)));
    
    return oklabToLinear(mixLch(lab0, lab1, localT));
}

// === DITHER ===
float IGN(vec2 uv) {
    return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715))));
}

float quickNoise(vec2 I) {
    return fract(sin(dot(I, vec2(12.9898, 78.233))) * 43758.5453);
}

// Dither Mode: 0=Off, 1=IGN, 2=quickNoise
float getDither(vec2 I, float mode) {
    if (mode < 0.5) return 0.5;          // 0: Off
    if (mode < 1.5) return IGN(I);       // 1: Smooth
    return quickNoise(I);                // 2: Grain
}

// === POST-PROCESS ===
vec3 softGamutMap(vec3 linearRgb) {
    float maxC = max(linearRgb.r, max(linearRgb.g, linearRgb.b));
    float minC = min(linearRgb.r, min(linearRgb.g, linearRgb.b));
    
    if (minC >= 0.0 && maxC <= 1.0) return linearRgb;
    
    vec3 lab = linearToOklab(max(linearRgb, 0.0));
    float L = clamp(lab.x, 0.0, 1.0);
    float C = length(lab.yz);
    float h = atan(lab.z, lab.y);
    
    float maxChroma = 0.4 * (1.0 - pow(abs(2.0 * L - 1.0), 2.0));
    
    if (C > maxChroma * 0.7) {
        float knee = maxChroma * 0.7;
        C = knee + (maxChroma - knee) * tanh((C - knee) / (maxChroma - knee + 0.001));
    }
    
    return clamp(oklabToLinear(vec3(L, C * cos(h), C * sin(h))), 0.0, 1.0);
}

vec3 applyContrastSaturation(vec3 linearRgb, float contrast, float saturation) {
    vec3 lab = linearToOklab(linearRgb);
    float C = length(lab.yz);
    float h = atan(lab.z, lab.y);
    
    lab.x = clamp((lab.x - 0.5) * contrast + 0.5, 0.0, 1.0);
    C *= saturation;
    lab.y = C * cos(h);
    lab.z = C * sin(h);
    
    return oklabToLinear(lab);
}

// === MAIN ===
void main() {
    vec2 fragCoord = v_uv * u_resolution;
    vec2 r = u_resolution;
    vec2 p = (fragCoord * 2.0 - r) / r.y;
    
    int colorCount = u_colors_length;
    
    // Early out: no colors -> black
    if (colorCount < 1) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float t = u_time * 0.3;
    
    // Map time onto a circle so animation seamlessly wraps.
    float looping = step(0.5, u_loop);
    float phase = TAU * u_time / max(u_loop, 0.01);
    float radius = u_loop * u_speed * 0.3 / TAU;
    float tA = sin(phase) * radius;
    float tB = (1.0 - cos(phase)) * radius;
    
    // Seed-based offsets
    vec3 seedOffset = seedRandom(u_seed);
    vec3 seedOffset2 = seedRandom(u_seed + 100.0);
    
    // Golden angle rotation
    float seedAngle = u_seed * GOLDEN_ANGLE;
    vec2 seedPhase = (seedOffset2.xy - 0.5) * TAU;
    
    // Seed-based rotation
    float cs = cos(seedAngle);
    float sn = sin(seedAngle);
    mat2 rot = mat2(cs, -sn, sn, cs);
    p = rot * p;

    // === MOUSE PUSH ===
    // Displace the domain by the accumulated push field so the pattern
    // drags in the direction the cursor moved, then relaxes as it decays.
    vec2 pushField = texture(u_push_buffer, v_uv).xy;
    p -= rot * pushField * 2.0;
    
    // Get dither value
    float dither = getDither(floor(fragCoord / u_pixelRatio), u_ditherMode);
    
    // === TURBULENCE ===
    float totalVal = 0.0;
    float totalWeight = 0.0;
    int turbIter = int(u_turbIter);
    
    float freq = 1.0 / max(u_turbFreq, 0.01);
    
    for (float i = 0.0; i < 4.0; i++) {
        float eph = i / 4.0;
       
        vec2 q = p * u_scale;
        float sq = eph * eph;
        
        if (u_jellify > 0.5) {
            q.yx *= mix(1.0, 0.5, 1.0 - exp(-sq));
        }
        
        float a = seedPhase.x;
        float d = seedPhase.y;
        
        for (int j = 2; j < 13; j++) {
            if (j >= turbIter) break;
            float fj = float(j);
            // When looping, use circular time. Otherwise original t.
            float t1 = mix(t * u_speed, tA, looping);
            float t2 = mix(t * u_speed, tB, looping);
            q += u_turbAmp * sin(q.yx / freq * fj + t1 + vec2(a, d) + seedOffset.xy * fj) / fj;
            a += cos(fj + d * 1.2 + q.x * 2.0 - t1 + seedOffset2.z + t2 * 0.3 * looping);
            d += sin(fj * q.y + a + seedOffset.z + t1 + seedOffset2.y + t2 * 0.3 * looping);
        }
        
        float v = 0.5 + 0.5 * sin(length(q.yx + vec2(a, d) * 0.2) * u_waveFreq + i * i + seedOffset.x);
        float weight = smoothstep(0.0, 0.5, eph) * smoothstep(1.0, 0.5, eph);
        totalVal += v * weight;
        totalWeight += weight;
    }
    
    float val = totalVal / totalWeight;
    val = clamp((val - 0.3) / 0.4, 0.0, 1.0);
    val = pow(val, exp(-u_distBias));
    val = clamp(val + (dither - 0.5) * u_dither, 0.0, 1.0);
    
    vec3 col = paletteN(val, colorCount);
    col *= u_exposure;
    col = applyContrastSaturation(col, u_contrast, u_saturation);
    col = softGamutMap(col);
    col = toSrgb(col);
    
    fragColor = vec4(col, 1.0);
}
`,propertyControls:{colors:{type:O.Array,title:`Colors`,control:{type:O.Color},maxCount:8,defaultValue:[`#00001A`,`#2962FF`,`#40BCFF`,`#FFB8B5`,`#FFC14F`]},seed:{type:O.Number,title:`Seed`,defaultValue:648,min:0,max:1e3,step:1},speed:{type:O.Number,title:`Speed`,defaultValue:.3,min:0,max:2,step:.01},loop:{type:O.Number,title:`Loop`,defaultValue:0,min:0,max:60,step:.5,hiddenWhenUnset:!0,displayStepper:!0},scale:{type:O.Number,title:`Scale`,defaultValue:.42,min:.1,max:2,step:.01},turbAmp:{type:O.Number,title:`Amplitude`,defaultValue:.6,min:0,max:1,step:.01},turbFreq:{type:O.Number,title:`Frequency`,defaultValue:.1,min:.1,max:2,step:.01},turbIter:{type:O.Number,title:`Definition`,defaultValue:7,min:3,max:10,step:1,displayStepper:!0},waveFreq:{type:O.Number,title:`Bands`,defaultValue:3.8,min:.1,max:5,step:.1},distBias:{type:O.Number,title:`Bias`,defaultValue:0,min:-1,max:1,step:.1,hiddenWhenUnset:!0},jellify:{type:O.Boolean,title:`Jellify`,defaultValue:!1,hiddenWhenUnset:!0},mousePush:{type:O.Number,title:`Push`,defaultValue:.5,min:.1,max:1,step:.1,section:`Mouse`},mouseRadius:{type:O.Number,title:`Radius`,defaultValue:1,min:.1,max:1,step:.1,section:`Mouse`},mouseStretch:{type:O.Number,title:`Stretch`,defaultValue:0,min:0,max:1,step:.1,section:`Mouse`},mousePersist:{type:O.Number,title:`Persistence`,defaultValue:.8,min:0,max:1,step:.01,section:`Mouse`},ditherMode:{type:O.Enum,title:`Noise`,options:[0,1,2],optionTitles:[`Off`,`Smooth`,`Grain`],defaultValue:0},dither:{type:O.Number,title:`Amount`,defaultValue:.05,min:0,max:.2,step:.01,hidden:e=>e.ditherMode===0},exposure:{type:O.Number,title:`Exposure`,defaultValue:1.1,min:.5,max:2,step:.1,section:`Filters`,displayStepper:!0,hiddenWhenUnset:!0},contrast:{type:O.Number,title:`Contrast`,defaultValue:1.1,min:.5,max:2,step:.1,section:`Filters`,displayStepper:!0,hiddenWhenUnset:!0},saturation:{type:O.Number,title:`Saturation`,defaultValue:1,min:0,max:2,step:.1,section:`Filters`,displayStepper:!0,hiddenWhenUnset:!0}}})})),P,F,I,L=e((()=>{y(),b.loadFonts([`GF;Fraunces-500`,`GF;Fraunces-700`,`GF;Fraunces-700italic`,`GF;Fraunces-500italic`]),P=[{explicitInter:!0,fonts:[{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`normal`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujC_TShUtWNg.woff2`,weight:`500`},{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`normal`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcUByjC_TShUtWNg.woff2`,weight:`700`},{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`italic`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NVf8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9vIVYX9G37lvd9sPEKsxx664UJf1isSv7Tp05GNi3k.woff2`,weight:`700`},{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`italic`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NVf8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9vIVYX9G37lvd9sPEKsxx664UJf1h5Tf7Tp05GNi3k.woff2`,weight:`500`}]}],F=[`.framer-LaInx .framer-styles-preset-1exvcw0:not(.rich-text-wrapper), .framer-LaInx .framer-styles-preset-1exvcw0.rich-text-wrapper h5 { --framer-font-family: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-open-type-features: 'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on; --framer-font-size: 28px; --framer-font-style: normal; --framer-font-style-bold: normal; --framer-font-style-bold-italic: italic; --framer-font-style-italic: italic; --framer-font-variation-axes: normal; --framer-font-weight: 500; --framer-font-weight-bold: 700; --framer-font-weight-bold-italic: 700; --framer-font-weight-italic: 500; --framer-letter-spacing: -0.04em; --framer-line-height: 1.3em; --framer-paragraph-spacing: 40px; --framer-text-alignment: start; --framer-text-color: var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, #1a1a1a); --framer-text-decoration: none; --framer-text-stroke-color: initial; --framer-text-stroke-width: initial; --framer-text-transform: none; }`,`@media (max-width: 1199px) and (min-width: 810px) { .framer-LaInx .framer-styles-preset-1exvcw0:not(.rich-text-wrapper), .framer-LaInx .framer-styles-preset-1exvcw0.rich-text-wrapper h5 { --framer-font-family: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-open-type-features: 'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on; --framer-font-size: 26px; --framer-font-style: normal; --framer-font-style-bold: normal; --framer-font-style-bold-italic: italic; --framer-font-style-italic: italic; --framer-font-variation-axes: normal; --framer-font-weight: 500; --framer-font-weight-bold: 700; --framer-font-weight-bold-italic: 700; --framer-font-weight-italic: 500; --framer-letter-spacing: -0.04em; --framer-line-height: 1.3em; --framer-paragraph-spacing: 40px; --framer-text-alignment: start; --framer-text-color: var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, #1a1a1a); --framer-text-decoration: none; --framer-text-stroke-color: initial; --framer-text-stroke-width: initial; --framer-text-transform: none; } }`,`@media (max-width: 809px) and (min-width: 0px) { .framer-LaInx .framer-styles-preset-1exvcw0:not(.rich-text-wrapper), .framer-LaInx .framer-styles-preset-1exvcw0.rich-text-wrapper h5 { --framer-font-family: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-open-type-features: 'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on; --framer-font-size: 22px; --framer-font-style: normal; --framer-font-style-bold: normal; --framer-font-style-bold-italic: italic; --framer-font-style-italic: italic; --framer-font-variation-axes: normal; --framer-font-weight: 500; --framer-font-weight-bold: 700; --framer-font-weight-bold-italic: 700; --framer-font-weight-italic: 500; --framer-letter-spacing: -0.04em; --framer-line-height: 1.3em; --framer-paragraph-spacing: 40px; --framer-text-alignment: start; --framer-text-color: var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, #1a1a1a); --framer-text-decoration: none; --framer-text-stroke-color: initial; --framer-text-stroke-width: initial; --framer-text-transform: none; } }`],I=`framer-LaInx`})),R,z,B,ie=e((()=>{y(),b.loadFonts([`GF;Fraunces-500`,`GF;Fraunces-700`,`GF;Fraunces-700italic`,`GF;Fraunces-500italic`]),R=[{explicitInter:!0,fonts:[{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`normal`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujC_TShUtWNg.woff2`,weight:`500`},{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`normal`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcUByjC_TShUtWNg.woff2`,weight:`700`},{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`italic`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NVf8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9vIVYX9G37lvd9sPEKsxx664UJf1isSv7Tp05GNi3k.woff2`,weight:`700`},{cssFamilyName:`Fraunces`,openType:!0,source:`google`,style:`italic`,uiFamilyName:`Fraunces`,url:`https://fonts.gstatic.com/s/fraunces/v38/6NVf8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9vIVYX9G37lvd9sPEKsxx664UJf1h5Tf7Tp05GNi3k.woff2`,weight:`500`}]}],z=[`.framer-wXc3K .framer-styles-preset-ad8lfm:not(.rich-text-wrapper), .framer-wXc3K .framer-styles-preset-ad8lfm.rich-text-wrapper h4 { --framer-font-family: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-open-type-features: 'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on; --framer-font-size: 32px; --framer-font-style: normal; --framer-font-style-bold: normal; --framer-font-style-bold-italic: italic; --framer-font-style-italic: italic; --framer-font-variation-axes: normal; --framer-font-weight: 500; --framer-font-weight-bold: 700; --framer-font-weight-bold-italic: 700; --framer-font-weight-italic: 500; --framer-letter-spacing: -0.05em; --framer-line-height: 1.3em; --framer-paragraph-spacing: 40px; --framer-text-alignment: start; --framer-text-color: var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, #1a1a1a); --framer-text-decoration: none; --framer-text-stroke-color: initial; --framer-text-stroke-width: initial; --framer-text-transform: none; }`,`@media (max-width: 1199px) and (min-width: 810px) { .framer-wXc3K .framer-styles-preset-ad8lfm:not(.rich-text-wrapper), .framer-wXc3K .framer-styles-preset-ad8lfm.rich-text-wrapper h4 { --framer-font-family: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-open-type-features: 'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on; --framer-font-size: 28px; --framer-font-style: normal; --framer-font-style-bold: normal; --framer-font-style-bold-italic: italic; --framer-font-style-italic: italic; --framer-font-variation-axes: normal; --framer-font-weight: 500; --framer-font-weight-bold: 700; --framer-font-weight-bold-italic: 700; --framer-font-weight-italic: 500; --framer-letter-spacing: -0.05em; --framer-line-height: 1.3em; --framer-paragraph-spacing: 40px; --framer-text-alignment: start; --framer-text-color: var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, #1a1a1a); --framer-text-decoration: none; --framer-text-stroke-color: initial; --framer-text-stroke-width: initial; --framer-text-transform: none; } }`,`@media (max-width: 809px) and (min-width: 0px) { .framer-wXc3K .framer-styles-preset-ad8lfm:not(.rich-text-wrapper), .framer-wXc3K .framer-styles-preset-ad8lfm.rich-text-wrapper h4 { --framer-font-family: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-bold-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-family-italic: "Fraunces", "Fraunces Placeholder", serif; --framer-font-open-type-features: 'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on; --framer-font-size: 24px; --framer-font-style: normal; --framer-font-style-bold: normal; --framer-font-style-bold-italic: italic; --framer-font-style-italic: italic; --framer-font-variation-axes: normal; --framer-font-weight: 500; --framer-font-weight-bold: 700; --framer-font-weight-bold-italic: 700; --framer-font-weight-italic: 500; --framer-letter-spacing: -0.05em; --framer-line-height: 1.3em; --framer-paragraph-spacing: 40px; --framer-text-alignment: start; --framer-text-color: var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, #1a1a1a); --framer-text-decoration: none; --framer-text-stroke-color: initial; --framer-text-stroke-width: initial; --framer-text-transform: none; } }`],B=`framer-wXc3K`})),ae,V,H,U,W,G,K,q,J,oe=e((()=>{c(),y(),m(),l(),ae=`framer-QBVjc`,V={ZaDv32lfH:`framer-v-l9eat1`},H={bounce:.2,delay:0,duration:.4,type:`spring`},U=e=>typeof e==`object`&&e&&typeof e.src==`string`?e:typeof e==`string`?{src:e}:void 0,W=({value:e,children:n})=>{let r=t(f),i=e??r.transition,s=o(()=>({...r,transition:i}),[JSON.stringify(i)]);return a(f.Provider,{value:s,children:n})},G=d.create(r),K=({click:e,height:t,id:n,image:r,link:i,width:a,...o})=>({...o,OO2DFLBCZ:r??o.OO2DFLBCZ,yobczhv92:e??o.yobczhv92,ZKAqT37Hr:i??o.ZKAqT37Hr}),q=(e,t)=>e.layoutDependency?t.join(`-`)+e.layoutDependency:t.join(`-`),J=w(i(function(e,t){let r=n(null),i=t??r,o=u(),{activeLocale:s,setLocale:c}=S(),l=k(),{style:f,className:m,layoutId:g,variant:_,OO2DFLBCZ:v,ZKAqT37Hr:y,yobczhv92:b,...w}=K(e),{baseVariant:ee,classNames:O,clearLoadingGesture:te,gestureHandlers:A,gestureVariant:ne,isLoading:re,setGestureState:j,setVariant:M,variants:N}=T({defaultVariant:`ZaDv32lfH`,ref:i,variant:_,variantClassNames:V}),P=q(e,N),{activeVariantCallback:F,delay:I}=D(ee),L=F(async(...e)=>{if(j({isPressed:!1}),b&&await b(...e)===!1)return!1}),R=h(ae);return a(p,{id:g??o,children:a(G,{animate:N,initial:!1,children:a(W,{value:H,children:a(d.div,{...w,...A,className:h(R,`framer-l9eat1`,m,O),"data-framer-name":`Variant 1`,"data-highlight":!0,layoutDependency:P,layoutId:`ZaDv32lfH`,onTap:L,ref:i,style:{...f},children:a(E,{href:y,motionChild:!0,nodeId:`Ut2uVmwtM`,openInNewTab:!1,scopeId:`UrMgu60ah`,children:a(d.a,{className:`framer-jyndve framer-18wa2j3`,layoutDependency:P,layoutId:`Ut2uVmwtM`,children:a(C,{background:{alt:``,fit:`fit`,loading:x((l?.y||0)+(0+((l?.height||32)-0-((l?.height||32)-0)*1)/2)+(0+(((l?.height||32)-0)*1-0-(((l?.height||32)-0)*1-0)*1)/2)),pixelHeight:36,pixelWidth:151,sizes:`calc(${(((l?.height||32)-0)*1-0)*1} * 3.1579)`,...U(v),positionX:`center`,positionY:`center`},className:`framer-g7mo3m`,"data-framer-name":`Logo`,layoutDependency:P,layoutId:`oYDPbIpdb`})})})})})})})}),[`@supports (aspect-ratio: 1) { body { --framer-aspect-ratio-supported: auto; } }`,`.framer-QBVjc.framer-18wa2j3, .framer-QBVjc .framer-18wa2j3 { display: block; }`,`.framer-QBVjc.framer-l9eat1 { align-content: center; align-items: center; cursor: pointer; display: flex; flex-direction: row; flex-wrap: nowrap; gap: 8px; height: 32px; justify-content: center; overflow: var(--overflow-clip-fallback, clip); padding: 0px 0px 0px 2px; position: relative; width: 100px; }`,`.framer-QBVjc .framer-jyndve { align-content: center; align-items: center; display: flex; flex: 1 0 0px; flex-direction: row; flex-wrap: nowrap; gap: 8px; height: 100%; justify-content: center; overflow: visible; padding: 0px; position: relative; text-decoration: none; width: 1px; }`,`.framer-QBVjc .framer-g7mo3m { aspect-ratio: 3.1578947368421053 / 1; flex: none; height: 100%; overflow: var(--overflow-clip-fallback, clip); position: relative; width: var(--framer-aspect-ratio-supported, 101px); will-change: var(--framer-will-change-filter-override, filter); }`],`framer-QBVjc`),J.displayName=`Logo`,J.defaultProps={height:32,width:100},_(J,{OO2DFLBCZ:{title:`Image`,type:O.ResponsiveImage},ZKAqT37Hr:{title:`Link`,type:O.Link},yobczhv92:{title:`Click`,type:O.EventHandler}}),v(J,[{explicitInter:!0,fonts:[]}],{supportsExplicitInterCodegen:!0})}));function Y(e,...t){let n={};return t?.forEach(t=>t&&Object.assign(n,e[t])),n}var X,Z,Q,se,ce,le,ue,de,fe,pe,$,me=e((()=>{c(),y(),m(),l(),re(),X={GCXGnv2BG:{hover:!0},HwghR76fp:{hover:!0},Vw_QHP4KY:{hover:!0}},Z=[`GCXGnv2BG`,`Vw_QHP4KY`,`HwghR76fp`],Q=`framer-h8Hye`,se={GCXGnv2BG:`framer-v-138lnn5`,HwghR76fp:`framer-v-1dxfrbu`,Vw_QHP4KY:`framer-v-1mzj87f`},ce={delay:0,duration:.3,ease:[0,0,1,1],type:`tween`},le=({value:e,children:n})=>{let r=t(f),i=e??r.transition,s=o(()=>({...r,transition:i}),[JSON.stringify(i)]);return a(f.Provider,{value:s,children:n})},ue={"Button 01":`GCXGnv2BG`,"Button 02":`Vw_QHP4KY`,"Variant 3":`HwghR76fp`},de=d.create(r),fe=({height:e,id:t,link:n,text:r,width:i,...a})=>({...a,sv70ZrxsM:r??a.sv70ZrxsM??`Get My AI Team`,tr55Jc_z1:n??a.tr55Jc_z1,variant:ue[a.variant]??a.variant??`GCXGnv2BG`}),pe=(e,t)=>e.layoutDependency?t.join(`-`)+e.layoutDependency:t.join(`-`),$=w(i(function(e,t){let i=n(null),o=t??i,c=u(),{activeLocale:l,setLocale:f}=S();k();let{style:m,className:g,layoutId:_,variant:v,sv70ZrxsM:y,tr55Jc_z1:b,...x}=fe(e),{baseVariant:C,classNames:w,clearLoadingGesture:ee,gestureHandlers:D,gestureVariant:O,isLoading:A,setGestureState:ne,setVariant:re,variants:M}=T({cycleOrder:Z,defaultVariant:`GCXGnv2BG`,enabledGestures:X,ref:o,variant:v,variantClassNames:se}),N=pe(e,M),P=h(Q,j);return a(p,{id:_??c,children:a(de,{animate:M,initial:!1,children:a(le,{value:ce,children:a(E,{href:b,motionChild:!0,nodeId:`GCXGnv2BG`,openInNewTab:!1,scopeId:`ZpHzaUCr3`,smoothScroll:!0,children:s(d.a,{...x,...D,className:`${h(P,`framer-138lnn5`,g,w)} framer-qcou1b`,"data-border":!0,"data-framer-name":`Button 01`,layoutDependency:N,layoutId:`GCXGnv2BG`,ref:o,style:{"--border-bottom-width":`1px`,"--border-color":`var(--token-6af0c9f6-b01c-4ccf-8265-b697c60ef641, rgb(144, 137, 240))`,"--border-left-width":`1px`,"--border-right-width":`1px`,"--border-style":`solid`,"--border-top-width":`1px`,backgroundColor:`var(--token-6af0c9f6-b01c-4ccf-8265-b697c60ef641, rgb(144, 137, 240))`,borderBottomLeftRadius:8,borderBottomRightRadius:8,borderTopLeftRadius:8,borderTopRightRadius:8,...m},variants:{Vw_QHP4KY:{"--border-bottom-width":`2px`,"--border-left-width":`2px`,"--border-right-width":`2px`,"--border-top-width":`2px`,backgroundColor:`var(--token-7d46519b-7ae3-4c0a-9383-88033d4deee8, rgb(255, 255, 255))`}},...Y({"GCXGnv2BG-hover":{"data-framer-name":void 0},"HwghR76fp-hover":{"data-framer-name":void 0},"Vw_QHP4KY-hover":{"data-framer-name":void 0},HwghR76fp:{"data-framer-name":`Variant 3`},Vw_QHP4KY:{"data-framer-name":`Button 02`}},C,O),children:[a(te,{__fromCanvasComponent:!0,children:a(r,{children:a(d.p,{className:`framer-styles-preset-1fj6cou`,"data-styles-preset":`Qoc3Pw9ZI`,dir:`auto`,style:{"--framer-text-color":`var(--extracted-r6o4lv, var(--token-7d46519b-7ae3-4c0a-9383-88033d4deee8, rgb(255, 255, 255)))`},children:`Get My AI Team`})}),className:`framer-kkg2go`,fonts:[`Inter`],layoutDependency:N,layoutId:`VCbmUbmjl`,style:{"--extracted-r6o4lv":`var(--token-7d46519b-7ae3-4c0a-9383-88033d4deee8, rgb(255, 255, 255))`,"--framer-link-text-color":`rgb(0, 153, 255)`,"--framer-link-text-decoration":`underline`},text:y,variants:{"HwghR76fp-hover":{"--extracted-r6o4lv":`var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, rgb(26, 26, 26))`},"Vw_QHP4KY-hover":{"--extracted-r6o4lv":`var(--token-7d46519b-7ae3-4c0a-9383-88033d4deee8, rgb(255, 255, 255))`},Vw_QHP4KY:{"--extracted-r6o4lv":`var(--token-a2032378-8413-49cd-b585-87ab5904c44d, rgba(0, 0, 0, 0.8))`}},verticalAlignment:`top`,withExternalLayout:!0,...Y({"HwghR76fp-hover":{children:a(r,{children:a(d.p,{className:`framer-styles-preset-1fj6cou`,"data-styles-preset":`Qoc3Pw9ZI`,dir:`auto`,style:{"--framer-text-color":`var(--extracted-r6o4lv, var(--token-86dbb439-c396-48fd-926a-93eef5aacd34, rgb(26, 26, 26)))`},children:`Get My AI Team`})})},"Vw_QHP4KY-hover":{children:a(r,{children:a(d.p,{className:`framer-styles-preset-1fj6cou`,"data-styles-preset":`Qoc3Pw9ZI`,dir:`auto`,style:{"--framer-text-color":`var(--extracted-r6o4lv, var(--token-7d46519b-7ae3-4c0a-9383-88033d4deee8, rgb(255, 255, 255)))`},children:`Get My AI Team`})})},Vw_QHP4KY:{children:a(r,{children:a(d.p,{className:`framer-styles-preset-1fj6cou`,"data-styles-preset":`Qoc3Pw9ZI`,dir:`auto`,style:{"--framer-text-color":`var(--extracted-r6o4lv, var(--token-a2032378-8413-49cd-b585-87ab5904c44d, rgba(0, 0, 0, 0.8)))`},children:`Get My AI Team`})})}},C,O)}),a(d.div,{className:`framer-2y0hjm`,"data-framer-name":`Icon Background`,layoutDependency:N,layoutId:`wb8_AuR9D`,style:{backgroundColor:`var(--token-a83649a1-3fb0-4a78-ac47-908be8944abe, rgb(239, 240, 254))`,borderBottomLeftRadius:999,borderBottomRightRadius:999,borderTopLeftRadius:999,borderTopRightRadius:999,opacity:0},variants:{"GCXGnv2BG-hover":{backgroundColor:`var(--token-f0955bfb-a74a-46d7-9910-f73cf244f2ce, rgb(78, 56, 155))`,borderBottomLeftRadius:4,borderBottomRightRadius:4,borderTopLeftRadius:4,borderTopRightRadius:4,opacity:1},"HwghR76fp-hover":{borderBottomLeftRadius:4,borderBottomRightRadius:4,borderTopLeftRadius:4,borderTopRightRadius:4,opacity:1},"Vw_QHP4KY-hover":{backgroundColor:`var(--token-6af0c9f6-b01c-4ccf-8265-b697c60ef641, rgb(144, 137, 240))`,borderBottomLeftRadius:`100%`,borderBottomRightRadius:`100%`,borderTopLeftRadius:`100%`,borderTopRightRadius:`100%`,opacity:1},Vw_QHP4KY:{backgroundColor:`var(--token-a2032378-8413-49cd-b585-87ab5904c44d, rgba(0, 0, 0, 0.8))`,borderBottomLeftRadius:1e3,borderBottomRightRadius:1e3,borderTopLeftRadius:1e3,borderTopRightRadius:1e3}}})]})})})})})}),[`.framer-h8Hye.framer-qcou1b, .framer-h8Hye .framer-qcou1b { display: block; }`,`.framer-h8Hye.framer-138lnn5 { align-content: center; align-items: center; cursor: pointer; display: flex; flex-direction: row; flex-wrap: nowrap; gap: 20px; height: min-content; justify-content: center; overflow: var(--overflow-clip-fallback, clip); padding: 12px 20px 12px 20px; position: relative; text-decoration: none; width: min-content; will-change: var(--framer-will-change-override, transform); }`,`.framer-h8Hye .framer-kkg2go { -webkit-user-select: none; flex: none; height: auto; position: relative; user-select: none; white-space: pre; width: auto; z-index: 1; }`,`.framer-h8Hye .framer-2y0hjm { flex: none; height: 1px; overflow: var(--overflow-clip-fallback, clip); position: absolute; right: 82px; top: calc(100.00000000000003% - 1px / 2); width: 1px; will-change: var(--framer-will-change-override, transform); z-index: 0; }`,`.framer-h8Hye.framer-v-1mzj87f.framer-138lnn5 { gap: 8px; padding: 10px 20px 10px 24px; }`,`.framer-h8Hye.framer-v-1mzj87f .framer-2y0hjm { bottom: -24px; height: 20px; left: calc(50.00000000000002% - 50% / 2); right: unset; top: unset; width: 50%; }`,`.framer-h8Hye.framer-v-138lnn5.hover .framer-2y0hjm, .framer-h8Hye.framer-v-1dxfrbu.hover .framer-2y0hjm { bottom: 4px; height: unset; left: 4px; right: 4px; top: 4px; width: unset; }`,`.framer-h8Hye.framer-v-1mzj87f.hover .framer-2y0hjm { bottom: -24px; height: unset; left: -24px; right: -24px; top: -24px; width: unset; }`,...ne,`.framer-h8Hye[data-border="true"]::after, .framer-h8Hye [data-border="true"]::after { content: ""; border-width: var(--border-top-width, 0) var(--border-right-width, 0) var(--border-bottom-width, 0) var(--border-left-width, 0); border-color: var(--border-color, none); border-style: var(--border-style, none); width: 100%; height: 100%; position: absolute; box-sizing: border-box; left: 0; top: 0; border-radius: inherit; corner-shape: inherit; pointer-events: none; }`],`framer-h8Hye`),$.displayName=`Primary Button`,$.defaultProps={height:48,width:165},_($,{variant:{options:[`GCXGnv2BG`,`Vw_QHP4KY`,`HwghR76fp`],optionTitles:[`Button 01`,`Button 02`,`Variant 3`],title:`Variant`,type:O.Enum},sv70ZrxsM:{defaultValue:`Get My AI Team`,displayTextArea:!1,placeholder:``,title:`Text`,type:O.String},onsv70ZrxsMChange:{changes:`sv70ZrxsM`,type:O.ChangeHandler},tr55Jc_z1:{title:`Link`,type:O.Link}}),v($,[{explicitInter:!0,fonts:[{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F`,url:`https://framerusercontent.com/assets/5vvr9Vy74if2I6bQbJvbw7SY1pQ.woff2`,weight:`400`},{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116`,url:`https://framerusercontent.com/assets/EOr0mi4hNtlgWNn9if640EZzXCo.woff2`,weight:`400`},{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+1F00-1FFF`,url:`https://framerusercontent.com/assets/Y9k9QrlZAqio88Klkmbd8VoMQc.woff2`,weight:`400`},{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+0370-03FF`,url:`https://framerusercontent.com/assets/OYrD2tBIBPvoJXiIHnLoOXnY9M.woff2`,weight:`400`},{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF`,url:`https://framerusercontent.com/assets/JeYwfuaPfZHQhEG8U5gtPDZ7WQ.woff2`,weight:`400`},{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`,url:`https://framerusercontent.com/assets/GrgcKwrN6d3Uz8EwcLHZxwEfC4.woff2`,weight:`400`},{cssFamilyName:`Inter`,source:`framer`,style:`normal`,uiFamilyName:`Inter`,unicodeRange:`U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB`,url:`https://framerusercontent.com/assets/b6Y37FthZeALduNqHicBT6FutY.woff2`,weight:`400`}]},...g(A)],{supportsExplicitInterCodegen:!0})}));export{B as a,ie as c,P as d,L as f,oe as i,I as l,N as m,me as n,z as o,M as p,J as r,R as s,$ as t,F as u};
//# sourceMappingURL=ZpHzaUCr3.Bs0CFFaA.mjs.map