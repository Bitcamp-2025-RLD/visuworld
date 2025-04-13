#version 330 core
out vec4 fragColor;
in vec2 fragCoord; // Input coordinates are pre-normalized from -1 to 1

uniform vec2 iResolution;
uniform float iTime;
// uniform vec2 iMouse; // Mouse input (not used in this version)

#define NUM_PARTICLES 300 // Number of gas particles
#define GRAVITY -0.1      // Weak downward acceleration (set to 0 for no gravity)
#define MAX_BOUNCES 8     // Maximum bounces to simulate per particle per frame (performance limit)

// --- Hash functions (pseudo-random number generation) ---
// Simple 1D hash
float hash( float n ) { return fract(sin(n)*43758.5453); }

// Generate a 2D vector from a seed
vec2 hash2( float n ) { return vec2(hash(n * 1.234), hash(n * 4.567 + 10.123)); }

// --- Color conversion utility ---
// Converts HSV color space to RGB
vec3 hsv2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    // Apply cubic smoothing and mix with value (brightness)
	rgb = rgb*rgb*(3.0-2.0*rgb);
	return c.z * mix( vec3(1.0), rgb, c.y);
}

// --- Main Shader ---
void main()
{
    // Adjust fragCoord (-1 to 1) for aspect ratio to get UV coordinates
    // where the visible space is roughly [-aspect, aspect] horizontally and [-1, 1] vertically
    vec2 uv = fragCoord.xy;
    float aspect = iResolution.x / iResolution.y;
    uv.x *= aspect;

    // Define the simulation boundaries based on the aspect-corrected UV space
    vec2 bounds = vec2(aspect, 1.0);

    // Initialize final color for this pixel
    vec3 col = vec3(0.0);
    float particle_radius = 0.018; // Visual size of the particles

    // Loop through each particle
    for(int i = 0; i < NUM_PARTICLES; i++)
    {
        float seed = float(i) * 17.37; // Unique seed for each particle

        // --- Initialize Particle State ---
        // Random initial position within the bounds (slightly inset)
        vec2 p0 = (hash2(seed + 1.0) * 2.0 - 1.0) * bounds * 0.95;

        // Random initial velocity (random direction, moderate speed)
        vec2 v0 = (hash2(seed + 3.0) * 2.0 - 1.0) * 0.8; // Speed factor

        // Assign a color based on the hash function
        vec3 pCol = hsv2rgb(vec3(hash(seed + 5.0), 0.75, 0.95)); // Hue, Saturation, Value

        // --- Stateless Physics Simulation (Calculate state at iTime) ---
        // Add a random time offset to desynchronize particle animations
        float t = iTime + hash(seed) * 10.0;

        vec2 pos = p0;
        vec2 vel = v0;
        float g = GRAVITY;                // Vertical acceleration
        float restitution = 0.9;          // Energy kept after bounce (0=inelastic, 1=perfectly elastic)
        float time_elapsed = 0.0;         // Time simulated so far for this particle
        float eps = 0.001;                // Small epsilon for floating point comparisons

        // Simulate particle trajectory and bounces up to the current time 't'
        // This loop iteratively calculates flight segments between bounces.
        for(int bounce = 0; bounce < MAX_BOUNCES; ++bounce) {
            float time_remaining = t - time_elapsed;
            if (time_remaining <= eps) break; // Stop if simulation time is reached

            // Calculate time until the next potential collision with each boundary
            float time_to_floor = 1e6, time_to_ceil = 1e6, time_to_wall = 1e6;

            // -- Time to hit floor (y = -bounds.y) --
            // Solves: pos.y + vel.y*dt + 0.5*g*dt^2 = -bounds.y
            if (vel.y < 0.0 || g < 0.0) { // Check only if potentially moving towards floor
                float a = 0.5 * g;
                float b = vel.y;
                float c = pos.y + bounds.y;
                float delta = b*b - 4.0*a*c; // Discriminant of quadratic equation

                if (delta >= 0.0) { // Real roots exist
                    float dt1 = (-b + sqrt(delta)) / (2.0*a + 1e-9); // Add small value to avoid division by zero if g=0
                    float dt2 = (-b - sqrt(delta)) / (2.0*a + 1e-9);
                    // Find the smallest positive time
                    if (dt1 > eps && dt2 > eps) time_to_floor = min(dt1, dt2);
                    else if (dt1 > eps) time_to_floor = dt1;
                    else if (dt2 > eps) time_to_floor = dt2;
                 }
                 // Handle linear case (g=0) separately if vel.y is non-zero
                 if (abs(a) < eps && abs(b) > eps) {
                     float dt_lin = -c / b;
                     if (dt_lin > eps && vel.y < 0.0) time_to_floor = dt_lin;
                 }
            }

            // -- Time to hit ceiling (y = bounds.y) --
            // Solves: pos.y + vel.y*dt + 0.5*g*dt^2 = bounds.y
            if (vel.y > 0.0 || g > 0.0) { // Check only if potentially moving towards ceiling
                float a = 0.5 * g;
                float b = vel.y;
                float c = pos.y - bounds.y;
                float delta = b*b - 4.0*a*c;
                 if (delta >= 0.0) {
                    float dt1 = (-b + sqrt(delta)) / (2.0*a + 1e-9);
                    float dt2 = (-b - sqrt(delta)) / (2.0*a + 1e-9);
                    if (dt1 > eps && dt2 > eps) time_to_ceil = min(dt1, dt2);
                    else if (dt1 > eps) time_to_ceil = dt1;
                    else if (dt2 > eps) time_to_ceil = dt2;
                 }
                 if (abs(a) < eps && abs(b) > eps) {
                     float dt_lin = -c / b;
                     if (dt_lin > eps && vel.y > 0.0) time_to_ceil = dt_lin;
                 }
            }

            // -- Time to hit walls (x = +/-bounds.x) --
            // Linear motion horizontally: pos.x + vel.x*dt = +/-bounds.x
            if (abs(vel.x) > eps) { // Avoid division by zero if vel.x is zero
                 float time_to_wall_r = (bounds.x - pos.x) / vel.x;  // Time to hit right wall
                 float time_to_wall_l = (-bounds.x - pos.x) / vel.x; // Time to hit left wall
                 time_to_wall = 1e6;
                 // Select the positive time corresponding to current direction
                 if (vel.x > 0.0 && time_to_wall_r > eps) time_to_wall = time_to_wall_r;
                 else if (vel.x < 0.0 && time_to_wall_l > eps) time_to_wall = time_to_wall_l;
            }

            // Find the minimum positive time until the next collision
            float time_to_collision = min(min(time_to_floor, time_to_ceil), time_to_wall);

            // --- Update State ---
            if (time_to_collision >= time_remaining - eps) {
                // No collision occurs within the remaining simulation time.
                // Advance position and velocity to the end time.
                pos += vel * time_remaining + 0.5 * g * time_remaining * time_remaining * vec2(0,1);
                // Optional: update final velocity (not strictly needed as we break)
                // vel += g * time_remaining * vec2(0,1);
                time_elapsed = t; // Mark time as fully simulated
                break; // Simulation finished for this particle
            } else {
                // A collision occurs before the end time.
                // Advance position and velocity to the exact moment of collision.
                pos += vel * time_to_collision + 0.5 * g * time_to_collision * time_to_collision * vec2(0,1);
                vel += g * time_to_collision * vec2(0,1);
                time_elapsed += time_to_collision; // Update elapsed time

                // Apply bounce based on which boundary was hit (check proximity after state update)
                // Use a slightly larger epsilon for position checks to handle precision errors
                float pos_eps = 0.01;
                bool bounced = false;

                // Check floor collision (use time_to_collision to disambiguate near-simultaneous hits)
                if (abs(time_to_collision - time_to_floor) < eps && vel.y < 0.0) {
                    pos.y = -bounds.y;        // Clamp position firmly to the boundary
                    vel.y *= -restitution;    // Reverse and dampen vertical velocity
                    // vel.x *= 0.98;         // Optional: Apply friction
                    bounced = true;
                }
                // Check ceiling collision
                else if (abs(time_to_collision - time_to_ceil) < eps && vel.y > 0.0) {
                    pos.y = bounds.y;
                    vel.y *= -restitution;
                    // vel.x *= 0.98;
                    bounced = true;
                }

                // Check wall collisions (can happen simultaneously with floor/ceil)
                if (abs(time_to_collision - time_to_wall) < eps) {
                    if (vel.x > 0.0) pos.x = bounds.x;  // Clamp to right wall
                    else pos.x = -bounds.x;             // Clamp to left wall
                    vel.x *= -restitution;              // Reverse and dampen horizontal velocity
                    bounced = true;
                 }

                 // Safety break if something unexpected happens (e.g., float errors cause no bounce condition match)
                 if (!bounced) {
                     break;
                 }
            }
        } // End bounce simulation loop

        // --- Render the particle ---
        // Calculate distance from the current pixel UV to the particle's final position
        float dist = length(uv - pos);

        // Use smoothstep for soft-edged particles and accumulate color contribution
        // The closer the pixel, the stronger the particle's color contribution.
        col += pCol * smoothstep(particle_radius, particle_radius * 0.5, dist);

    } // End particle loop

    // --- Final Color Output ---
    // Optional post-processing: Clamp brightness, apply gamma correction, etc.
    col = pow(clamp(col, 0.0, 1.5), vec3(0.8)); // Allow slight overbright, simple gamma-like curve

    fragColor = vec4(col, 1.0); // Output final color with full alpha
}