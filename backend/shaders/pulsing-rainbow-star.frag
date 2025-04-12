#version 330 core

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
// fragCoord is already normalized from -1 to 1 by the host application

// --- Hash functions ---
// Simple 3D hash -> 1D float
float hash13(vec3 p) {
    p = fract(p * vec3(123.34, 234.34, 345.65));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y * p.z);
}

// Simple 3D hash -> 3D float vector
vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

// --- Noise function (3D Value Noise) ---
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep interpolation

    // Use 1D hash output for value noise
    float v000 = hash13(i + vec3(0.0, 0.0, 0.0));
    float v100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float v010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float v110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float v001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float v101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float v011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float v111 = hash13(i + vec3(1.0, 1.0, 1.0));

    // Trilinear interpolation
    float v00 = mix(v000, v100, f.x);
    float v01 = mix(v001, v101, f.x);
    float v10 = mix(v010, v110, f.x);
    float v11 = mix(v011, v111, f.x);

    float v0 = mix(v00, v10, f.y);
    float v1 = mix(v01, v11, f.y);

    return mix(v0, v1, f.z);
}

// --- Fractional Brownian Motion ---
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.5;
    const int OCTAVES = 5;
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- SDFs ---
// Cone pointing up Y axis, tip at (0,0,0), base radius 'r', height 'h'
float sdConeUp( vec3 p, float r, float h ) {
    p.y = max(0.0, min(h, p.y)); // Clamp p within height bounds for stability
    vec2 q = vec2( length(p.xz), p.y );
    vec2 tip = vec2(0.0, 0.0);
    vec2 base_rim = vec2(r, h);
    vec2 axis_dir = vec2(0.0, 1.0);
    vec2 slant_dir = normalize(base_rim - tip);

    float d = dot(q - tip, slant_dir); // Project onto slant
    d = clamp(d, 0.0, length(base_rim - tip)); // Clamp projection onto the slant segment
    vec2 closest_point_on_slant = tip + d * slant_dir;

    float dist = length(q - closest_point_on_slant);

    // Determine if inside or outside based on dot product with normal to slant
    vec2 normal_to_slant = vec2(slant_dir.y, -slant_dir.x);
    float side = dot(q - tip, normal_to_slant);
    dist *= sign(side); // Negative distance inside

    // Cap base and top (max combines distances to planes)
    dist = max(dist, -p.y);      // Distance to base plane y=0 (inside is negative)
    dist = max(dist, p.y - h);   // Distance to top plane y=h (inside is negative)

    return dist;
}

// Cone pointing down Y axis, tip at (0,h,0), base radius 'r', height 'h'
float sdVolcanoCone( vec3 p, float r, float h ) {
    p.y = h - p.y; // Shift p so tip is at origin, pointing up
    return sdConeUp(p, r, h);
}

// Simple plane at y=h
float sdPlane(vec3 p, float h) {
    return p.y - h;
}

// Smooth maximum (for smooth subtraction)
float smax(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(a, b, h) + k*h*(1.0-h); // Use sum for max blend
}


// --- Scene Map ---
const float VOLCANO_HEIGHT = 1.5;
const float VOLCANO_RADIUS = 2.0;
const float CRATER_RADIUS = 0.7;
const float CRATER_DEPTH = 0.8; // How deep the crater cone goes from the top
const float GROUND_LEVEL = 0.0;

float map(vec3 p) {
    // Volcano body: Cone pointing down, tip intended at (0, VOLCANO_HEIGHT, 0)
    float volcanoDist = sdVolcanoCone(p, VOLCANO_RADIUS, VOLCANO_HEIGHT);

    // Crater: Subtract a smaller cone pointing down.
    // Tip position of the subtraction cone:
    vec3 craterConeTipPos = vec3(0.0, VOLCANO_HEIGHT, 0.0);
    // Adjust radius for subtraction shape if needed
    float craterSubRadius = CRATER_RADIUS;
    float craterSubHeight = CRATER_DEPTH;
    float craterConeDist = sdVolcanoCone(p - vec3(0, VOLCANO_HEIGHT - craterSubHeight, 0), craterSubRadius, craterSubHeight);

    // Smooth subtraction: smax(volcano, -crater)
    // Negative distance means inside, so -craterConeDist is the "solid" part of the subtraction shape.
    float combinedDist = smax(volcanoDist, -craterConeDist, 0.15); // Smoothness k=0.15

    // Add noise displacement for ruggedness - apply *after* combining shapes
    float displacementFreq = 2.0;
    float displacementAmp = 0.1;
    // Modulate displacement amplitude based on height (less displacement near base)
    float heightFactor = smoothstep(GROUND_LEVEL, VOLCANO_HEIGHT * 0.7, p.y);
    float displacement = displacementAmp * fbm(p * displacementFreq) * heightFactor;
    combinedDist -= displacement;

    // Ground plane
    float groundDist = sdPlane(p, GROUND_LEVEL);

    return min(combinedDist, groundDist);
}

