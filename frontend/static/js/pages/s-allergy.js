// /allergy — 내 알레르기 (GET/PUT /auth/me/allergies). registered=false(미등록)와 [](해당 없음)은 달라요.
(async function () {
  const { $, esc, ALLERGENS, ALLERGEN_KEY } = UI;
  const chips = $("#chips"), none = $("#none"), save = $("#save");
  chips.innerHTML = Object.entries(ALLERGENS).map(([no, name]) =>
    `<button class="k-chip" type="button" aria-pressed="false" data-key="${esc(ALLERGEN_KEY[no])}"><b>${no}</b>${esc(name)}</button>`).join("");

  if (!(await S.boot(null))) return;

  let selected = new Set(), noneOn = false, registered = false;
  function draw() {
    for (const c of chips.children) { const on = selected.has(c.dataset.key); c.classList.toggle("is-on", on); c.setAttribute("aria-pressed", on); }
    none.classList.toggle("is-on", noneOn); none.setAttribute("aria-pressed", noneOn);
    const items = UI.allergenItems([...selected]);
    $("#sel-count").textContent = noneOn ? "해당 없음" : items.length ? `${items.length}개 선택됨` : registered ? "선택 없음" : "아직 등록하지 않았어요";
    $("#sel-names").textContent = items.map((a) => a.name).join(", ");
    save.disabled = !noneOn && !items.length;
  }

  try {
    const r = await API.get("/auth/me/allergies");
    registered = r.registered;
    selected = new Set(r.allergies);
    noneOn = r.registered && !r.allergies.length;
    draw();
  } catch (e) { UI.showError($("#flash"), e); return; }

  chips.addEventListener("click", (e) => {
    const c = e.target.closest("[data-key]");
    if (!c) return;
    selected.has(c.dataset.key) ? selected.delete(c.dataset.key) : selected.add(c.dataset.key);
    if (selected.size) noneOn = false;
    draw();
  });
  none.addEventListener("click", () => { noneOn = !noneOn; if (noneOn) selected.clear(); draw(); });

  save.addEventListener("click", () => UI.busy(save, async () => {
    try {
      const r = await API.put("/auth/me/allergies", { allergies: noneOn ? [] : [...selected] });
      registered = true;
      UI.flash(r.allergies.length ? "알레르기 정보를 저장했어요." : "알레르기 ‘해당 없음’으로 저장했어요.");
      location.href = "/me";
    } catch (err) { UI.showError($("#flash"), err); }
  }));
})();
