// ===== FIZIOAPP - app.js =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyAU-Uz2PLNVzwp701dWoaLHSujEuzIbTow",
  authDomain: "fizioterapeut-app.firebaseapp.com",
  projectId: "fizioterapeut-app",
  storageBucket: "fizioterapeut-app.firebasestorage.app",
  messagingSenderId: "224842686525",
  appId: "1:224842686525:web:0735eda9d92b9bd0238a54"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== STATE =====
let currentUser = null;
let currentUserRole = null; // 'fizioterapeut' | 'pacijent'
let currentUserData = null;
let allVjezbe = [];
let allPacijenti = [];
let allPlanovi = [];
let planVjezbeIds = []; // za plan builder

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData(user.uid);
  } else {
    currentUser = null;
    currentUserRole = null;
    showLoginScreen();
  }
});

async function loadUserData(uid) {
  try {
    // Provjeri je li fizioterapeut
    const fizio = await getDoc(doc(db, 'fizioterapeuti', uid));
    if (fizio.exists()) {
      currentUserRole = 'fizioterapeut';
      currentUserData = { id: uid, ...fizio.data() };
      showApp('fizioterapeut');
      return;
    }
    // Provjeri je li pacijent
    const pacijent = await getDoc(doc(db, 'pacijenti', uid));
    if (pacijent.exists()) {
      currentUserRole = 'pacijent';
      currentUserData = { id: uid, ...pacijent.data() };
      showApp('pacijent');
      return;
    }
    // Nema profila — odjava
    await signOut(auth);
    showToast('Korisnički profil nije pronađen', 'error');
  } catch(e) {
    showToast('Greška: ' + e.message, 'error');
  }
}

// ===== LOGIN =====
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  if (!email || !password) { err.textContent = 'Unesite email i lozinku'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e) {
    err.textContent = 'Pogrešan email ili lozinka';
  }
});
document.getElementById('loginPassword').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
});

// ===== SCREENS =====
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

function showApp(role) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';
  document.getElementById('headerUserName').textContent = currentUserData?.ime || currentUser.email;

  // Build nav
  const nav = document.getElementById('headerNav');
  if (role === 'fizioterapeut') {
    nav.innerHTML = `
      <button class="nav-tab active" data-view="pacijenti">Pacijenti</button>
      <button class="nav-tab" data-view="vjezbe">Vježbe</button>
      <button class="nav-tab" data-view="planovi">Planovi</button>
    `;
    nav.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        nav.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showView(btn.dataset.view);
      });
    });
    showView('pacijenti');
    loadPacijenti();
  } else {
    nav.innerHTML = `<button class="nav-tab active" data-view="moj-plan">Moje vježbe</button>`;
    showView('moj-plan');
    loadMojPlan();
  }
}

// ===== VIEWS =====
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  if (name === 'pacijenti') loadPacijenti();
  if (name === 'vjezbe') loadVjezbe();
  if (name === 'planovi') loadPlanovi();
}

// ===== PACIJENTI =====
async function loadPacijenti() {
  try {
    const q = query(collection(db, 'pacijenti'), where('fizioterapeutId', '==', currentUser.uid));
    const snap = await getDocs(q);
    allPacijenti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPacijenti(allPacijenti);
  } catch(e) { showToast('Greška pri učitavanju pacijenata', 'error'); }
}

function renderPacijenti(lista) {
  const container = document.getElementById('pacijentiList');
  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>Nema pacijenata. Dodajte prvog pacijenta!</p></div>`;
    return;
  }
  container.innerHTML = lista.map(p => `
    <div class="pacijent-card" onclick="openPacijentDetalji('${p.id}')">
      <div class="pacijent-avatar">${p.ime?.charAt(0).toUpperCase() || '?'}</div>
      <div class="pacijent-name">${escHtml(p.ime)}</div>
      <div class="pacijent-email">${escHtml(p.email)}</div>
      ${p.napomena ? `<div class="pacijent-napomena">${escHtml(p.napomena)}</div>` : ''}
      <div class="pacijent-actions" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="openPacijentDetalji('${p.id}')">Planovi</button>
        <button class="btn btn-danger btn-sm" onclick="deletePacijent('${p.id}')">Obriši</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('pacijentSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderPacijenti(allPacijenti.filter(p =>
    p.ime?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
  ));
});

