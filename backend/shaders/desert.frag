#version 330 core

in vec2 fragCoord; // Normalized coordinates (-1 to 1)
out vec4 fragColor;

uniform float iTime;
uniform vec2 iResolution; // Viewport resolution (pixels)
// uniform vec4 iMouse; // Mouse input (xy: current pixel, zw: click pixel)

// --- Quality Settings ---
const int MARCH_STEPS = 150;
const float MAX_DIST = 150.0;
const float HIT_THRESHOLD = 0.001;
const float FOG_DENSITY = 0.018;

// --- Noise Functions ---
// Simple hash function
float hash1(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract((p.x + p.y) * p.x);
}

// Value Noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep

    float a = hash1(i + vec2(0.0, 0.0));
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion (FBM) for dunes
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 2.0;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5)); // Rotation to break axis alignment

    for (int i = 0; i < 6; ++i) {
        value += amplitude * noise(p * frequency);
        p = rot * p;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// --- SDF for the Desert Ground ---
float sdGround(vec3 p) {
    // Base plane at y=0, displaced by noise
    float groundPlane = p.y;

    // Large scale dunes using FBM
    vec2 p_xz_large = p.xz * 0.03;
    float duneHeight = fbm(p_xz_large) * 15.0; // Adjust amplitude for dune height

    // Smaller scale ripples influenced by wind direction (e.g., along x)
    // Make ripples move slowly over time
    vec2 p_xz_small = p.xz * 0.4 + vec2(iTime * 0.05, 0.0);
    float rippleBase = (sin(p.x * 0.5 + fbm(p_xz_small * 0.5) * 6.0) * 0.5 + 0.5); // Base ripple waves
    float rippleDetail = (noise(p_xz_small * 2.5) - 0.5) * 0.4; // Finer noise texture
    float rippleHeight = rippleBase * 0.3 + rippleDetail * 0.15; // Combine and scale ripples

    return groundPlane - duneHeight - rippleHeight;
}

// --- Scene SDF ---
// Only contains the ground for this scene
float map(vec3 p) {
    return sdGround(p);
}

// --- Calculate Normal using Gradient of the SDF ---
// Uses tetrahedron technique for better precision around sharp features if needed,
// but central difference is usually fine for smooth noise.
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0); // Small offset for central difference
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy), // Gradient in x
        map(p + e.yxy) - map(p - e.yxy), // Gradient in y
        map(p + e.yyx) - map(p - e.yyx)  // Gradient in z
    ));
}

// --- Raymarching Function ---
// Returns distance marched, or -1.0 if missed
// Outputs hit position via pHit parameter
float raymarch(vec3 ro, vec3 rd, out vec3 pHit) {
    float t = 0.0; // Distance traveled along the ray
    pHit = ro;
    for (int i = 0; i < MARCH_STEPS; ++i) {
        pHit = ro + rd * t;
        float d = map(pHit);

        // Check for hit
        if (abs(d) < HIT_THRESHOLD * t) { // Use relative threshold
            return t; // Hit
        }

        // Step forward safely
        t += max(HIT_THRESHOLD * t, abs(d)) * 0.8; // Step forward, ensure minimum progress, safety factor

        // Check for exceeding max distance
        if (t > MAX_DIST) {
            break;
        }
    }
    return -1.0; // Missed
}

// --- Sky and Sun Color ---
vec3 getSkyColor(vec3 rd, vec3 lightDir) {
    float sunAmount = max(0.0, dot(rd, lightDir));
    float horizonFade = smoothstep(0.0, 0.15, rd.y); // Fade towards zenith color higher up

    // Base sky gradient (blue zenith, lighter blue/cyan near horizon)
    vec3 skyCol = mix(vec3(0.3, 0.5, 0.8), vec3(0.05, 0.2, 0.45), horizonFade);

    // Sun disk
    skyCol += vec3(1.0, 0.8, 0.6) * pow(sunAmount, 100.0) * 0.8;
    // Sun glow (softer, wider)
    skyCol += vec3(1.0, 0.6, 0.3) * pow(sunAmount, 5.0) * 0.3;
    // Horizon glow (yellow/orange tint near the sun)
    skyCol += vec3(1.0, 0.4, 0.1) * pow(sunAmount, 2.0) * 0.2 * (1.0 - horizonFade);

    return clamp(skyCol, 0.0, 1.0);
}

// --- Main Render Function ---
void main() {
    vec2 uv = fragCoord; // Input coords are -1 to 1

    // Camera Setup
    vec3 ro = vec3(0.0, 5.0 + sin(iTime * 0.1) * 0.5, -iTime * 3.0); // Camera pos: moves forward, slight bob, raised
    vec3 lookAt = vec3(0.0, 3.0, ro.z + 5.0); // Look slightly down and forward

    // Camera Basis Vectors
    vec3 camFwd = normalize(lookAt - ro);
    vec3 camRight = normalize(cross(vec3(0.0, 1.0, 0.0), camFwd));
    vec3 camUp = cross(camFwd, camRight);

    // Calculate Ray Direction through virtual screen plane
    float fov = 1.2; // Adjust Field of View (lower means more zoom)
    vec3 rd = normalize(camFwd + camRight * uv.x * (iResolution.x / iResolution.y) * fov + camUp * uv.y * fov);

    // Define Sun Direction
    vec3 lightDir = normalize(vec3(0.7, 0.5, 0.4));

    // Raymarch the scene
    vec3 hitPos;
    float dist = raymarch(ro, rd, hitPos);

    vec3 col;
    if (dist > 0.0) { // We hit the ground
        vec3 normal = calcNormal(hitPos);

        // Lighting Calculation
        float diffuse = max(0.0, dot(normal, lightDir)); // Lambertian diffuse
        float ambient = 0.25;                            // Ambient term
        float fresnel = pow(1.0 - max(0.0, dot(normal, -rd)), 3.0); // Fresnel for rim lighting effect

        // Base Sand Color Palette
        vec3 sandColorDark = vec3(0.65, 0.5, 0.3);
        vec3 sandColorLight = vec3(0.95, 0.85, 0.65);

        // Mix colors based on noise and normal (lighter on crests/flatter areas)
        float noiseVal = noise(hitPos.xz * 0.1);
        float mixFactor = smoothstep(0.3, 0.7, normal.y) * 0.5 + noiseVal * 0.5;
        vec3 sandColor = mix(sandColorDark, sandColorLight, mixFactor);

        // Add subtle color variation based on large scale position
        sandColor *= (0.95 + 0.1 * noise(hitPos.xz * 0.01));

        // Combine lighting and color
        col = sandColor * (diffuse * 1.0 + ambient);
        col += vec3(1.0, 0.7, 0.3) * fresnel * 0.3; // Add rim light glow

        // Apply Fog (Atmospheric Perspective)
        vec3 skyCol = getSkyColor(rd, lightDir);
        float fogFactor = exp(-dist * FOG_DENSITY); // Exponential fog based on distance
        col = mix(skyCol, col, fogFactor);

    } else { // We hit the sky
        col = getSkyColor(rd, lightDir);
    }

    // Basic Tone Mapping & Gamma Correction
    col = pow(col, vec3(0.8)); // Adjust contrast slightly
    col = col / (col + vec3(1.0)); // Reinhard tone mapping approximation
    col = pow(col, vec3(1.0/2.2)); // Gamma correction

    fragColor = vec4(col, 1.0);
}