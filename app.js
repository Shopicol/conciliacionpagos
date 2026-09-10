(function () {
  "use strict";

  const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  const el = {
    loginScreen: document.getElementById("loginScreen"),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginBtn: document.getElementById("loginBtn"),
    loginError: document.getElementById("loginError"),

    app: document.getElementById("app"),
    userName: document.getElementById("userName"),
    roleBadge: document.getElementById("roleBadge"),
    logoutBtn: document.getElementById("logoutBtn"),

    newAccountBtn: document.getElementById("newAccountBtn"),
    accountsList: document.getElementById("accountsList"),

    reconciliationForm: document.getElementById("reconciliationForm"),
    fieldBusiness: document.getElementById("fieldBusiness"),
    fieldDate: document.getElementById("fieldDate"),
    fieldInvoiceNumber: document.getElementById("fieldInvoiceNumber"),
    fieldReference: document.getElementById("fieldReference"),
    fieldAmountBs: document.getElementById("fieldAmountBs"),
    fieldAmount: document.getElementById("fieldAmount"),
    fieldType: document.getElementById("fieldType"),
    fieldCustomerName: document.getElementById("fieldCustomerName"),
    fieldCustomerPhone: document.getElementById("fieldCustomerPhone"),
    fieldNote: document.getElementById("fieldNote"),
    saveReconciliationBtn: document.getElementById("saveReconciliationBtn"),
    reconciliationMessage: document.getElementById("reconciliationMessage"),

    searchInput: document.getElementById("searchInput"),
    asesoraFilter: document.getElementById("asesoraFilter"),
    businessFilter: document.getElementById("businessFilter"),
    exportExcelBtn: document.getElementById("exportExcelBtn"),
    reconciliationsBody: document.getElementById("reconciliationsBody"),
    emptyState: document.getElementById("emptyState"),
    dailyTotalsBody: document.getElementById("dailyTotalsBody"),
    dailyTotalsEmpty: document.getElementById("dailyTotalsEmpty"),

    accountModalOverlay: document.getElementById("accountModalOverlay"),
    accountModalTitle: document.getElementById("accountModalTitle"),
    accountModalClose: document.getElementById("accountModalClose"),
    accountForm: document.getElementById("accountForm"),
    accountFieldId: document.getElementById("accountFieldId"),
    accountFieldType: document.getElementById("accountFieldType"),
    accountFieldLabel: document.getElementById("accountFieldLabel"),
    accountFieldPhone: document.getElementById("accountFieldPhone"),
    accountFieldCedula: document.getElementById("accountFieldCedula"),
    accountFieldBank: document.getElementById("accountFieldBank"),
    accountFieldEmail: document.getElementById("accountFieldEmail"),
    accountFieldHolder: document.getElementById("accountFieldHolder"),
    accountFieldActive: document.getElementById("accountFieldActive"),
    deleteAccountBtn: document.getElementById("deleteAccountBtn"),
    cancelAccountBtn: document.getElementById("cancelAccountBtn"),
    accountFormMessage: document.getElementById("accountFormMessage"),
  };

  const TYPE_LABELS = { pago_movil: "Pago Móvil", binance: "Binance", zelle: "Zelle", otro: "Otro" };
  const BUSINESS_LABELS = { mayoristas: "Mayoristas", shopicol: "Shopicol" };

  let currentProfile = null;
  let allProfiles = {}; // id -> full_name
  let allAccounts = [];
  let allReconciliations = [];

  function money(n) {
    return "$" + Number(n).toFixed(2);
  }

  function showMessage(el2, text, ok) {
    el2.textContent = text;
    el2.hidden = false;
    el2.className = "form-message " + (ok ? "ok" : "error");
  }

  /* ---------------------------------------------------------------
     Autenticación
     --------------------------------------------------------------- */
  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.loginError.hidden = true;
    el.loginBtn.disabled = true;
    el.loginBtn.textContent = "Entrando…";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: el.loginEmail.value.trim(),
      password: el.loginPassword.value,
    });

    el.loginBtn.disabled = false;
    el.loginBtn.textContent = "Entrar";

    if (error) {
      el.loginError.textContent = "Correo o contraseña incorrectos.";
      el.loginError.hidden = false;
      return;
    }
    await enterApp(data.user);
  });

  el.logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      await enterApp(data.session.user);
    }
  }

  async function enterApp(user) {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      el.loginError.textContent = "No se pudo cargar tu perfil. Contacta al administrador.";
      el.loginError.hidden = false;
      return;
    }
    if (!profile.active) {
      el.loginError.textContent = "Tu usuario está desactivado. Contacta al administrador.";
      el.loginError.hidden = false;
      return;
    }

    currentProfile = profile;
    el.loginScreen.hidden = true;
    el.app.hidden = false;
    el.userName.textContent = profile.full_name;
    el.roleBadge.textContent = profile.role === "master" ? "Master" : "Staff";
    el.newAccountBtn.hidden = profile.role !== "master";

    el.fieldDate.value = new Date().toISOString().slice(0, 10);

    await loadProfiles();
    await loadAccounts();
    await loadReconciliations();
  }

  /* ---------------------------------------------------------------
     Perfiles (para mostrar "registrado por")
     --------------------------------------------------------------- */
  async function loadProfiles() {
    const { data } = await supabaseClient.from("profiles").select("id, full_name").order("full_name");
    allProfiles = {};
    (data || []).forEach((p) => (allProfiles[p.id] = p.full_name));
    populateAsesoraFilter(data || []);
  }

  function populateAsesoraFilter(profiles) {
    const current = el.asesoraFilter.value;
    el.asesoraFilter.innerHTML =
      `<option value="">Todas las asesoras</option>` +
      profiles.map((p) => `<option value="${p.id}">${p.full_name}</option>`).join("");
    el.asesoraFilter.value = current;
  }

  /* ---------------------------------------------------------------
     Cuentas de pago
     --------------------------------------------------------------- */
  async function loadAccounts() {
    const { data, error } = await supabaseClient
      .from("payment_accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("No se pudieron cargar las cuentas:", error.message);
      return;
    }
    allAccounts = data || [];
    renderAccounts();
  }

  function renderAccounts() {
    const isMaster = currentProfile.role === "master";
    if (!allAccounts.length) {
      el.accountsList.innerHTML = `<p class="empty-state">Todavía no hay cuentas de pago registradas.</p>`;
      return;
    }
    el.accountsList.innerHTML = allAccounts
      .map((a) => {
        const details = [
          a.phone ? `Tel: <b>${a.phone}</b>` : "",
          a.cedula ? `Cédula: <b>${a.cedula}</b>` : "",
          a.bank ? `Banco: <b>${a.bank}</b>` : "",
          a.email ? `Correo: <b>${a.email}</b>` : "",
          a.holder_name ? `Titular: <b>${a.holder_name}</b>` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return `
          <div class="account-item ${a.active ? "" : "inactive"}">
            <div>
              <strong>${TYPE_LABELS[a.type]} — ${a.label}</strong>
              <div class="details">${details}</div>
            </div>
            ${isMaster ? `<button data-edit-account="${a.id}">Editar</button>` : ""}
          </div>
        `;
      })
      .join("");
  }

  el.accountsList.addEventListener("click", (e) => {
    const editId = e.target.closest("[data-edit-account]")?.dataset.editAccount;
    if (editId) openAccountModal(allAccounts.find((a) => a.id === editId));
  });

  function openAccountModal(account) {
    el.accountFormMessage.hidden = true;
    if (account) {
      el.accountModalTitle.textContent = "Editar cuenta de pago";
      el.accountFieldId.value = account.id;
      el.accountFieldType.value = account.type;
      el.accountFieldLabel.value = account.label;
      el.accountFieldPhone.value = account.phone || "";
      el.accountFieldCedula.value = account.cedula || "";
      el.accountFieldBank.value = account.bank || "";
      el.accountFieldEmail.value = account.email || "";
      el.accountFieldHolder.value = account.holder_name || "";
      el.accountFieldActive.checked = account.active;
      el.deleteAccountBtn.hidden = false;
      el.deleteAccountBtn.onclick = async () => {
        if (!confirm("¿Eliminar esta cuenta de pago?")) return;
        const { error } = await supabaseClient.from("payment_accounts").delete().eq("id", account.id);
        if (error) { alert("No se pudo eliminar: " + error.message); return; }
        closeAccountModal();
        await loadAccounts();
      };
    } else {
      el.accountModalTitle.textContent = "Nueva cuenta de pago";
      el.accountForm.reset();
      el.accountFieldId.value = "";
      el.accountFieldActive.checked = true;
      el.deleteAccountBtn.hidden = true;
    }
    el.accountModalOverlay.hidden = false;
  }
  function closeAccountModal() {
    el.accountModalOverlay.hidden = true;
  }

  el.newAccountBtn.addEventListener("click", () => openAccountModal(null));
  el.accountModalClose.addEventListener("click", closeAccountModal);
  el.cancelAccountBtn.addEventListener("click", closeAccountModal);
  el.accountModalOverlay.addEventListener("click", (e) => {
    if (e.target === el.accountModalOverlay) closeAccountModal();
  });

  el.accountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      type: el.accountFieldType.value,
      label: el.accountFieldLabel.value.trim(),
      phone: el.accountFieldPhone.value.trim(),
      cedula: el.accountFieldCedula.value.trim(),
      bank: el.accountFieldBank.value.trim(),
      email: el.accountFieldEmail.value.trim(),
      holder_name: el.accountFieldHolder.value.trim(),
      active: el.accountFieldActive.checked,
    };
    const id = el.accountFieldId.value;
    let error;
    if (id) {
      ({ error } = await supabaseClient.from("payment_accounts").update(payload).eq("id", id));
    } else {
      ({ error } = await supabaseClient.from("payment_accounts").insert(payload));
    }
    if (error) {
      showMessage(el.accountFormMessage, error.message, false);
      return;
    }
    closeAccountModal();
    await loadAccounts();
  });

  /* ---------------------------------------------------------------
     Registrar un pago (conciliación)
     --------------------------------------------------------------- */
  el.fieldReference.addEventListener("input", () => {
    el.fieldReference.value = el.fieldReference.value.replace(/\D/g, "").slice(0, 6);
  });

  el.reconciliationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.reconciliationMessage.hidden = true;

    const reference = el.fieldReference.value.trim();
    if (!/^\d{6}$/.test(reference)) {
      showMessage(el.reconciliationMessage, "La referencia debe tener exactamente 6 dígitos.", false);
      return;
    }

    el.saveReconciliationBtn.disabled = true;
    el.saveReconciliationBtn.textContent = "Guardando…";

    const payload = {
      business: el.fieldBusiness.value,
      payment_date: el.fieldDate.value,
      invoice_number: el.fieldInvoiceNumber.value.trim(),
      reference,
      amount_bs: parseFloat(el.fieldAmountBs.value) || 0,
      amount: parseFloat(el.fieldAmount.value),
      payment_type: el.fieldType.value,
      customer_name: el.fieldCustomerName.value.trim(),
      customer_phone: el.fieldCustomerPhone.value.trim(),
      note: el.fieldNote.value.trim(),
      entered_by: currentProfile.id,
    };

    const { error } = await supabaseClient.from("reconciliations").insert(payload);

    el.saveReconciliationBtn.disabled = false;
    el.saveReconciliationBtn.textContent = "Registrar pago";

    if (error) {
      // Código 23505 = violación de restricción UNIQUE (referencia repetida)
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        const existing = allReconciliations.find((r) => r.reference === reference);
        const who = existing ? (allProfiles[existing.entered_by] || "otra persona") : "otra persona";
        showMessage(
          el.reconciliationMessage,
          `⚠️ Esa referencia YA fue registrada antes (por ${who}). No se puede repetir un pago.`,
          false
        );
      } else {
        showMessage(el.reconciliationMessage, "No se pudo guardar: " + error.message, false);
      }
      return;
    }

    showMessage(el.reconciliationMessage, "✅ Pago registrado correctamente.", true);
    el.reconciliationForm.reset();
    el.fieldDate.value = new Date().toISOString().slice(0, 10);
    await loadReconciliations();
  });

  /* ---------------------------------------------------------------
     Historial de conciliaciones
     --------------------------------------------------------------- */
  async function loadReconciliations() {
    const { data, error } = await supabaseClient
      .from("reconciliations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("No se pudieron cargar las conciliaciones:", error.message);
      return;
    }
    allReconciliations = data || [];
    renderReconciliations();
  }

  function getFilteredReconciliations() {
    let list = allReconciliations;

    const asesoraId = el.asesoraFilter.value;
    if (asesoraId) {
      list = list.filter((r) => r.entered_by === asesoraId);
    }

    const business = el.businessFilter.value;
    if (business) {
      list = list.filter((r) => r.business === business);
    }

    const q = el.searchInput.value.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.reference.includes(q) ||
          (r.invoice_number || "").toLowerCase().includes(q) ||
          (r.customer_name || "").toLowerCase().includes(q) ||
          (r.customer_phone || "").includes(q)
      );
    }

    return list;
  }

  function renderReconciliations() {
    const list = getFilteredReconciliations();
    renderDailyTotals(list);

    if (!list.length) {
      el.reconciliationsBody.innerHTML = "";
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;
    el.reconciliationsBody.innerHTML = list
      .map(
        (r) => `
        <tr>
          <td>${BUSINESS_LABELS[r.business] || "—"}</td>
          <td>${r.payment_date}</td>
          <td>${r.invoice_number || "—"}</td>
          <td class="ref-cell">${r.reference}</td>
          <td>${r.amount_bs ? moneyBs(r.amount_bs) : "—"}</td>
          <td>${money(r.amount)}</td>
          <td>${TYPE_LABELS[r.payment_type]}</td>
          <td>${r.customer_name || "—"}</td>
          <td>${allProfiles[r.entered_by] || "—"}</td>
        </tr>
      `
      )
      .join("");
  }

  function moneyBs(n) {
    return "Bs " + Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function groupTotalsByDay(list) {
    const groups = {};
    list.forEach((r) => {
      const day = r.payment_date;
      if (!groups[day]) groups[day] = { count: 0, totalBs: 0, totalUsd: 0 };
      groups[day].count += 1;
      groups[day].totalBs += Number(r.amount_bs) || 0;
      groups[day].totalUsd += Number(r.amount) || 0;
    });
    return Object.entries(groups)
      .map(([day, totals]) => ({ day, ...totals }))
      .sort((a, b) => (a.day < b.day ? 1 : -1)); // más reciente primero
  }

  function renderDailyTotals(list) {
    const groups = groupTotalsByDay(list);
    if (!groups.length) {
      el.dailyTotalsBody.innerHTML = "";
      el.dailyTotalsEmpty.hidden = false;
      return;
    }
    el.dailyTotalsEmpty.hidden = true;
    el.dailyTotalsBody.innerHTML = groups
      .map(
        (g) => `
        <tr>
          <td>${g.day}</td>
          <td>${g.count}</td>
          <td>${moneyBs(g.totalBs)}</td>
          <td>${money(g.totalUsd)}</td>
        </tr>
      `
      )
      .join("");
  }

  el.searchInput.addEventListener("input", () => renderReconciliations());
  el.asesoraFilter.addEventListener("change", () => renderReconciliations());
  el.businessFilter.addEventListener("change", () => renderReconciliations());

  /* ---------------------------------------------------------------
     Exportar a Excel — respeta los filtros que estén activos
     --------------------------------------------------------------- */
  el.exportExcelBtn.addEventListener("click", () => {
    const list = getFilteredReconciliations();
    if (!list.length) {
      alert("No hay pagos para exportar con los filtros actuales.");
      return;
    }

    const rows = list.map((r, i) => ({
      "#": i + 1,
      "Fecha": r.payment_date,
      "Número de factura": r.invoice_number || "",
      "Cliente": r.customer_name || "",
      "Monto en Bs": r.amount_bs || 0,
      "Monto en $": r.amount,
    }));

    const dailyGroups = groupTotalsByDay(list);
    const dailyRows = dailyGroups.map((g) => ({
      "Fecha": g.day,
      "Cantidad de pagos": g.count,
      "Total en Bs": g.totalBs,
      "Total en $": g.totalUsd,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const dailyWorksheet = XLSX.utils.json_to_sheet(dailyRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Conciliación");
    XLSX.utils.book_append_sheet(workbook, dailyWorksheet, "Totales por día");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `conciliacion_${fecha}.xlsx`);
  });

  checkSession();
})();