// Dodaj pacijenta
document.getElementById('addPacijentBtn').addEventListener('click', () => {
  document.getElementById('modalPacijentTitle').textContent = 'Novi pacijent';
  document.getElementById('pacijentIme').value = '';
  document.getElementById('pacijentEmail').value = '';
  document.getElementById('pacijentLozinka').value = '';
  document.getElementById('pacijentNapomena').value = '';
  openModal('modalPacijent');
});

document.getElementById('savePacijentBtn').addEventListener('click', async () => {
  const ime = document.getElementById('pacijentIme').value.trim();
  const email = document.getElementById('pacijentEmail').value.trim();
  const lozinka = document.getElementById('pacijentLozinka').value;
  const napomena = document.getElementById('pacijentNapomena').value.trim();

  if (!ime || !email || !lozinka) { showToast('Popunite sva obavezna polja', 'error'); return; }
  if (lozinka.length < 6) { showToast('Lozinka mora imati minimalno 6 znakova', 'error'); return; }

  try {
    // Kreiraj Firebase auth korisnika
    const secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, lozinka);
    const uid = userCred.user.uid;
    await signOut(secondaryAuth);

    // Spremi u Firestore
    await setDoc(doc(db, 'pacijenti', uid), {
      ime, email, napomena,
      fizioterapeutId: currentUser.uid,
      kreiran: new Date().toISOString()
    });

    closeModal('modalPacijent');
    await loadPacijenti();
    showToast('Pacijent uspješno dodan!', 'success');
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') {
      showToast('Email je već u upotrebi', 'error');
    } else {
      showToast('Greška: ' + e.message, 'error');
    }
  }
});

async function deletePacijent(id) {
  if (!confirm('Obrisati pacijenta? Ova radnja je nepovratna.')) return;
  try {
    await deleteDoc(doc(db, 'pacijenti', id));
    await loadPacijenti();
    showToast('Pacijent obrisan');
  } catch(e) { showToast('Greška pri brisanju', 'error'); }
}

// Detalji pacijenta
window.openPacijentDetalji = async function(pacijentId) {
  const p = allPacijenti.find(x => x.id === pacijentId);
  if (!p) return;

  document.getElementById('pacijentDetaljiNaslov').textContent = p.ime;
  document.getElementById('pacijentDetaljiContent').innerHTML = '<p style="color:var(--text-dim);">⏳ Učitavanje...</p>';
  openModal('modalPacijentDetalji');

  try {
    const q = query(collection(db, 'planovi'), where('pacijentId', '==', pacijentId));
    const snap = await getDocs(q);
    const planovi = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    document.getElementById('pacijentDetaljiContent').innerHTML = `
      <div class="pacijent-detalji-info">
        <div class="detalji-row"><span class="detalji-label">Email:</span><span>${escHtml(p.email)}</span></div>
        ${p.napomena ? `<div class="detalji-row"><span class="detalji-label">Napomena:</span><span>${escHtml(p.napomena)}</span></div>` : ''}
      </div>
      <div class="planovi-pacijenta">
        <h4>Planovi vježbanja (${planovi.length})</h4>
        ${planovi.length === 0
          ? '<p style="color:var(--text-dim);font-size:.85rem;">Nema dodijeljenih planova.</p>'
          : planovi.map(plan => `
            <div class="plan-mini">
              <div>
                <div class="plan-mini-name">${escHtml(plan.naziv)}</div>
                <div class="plan-mini-count">${plan.vjezbe?.length || 0} vježbi</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick="closeModal('modalPacijentDetalji'); editPlan('${plan.id}')">Uredi</button>
                <button class="btn btn-danger btn-sm" onclick="deletePlan('${plan.id}')">Obriši</button>
              </div>
            </div>`).join('')
        }
        <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="closeModal('modalPacijentDetalji'); openNoviPlanZaPacijenta('${pacijentId}')">Dodaj plan</button>
      </div>
    `;
  } catch(e) {
    document.getElementById('pacijentDetaljiContent').innerHTML = `<p style="color:var(--danger);">Greška: ${e.message}</p>`;
  }
}

