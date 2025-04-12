#version 330 core

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
// uniform vec4 iMouse; // Optional: For mouse interaction

// --- Noise Function (Value Noise based) ---
// Hash function to generate pseudo-random gradient directions
vec2 hash( vec2 p ) {
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
    return -1.0 + 2.0 * fract(sin(p)*43758.5453123);
}

// Value Noise function - using gradient sampling
float noise( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );

    // Smooth interpolation (quintic smoothstep)
    vec2 u = f*f*f*(f*(f*6.-15.)+10.);

    // Sample gradient vectors at the 4 grid corners
    float a = dot( hash( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) );
    float b = dot( hash( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) );
    float c = dot( hash( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) );
    float d = dot( hash( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) );

    // Interpolate results
    return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}


// Fractional Brownian Motion (FBM) - Sum of noise layers
float fbm( vec2 p ) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    mat2 rot = mat2(cos(0.75), sin(0.75), -sin(0.75), cos(0.75)); // Rotation matrix

    for (int i = 0; i < 6; i++) { // 6 octaves for detail
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
        p = rot * p; // Rotate domain for each octave to break grid alignment
    }
    return value;
}

// --- Terrain Height Function ---
// Uses FBM to generate dune-like terrain height at a given 2D position
float terrainHeight(vec2 p) {
    vec2 p_scaled_large = p * 0.008; // Scale for large dune structures
    float dunes = fbm(p_scaled_large) * 40.0; // Amplitude for large dunes

    vec2 p_scaled_small = p * 0.08; // Scale for smaller surface details/ripples
    float ripples = fbm(p_scaled_small) * 2.5; // Amplitude for ripples

    // Modulate ripples based on large dune height (less ripples on crests maybe)
    ripples *= smoothstep(0.8, 0.4, abs(fbm(p_scaled_large * 0.8))); // Reduce ripples near crests/troughs

    return dunes + ripples;
}

// --- Scene SDF ---
// Returns the signed distance from point p to the nearest surface (the ground)
float map(vec3 p) {
    // Add some very large scale, slow undulation for variety
    float base_undulation = sin(p.x * 0.0005 + iTime * 0.01) * cos(p.z * 0.0005) * 15.0;
    return p.y - (terrainHeight(p.xz) + base_undulation);
}

// --- Normal Calculation ---
// Calculates the surface normal at point p using the tetrahedron technique
vec3 calcNormal(vec3 p) {
    const float h = 0.01; // Epsilon for gradient calculation (adjusted slightly)
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy * map( p + k.xyy*h ) +
                      k.yyx * map( p + k.yyx*h ) +
                      k.yxy * map( p + k.yxy*h ) +
                      k.xxx * map( p + k.xxx*h ) );
}

// --- Raymarching Function ---
// Marches a ray from origin 'ro' in direction 'rd'
// Returns distance traveled 't', or max distance if nothing hit
float raymarch(vec3 ro, vec3 rd) {
    float t = 0.01; // Start slightly away from origin
    for (int i = 0; i < 150; i++) { // Max steps
        vec3 p = ro + rd * t;
        float d = map(p);

        // Check for hit (distance threshold increases slightly with distance)
        if (d < (0.002 * t)) return t;

        // Step forward safely
        t += max(d * 0.7, 0.01); // Ensure minimum step size, scale step by distance

        if (t > 3500.0) break; // Max view distance
    }
    return 3500.0; // Return max distance if nothing hit
}

// --- Camera Setup Function ---
// Creates a view matrix for a camera looking from ro to target
mat3 setCamera(vec3 ro, vec3 target, float roll) {
    vec3 forward = normalize(target - ro);
    vec3 initialUp = vec3(sin(roll), cos(roll), 0.0); // Use vec3(0,1,0) for standard up
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward)); // Recalculate right based on world up
    vec3 up = normalize(cross(forward, right));
    return mat3(right, up, forward);
}

