#version 330 core

// Input from vertex shader: normalized fragment coordinates [-1, 1]
in vec2 fragCoord;

// Output color
out vec4 fragColor;

// Uniforms provided
uniform vec3 iResolution; // viewport resolution (in pixels)
uniform float iTime;      // shader playback time (in seconds)
uniform vec4 iMouse;      // mouse pixel coords. xy: current (if active), zw: click

// --- SDF Primitives ---
// (Using standard SDFs like those provided in examples)
float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}

float sdRoundBox( vec3 p, vec3 b, float r )
{
  vec3 q = abs(p) - b + r;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

// --- Rotation Helper ---
mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

// --- Scene Definition ---
// This function defines the distance to the nearest surface at point p
float map(vec3 p) {
    // Apply global rotation based on time
    p.yz *= rot(iTime * 0.25);
    p.xz *= rot(iTime * 0.15);

    // Define parameters for fractal repetition
    float scale = 1.8 + 0.2 * sin(iTime * 0.5); // Pulsating scale
    vec3 offset = vec3(1.0, 1.0, 1.0); // Offset for each repetition

    // Fractal repetition (domain folding/scaling)
    float final_d = 1e10; // Initialize with large distance
    float current_scale = 1.0; // Keep track of current scale for distance correction

    for(int i = 0; i < 6; i++) { // Number of iterations controls complexity
        // Center, scale, and fold the space
        p = abs(p); // Folding
        p = p / scale - offset;
        p.xy *= rot(0.4 + 0.1 * sin(iTime*0.3 + float(i)*0.5)); // Add twist per iteration
        p.zx *= rot(0.3 + 0.1 * cos(iTime*0.2 + float(i)*0.6));

        current_scale *= scale; // Update scale factor

        // Base shape: a rounded box that gets smaller with iterations
        float boxSize = 0.3 + 0.1 * sin(iTime + float(i));
        float d = sdRoundBox(p, vec3(boxSize), 0.05);

        // Combine the distance using minimum (could use smooth min for blending)
        // We need to scale the distance back to the original coordinate space
        final_d = min(final_d, d * current_scale);
    }

    return final_d;
}

// --- Normal Calculation ---
// Computes the surface normal at point p using the gradient of the SDF
vec3 calcNormal( in vec3 p )
{
    // Use central differences to estimate the gradient
    vec2 e = vec2(0.001, 0.0); // Small offset (epsilon)
    return normalize( vec3(map(p + e.xyy) - map(p - e.xyy),
                           map(p + e.yxy) - map(p - e.yxy),
                           map(p + e.yyx) - map(p - e.yyx)) );
}

// --- Raymarching ---
// Marches a ray from origin 'ro' in direction 'rd'
float rayMarch( vec3 ro, vec3 rd )
{
	float dO = 0.0; // Distance traveled along the ray
    const int MAX_STEPS = 100;
    const float MAX_DIST = 100.0;
    const float PRECISION = 0.001;

    for(int i = 0; i < MAX_STEPS; i++)
    {
    	vec3 p = ro + rd * dO; // Current point on the ray
        float dS = map(p);     // Distance from current point to the scene surface

        dO += dS; // Advance the ray by the minimum distance

        // Check if we hit the surface or went too far
        if(abs(dS) < PRECISION || dO > MAX_DIST) break;
    }
    return min(dO, MAX_DIST); // Return distance, capped at MAX_DIST
}

// --- Main Shader ---
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Use pre-normalized fragCoord [-1, 1]
    // Adjust for aspect ratio
    vec2 uv = fragCoord.xy * vec2(iResolution.x / iResolution.y, 1.0);

    // --- Camera Setup ---
    vec3 ro; // Ray Origin
    vec3 target = vec3(0.0, 0.0, 0.0); // Look at point

    // Mouse control for camera rotation (optional)
    float camDist = 4.0 + 2.0 * sin(iTime * 0.1); // Vary camera distance slightly
    float camAngleX = iTime * 0.1; // Default rotation
    float camAngleY = 0.3 * sin(iTime * 0.2); // Default elevation

    if (iMouse.z > 0.0) { // Use mouse if clicked/dragged
        vec2 mouseNorm = (iMouse.xy / iResolution.xy - 0.5) * 2.0 * 3.14159;
        camAngleX = mouseNorm.x;
        camAngleY = -mouseNorm.y * 0.5; // Limit vertical angle
    }

    // Calculate camera position based on angles and distance
    ro = target + vec3(sin(camAngleX) * cos(camAngleY), sin(camAngleY), cos(camAngleX) * cos(camAngleY)) * camDist;

    // Calculate camera basis vectors (view matrix)
    vec3 f = normalize(target - ro); // Forward vector
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f)); // Right vector
    vec3 u = cross(f, r); // Up vector

    // Calculate ray direction for the current pixel
    float fov = 1.5; // Field of View (lower is more zoomed)
    vec3 rd = normalize(f * fov + uv.x * r + uv.y * u); // Ray Direction

    // --- Raymarch the scene ---
    float dist = rayMarch(ro, rd);

    // --- Shading ---
    vec3 col = vec3(0.0); // Initialize color (background)

    if (dist < 100.0) { // If the ray hit something (not exceeding MAX_DIST)
        vec3 p = ro + rd * dist; // Hit point
        vec3 n = calcNormal(p);  // Surface normal at hit point

        // --- Lighting ---
        vec3 lightPos = vec3(3.0 * sin(iTime * 0.8), 3.0, 3.0 * cos(iTime * 0.8)); // Moving light source
        vec3 lightDir = normalize(lightPos - p);
        float diffuse = max(dot(n, lightDir), 0.0); // Lambertian diffuse term

        // Simple ambient occlusion approximation based on distance inside the geometry
        float ao = clamp(map(p + n * 0.1) / 0.1, 0.0, 1.0); // Check slightly inside the surface

        float ambient = 0.2; // Ambient light intensity
        vec3 lightColor = vec3(1.0, 0.9, 0.8); // Warm light

        // --- Material Color ---
        // Psychedelic color based on position, normal, and time
        vec3 baseColor = 0.5 + 0.5 * cos(iTime * 0.5 + p * 1.5 + n * 1.0 + vec3(0.0, 1.5, 3.0));

        // Combine lighting components
        col = baseColor * (ambient * ao + diffuse * lightColor * ao); // Apply AO to both ambient and diffuse

        // --- Fog ---
        float fogDensity = 0.1 + 0.05 * sin(iTime);
        float fogAmount = exp(-dist * fogDensity); // Exponential fog based on distance
        vec3 fogColor = vec3(0.0); // Fog color (matching background)
        col = mix(fogColor, col, fogAmount);

    } else {
        // Background: simple gradient or stars maybe?
        // Let's keep it black for now to focus on the main object
        col = vec3(0.0);
    }

    // --- Final Output ---
    // Gamma correction (approximate)
    col = pow(col, vec3(0.4545));
    fragColor = vec4(col, 1.0);
}