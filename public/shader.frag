precision highp float;

uniform float iTime;
uniform vec2 iResolution;

#define MAX_STEPS 100
#define MAX_DIST 100.0
#define SURF_DIST 0.001

// ---------- SDF Primitives ----------
float sphereSDF(vec3 p, float r) {
  return length(p) - r;
}

float boxSDF(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// ---------- Scene Objects ----------
float sceneSDF(vec3 p, out int matID) {
  float d = MAX_DIST;

  // Desk
  float desk = boxSDF(p - vec3(0.0, -0.5, 0.0), vec3(1.0, 0.1, 1.0));
  d = desk; matID = 1;

  // Book (stacked box)
  float book = boxSDF(p - vec3(-0.3, -0.35, 0.0), vec3(0.2, 0.05, 0.3));
  if (book < d) { d = book; matID = 2; }

  // Lamp base
  float lampBase = boxSDF(p - vec3(0.4, -0.35, 0.0), vec3(0.05, 0.05, 0.05));
  if (lampBase < d) { d = lampBase; matID = 3; }

  // Lamp head (sphere)
  float lampHead = sphereSDF(p - vec3(0.45, -0.2, 0.0), 0.08);
  if (lampHead < d) { d = lampHead; matID = 4; }

  return d;
}

// ---------- Normal & Raymarch ----------
vec3 getNormal(vec3 p) {
  float h = 0.001;
  int m;
  vec2 k = vec2(1, -1);
  return normalize(
    k.xyy * sceneSDF(p + k.xyy * h, m) +
    k.yyx * sceneSDF(p + k.yyx * h, m) +
    k.yxy * sceneSDF(p + k.yxy * h, m) +
    k.xxx * sceneSDF(p + k.xxx * h, m)
  );
}

float raymarch(vec3 ro, vec3 rd, out vec3 p, out int matID) {
  float dist = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    p = ro + rd * dist;
    float d = sceneSDF(p, matID);
    if (d < SURF_DIST || dist > MAX_DIST) break;
    dist += d;
  }
  return dist;
}

// ---------- Lighting ----------
vec3 shade(int matID, vec3 p, vec3 n, vec3 rd) {
  vec3 lightPos = vec3(0.45, -0.2, 0.0); // lamp head
  vec3 lightDir = normalize(lightPos - p);
  float diff = max(dot(n, lightDir), 0.0);
  float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);

  vec3 baseColor;
  if (matID == 1) baseColor = vec3(0.5, 0.3, 0.2); // desk
  else if (matID == 2) baseColor = vec3(0.2, 0.4, 0.7); // book
  else if (matID == 3) baseColor = vec3(0.4); // lamp base
  else if (matID == 4) baseColor = vec3(1.0); // lamp head
  else baseColor = vec3(0.0);

  vec3 ambient = 0.1 * baseColor;
  vec3 color = ambient + diff * baseColor + spec * vec3(1.0);
  if (matID == 4) color += vec3(1.0, 0.9, 0.7) * 0.5; // glow from lamp

  return color;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  vec3 ro = vec3(0.0, 0.0, -2.5);
  vec3 ta = vec3(0.0, -0.2, 0.0);
  vec3 f = normalize(ta - ro);
  vec3 r = normalize(cross(vec3(0, 1, 0), f));
  vec3 u = cross(f, r);
  vec3 rd = normalize(uv.x * r + uv.y * u + 1.5 * f);

  vec3 p;
  int matID;
  float d = raymarch(ro, rd, p, matID);

  vec3 col = vec3(0.0);
  if (d < MAX_DIST) {
    vec3 n = getNormal(p);
    col = shade(matID, p, n, rd);
  } else {
    // soft background
    col = vec3(0.05, 0.07, 0.1) + uv.y * 0.1;
  }

  gl_FragColor = vec4(col, 1.0);
}