// --- Normal Calculation ---
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0); // Use a small epsilon
    // Finite differences (central difference)
    vec3 n = vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    );
    // Handle potential zero vector normal if map() is flat or p is exactly on an edge/corner
    if (length(n) < 1e-6) {
       // Fallback normal, e.g., pointing up, or try a larger epsilon
       return vec3(0.0, 1.0, 0.0);
    }
    return normalize(n);
}


// --- Raymarching ---
float rayMarch(vec3 ro, vec3 rd, out vec3 pHit, out bool hitGround) {
    float t = 0.0;
    pHit = ro; // Initialize pHit
    hitGround = false;
    const float maxDist = 80.0; // Max ray distance
    const int maxSteps = 150; // Max steps
    const float precision = 0.001; // Required precision

    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);

        // Precision check: Use relative precision based on distance traveled 't'
        // This helps avoid "surface acne" and overstepping on distant objects
        if (abs(d) < precision * t) {
        // if (abs(d) < precision) { // Absolute precision alternative
            pHit = p;
            // Check if the hit point is very close to the ground plane's SDF definition
            hitGround = (abs(sdPlane(p, GROUND_LEVEL)) < precision * 5.0);
            return t;
        }

        // Advance the ray: Ensure a minimum step to avoid stalling in flat areas
        // Also, don't step further than the max distance
        t += max(d, precision * 2.0); // Minimum step based on precision

        if (t > maxDist) {
            break; // Exceeded max distance
        }
    }
    return -1.0; // Miss (no hit within max distance/steps)
}

// --- Get Material Color ---
vec3 getMaterialColor(vec3 p, vec3 normal, bool hitGround) {
     if (hitGround) {
        // Ground color with some procedural variation (e.g., patchy noise)
        float n = noise(p * 0.8); // Low frequency noise
        vec3 groundCol1 = vec3(0.35, 0.28, 0.22); // Dark soil/rock
        vec3 groundCol2 = vec3(0.5, 0.4, 0.3);   // Lighter patches
        return mix(groundCol1, groundCol2, smoothstep(0.4, 0.6, n));
     } else {
        // Volcano Rock Color
        float rockNoise = fbm(p * 3.0); // Higher frequency noise for rock texture
        vec3 baseRockColor = vec3(0.25, 0.2, 0.18);
        vec3 darkRockColor = vec3(0.15, 0.12, 0.1);
        vec3 rockColor = mix(darkRockColor, baseRockColor, smoothstep(0.4, 0.6, rockNoise));

        // Lava Color and Effect
        float craterRimY = VOLCANO_HEIGHT - 0.1; // Y-level near the top rim
        float lavaStartHeight = VOLCANO_HEIGHT * 0.5; // Where lava influence begins

        // Intensity based on height (stronger near the top inside the crater)
        float heightIntensity = smoothstep(lavaStartHeight, craterRimY, p.y);

        // Intensity based on how "inside" the crater cone we are (using the subtraction SDF)
        vec3 craterConeTipPos = vec3(0.0, VOLCANO_HEIGHT - CRATER_DEPTH, 0.0);
        float craterSubRadius = CRATER_RADIUS;
        float craterSubHeight = CRATER_DEPTH;
        float craterSDFVal = sdConeUp(p - craterConeTipPos, craterSubRadius, craterSubHeight);
        float insideCraterIntensity = smoothstep(0.1, -0.2, craterSDFVal); // Stronger effect deep inside (negative SDF)

        // Combine intensities
        float lavaIntensity = heightIntensity * insideCraterIntensity;

        // Pulsating lava effect using animated noise
        float lavaNoiseFreq = 3.5;
        float lavaTimeScale = 0.6;
        float lavaNoise = 0.6 + 0.4 * noise(p * lavaNoiseFreq + vec3(0.0, -iTime * lavaTimeScale, 0.0));
        lavaNoise = smoothstep(0.5, 0.8, lavaNoise); // Sharpen noise effect

        // Base lava color, make it brighter/hotter
        vec3 lavaColor = vec3(1.5, 0.4, 0.05) * (1.0 + 0.5 * sin(iTime*1.5 + p.y*4.0 + rockNoise * 5.0)); // Pulsating, noise influenced

        // Mix rock and lava based on combined intensity and noise
        vec3 finalColor = mix(rockColor, lavaColor, lavaIntensity * lavaNoise);

        // Add dark ash/soot near the very top / rim, potentially based on slope
        float slope = 1.0 - clamp(normal.y, 0.0, 1.0); // Flatter slope = higher value
        float ashHeightIntensity = smoothstep(craterRimY - 0.3, VOLCANO_HEIGHT + 0.2, p.y); // Apply in a wider range near the top
        float ashIntensity = ashHeightIntensity * smoothstep(0.5, 0.8, slope); // More ash on flatter upper slopes
        finalColor = mix(finalColor, vec3(0.1) * (0.7 + 0.3 * rockNoise), ashIntensity * 0.8);

        return finalColor;
     }
}


