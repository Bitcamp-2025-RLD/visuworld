#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 iResolution;
uniform float iTime;
// uniform vec4 iMouse; // Optional: for camera control

#define MAX_DIST 100.0 // Max viewing distance
#define MAX_STEPS 80   // Max raymarching steps
#define SURF_DIST 0.005 // Precision threshold for hitting the surface

#define SAMPLES 1 // Anti-aliasing - keep at 1 for basic version

// --- Utility Functions ---

// Simple hash functions
float hash1( float n ) { return fract(sin(n)*43758.5453123); }
float hash1( vec2 p ) { return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453123); }

// 2D Noise function (Value Noise)
float noise( in vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    f = f*f*(3.0-2.0*f); // Smoothstep interpolation

    float a = hash1( i + vec2(0.0,0.0) );
    float b = hash1( i + vec2(1.0,0.0) );
    float c = hash1( i + vec2(0.0,1.0) );
    float d = hash1( i + vec2(1.0,1.0) );

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractional Brownian Motion (FBM) for generating wave patterns
float fbm( vec2 p ) {
    float f = 0.0;
    mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 ); // Domain rotation/scaling matrix
    float amp = 0.5;
    float freq = 1.0;

    for (int i = 0; i < 6; i++) { // 6 octaves of noise
        f += amp * noise(p * freq);
        // p = m * p; // Rotate and scale for next octave (can be expensive)
        freq *= 2.0; // Increase frequency
        amp *= 0.5;  // Decrease amplitude
    }
    return f;
}

// Rotation matrix for camera control
mat3 rotY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0, c
    );
}
mat3 rotX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}


// --- Ocean Surface ---

// Defines the height of the ocean at a given 2D point (xz plane)
float oceanHeight(vec2 p) {
    // Base wave motion using FBM
    vec2 motion1 = vec2(iTime * 0.05, iTime * 0.03);
    vec2 motion2 = vec2(-iTime * 0.04, iTime * 0.06);
    float h = 0.0;
    h += fbm(p * 0.1 + motion1) * 2.0; // Base low-frequency waves
    h += fbm(p * 0.4 + motion2) * 0.5; // Medium frequency waves
    h += fbm(p * 1.0 - motion1) * 0.15; // High frequency detail
    return h;
}

// Map function: returns vertical distance to the ocean surface from point p
// Not a true SDF, but sufficient for heightmap raymarching
float map(vec3 p) {
    return p.y - oceanHeight(p.xz);
}

// Calculate surface normal using finite differences on the height function
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.01, 0.0); // Small offset for calculating gradient
    float h = oceanHeight(p.xz); // Height at current point
    // Calculate height differences in x and z directions
    vec3 n = vec3(
        h - oceanHeight(p.xz - e.xy), // Difference in x
        e.x,                           // Vertical component (related to offset size)
        h - oceanHeight(p.xz - e.yx)  // Difference in z
    );
    return normalize(n);
}

// --- Raymarching ---

// March a ray from ro (origin) in direction rd (direction)
// Returns distance travelled, or -1.0 if no surface hit
float rayMarch(vec3 ro, vec3 rd, out vec3 hitPos) {
    float t = 0.01; // Start slightly away from origin to avoid self-intersection
    hitPos = ro;
    for(int i = 0; i < MAX_STEPS; i++) {
        hitPos = ro + rd * t;
        float h = map(hitPos);

        // Check if ray is close enough to the surface
        if(h < SURF_DIST || t > MAX_DIST) break;

        // Advance the ray
        // Step size is based on distance to surface, but limited to prevent large jumps
        // Also ensures a minimum step size
        t += max(SURF_DIST, h * 0.7); // Adaptive step based on height diff

        // Alternative simpler step: t += 0.1 + t*0.02; // Increase step size with distance
    }
    return (t < MAX_DIST) ? t : -1.0; // Return distance if hit, else -1
}

// --- Shading ---

