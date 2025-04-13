#version 330 core

out vec4 fragColor;

in vec2 fragCoord; // Already normalized to [-1, 1]

uniform float iTime;
uniform vec2 iResolution;
// uniform vec2 iMouse; // Not used in this version

#define NUM_PARTICLES 60
#define PARTICLE_RADIUS 0.04
#define GRAVITY 0.6       // Acceleration due to gravity (downwards)
#define BOUNCE_RATIO 0.75  // Energy retained after bounce (0.0 - 1.0)

// --- Hash functions ---
// Simple 1D hash
float hash1(float n) {
    return fract(sin(n) * 43758.5453);
}

// Simple 2D hash
vec2 hash2(float n) {
    return vec2(hash1(n), hash1(n + 57.0));
}

// --- Physics Solver ---
// Solves for the smallest positive time t > 0 where:
// p + v*t + 0.5*a*t^2 = target
// Returns 1e10 if no positive solution exists.
float solve(float p, float v, float a, float target) {
    float delta = p - target;
    // Constant position special case (a=0, v=0)
    if (abs(a) < 1e-5 && abs(v) < 1e-5) {
        return 1e10; // No movement, can't reach target unless already there
    }
    // Constant velocity case (a=0)
    if (abs(a) < 1e-5) {
        float t = -delta / v;
        return (t > 1e-5) ? t : 1e10; // Return positive time, avoid t=0 hits immediately
    }

    // Quadratic case: A*t^2 + B*t + C = 0
    float A = 0.5 * a;
    float B = v;
    float C = delta;
    float discriminant = B*B - 4.0*A*C;

    if (discriminant < 0.0) return 1e10; // No real roots

    float sqrtD = sqrt(discriminant);
    // Two potential solutions
    float t1 = (-B - sqrtD) / (2.0 * A);
    float t2 = (-B + sqrtD) / (2.0 * A);

    // Return the smallest positive time, ensuring t > epsilon
    float tMin = min(t1, t2);
    float tMax = max(t1, t2);

    if (tMin > 1e-5) return tMin;
    if (tMax > 1e-5) return tMax;

    return 1e10; // No positive solution found
}

// --- Particle State ---
struct ParticleState {
    vec2 p; // Position
    vec2 v; // Velocity
};