void main() {
    // Screen coordinates setup using pre-normalized fragCoord (-1 to 1)
    vec2 uv = fragCoord.xy;
    vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
    uv.x *= aspect.x; // Correct for aspect ratio

    // Camera setup
    float camDist = 5.5; // Camera distance from target
    float angle = iTime * 0.25; // Rotation speed
    float camHeight = 1.8; // Camera height
    vec3 ro = vec3(cos(angle) * camDist, camHeight, sin(angle) * camDist); // Camera position rotating around Y axis
    vec3 ta = vec3(0.0, VOLCANO_HEIGHT * 0.4, 0.0); // Look-at target (slightly above base)

    // Camera basis vectors
    vec3 ww = normalize(ta - ro); // Forward vector
    vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww)); // Right vector
    vec3 vv = cross(ww, uu); // Up vector (already normalized)

    // Ray direction calculation (adjust FOV with the multiplier for ww)
    float fov = 1.8; // Higher value = narrower FOV
    vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww);

    // Raymarch the scene
    vec3 hitPos;
    bool hitGround;
    float t = rayMarch(ro, rd, hitPos, hitGround);

    // Default Sky color (simple gradient)
    vec3 skyColor = vec3(0.3, 0.5, 0.8) - max(rd.y, 0.0) * 0.2; // Slightly darker blue gradient
    skyColor = mix(skyColor, vec3(0.8, 0.6, 0.5), pow(max(dot(rd, normalize(vec3(0.8, 0.1, 0.2))), 0.0), 8.0)); // Sun glare


    vec3 col = skyColor; // Initialize color to sky

    if (t > 0.0) { // If the ray hit something
        vec3 p = hitPos; // Hit position
        vec3 normal = calcNormal(p); // Surface normal at hit point
        vec3 viewDir = -rd; // Direction from surface point to camera

        // Define light source
        vec3 lightDir = normalize(vec3(0.7, 0.5, -0.6)); // Main directional light
        vec3 lightColor = vec3(1.0, 0.95, 0.9); // Slightly warm light

        // Get material properties
        vec3 materialColor = getMaterialColor(p, normal, hitGround);

        // Lighting Calculations
        float ambient = 0.15; // Ambient light contribution
        float diffuse = max(0.0, dot(normal, lightDir)); // Diffuse term (Lambertian)

        // Specular term (Blinn-Phong) - subtle for rock/ground
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float specAngle = max(dot(normal, halfwayDir), 0.0);
        float specIntensity = hitGround ? 0.1 : 0.4; // Less shiny ground
        float specPower = hitGround ? 16.0 : 32.0;
        float specular = pow(specAngle, specPower) * specIntensity;

        // Shadow (Simple approximation: assume objects cast shadow on themselves/ground)
        // A proper shadow raymarch would be needed for accurate shadows.
        // Cheap AO based on normal check:
        float ao = clamp(map(p + normal * 0.1) / 0.1, 0.0, 1.0); // Occlusion factor based on nearby geometry along normal
        ao = 0.6 + 0.4 * ao; // Remap to a usable range (0.6 to 1.0)

        // Combine lighting components
        col = materialColor * (ambient + diffuse * lightColor) * ao; // Apply ambient, diffuse, AO
        col += specular * lightColor * ao; // Add specular highlights (also affected by AO)

        // Add emission for lava areas (make them glow)
        if (!hitGround) {
            float craterRimY = VOLCANO_HEIGHT - 0.1;
            float lavaStartHeight = VOLCANO_HEIGHT * 0.5;
            float heightIntensity = smoothstep(lavaStartHeight, craterRimY, p.y);
            vec3 craterConeTipPos = vec3(0.0, VOLCANO_HEIGHT - CRATER_DEPTH, 0.0);
            float craterSDFVal = sdConeUp(p - craterConeTipPos, CRATER_RADIUS, CRATER_DEPTH);
            float insideCraterIntensity = smoothstep(0.1, -0.2, craterSDFVal);
            float lavaIntensity = heightIntensity * insideCraterIntensity;
            float lavaNoise = 0.6 + 0.4 * noise(p * 3.5 + vec3(0.0, -iTime * 0.6, 0.0));
            lavaNoise = smoothstep(0.5, 0.8, lavaNoise);

            vec3 emissionColor = vec3(1.0, 0.3, 0.05);
            float emissionStrength = lavaIntensity * lavaNoise * 0.8; // Control emission brightness
             col += emissionColor * emissionStrength;
        }


        // Fog (Apply exponential fog based on distance)
        float fogDensity = 0.025;
        float fogFactor = exp(-t * t * fogDensity); // Exponential squared fog (denser)
        col = mix(skyColor, col, fogFactor); // Blend scene color with sky color based on fog factor

    }

    // Basic Tone Mapping & Gamma Correction
    col = col / (col + vec3(1.0)); // Reinhard tone mapping (simple version)
    col = pow(col, vec3(1.0 / 2.2)); // Gamma correction

    fragColor = vec4(col, 1.0); // Output final color
}