window.openNoviPlanZaPacijenta = function(pacijentId) {
  openNoviPlan(pacijentId);
}

// ===== VJEŽBE =====
async function loadVjezbe() {
  try {
    const q = query(collection(db, 'vjezbe'), where('fizioterapeutId', '==', currentUser.uid));
    const snap = await getDocs(q);
    allVjezbe = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderVjezbe(allVjezbe);
  } catch(e) { showToast('Greška pri učitavanju vježbi', 'error'); }
}

const kategorijeLabels = {
  ledja: 'Leđa', ramena: 'Ramena', noge: 'Noge', kuk: 'Kuk',
  koljeno: 'Koljeno', stopalo: 'Stopalo/Gležanj', vrat: 'Vrat',
  core: 'Core/Trbuh', opce: 'Opće'
};

function renderVjezbe(lista) {
  const container = document.getElementById('vjezbeList');
  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📚</div><p>Nema vježbi. Dodajte prvu vježbu!</p></div>`;
    return;
  }
  container.innerHTML = lista.map(v => `
    <div class="vjezba-card">
      <div class="vjezba-header">
        <div class="vjezba-name">${escHtml(v.naziv)}</div>
        <span class="vjezba-kategory">${kategorijeLabels[v.kategorija] || v.kategorija}</span>
      </div>
      <div class="vjezba-opis">${escHtml(v.opis)}</div>
      <div class="vjezba-meta">
        <span class="meta-chip">🔄 ${v.serije} serije</span>
        <span class="meta-chip">✕ ${v.ponavljanja} ponavljanja</span>
        ${v.trajanje > 0 ? `<span class="meta-chip">⏱ ${v.trajanje}s</span>` : ''}
        ${v.video ? `<span class="meta-chip">🎥 Video</span>` : ''}
      </div>
      <div class="vjezba-actions">
        ${v.video ? `<button class="btn btn-secondary btn-sm" onclick="playVideo('${escHtml(v.video)}', '${escHtml(v.naziv)}')">Video</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="editVjezba('${v.id}')">Uredi</button>
        <button class="btn btn-danger btn-sm" onclick="deleteVjezba('${v.id}')">Obriši</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('vjezbaSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderVjezbe(allVjezbe.filter(v =>
    v.naziv?.toLowerCase().includes(q) || v.opis?.toLowerCase().includes(q)
  ));
});

let editingVjezbaId = null;

document.getElementById('addVjezbaBtn').addEventListener('click', () => {
  editingVjezbaId = null;
  document.getElementById('modalVjezbaTitle').textContent = 'Nova vježba';
  document.getElementById('vjezbaName').value = '';
  document.getElementById('vjezbaOpis').value = '';
  document.getElementById('vjezbaVideo').value = '';
  document.getElementById('vjezbaSerije').value = '3';
  document.getElementById('vjezbaPonavlja').value = '10';
  document.getElementById('vjezbaTraje').value = '0';
  document.getElementById('vjezbaKategorija').value = 'opce';
  openModal('modalVjezba');
});

window.editVjezba = function(id) {
  const v = allVjezbe.find(x => x.id === id);
  if (!v) return;
  editingVjezbaId = id;
  document.getElementById('modalVjezbaTitle').textContent = 'Uredi vježbu';
  document.getElementById('vjezbaName').value = v.naziv || '';
  document.getElementById('vjezbaOpis').value = v.opis || '';
  document.getElementById('vjezbaVideo').value = v.video || '';
  document.getElementById('vjezbaSerije').value = v.serije || 3;
  document.getElementById('vjezbaPonavlja').value = v.ponavljanja || 10;
  document.getElementById('vjezbaTraje').value = v.trajanje || 0;
  document.getElementById('vjezbaKategorija').value = v.kategorija || 'opce';
  openModal('modalVjezba');
}

document.getElementById('saveVjezbaBtn').addEventListener('click', async () => {
  const naziv = document.getElementById('vjezbaName').value.trim();
  const opis = document.getElementById('vjezbaOpis').value.trim();
  const video = document.getElementById('vjezbaVideo').value.trim();
  const serije = parseInt(document.getElementById('vjezbaSerije').value) || 3;
  const ponavljanja = parseInt(document.getElementById('vjezbaPonavlja').value) || 10;
  const trajanje = parseInt(document.getElementById('vjezbaTraje').value) || 0;
  const kategorija = document.getElementById('vjezbaKategorija').value;

  if (!naziv) { showToast('Unesite naziv vježbe', 'error'); return; }

  const data = { naziv, opis, video, serije, ponavljanja, trajanje, kategorija, fizioterapeutId: currentUser.uid };

  try {
    if (editingVjezbaId) {
      await updateDoc(doc(db, 'vjezbe', editingVjezbaId), data);
      showToast('Vježba ažurirana!', 'success');
    } else {
      await addDoc(collection(db, 'vjezbe'), data);
      showToast('Vježba dodana!', 'success');
    }
    closeModal('modalVjezba');
    await loadVjezbe();
  } catch(e) { showToast('Greška: ' + e.message, 'error'); }
});

window.deleteVjezba = async function(id) {
  if (!confirm('Obrisati vježbu?')) return;
  try {
    await deleteDoc(doc(db, 'vjezbe', id));
    await loadVjezbe();
    showToast('Vježba obrisana');
  } catch(e) { showToast('Greška pri brisanju', 'error'); }
}

// ===== PLANOVI =====
async function loadPlanovi() {
  try {
    const q = query(collection(db, 'planovi'), where('fizioterapeutId', '==', currentUser.uid));
    const snap = await getDocs(q);
    allPlanovi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPlanovi(allPlanovi);
  } catch(e) { showToast('Greška pri učitavanju planova', 'error'); }
}

let editingPlanId = null;

function renderPlanovi(lista) {
  const container = document.getElementById('planoviList');
  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Nema planova. Kreirajte prvi plan!</p></div>`;
    return;
  }
  container.innerHTML = lista.map(plan => {
    const p = allPacijenti.find(x => x.id === plan.pacijentId);
    return `
      <div class="plan-card">
        <div class="plan-name">${escHtml(plan.naziv)}</div>
        <div class="plan-pacijent">${p ? escHtml(p.ime) : 'Nepoznat pacijent'}</div>
        <div class="plan-count">${plan.vjezbe?.length || 0} vježbi</div>
        <div class="plan-actions">
          <button class="btn btn-secondary btn-sm" onclick="editPlan('${plan.id}')">Uredi</button>
          <button class="btn btn-danger btn-sm" onclick="deletePlan('${plan.id}')">Obriši</button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('addPlanBtn').addEventListener('click', () => openNoviPlan(null));

window.editPlan = async function(planId) {
  const snap = await getDoc(doc(db, 'planovi', planId));
  if (!snap.exists()) return;
  const plan = { id: planId, ...snap.data() };
  openNoviPlan(plan.pacijentId, plan);
}

function openNoviPlan(pacijentId = null, existingPlan = null) {
  editingPlanId = existingPlan ? existingPlan.id : null;
  planVjezbeIds = existingPlan ? [...(existingPlan.vjezbe || [])] : [];

  document.getElementById('modalPlanTitle').textContent = existingPlan ? 'Uredi plan' : 'Novi plan vježbanja';
  document.getElementById('planNaziv').value = existingPlan?.naziv || '';
  document.getElementById('planNapomena').value = existingPlan?.napomena || '';

  // Popuni pacijente
  const sel = document.getElementById('planPacijent');
  sel.innerHTML = allPacijenti.map(p =>
    `<option value="${p.id}" ${p.id === (pacijentId || existingPlan?.pacijentId) ? 'selected' : ''}>${escHtml(p.ime)}</option>`
  ).join('');
  if (allPacijenti.length === 0) {
    sel.innerHTML = '<option value="">Nema pacijenata</option>';
  }

  // Učitaj vježbe ako nisu učitane
  if (allVjezbe.length === 0) {
    loadVjezbeForPlan().then(() => renderPlanVjezbe());
  } else {
    renderPlanVjezbe();
  }
  openModal('modalPlan');
}

async function loadVjezbeForPlan() {
  const q = query(collection(db, 'vjezbe'), where('fizioterapeutId', '==', currentUser.uid));
  const snap = await getDocs(q);
  allVjezbe = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderPlanVjezbe() {
  const container = document.getElementById('planVjezbeList');
  if (planVjezbeIds.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);font-size:.82rem;padding:8px 0;">Nema dodanih vježbi.</p>';
    return;
  }
  container.innerHTML = planVjezbeIds.map((vjezbaId, idx) => {
    const v = allVjezbe.find(x => x.id === vjezbaId);
    if (!v) return '';
    return `
      <div class="plan-vjezba-item">
        <span style="color:var(--text-dim);font-size:.75rem;min-width:20px;">${idx + 1}.</span>
        <span class="plan-vjezba-name">${escHtml(v.naziv)}</span>
        <span class="plan-vjezba-info">${v.serije}×${v.ponavljanja}</span>
        <button class="btn btn-danger btn-sm" onclick="removePlanVjezba(${idx})">✕</button>
      </div>`;
  }).join('');
}

document.getElementById('dodajVjezbuPlanBtn').addEventListener('click', () => {
  // Prikaži dropdown za odabir vježbe
  if (allVjezbe.length === 0) {
    showToast('Nema vježbi u biblioteci. Dodajte vježbe prvo.', 'error');
    return;
  }
  const opts = allVjezbe.map(v => `<option value="${v.id}">${escHtml(v.naziv)}</option>`).join('');
  const sel = document.createElement('select');
  sel.className = 'form-input';
  sel.style.marginTop = '8px';
  sel.innerHTML = `<option value="">-- odaberi vježbu --</option>${opts}`;
  sel.addEventListener('change', () => {
    if (sel.value) {
      planVjezbeIds.push(sel.value);
      renderPlanVjezbe();
      sel.remove();
    }
  });
  document.getElementById('planVjezbeList').appendChild(sel);
  sel.focus();
});

window.removePlanVjezba = function(idx) {
  planVjezbeIds.splice(idx, 1);
  renderPlanVjezbe();
}

document.getElementById('savePlanBtn').addEventListener('click', async () => {
  const naziv = document.getElementById('planNaziv').value.trim();
  const pacijentId = document.getElementById('planPacijent').value;
  const napomena = document.getElementById('planNapomena').value.trim();

  if (!naziv) { showToast('Unesite naziv plana', 'error'); return; }
  if (!pacijentId) { showToast('Odaberite pacijenta', 'error'); return; }
  if (planVjezbeIds.length === 0) { showToast('Dodajte barem jednu vježbu', 'error'); return; }

  try {
    if (editingPlanId) {
      await updateDoc(doc(db, 'planovi', editingPlanId), {
        naziv, pacijentId, napomena, vjezbe: planVjezbeIds
      });
      showToast('Plan ažuriran!', 'success');
    } else {
      await addDoc(collection(db, 'planovi'), {
        naziv, pacijentId, napomena,
        vjezbe: planVjezbeIds,
        fizioterapeutId: currentUser.uid,
        kreiran: new Date().toISOString()
      });
      showToast('Plan kreiran!', 'success');
    }
    closeModal('modalPlan');
    editingPlanId = null;
    await loadPlanovi();
  } catch(e) { showToast('Greška: ' + e.message, 'error'); }
});

window.deletePlan = async function(id) {
  if (!confirm('Obrisati plan?')) return;
  try {
    await deleteDoc(doc(db, 'planovi', id));
    closeModal('modalPacijentDetalji');
    await loadPlanovi();
    showToast('Plan obrisan');
  } catch(e) { showToast('Greška pri brisanju', 'error'); }
}

// ===== MOJ PLAN (pacijent) =====
async function loadMojPlan() {
  const container = document.getElementById('mojPlanContent');
  container.innerHTML = '<p style="color:var(--text-dim);">⏳ Učitavanje...</p>';

  try {
    const q = query(collection(db, 'planovi'), where('pacijentId', '==', currentUser.uid));
    const snap = await getDocs(q);
    const planovi = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (planovi.length === 0) {
      container.innerHTML = `
        <div class="moj-plan-empty">
          <div class="icon">💪</div>
          <p>Vaš fizioterapeut još nije dodijelio plan vježbanja.</p>
        </div>`;
      return;
    }

    // Učitaj sve vježbe koje su potrebne
    const sveVjezbeIds = [...new Set(planovi.flatMap(p => p.vjezbe || []))];
    const vjezbeMap = {};
    for (const vid of sveVjezbeIds) {
      const vSnap = await getDoc(doc(db, 'vjezbe', vid));
      if (vSnap.exists()) vjezbeMap[vid] = { id: vid, ...vSnap.data() };
    }

    container.innerHTML = planovi.map(plan => `
      <div class="plan-section">
        <div class="plan-section-title">📋 ${escHtml(plan.naziv)}</div>
        ${plan.napomena ? `<div class="plan-napomena-box">💬 ${escHtml(plan.napomena)}</div>` : ''}
        ${(plan.vjezbe || []).map((vid, idx) => {
          const v = vjezbeMap[vid];
          if (!v) return '';
          return `
            <div class="vjezba-pacijent-card">
              <div class="vjezba-pacijent-header">
                <div class="vjezba-pacijent-name">${idx + 1}. ${escHtml(v.naziv)}</div>
                <span class="vjezba-kategory">${kategorijeLabels[v.kategorija] || v.kategorija}</span>
              </div>
              ${v.opis ? `<div class="vjezba-pacijent-opis">${escHtml(v.opis)}</div>` : ''}
              <div class="vjezba-pacijent-meta">
                <span class="meta-chip">🔄 ${v.serije} serije</span>
                <span class="meta-chip">✕ ${v.ponavljanja} ponavljanja</span>
                ${v.trajanje > 0 ? `<span class="meta-chip">⏱ ${v.trajanje}s</span>` : ''}
                ${v.video ? `<button class="btn btn-primary btn-sm" onclick="playVideo('${escHtml(v.video)}', '${escHtml(v.naziv)}')">Pogledaj video</button>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = `<p style="color:var(--danger);">Greška pri učitavanju: ${e.message}</p>`;
  }
}

// ===== VIDEO PLAYER =====
window.playVideo = function(url, title) {
  const embedUrl = getEmbedUrl(url);
  document.getElementById('modalVideoTitle').textContent = title;
  document.getElementById('videoIframe').src = embedUrl;
  openModal('modalVideo');
}

function getEmbedUrl(url) {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  return url;
}

document.getElementById('closeVideoBtn').addEventListener('click', () => {
  document.getElementById('videoIframe').src = '';
  closeModal('modalVideo');
});

// ===== MODAL HELPERS =====
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
window.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modalVideo') document.getElementById('videoIframe').src = '';
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      if (overlay.id === 'modalVideo') document.getElementById('videoIframe').src = '';
    }
  });
});

// ===== HELPERS =====
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// Expose globally
window.openPacijentDetalji = window.openPacijentDetalji;
window.playVideo = window.playVideo;
window.editVjezba = window.editVjezba;
window.deleteVjezba = window.deleteVjezba;
window.deletePlan = window.deletePlan;
window.removePlanVjezba = window.removePlanVjezba;
window.closeModal = window.closeModal;
window.openNoviPlanZaPacijenta = window.openNoviPlanZaPacijenta;
