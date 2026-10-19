/* Display saved observations only. No browser-side fit or interpolation. */
(() => {
  const data = window.rareErrorResults;
  if (!data) return;
  const buttons = [...document.querySelectorAll("[data-errors]")];
  // portfolio-study.py sorts the frozen metric values by noise_seed 0 through 4.
  const legend = document.querySelector("#seed-legend");
  if (legend) {
    for (let seed = 0; seed < 5; seed++) {
      const key = document.createElement("span");
      key.className = `seed-key seed-${seed}`;
      const swatch = document.createElement("span");
      swatch.className = "seed-swatch";
      swatch.setAttribute("aria-hidden", "true");
      key.append(swatch, document.createTextNode(`Seed ${seed}`));
      legend.append(key);
    }
    legend.hidden = false;
  }
  const ns = "http://www.w3.org/2000/svg";
  const svgNode = (tag, attrs, value) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, val));
    if (value !== undefined) node.textContent = value;
    return node;
  };
  function metric(name, result, max, percent) {
    const container = document.querySelector(`[data-metric="${name}"]`);
    const value = container.querySelector("strong");
    const range = container.querySelector(".metric-range");
    const graph = container.querySelector("svg");
    graph.replaceChildren();
    graph.setAttribute("viewBox", "0 0 360 104");
    if (!result) {
      value.textContent = "No fit";
      range.textContent = "Missing trial combinations";
      graph.setAttribute("aria-label", "No fitted result at zero errors.");
      graph.append(svgNode("text", { x: 12, y: 50, fill: "currentColor", "font-size": 13 }, "No fitted result at zero errors."));
      return;
    }
    const format = (x) => (percent ? `${(100 * x).toFixed(2)}%` : x.toFixed(4));
    value.textContent = format(result.mean);
    range.textContent = `${format(result.min)}–${format(result.max)} · full seed range`;
    graph.setAttribute(
      "aria-label",
      `Five noise seeds: ${result.values.map((v, i) => `Seed ${i}: ${format(v)}`).join(", ")}. Axis zero to ${percent ? "100 percent" : max}.`,
    );
    graph.append(
      svgNode("line", {
        x1: 12,
        x2: 348,
        y1: 76,
        y2: 76,
        stroke: "currentColor",
        opacity: ".35",
      }),
    );
    graph.append(
      svgNode(
        "text",
        { x: 12, y: 98, fill: "currentColor", "font-size": 12 },
        "0",
      ),
    );
    graph.append(
      svgNode(
        "text",
        {
          x: 348,
          y: 98,
          fill: "currentColor",
          "text-anchor": "end",
          "font-size": 12,
        },
        percent ? "100%" : max,
      ),
    );
    result.values.forEach((v, i) => {
      const point = svgNode("circle", {
        cx: 12 + (336 * v) / max,
        cy: 12 + i * 12,
        r: 4,
        class: `seed-point seed-${i}`,
        "data-seed": i,
      });
      point.append(svgNode("title", {}, `Seed ${i}: ${format(v)}`));
      graph.append(point);
    });
  }

  function select(count) {
    const result = data[count];
    const ratio = count
      ? result.choice_branch_target_nmse.mean /
        data[20].choice_branch_target_nmse.mean
      : null;
    document.querySelector('[data-overview="purity"]').textContent = count
      ? `${(100 * result.choice_intended_purity.mean).toFixed(2)}%`
      : "No fit";
    document.querySelector('[data-overview="ratio"]').textContent = count
      ? `${ratio.toFixed(2)}×`
      : "No fit";
    document.querySelector("#compact-result").textContent = count
      ? `${count} errors per stimulus: ${(100 * result.choice_intended_purity.mean).toFixed(2)} percent choice attribution; ${ratio.toFixed(2)} times the balanced reconstruction error.`
      : "No fit: stimulus and choice are confounded.";
    buttons.forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.errors) === count),
      ),
    );
    document.querySelectorAll("[data-cell]").forEach((cell) => {
      const amount = cell.dataset.cell === "error" ? count : result.correct;
      cell.querySelector("strong").textContent = amount;
      cell
        .querySelectorAll(".dots i")
        .forEach((dot, i) => dot.classList.toggle("filled", i < amount));
    });
    document.querySelector("#design-state").textContent =
      `${count} ${count === 1 ? "error" : "errors"} per stimulus · 80 trials total · design rank ${result.rank} of 4`;
    document.querySelector("#result-title").textContent =
      count === 0
        ? "The missing comparison."
        : count === 20
          ? "Four equally sampled cells."
          : "A clean label. A noisier estimate.";
    document.querySelector("#result-explanation").textContent =
      count === 0
        ? "With no errors, stimulus and choice coincide. Two combinations are missing, so this study refuses the dPCA fit."
        : count === 20
          ? "Twenty trials in each cell: the balanced comparison. This is the reference used by the error ratio, not a claim of perfect recovery."
          : `The component is strongly choice-driven, yet mean reconstruction error is ${ratio.toFixed(2)} times the balanced setting. Each error cell has only ${count} ${count === 1 ? "trial" : "trials"}.`;
    metric("purity", result.choice_intended_purity, 1, true);
    metric("error", result.choice_branch_target_nmse, 0.12, false);
    document.querySelector("#null-result").textContent =
      count === 0
        ? "No null fit at zero errors."
        : `At ${count} errors per stimulus, mean branch energy is ${result.choice_branch_truth_energy_fraction.mean.toFixed(7)} on noise-free truth and ${result.choice_branch_total_nmse.mean.toFixed(7)} on held-out noisy means, both divided by total true signal energy. Full seed ranges and curves appear in the saved figure.`;
  }
  document.querySelectorAll(".dots").forEach((node) => {
    for (let i = 0; i < 40; i++) node.append(document.createElement("i"));
  });
  buttons.forEach((button) =>
    button.addEventListener("click", () =>
      select(Number(button.dataset.errors)),
    ),
  );
  document.querySelector(".count-controls").hidden = false;
  const openDiagnostics = () => {
    const details = document.querySelector("#seed-diagnostics");
    details.open = true;
    details.querySelector("summary").focus({ preventScroll: true });
  };
  document
    .querySelector("[data-open-diagnostics]")
    .addEventListener("click", openDiagnostics);
  if (location.hash === "#seed-diagnostics") openDiagnostics();
  select(1);
})();