void main() {
    // --- Screen Coordinates & Aspect Ratio ---
    // fragCoord is pre-normalized from -1 to 1
    vec2 uv = fragCoord;
    float aspect = iResolution.x / iResolution.y;

    // --- Camera Setup ---
    float timeParam = iTime * 6.0; // Control speed of forward movement
    vec2 cameraXZ = vec2(sin(iTime * 0.05) * 50.0, timeParam); // Gentle side-to-side drift + forward motion
    float currentGroundHeight = terrainHeight(cameraXZ);
    vec3 ro = vec3(cameraXZ.x, currentGroundHeight + 5.0, cameraXZ.y); // Camera position, stays ~5 units above ground

    // Target point slightly ahead and adjusted for terrain height changes
    vec2 targetXZ = vec2(sin(iTime * 0.05 + 0.1) * 50.0, timeParam + 30.0); // Look ~30 units ahead
    float targetGroundHeight = terrainHeight(targetXZ);
    vec3 target = vec3(targetXZ.x, mix(currentGroundHeight, targetGroundHeight, 0.5) + 2.0, targetXZ.y); // Look towards a point slightly above the ground ahead

    // Create camera view matrix
    mat3 camMatrix = setCamera(ro, target, 0.0); // No camera roll

    // Calculate ray direction through the view matrix
    // Adjust the Z component (1.8 here) to control Field of View (FOV)
    // Smaller values -> wider FOV, Larger values -> narrower FOV
    vec3 rd = camMatrix * normalize(vec3(uv.x * aspect, uv.y, 1.8));

    // --- Raymarching ---
    float t = raymarch(ro, rd);

    // --- Coloring & Lighting ---
    vec3 col = vec3(0.0); // Initialize color

    // Environment Colors
    vec3 sunDir = normalize(vec3(0.8, 0.3, -0.5)); // Sun direction (slightly lower)
    vec3 skyColor = vec3(0.3, 0.5, 0.8); // Sky blue
    vec3 horizonColor = vec3(0.9, 0.75, 0.6); // Warm horizon/haze
    vec3 sandColor = vec3(0.95, 0.8, 0.6); // Base sand color
    vec3 shadowColorFactor = vec3(0.7, 0.65, 0.6); // Multiplier for shadowed areas
    vec3 fogColor = horizonColor * 0.95; // Fog color based on horizon

    if (t < 3500.0) { // Ray hit the ground
        vec3 p = ro + rd * t;
        vec3 normal = calcNormal(p);

        // Lighting Calculations
        float diffuse = max(0.0, dot(normal, sunDir));
        float ambient = 0.3; // Ambient light level
        float skyLight = max(0.1, dot(normal, vec3(0.0, 1.0, 0.0))) * 0.3; // Light from the sky dome

        // Basic soft shadow approximation (darken based on AO-like self-occlusion)
        float occlusion = map(p + normal * 0.5) / 0.5; // Check distance slightly above surface
        float shadow = mix(0.4, 1.0, smoothstep(0.0, 1.0, occlusion)); // Darken if nearby surface above

        // Combine lighting
        vec3 lighting = ambient + skyLight + diffuse * shadow * vec3(1.1, 1.0, 0.9); // Slightly warm direct light

        // Surface Color variation based on normal (micro-texture / angle dependence)
        float fresnel = pow(1.0 - max(0.0, dot(normal, -rd)), 3.0); // Fresnel-like effect for glancing angles
        vec3 surfaceColor = mix(sandColor, horizonColor, fresnel * 0.5); // Mix with horizon at glancing angles

        // Apply lighting to surface color, modulating shadowed areas
        col = surfaceColor * lighting * mix(shadowColorFactor, vec3(1.0), diffuse * shadow);


        // Fog - Exponential fog based on distance 't'
        float fogAmount = 1.0 - exp(-t * t * 0.0000005); // Adjusted fog curve (starts further, gets dense)
        col = mix(col, fogColor, fogAmount);

    } else { // Ray hit the sky
        // Sky Gradient
        float skyGradient = pow(max(0.0, rd.y), 0.35); // Bias towards horizon
        col = mix(horizonColor, skyColor, skyGradient);

        // Sun Disc and Halo
        float sunDot = dot(rd, sunDir);
        col += vec3(1.0, 0.95, 0.9) * pow(max(0.0, sunDot), 500.0); // Sharp sun disc
        col += vec3(1.0, 0.8, 0.6) * pow(max(0.0, sunDot), 15.0) * 0.3; // Softer sun halo

        // Apply slight fog to distant sky
        col = mix(col, fogColor, 0.1);
    }

    // Final Adjustments
    col = pow(col, vec3(0.4545)); // Approximate Gamma Correction
    col = clamp(col, 0.0, 1.0); // Clamp final color

    // --- Output ---
    fragColor = vec4(col, 1.0);
}