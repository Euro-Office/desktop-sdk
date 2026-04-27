export interface PromptInputs {
  topic: string;
  userSlideCount: number | null;
  style: string;
  availableFonts: string[];
  supportsAnimations: boolean;
}

const fontsContract = `
FONT SELECTION POLICY
Choose {"t":"theme.fonts","major":...,"minor":...} **only** from AVAILABLE FONTS.

Rules:
1. Match the language from {"t":"presentation.start","language":...}:
   - Latin → Inter, Roboto, Open Sans, Lato, Noto Sans, Arial
   - Cyrillic → Noto Sans/Serif, PT Sans/Serif, Inter, Roboto, Arial
   - Greek → Noto Sans/Serif, Roboto, Arial
   - Arabic/Hebrew → Noto Sans Arabic/Hebrew, Arial (RTL support required)
   - CJK/Devanagari/Thai → Noto Sans [script], Malgun Gothic, Microsoft YaHei
2. Style alignment:
   - modern/minimal/corporate → Sans for minor, Sans or transitional Serif for major
   - classic/editorial → Serif for major, Serif for minor
3. Fallbacks:
   - If font not in AVAILABLE FONTS, pick the first available with correct script coverage.
   - Avoid decorative/display faces for body text.
4. Major = headings; Minor = body text.
5. Output exactly one valid pair.
`;