// Simple sky gradient and sun
vec3 getSkyColor(vec3 rd) {
    vec3 sunDir = normalize(vec3(0.8, 0.25, 0.5)); // Direction of the sun
    float sunAmount = max(0.0, dot(rd, sunDir));
    float skyAmount = max(0.0, rd.y);

    // Sky gradient: blueish near horizon, lighter overhead
    vec3 skyCol = mix(vec3(0.1, 0.2, 0.4), vec3(0.5, 0.7, 0.95), smoothstep(0.0, 0.4, skyAmount));

    // Sun disk
    skyCol += vec3(1.0, 0.7, 0.4) * pow(sunAmount, 200.0);
    // Sun glow
    skyCol += vec3(1.0, 0.6, 0.3) * pow(sunAmount, 10.0) * 0.4;

    return clamp(skyCol, 0.0, 1.0);
}

// Calculate water color and lighting
vec3 shadeWater(vec3 p, vec3 n, vec3 rd, vec3 ro) {
    vec3 sunDir = normalize(vec3(0.8, 0.25, 0.5));

    // Basic lighting
    float diffuse = max(0.0, dot(n, sunDir));

    // Specular highlight
    vec3 viewDir = -rd; // normalize(ro - p); // Should be -rd
    vec3 reflectDir = reflect(-sunDir, n);
    float specular = pow(max(0.0, dot(reflectDir, viewDir)), 64.0);

    // Fresnel effect (more reflection at glancing angles)
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(n, viewDir)), 5.0);

    // Water base color (changes slightly with depth/height)
    vec3 waterBaseColor = mix(vec3(0.0, 0.1, 0.2), vec3(0.05, 0.25, 0.35), smoothstep(-1.0, 2.0, p.y));

    // Reflected sky color
    vec3 reflectedSky = getSkyColor(reflect(-viewDir, n));

    // Combine components
    vec3 col = waterBaseColor * (0.2 + diffuse * 0.8); // Ambient + Diffuse
    col = mix(col, reflectedSky, fresnel);             // Mix with reflection based on Fresnel
    col += vec3(1.0, 0.9, 0.8) * specular * fresnel * 1.5; // Add specular highlight (modulated by fresnel)

    return col;
}

// --- Main ---

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
    vec3 finalColor = vec3(0.0);

    // Camera Setup
    vec3 ro = vec3(0.0, 3.5, -5.0 + iTime * 0.5); // Camera position (moves forward slowly)
    vec3 lookAt = vec3(0.0, 1.0, 0.0 + iTime * 0.5);   // Look slightly down and forward

    // Optional mouse control
    // float camAngleY = -iMouse.x / iResolution.x * 3.14159 * 2.0 + 1.57; // Pan
    // float camAngleX = (iMouse.y / iResolution.y - 0.5) * 3.14159; // Tilt
    float camAngleY = 1.57; // Fixed forward view if mouse not used
    float camAngleX = -0.1;

    mat3 camRot = rotY(camAngleY) * rotX(camAngleX);

    // Calculate ray direction
    vec3 camFwd = normalize(lookAt - ro);
    vec3 camRight = normalize(cross(vec3(0.0, 1.0, 0.0), camFwd));
    vec3 camUp = cross(camFwd, camRight);
    // vec3 rd = normalize(camFwd + camRight * uv.x + camUp * uv.y);
    vec3 rd = camRot * normalize(vec3(uv.x, uv.y, 1.5)); // FOV adjustment via z-component


    // Raymarch to find intersection with the ocean
    vec3 hitPos;
    float t = rayMarch(ro, rd, hitPos);

    if (t > 0.0) { // We hit the ocean surface
        vec3 p = hitPos; // Point of intersection
        vec3 n = calcNormal(p); // Surface normal at intersection

        // Get water color and lighting
        finalColor = shadeWater(p, n, rd, ro);

        // Atmospheric Fog (fades to sky color with distance)
        float fogAmount = smoothstep(10.0, MAX_DIST * 0.8, t);
        finalColor = mix(finalColor, getSkyColor(rd), fogAmount);

    } else { // We didn't hit the ocean, draw the sky
        finalColor = getSkyColor(rd);
    }

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0/2.2));

    gl_FragColor = vec4(finalColor, 1.0);
}