// Calculates particle state at a given time, handling wall bounces
ParticleState calcParticleState(int index, float time, vec2 gravityAcc, vec2 boundsMin, vec2 boundsMax, float bounceRatio, float radius) {
    // Generate consistent initial conditions based on index
    float seed = float(index) * 12.345;
    vec2 p0 = mix(boundsMin + radius, boundsMax - radius, hash2(seed)); // Start inside bounds
    vec2 v0 = (hash2(seed + 10.0) - 0.5) * 2.0; // Initial velocity [-1, 1] range, scaled later if needed

    vec2 p = p0;
    vec2 v = v0;
    float currentTime = 0.0;

    // Simulate forward in time, handling bounces
    const int MAX_BOUNCES = 32; // Safety break
    for (int i = 0; i < MAX_BOUNCES; ++i) {
        if (currentTime >= time) break;

        float remainingTime = time - currentTime;

        // Calculate time until the particle *center* hits each boundary wall
        // Note: Gravity only affects Y component
        float dt_xMin = solve(p.x, v.x, 0.0,        boundsMin.x + radius);
        float dt_xMax = solve(p.x, v.x, 0.0,        boundsMax.x - radius);
        float dt_yMin = solve(p.y, v.y, gravityAcc.y, boundsMin.y + radius);
        float dt_yMax = solve(p.y, v.y, gravityAcc.y, boundsMax.y - radius);

        // Find the earliest collision time
        float dt_hit = 1e9;
        dt_hit = min(dt_hit, dt_xMin);
        dt_hit = min(dt_hit, dt_xMax);
        dt_hit = min(dt_hit, dt_yMin);
        dt_hit = min(dt_hit, dt_yMax);

        // Determine the time step: either until the next collision or until the target time
        float dt = min(remainingTime, dt_hit);

        // Update position and velocity for this step
        p += v * dt + 0.5 * gravityAcc * dt * dt;
        v += gravityAcc * dt;
        currentTime += dt;

        // If a bounce occurred (and we haven't reached the target time yet)
        if (abs(dt - dt_hit) < 1e-4 && currentTime < time) {
             // Apply bounce response based on which wall was hit
             // Add small epsilon push away from wall to prevent sticking issues? (Optional)
             float epsilon = 1e-4;
             if (abs(dt_hit - dt_xMin) < 1e-4) { // Hit left wall
                p.x = boundsMin.x + radius + epsilon;
                v.x *= -bounceRatio;
            } else if (abs(dt_hit - dt_xMax) < 1e-4) { // Hit right wall
                p.x = boundsMax.x - radius - epsilon;
                v.x *= -bounceRatio;
            } else if (abs(dt_hit - dt_yMin) < 1e-4) { // Hit bottom wall
                p.y = boundsMin.y + radius + epsilon;
                v.y *= -bounceRatio;
                // Optional: Apply friction on ground bounce
                // v.x *= 0.9;
            } else if (abs(dt_hit - dt_yMax) < 1e-4) { // Hit top wall
                p.y = boundsMax.y - radius - epsilon;
                v.y *= -bounceRatio;
            }
        } else {
             // No collision within the remaining time, loop will terminate
            break;
        }
    }

    // Ensure simulation reaches exactly 'time' if max bounces was hit early
     if (currentTime < time) {
         float dt = time - currentTime;
         p += v * dt + 0.5 * gravityAcc * dt * dt;
         v += gravityAcc * dt;
     }

    ParticleState finalState;
    finalState.p = p;
    finalState.v = v;
    return finalState;
}


// --- Main Shader ---
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Use normalized coordinates directly [-1, 1]
    vec2 uv = fragCoord;

    // Define simulation world bounds (slightly inside the [-1, 1] viewport)
    vec2 boundsMin = vec2(-1.0, -1.0);
    vec2 boundsMax = vec2( 1.0,  1.0);

    // Background color
    vec3 col = vec3(0.1, 0.1, 0.15);

    // Gravity vector (usually pointing down)
    vec2 gravityVec = vec2(0.0, -GRAVITY);

    // Iterate through particles
    for (int i = 0; i < NUM_PARTICLES; ++i) {
        // Calculate particle state at current time
        ParticleState state = calcParticleState(i, iTime, gravityVec, boundsMin, boundsMax, BOUNCE_RATIO, PARTICLE_RADIUS);
        vec2 p = state.p;

        // Calculate distance from fragment coordinate to particle center
        float dist = length(uv - p);

        // Draw particle if fragment is within radius (with antialiasing)
        // Antialiasing width based on approximate pixel size in uv coords
        float aa_width = 2.0 / iResolution.y; // Width of ~1 pixel vertically
        float intensity = smoothstep(PARTICLE_RADIUS + aa_width, PARTICLE_RADIUS - aa_width, dist);

        if (intensity > 0.0) {
            // Assign color based on index (for variety)
            vec3 particleColor = 0.5 + 0.5*sin(vec3(0.0,2.1,4.2) + hash1(float(i)*5.67)*6.28);

            // Optional: Modulate color/brightness by speed
            float speed = length(state.v);
            particleColor = mix(particleColor * 0.6, particleColor * 1.2, smoothstep(0.0, 2.0, speed)); // Dim slow, brighten fast

            // Blend particle color with background
            // Using mix for overwrite-style blending:
            col = mix(col, clamp(particleColor, 0.0, 1.0), intensity);
            // Or use additive blending for glowy effect:
            // col += clamp(particleColor, 0.0, 1.0) * intensity;
        }
    }

    // Final output color
    fragColor = vec4(col, 1.0);
}