export function buildPrompt({
  topic,
  userSlideCount,
  style,
  availableFonts,
  supportsAnimations,
}: PromptInputs): string {
  const additionalConstraint =
    userSlideCount !== null
      ? `- You have a HARD CAP of ${userSlideCount} slide blocks: output exactly ${userSlideCount} {"t":"slide.start"}...{"t":"slide.end"} pairs.`
      : "";

  const goalSlidesText = userSlideCount
    ? `with exactly ${userSlideCount} slides`
    : `with an optimal number of slides (do NOT state a number)`;

  const slideCountContract = userSlideCount
    ? `
SLIDE COUNT CONTRACT (CRITICAL — HARD CAP):
- You MUST output exactly ${userSlideCount} slide blocks.
- A slide block is defined as one pair: {"t":"slide.start",...} ... {"t":"slide.end"}.
- Produce **no more and no fewer** than ${userSlideCount} such blocks.
- If you feel you need more space, compress or merge content into the existing slides instead of starting a new slide.
- Never emit a ${userSlideCount + 1}-th {"t":"slide.start"} under any circumstances.
`
    : "";

  const animationCommands = supportsAnimations
    ? `
- {"t":"slide.transition","effect":"effectFadeSmoothly","speed":"medium","advanceOnClick":true}
- {"t":"animation","ph_type":"title|ctrTitle|subTitle|body","ph_idx":<number>,"effect":"fade|appear|fly-in|float-in|wipe|zoom|bounce|split|wheel","trigger":"withprevious|afterprevious|onclick","duration":500}
`
    : "";

  const animationConstraint = supportsAnimations
    ? `- Add slide transitions and animations for professional polish. When animating a slide, animate all its content elements (title and body). See "SLIDE TRANSITIONS & ANIMATIONS" section.`
    : "";

  const animationSection = supportsAnimations
    ? `
SLIDE TRANSITIONS & ANIMATIONS:

Use transitions and animations where logical and appropriate for the content and narrative.
Not every slide needs effects — use them to enhance meaning, not distract from it.

Transitions (slide.transition):
- Add transitions to slides for visual flow — section changes, topic shifts, after visual content.
- Skip transition on title slide (first slide).
- Place {"t":"slide.transition",...} AFTER {"t":"slide.start"} and BEFORE any content.
- Available effects:
  * Subtle: "effectFadeSmoothly", "effectFade", "effectDissolve", "effectWipeLeft", "effectWipeRight", "effectWipeUp", "effectWipeDown"
  * Modern: "effectPushLeft", "effectPushRight", "effectCoverLeft", "effectCoverRight"
  * Bold: "effectCubeLeft", "effectCubeRight", "effectFlipLeft", "effectFlipRight"
- Speed: "fast", "medium", "slow". Use "medium" by default.
- Match style: corporate → fade/wipe; modern → push/cover; creative → cube/flip.

Animations (animation):
- Add animations to reveal content sequentially — titles, then body content.
- When you animate a slide, animate ALL content elements (title AND body/chart/table) so everything appears in sequence.
- Place {"t":"animation",...} AFTER each element's figure.end/table.end/chart.end/picture.end.
- Effects: "fade", "appear", "wipe", "float-in", "zoom", "fly-in", "bounce", "split", "wheel".
- Trigger: "afterprevious" (auto-play in sequence), "withprevious" (simultaneous), "onclick" (on click).
- Duration: 300-800ms. Use 500ms as default.
- Do NOT animate: dt, ftr, sldNum placeholders.

Example — title slide with animations:
{"t":"slide.start","layout":"title"}
{"t":"figure.start","ph_type":"ctrTitle","ph_idx":0}
{"t":"para","text":"Quarterly Report"}
{"t":"figure.end"}
{"t":"animation","ph_type":"ctrTitle","ph_idx":0,"effect":"fade","trigger":"afterprevious","duration":500}
{"t":"figure.start","ph_type":"subTitle","ph_idx":1}
{"t":"para","text":"Q4 2024 Results"}
{"t":"figure.end"}
{"t":"animation","ph_type":"subTitle","ph_idx":1,"effect":"fade","trigger":"afterprevious","duration":400}
{"t":"slide.end"}

Example — content slide with transition and animations:
{"t":"slide.start","layout":"obj"}
{"t":"slide.transition","effect":"effectFadeSmoothly","speed":"medium"}
{"t":"figure.start","ph_type":"title","ph_idx":0}
{"t":"para","text":"Key Findings"}
{"t":"figure.end"}
{"t":"animation","ph_type":"title","ph_idx":0,"effect":"fade","trigger":"afterprevious","duration":400}
{"t":"figure.start","ph_type":"body","ph_idx":1}
{"t":"para","text":"Revenue grew by 15%"}
{"t":"para","text":"Customer base expanded"}
{"t":"figure.end"}
{"t":"animation","ph_type":"body","ph_idx":1,"effect":"wipe","trigger":"afterprevious","duration":500}
{"t":"slide.end"}
`
    : "";

  return `
You must stream a sequence of JSON objects (JSON Lines). Each line is one complete JSON object with a field "t".
ABSOLUTELY NO prose, no markdown, no code fences — only JSON objects, one per line.

Goal: generate a complete PPTX presentation about "${topic}" ${goalSlidesText} in ${style} style.
${slideCountContract}

AVAILABLE FONTS (use only these for theme.fonts):
${availableFonts.join(", ")}

Top-level envelope (MANDATORY):
- {"t":"presentation.start","language":"<a language identifier as defined by RFC 4646/BCP 47. Example: "en-CA">"}
  ... all commands MUST be here ...
- {"t":"presentation.end"}


Allowed commands (flat placeholder fields; NO nested "placeholder" objects):
- {"t":"theme.start"}
- {"t":"theme.colors","dk1":"#RRGGBB","lt1":"#RRGGBB","dk2":"#RRGGBB","lt2":"#RRGGBB","accent1":"#RRGGBB","accent2":"#RRGGBB","accent3":"#RRGGBB","accent4":"#RRGGBB","accent5":"#RRGGBB","accent6":"#RRGGBB","hlink":"#RRGGBB","folHlink":"#RRGGBB"}
- {"t":"theme.fonts","major":"<one of AVAILABLE FONTS>","minor":"<one of AVAILABLE FONTS>"}
- {"t":"theme.decor.start"}
- {"t":"layoutDecor","layoutType":"title|obj|twoObj|twoTxTwoObj|secHead|titleOnly|blank|objTx|picTx|vertTx|vertTitleAndTx","fill":"accent1|accent2|accent3|accent4|accent5|accent6|dk1|lt1|dk2|lt2|hlink|folHlink","opacity":0.08_to_0.30,"d":"M 0.00 0.90 L 1.00 0.82 L 1.00 1.00 L 0.00 1.00 Z"}
- {"t":"theme.decor.end"}
- {"t":"theme.end"}

- {"t":"slide.start","layout":"title|obj|twoObj|twoTxTwoObj|secHead|titleOnly|blank|objTx|picTx|vertTx|vertTitleAndTx"}
- {"t":"slide.end"}

- {"t":"figure.start","ph_type":"ctrTitle|subTitle|title|body|dt|ftr|sldNum","ph_idx":<number>}
- {"t":"para","text":"..."}           // each para is one paragraph; NO bullets/dashes/checkboxes/emojis/numeric prefixes
- {"t":"figure.end"}

- {"t":"picture.start","ph_type":"body|picture","ph_idx":<number>}
- {"t":"picture.desc","text":"detailed image prompt..."}  // one-shot description
- {"t":"picture.end"}

- {"t":"table.start","ph_type":"body","ph_idx":<number>,"rows":R,"cols":C}
- {"t":"cell.start","row":r,"col":c}
- {"t":"para","text":"..."}           // still no bullets here
- {"t":"cell.end"}
- {"t":"table.end"}

- {"t":"chart.start","ph_type":"body","ph_idx":<number>,"chartType":"bar|barStacked|barStackedPercent|bar3D|barStacked3D|barStackedPercent3D|barStackedPercent3DPerspective|horizontalBar|horizontalBarStacked|horizontalBarStackedPercent|horizontalBar3D|horizontalBarStacked3D|horizontalBarStackedPercent3D|lineNormal|lineStacked|lineStackedPercent|line3D|pie|pie3D|doughnut|scatter|area|areaStacked|areaStackedPercent"}
- {"t":"chart.title","text":"..."}
- {"t":"chart.axes","x":"...","y":"..."}
- {"t":"chart.categories","items":["A","B","C",...]}
- {"t":"chart.series","name":"Series Name","values":[10,12,15]}
- {"t":"chart.end"}

- {"t":"notes.start"}
- {"t":"para","text":"speaker note..."}  // no bullets in notes either
- {"t":"notes.end"}
${animationCommands}

${additionalConstraint}

Constraints:
- The VERY FIRST object must be {"t":"presentation.start"} and the VERY LAST must be {"t":"presentation.end"}.
${animationConstraint}
- All commands (theme.*, slide.*, figure.*, para, picture.*, table.*, chart.*, notes.*) MUST appear STRICTLY between presentation.start and presentation.end.
- Inside the presentation, all slide content and notes MUST appear strictly between that slide's {"t":"slide.start"} and {"t":"slide.end"}.
- Do NOT emit any figure/table/chart/picture/notes/para outside an open slide.
- Theme commands (theme.*) MUST be inside the presentation and BEFORE the first slide.start.
- {"t":"slide.start"} MUST include ONLY the keys "t" and "layout". Do NOT include any extra fields (like ph_type, chartType, etc.).
- **Text formatting rule (critical):** never prefix any paragraph with bullets, dashes, asterisks, checkbox marks, numerals with separators, or emojis.
  Disallowed starts include: "•", "·", "▪", "◦", "*", "-", "–", "—", "1)", "1.", "[ ]", "[x]", "✅", etc.
  For list-like content, emit multiple {"t":"para","text":"Item"} lines as plain sentences with no leading marks.
- **Slide count rule:** If a fixed slide count is provided by the user, produce EXACTLY that many slides. If the user did NOT provide a slide count, choose the optimal number yourself and DO NOT state or promise any specific number anywhere in the output.
- Use AVAILABLE FONTS only for theme.fonts major/minor.
- Start with theme.* then the first slide as "title".
- Do NOT place tables/charts/pictures into title/ctrTitle/subTitle placeholders.
- Do NOT place any content into dt/ftr/sldNum placeholders.
- Provide concise speaker notes for most content slides via notes.start/para/notes.end.
- Each JSON must be valid and standalone. Do not split objects across lines.
- Layout value is STRICT: it MUST be EXACTLY one of:
  title, obj, twoObj, twoTxTwoObj, secHead, titleOnly, blank, objTx, picTx, vertTx, vertTitleAndTx.
- Never use any value that looks like a command token (e.g., "chart.start", "notes.end") or contains a dot.
- {"t":"slide.start"} MUST contain ONLY keys "t" and "layout". Any other keys are forbidden.
- If you are unsure which layout to choose, use "obj".

- Slide count rule (critical):
  * If the user provided a slide count, you MUST produce exactly that many slides.
  * A slide = one {"t":"slide.start",...} ... {"t":"slide.end"} pair.
  * Never exceed or fall short of this number. If you need more content, compress/merge within existing slides.
  * If the user did not provide a slide count, choose an optimal number yourself and do NOT state any number.
${animationSection}
- Language (critical):
  * The "language" property in {"t":"presentation.start", ...} defines the language for ALL human-readable text in this deck:
\tslide titles, body paragraphs, captions, picture.desc, chart titles/axes/categories/series names, speaker notes, etc.
  * Use a valid BCP 47 tag (RFC 4646). Example: "en-CA".
  * JSON field names and command tokens stay in English as specified; only the TEXT CONTENT follows the selected language.
  * Choose fonts (theme.fonts major/minor) that exist in AVAILABLE FONTS and have glyph coverage for the selected language/script.


Layout selection guide (pick the one that best matches the intent of the slide):
- title — Opening slide. Big headline + subtitle.
  Placeholders: ctrTitle(0), subTitle(1). Use ONLY for slide 1 (and rarely for a closing recap).
- obj — Default content slide. One title + a single body area for text/table/chart/image.
  Placeholders: title(0), body(1). Use for most slides: overviews, short lists (as multiple plain paras), a single chart or table, or one illustration.
- twoObj — Comparison / Two columns. Title + left body + right body.
  Placeholders: title(0), body(1), body(2). Use for A/B comparisons, Pros vs Cons, Before/After.
- twoTxTwoObj — Four-block grid. Title + 4 bodies.
  Placeholders: title(0), body(1..4). Use for 2×2 matrices, KPI grids, SWOT, roadmap quadrants. Keep each block short.
- secHead — Section divider. Big section title + optional single line of context.
  Placeholders: title(0), body(1). Use to split the deck into parts; minimal content only.
- titleOnly — Divider/quote slide with a single large title line.
  Placeholders: title(0). Use for a clean break or a single statement.
- blank — Empty canvas. No content placeholders.
  Use only for full-bleed visuals or highly custom compositions (rare in this protocol).
- objTx — Object with caption. Title + main object (image/table/chart) + caption text.
  Placeholders: title(0), body(1)=object, body(2)=caption. Use when an illustration needs a short explanation.
- picTx — Image + text. Title + picture + text.
  Placeholders: title(0), picture(1), body(2). Use for hero image with supporting text, case studies, product shots with commentary.
- vertTx — Vertical body (rare). Vertical typography scenarios only (explicit request).
  Placeholders: title(0), body(1). Avoid by default; if unsure, choose obj.
- vertTitleAndTx — Vertical title and body (very rare). Niche vertical design.
  Placeholders: title(0), body(1). Do not use unless explicitly asked for vertical text.


Placeholder compatibility for media (tables/charts/pictures):
- title:     NO media in ctrTitle/subTitle. (Text only.)
- obj:       Put ALL media into body(1). Use {"t":"picture.start","ph_type":"body","ph_idx":1}, etc.
- twoObj:    Media goes into body(1) or body(2) (left/right).
- twoTxTwoObj: Media goes into body(1..4).
- objTx:     Main object region is body(1); caption is body(2). Put pictures/charts/tables into body(1).
- picTx:     Picture MUST target placeholder "picture(1)"; text goes to body(2).
- secHead/titleOnly/vert*:  Prefer text only; if media is absolutely needed, use the body placeholder if present.
- blank:     No placeholders — do NOT emit media here.


- Never use ph_type:"picture" unless the current layout actually provides a "picture" placeholder (currently only "picTx").
  For all other layouts (e.g., "obj", "twoObj", "objTx"), always target a "body" placeholder for pictures/charts/tables.

Chart type selection guide (choose ONLY from the exact values listed; no aliases and no combo/stock):
DATA SHAPE → CHART TYPE
1) Single series over time (years, months, dates) → "lineNormal"
   - Multiple time series (2–6): "lineNormal" for trend comparison, or "lineStacked" if showing cumulative totals
   - Percent shares over time (each point sums ≈100%) → "lineStackedPercent"
   - Use "line3D" only if the user explicitly requests 3D
2) Categories (not time) + 1–N series → column/bar family:
   - Short category labels → "bar"
   - Long labels or many categories → "horizontalBar"
   - Additive parts per category → "barStacked" / "horizontalBarStacked"
   - Percent shares per category (sum 100%) → "barStackedPercent" / "horizontalBarStackedPercent"
   - 3D variants only on explicit 3D request
3) Parts of a whole for FEW categories (≤6, sums ≈100%) → "pie" or "doughnut"
   - If >6 categories or values are too similar, do NOT use pie/doughnut — choose "bar" or "horizontalBar"
   - "pie3D" only on explicit 3D request
4) Area charts (accumulation across X):
   - One series volume over time → "area"
   - Multiple additive series → "areaStacked"
   - Normalized to 100% → "areaStackedPercent"
5) Two quantitative variables (x and y) without categories → "scatter"
6) NEVER use: any "combo*" types, "stock", or "unknown". Prefer 2D unless explicitly demanded.


Theme color & font guide (OOXML-aligned):
- Theme color slots (choose hex values that fit both the topic and the OOXML role):
  dk1     — Primary text on light backgrounds. Near-black or very dark neutral; must pass WCAG AA (≥4.5:1) on lt1.
  lt1     — Primary background. Near-white or very light neutral; avoid color casts that reduce contrast.
  dk2     — Secondary text/accents on light backgrounds. Dark neutral or dark tinted; AA vs lt1 preferred.
  lt2     — Secondary background/panels. Very light neutral/tinted; keep sufficient contrast vs dk1/dk2 text.
  accent1 — Main brand/topic accent. High-chroma hue matching the subject; used for highlights and primary charts.
  accent2 — Complementary accent (distinct from accent1); used for secondary emphasis.
  accent3 — Additional accent; ensure it is distinguishable from accent1/2 in charts.
  accent4 — Additional accent for multi-series charts.
  accent5 — Additional accent for multi-series charts.
  accent6 — Additional accent for multi-series charts.
  hlink   — Hyperlink color (typically a readable blue aligned with the palette); must be readable on lt1 and distinct from body text.
  folHlink— Visited hyperlink color; distinct from hlink and body text (e.g., a darker/desaturated variant).
- Palette guidance by topic (suggestions; adapt as needed):
  Technology/AI → cool blues & violets; neutrals slightly cool.
  Healthcare/Medical → clean blues & greens; avoid alarming reds as primaries.
  Environment/Nature → greens & earth tones; neutrals warm/earthy.
  Finance/Business → confident blues & neutrals (gray/charcoal); accents conservative.
  Education → approachable blues & oranges; balanced, accessible hues.
- Chart palette: assign series colors in order from accent1..accent6; ensure sufficient contrast vs backgrounds and between series.
- Contrast & accessibility:
  * Body text (dk1 on lt1) should meet WCAG AA (≈≥4.5:1). Large headings (major) ≥3:1.
  * Do not choose overly light accents for text over light backgrounds.
  * Links should be clearly identifiable and legible; underline is acceptable.
- Fonts (theme.fonts):
  * major — headings/titles; minor — body text. Choose ONLY from AVAILABLE FONTS.
  * Language/script coverage: pick fonts that contain glyphs for the presentation language(s). For Cyrillic/Greek/Arabic/Hebrew/CJK, use fonts with native script coverage if present in AVAILABLE FONTS.
  * Purpose/style alignment:
\t  - modern/corporate → clean sans-serif for minor, sturdy sans or transitional serif for major.
\t  - classic/editorial → serif major + readable serif/sans minor.
\t  - technical/code snippets → consider monospaced only for the snippet figures, not as theme minor.
  * Readability first: avoid decorative/display faces for minor; ensure consistent x-height and weight contrast.
  * If multiple languages appear, prefer a pair with broad Unicode support and harmonious metrics.
- IMPORTANT: Do NOT copy any fixed hex examples; you must PICK COLORS dynamically to fit the topic and roles above.

Good choices:
- Neutral light theme: lt1="#FFFFFF", dk1="#111111", dk2="#333333", lt2="#F5F7FA"; accent1="#2A67FF", accent2="#00B894", ...
- Healthcare: cool lt1, dk1; accents in clean blues/greens; readable hlink blue; folHlink darker.
- Environment: soft warm lt2; greens/browns as accents with sufficient contrast.

Bad choices (avoid):
- dk1 too light to read on lt1; overly saturated lt1; accent colors indistinguishable in charts; hyperlink color identical to body text; fonts lacking glyphs for the language.

Remember:
- Choose theme.colors and theme.fonts BEFORE the first slide.
- Colors must be valid hex "#RRGGBB" values.
- Font names must be from AVAILABLE FONTS exactly as listed.

THEME DECOR (MANDATORY, FLAT JSON BETWEEN START/END)

- You MUST emit exactly one {"t":"theme.decor.start"} and one {"t":"theme.decor.end"} between theme.fonts and theme.end.
- Between them, emit ONLY flat {"t":"layoutDecor",...} lines — no arrays or nested objects.

LAYOUT COVERAGE GUARANTEE (ABSOLUTE)
- Before emitting the first {"t":"slide.start"}, decide the exact set of layouts you will use in the entire deck.
- For EVERY layout that will later appear in {"t":"slide.start","layout":...} (including "title"), emit 2–3 {"t":"layoutDecor"} lines (layers) before any slides.
- Missing decor for any used layout is forbidden.
- Do NOT include decor for layouts that will not appear in the slides.
- After {"t":"theme.decor.end"} you MUST NOT introduce any new layout value in slides.

DECOR STRUCTURE (PER LAYOUT, FLAT LINE)
- Each layer is one flat object:
  {"t":"layoutDecor",
   "layoutType":"title|obj|twoObj|twoTxTwoObj|secHead|titleOnly|blank|objTx|picTx|vertTx|vertTitleAndTx",
   "fill":"accent1|accent2|accent3|accent4|accent5|accent6|dk1|lt1|dk2|lt2|hlink|folHlink",
   "opacity":0.08..0.30,
   "d":"M 0.00 0.90 L 1.00 0.82 L 1.00 1.00 L 0.00 1.00 Z"}
- Exactly ONE closed path per layer (via "d" string). Path MUST start with "M" and end with "Z".
- "d" uses ONLY M/L/C/Z with normalized coordinates in [0..1], quantized to 0.05 (0.00, 0.05, …, 1.00).
- Each layer should cover ~15%–20% of slide area and stay near edges/corners (background only). Do NOT overlap core text zones (title/body/picture placeholders).
- Consistency: the same layout type must keep the same decoration across all slides using that layout.

FILL & OPACITY
- "fill" MUST be one of the theme color keys ONLY: accent1..accent6, dk1, lt1, dk2, lt2, hlink, folHlink. Hex (#RRGGBB) is FORBIDDEN in decor.
- "opacity" MUST be between 0.08 and 0.30. Layers SHOULD vary in fill and/or opacity to create depth.

STYLE → GEOMETRY RULES (CRITICAL)
- Corporate / Official / Classic / Minimal → STRAIGHT polygons (no curves).
- Modern / Playful / Creative / Nature / Ocean / Marketing / Growth / Education / Wellness → at least one layer uses curve ("C").
- Technical / Technology / AI / Data / Engineering / Cloud / Cyber / System / Architecture → mixed: one polygon layer, one curved.

SHAPE LIBRARY (REFERENCE ONLY)
The "d" path must implement one of these archetypes but you must NOT include any "shape" field.
- DIAGONAL_BAND: [ M(0,B) L(1,B-T) L(1,B-T+H) L(0,B+H) Z ]
- CORNER_BLOCK: [ M(0,0) L(S,0) L(0,S) Z ] or [ M(1-S,0) L(1,0) L(1,S) L(1-S,S*0.6) Z ]
- BOTTOM_WAVE: [ M(0,A) C(0.4,A+U,0.7,A+V,1.0,A+W) L(1,1) L(0,1) Z ]
- CORNER_ARC: [ M(0,R) C(0.0,R*0.55,R*0.55,0.0,R,0.0) L(R,0.0) L(0,0) Z ]

HARD GEOMETRY GUARDRAILS
- Each layer MUST be closed (M...Z), convex, edge ≥ 0.10, ≤35% area, near edges/corners.
- No thin lines, spikes, or overlaps with text zones.

${fontsContract}
`;
}
