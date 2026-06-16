// ===== FIZIOAPP - app.js (Multi-role) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let currentUserRole = null; // 'superadmin' | 'fizioterapeut' | 'pacijent'
let currentUserData = null;
let allVjezbe = [];
let allPacijenti = [];
let allFizioterapeuti = [];
let allPlanovi = [];
let planVjezbeIds = [];
let editingPlanId = null;
let editingVjezbaId = null;

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
    // Super-admin?
    const admin = await getDoc(doc(db, 'superadmini', uid));
    if (admin.exists()) {
      currentUserRole = 'superadmin';
      currentUserData = { id: uid, ...admin.data() };
      showApp('superadmin');
      return;
    }
    // Fizioterapeut?
    const fizio = await getDoc(doc(db, 'fizioterapeuti', uid));
    if (fizio.exists()) {
      currentUserRole = 'fizioterapeut';
      currentUserData = { id: uid, ...fizio.data() };
      showApp('fizioterapeut');
      return;
    }
    // Pacijent?
    const pacijent = await getDoc(doc(db, 'pacijenti', uid));
    if (pacijent.exists()) {
      currentUserRole = 'pacijent';
      currentUserData = { id: uid, ...pacijent.data() };
      showApp('pacijent');
      return;
    }
    await signOut(auth);
    showToast('Profil nije pronađen', 'error');
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
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

// ===== SCREENS =====
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

function showApp(role) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';
  document.getElementById('headerUserName').textContent = currentUserData?.ime || currentUser.email;

  const nav = document.getElementById('headerNav');

  if (role === 'superadmin') {
    nav.innerHTML = `
      <button class="nav-tab active" data-view="fizioterapeuti-admin">Fizioterapeuti</button>
      <button class="nav-tab" data-view="pacijenti-admin">Pacijenti</button>
      <button class="nav-tab" data-view="vjezbe">Vježbe</button>
    `;
    bindNav(nav);
    showView('fizioterapeuti-admin');
    loadFizioterapeuti();

  } else if (role === 'fizioterapeut') {
    nav.innerHTML = `
      <button class="nav-tab active" data-view="pacijenti">Pacijenti</button>
      <button class="nav-tab" data-view="vjezbe">Vježbe</button>
      <button class="nav-tab" data-view="planovi">Planovi</button>
    `;
    bindNav(nav);
    showView('pacijenti');
    loadPacijenti();

  } else {
    nav.innerHTML = `<button class="nav-tab active" data-view="moj-plan">Moje vježbe</button>`;
    bindNav(nav);
    showView('moj-plan');
    loadMojPlan();
  }
}

function bindNav(nav) {
  nav.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showView(btn.dataset.view);
    });
  });
}

// ===== VIEWS =====
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  if (name === 'fizioterapeuti-admin') loadFizioterapeuti();
  if (name === 'pacijenti-admin') loadSviPacijenti();
  if (name === 'pacijenti') loadPacijenti();
  if (name === 'vjezbe') loadVjezbe();
  if (name === 'planovi') loadPlanovi();
}

// ===== SUPER-ADMIN: FIZIOTERAPEUTI =====
async function loadFizioterapeuti() {
  const snap = await getDocs(collection(db, 'fizioterapeuti'));
  allFizioterapeuti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFizioterapeuti();
}

function renderFizioterapeuti() {
  const container = document.getElementById('fizioterapeutiList');
  if (!container) return;
  if (allFizioterapeuti.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg></div><p>Nema fizioterapeuta.</p></div>`;
    return;
  }
  container.innerHTML = allFizioterapeuti.map(f => `
    <div class="pacijent-card">
      <div class="pacijent-avatar">${f.ime?.charAt(0).toUpperCase() || '?'}</div>
      <div class="pacijent-name">${escHtml(f.ime)}</div>
      <div class="pacijent-email">${escHtml(f.email)}</div>
      ${f.specijalizacija ? `<div class="pacijent-napomena">${escHtml(f.specijalizacija)}</div>` : ''}
      <div class="pacijent-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteFizioterapeut('${f.id}')">Obriši</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('addFizioterapeutBtn')?.addEventListener('click', () => {
  document.getElementById('fizioterapeutIme').value = '';
  document.getElementById('fizioterapeutEmail').value = '';
  document.getElementById('fizioterapeutLozinka').value = '';
  document.getElementById('fizioterapeutSpecijalizacija').value = '';
  openModal('modalFizioterapeut');
});

document.getElementById('saveFizioterapeutBtn')?.addEventListener('click', async () => {
  const ime = document.getElementById('fizioterapeutIme').value.trim();
  const email = document.getElementById('fizioterapeutEmail').value.trim();
  const lozinka = document.getElementById('fizioterapeutLozinka').value;
  const specijalizacija = document.getElementById('fizioterapeutSpecijalizacija').value.trim();

  if (!ime || !email || !lozinka) { showToast('Popunite sva polja', 'error'); return; }
  if (lozinka.length < 6) { showToast('Lozinka mora imati min. 6 znakova', 'error'); return; }

  try {
    const secondaryApp = initializeApp(firebaseConfig, 'secondary-fizio-' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, lozinka);
    const uid = userCred.user.uid;
    await signOut(secondaryAuth);

    await setDoc(doc(db, 'fizioterapeuti', uid), {
      ime, email, specijalizacija,
      dodanOd: currentUser.uid,
      kreiran: new Date().toISOString()
    });

    closeModal('modalFizioterapeut');
    await loadFizioterapeuti();
    showToast('Fizioterapeut dodan!', 'success');
  } catch(e) {
    showToast(e.code === 'auth/email-already-in-use' ? 'Email je već u upotrebi' : 'Greška: ' + e.message, 'error');
  }
});

window.deleteFizioterapeut = async function(id) {
  if (!confirm('Obrisati fizioterapeuta?')) return;
  await deleteDoc(doc(db, 'fizioterapeuti', id));
  await loadFizioterapeuti();
  showToast('Fizioterapeut obrisan');
}

// ===== SUPER-ADMIN: SVI PACIJENTI =====
async function loadSviPacijenti() {
  const snap = await getDocs(collection(db, 'pacijenti'));
  allPacijenti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (allFizioterapeuti.length === 0) await loadFizioterapeuti();
  renderSviPacijenti();
}

function renderSviPacijenti() {
  const container = document.getElementById('sviPacijentiList');
  if (!container) return;
  if (allPacijenti.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg></div><p>Nema pacijenata.</p></div>`;
    return;
  }
  container.innerHTML = allPacijenti.map(p => {
    const fizio = allFizioterapeuti.find(f => f.id === p.fizioterapeutId);
    return `
      <div class="pacijent-card">
        <div class="pacijent-avatar">${p.ime?.charAt(0).toUpperCase() || '?'}</div>
        <div class="pacijent-name">${escHtml(p.ime)}</div>
        <div class="pacijent-email">${escHtml(p.email)}</div>
        <div class="fizioterapeut-badge">
          <span class="fizioterapeut-label">Fizioterapeut:</span>
          <span class="fizioterapeut-name">${fizio ? escHtml(fizio.ime) : 'Nije dodijeljen'}</span>
        </div>
        ${p.napomena ? `<div class="pacijent-napomena">${escHtml(p.napomena)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ===== FIZIOTERAPEUT: PACIJENTI =====
async function loadPacijenti() {
  try {
    const snap = await getDocs(collection(db, 'pacijenti'));
    allPacijenti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (allFizioterapeuti.length === 0) await loadFizioterapeuti();
    renderPacijenti(allPacijenti);
  } catch(e) { showToast('Greška pri učitavanju', 'error'); }
}

function renderPacijenti(lista) {
  const container = document.getElementById('pacijentiList');
  if (!container) return;
  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg></div><p>Nema pacijenata.</p></div>`;
    return;
  }
  container.innerHTML = lista.map(p => {
    const fizio = allFizioterapeuti.find(f => f.id === p.fizioterapeutId);
    const isMoj = p.fizioterapeutId === currentUser.uid;
    return `
      <div class="pacijent-card ${isMoj ? 'moj-pacijent' : ''}" onclick="openPacijentDetalji('${p.id}')">
        <div class="pacijent-avatar">${p.ime?.charAt(0).toUpperCase() || '?'}</div>
        ${isMoj ? '<div class="moj-badge">Moj pacijent</div>' : ''}
        <div class="pacijent-name">${escHtml(p.ime)}</div>
        <div class="pacijent-email">${escHtml(p.email)}</div>
        <div class="fizioterapeut-badge">
          <span class="fizioterapeut-label">Fizioterapeut:</span>
          <span class="fizioterapeut-name">${fizio ? escHtml(fizio.ime) : 'Nije dodijeljen'}</span>
        </div>
        ${p.napomena ? `<div class="pacijent-napomena">${escHtml(p.napomena)}</div>` : ''}
        <div class="pacijent-actions" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="openPacijentDetalji('${p.id}')">Planovi</button>
          ${isMoj ? `<button class="btn btn-danger btn-sm" onclick="deletePacijent('${p.id}')">Obriši</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('pacijentSearch')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderPacijenti(allPacijenti.filter(p =>
    p.ime?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
  ));
});

// Filter - moji / svi
document.getElementById('filterMoji')?.addEventListener('click', () => {
  setFilter('moji');
  renderPacijenti(allPacijenti.filter(p => p.fizioterapeutId === currentUser.uid));
});
document.getElementById('filterSvi')?.addEventListener('click', () => {
  setFilter('svi');
  renderPacijenti(allPacijenti);
});
function setFilter(active) {
  document.getElementById('filterMoji')?.classList.toggle('active', active === 'moji');
  document.getElementById('filterSvi')?.classList.toggle('active', active === 'svi');
}

document.getElementById('addPacijentBtn')?.addEventListener('click', () => {
  document.getElementById('pacijentIme').value = '';
  document.getElementById('pacijentEmail').value = '';
  document.getElementById('pacijentLozinka').value = '';
  document.getElementById('pacijentNapomena').value = '';
  openModal('modalPacijent');
});

document.getElementById('savePacijentBtn')?.addEventListener('click', async () => {
  const ime = document.getElementById('pacijentIme').value.trim();
  const email = document.getElementById('pacijentEmail').value.trim();
  const lozinka = document.getElementById('pacijentLozinka').value;
  const napomena = document.getElementById('pacijentNapomena').value.trim();

  if (!ime || !email || !lozinka) { showToast('Popunite sva polja', 'error'); return; }
  if (lozinka.length < 6) { showToast('Lozinka mora imati min. 6 znakova', 'error'); return; }

  try {
    const secondaryApp = initializeApp(firebaseConfig, 'secondary-pac-' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, lozinka);
    const uid = userCred.user.uid;
    await signOut(secondaryAuth);

    await setDoc(doc(db, 'pacijenti', uid), {
      ime, email, napomena,
      fizioterapeutId: currentUser.uid,
      kreiran: new Date().toISOString()
    });

    closeModal('modalPacijent');
    await loadPacijenti();
    showToast('Pacijent dodan!', 'success');
  } catch(e) {
    showToast(e.code === 'auth/email-already-in-use' ? 'Email je već u upotrebi' : 'Greška: ' + e.message, 'error');
  }
});

window.deletePacijent = async function(id) {
  if (!confirm('Obrisati pacijenta?')) return;
  await deleteDoc(doc(db, 'pacijenti', id));
  await loadPacijenti();
  showToast('Pacijent obrisan');
}

// ===== DETALJI PACIJENTA =====
window.openPacijentDetalji = async function(pacijentId) {
  const p = allPacijenti.find(x => x.id === pacijentId);
  if (!p) return;
  const fizio = allFizioterapeuti.find(f => f.id === p.fizioterapeutId);
  const isMoj = p.fizioterapeutId === currentUser.uid;

  document.getElementById('pacijentDetaljiNaslov').textContent = p.ime;
  document.getElementById('pacijentDetaljiContent').innerHTML = '<p style="color:var(--grey-mid);">Učitavanje...</p>';
  openModal('modalPacijentDetalji');

  try {
    const q = query(collection(db, 'planovi'), where('pacijentId', '==', pacijentId));
    const snap = await getDocs(q);
    const planovi = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    document.getElementById('pacijentDetaljiContent').innerHTML = `
      <div class="pacijent-detalji-info">
        <div class="detalji-row"><span class="detalji-label">Email:</span><span>${escHtml(p.email)}</span></div>
        <div class="detalji-row"><span class="detalji-label">Fizioterapeut:</span><span style="color:var(--teal);font-weight:600;">${fizio ? escHtml(fizio.ime) : 'Nije dodijeljen'}</span></div>
        ${p.napomena ? `<div class="detalji-row"><span class="detalji-label">Napomena:</span><span>${escHtml(p.napomena)}</span></div>` : ''}
      </div>
      <div class="planovi-pacijenta">
        <h4>Planovi vježbanja (${planovi.length})</h4>
        ${planovi.length === 0
          ? '<p style="color:var(--grey-mid);font-size:.85rem;margin-bottom:12px;">Nema dodijeljenih planova.</p>'
          : planovi.map(plan => {
              const planFizio = allFizioterapeuti.find(f => f.id === plan.fizioterapeutId);
              return `
                <div class="plan-mini">
                  <div>
                    <div class="plan-mini-name">${escHtml(plan.naziv)}</div>
                    <div class="plan-mini-count">${plan.vjezbe?.length || 0} vježbi · ${planFizio ? escHtml(planFizio.ime) : ''}</div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="closeModal('modalPacijentDetalji'); editPlan('${plan.id}')">Uredi</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePlan('${plan.id}')">Obriši</button>
                  </div>
                </div>`;
            }).join('')
        }
        ${isMoj ? `<button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="closeModal('modalPacijentDetalji'); openNoviPlanZaPacijenta('${pacijentId}')">+ Dodaj plan</button>` : '<p style="font-size:.78rem;color:var(--grey-mid);margin-top:8px;">Samo odgovorni fizioterapeut može dodavati planove.</p>'}
      </div>
    `;
  } catch(e) {
    document.getElementById('pacijentDetaljiContent').innerHTML = `<p style="color:var(--danger);">Greška: ${e.message}</p>`;
  }
}

window.openNoviPlanZaPacijenta = function(pacijentId) { openNoviPlan(pacijentId); }

// ===== VJEŽBE =====
async function loadVjezbe() {
  try {
    // Shared biblioteka — sve vježbe svih fizioterapeuta
    const snap = await getDocs(collection(db, 'vjezbe'));
    allVjezbe = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (allFizioterapeuti.length === 0) await loadFizioterapeuti();
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
  if (!container) return;
  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><p>Nema vježbi.</p></div>`;
    return;
  }
  container.innerHTML = lista.map(v => {
    const autor = allFizioterapeuti.find(f => f.id === v.fizioterapeutId);
    const jeMoja = v.fizioterapeutId === currentUser.uid || currentUserRole === 'superadmin';
    return `
      <div class="vjezba-card">
        <div class="vjezba-header">
          <div class="vjezba-name">${escHtml(v.naziv)}</div>
          <span class="vjezba-kategory">${kategorijeLabels[v.kategorija] || v.kategorija}</span>
        </div>
        ${autor ? `<div style="font-size:.72rem;color:var(--grey-mid);margin-bottom:6px;">Dodao: ${escHtml(autor.ime)}</div>` : ''}
        <div class="vjezba-opis">${escHtml(v.opis)}</div>
        <div class="vjezba-meta">
          <span class="meta-chip">${v.serije} serije</span>
          <span class="meta-chip">${v.ponavljanja} ponavljanja</span>
          ${v.trajanje > 0 ? `<span class="meta-chip">${v.trajanje}s</span>` : ''}
          ${v.video ? `<span class="meta-chip">Video</span>` : ''}
        </div>
        <div class="vjezba-actions">
          ${v.video ? `<button class="btn btn-secondary btn-sm" onclick="playVideo('${escHtml(v.video)}', '${escHtml(v.naziv)}')">Pogledaj video</button>` : ''}
          ${jeMoja ? `<button class="btn btn-secondary btn-sm" onclick="editVjezba('${v.id}')">Uredi</button>` : ''}
          ${jeMoja ? `<button class="btn btn-danger btn-sm" onclick="deleteVjezba('${v.id}')">Obriši</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('vjezbaSearch')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderVjezbe(allVjezbe.filter(v => v.naziv?.toLowerCase().includes(q) || v.opis?.toLowerCase().includes(q)));
});

document.getElementById('addVjezbaBtn')?.addEventListener('click', () => {
  editingVjezbaId = null;
  document.getElementById('modalVjezbaTitle').textContent = 'Nova vježba';
  ['vjezbaName','vjezbaOpis','vjezbaVideo'].forEach(id => document.getElementById(id).value = '');
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
  document.getElementById('vjezbaKategorija').value = v.kategorija || 'opce';
  openModal('modalVjezba');
}

document.getElementById('saveVjezbaBtn')?.addEventListener('click', async () => {
  const naziv = document.getElementById('vjezbaName').value.trim();
  const opis = document.getElementById('vjezbaOpis').value.trim();
  const video = document.getElementById('vjezbaVideo').value.trim();
  const kategorija = document.getElementById('vjezbaKategorija').value;
  if (!naziv) { showToast('Unesite naziv vježbe', 'error'); return; }
  const data = { naziv, opis, video, kategorija, fizioterapeutId: currentUser.uid };
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
  await deleteDoc(doc(db, 'vjezbe', id));
  await loadVjezbe();
  showToast('Vježba obrisana');
}

// ===== PLANOVI =====
async function loadPlanovi() {
  try {
    // Fizioterapeut vidi sve planove u klinici
    const snap = await getDocs(collection(db, 'planovi'));
    allPlanovi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (allPacijenti.length === 0) await loadPacijenti();
    renderPlanovi(allPlanovi);
  } catch(e) { showToast('Greška pri učitavanju planova', 'error'); }
}

function renderPlanovi(lista) {
  const container = document.getElementById('planoviList');
  if (!container) return;
  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><p>Nema planova.</p></div>`;
    return;
  }
  container.innerHTML = lista.map(plan => {
    const p = allPacijenti.find(x => x.id === plan.pacijentId);
    const fizio = allFizioterapeuti.find(f => f.id === plan.fizioterapeutId);
    return `
      <div class="plan-card">
        <div class="plan-name">${escHtml(plan.naziv)}</div>
        <div class="plan-pacijent">Pacijent: ${p ? escHtml(p.ime) : 'Nepoznat'}</div>
        <div class="plan-pacijent" style="color:var(--teal);">Fizioterapeut: ${fizio ? escHtml(fizio.ime) : 'Nepoznat'}</div>
        <div class="plan-count">${plan.vjezbe?.length || 0} vježbi</div>
        <div class="plan-actions">
          <button class="btn btn-secondary btn-sm" onclick="editPlan('${plan.id}')">Uredi</button>
          <button class="btn btn-danger btn-sm" onclick="deletePlan('${plan.id}')">Obriši</button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('addPlanBtn')?.addEventListener('click', () => openNoviPlan(null));

window.editPlan = async function(planId) {
  const snap = await getDoc(doc(db, 'planovi', planId));
  if (!snap.exists()) return;
  openNoviPlan(snap.data().pacijentId, { id: planId, ...snap.data() });
}

function openNoviPlan(pacijentId = null, existingPlan = null) {
  editingPlanId = existingPlan ? existingPlan.id : null;
  planVjezbeIds = existingPlan ? [...(existingPlan.vjezbe || [])] : [];
  document.getElementById('modalPlanTitle').textContent = existingPlan ? 'Uredi plan' : 'Novi plan vježbanja';
  document.getElementById('planNaziv').value = existingPlan?.naziv || '';
  document.getElementById('planNapomena').value = existingPlan?.napomena || '';

  // Samo moji pacijenti za novi plan, svi za edit
  const mojiPacijenti = allPacijenti.filter(p => p.fizioterapeutId === currentUser.uid);
  const sel = document.getElementById('planPacijent');
  sel.innerHTML = mojiPacijenti.map(p =>
    `<option value="${p.id}" ${p.id === (pacijentId || existingPlan?.pacijentId) ? 'selected' : ''}>${escHtml(p.ime)}</option>`
  ).join('');
  if (mojiPacijenti.length === 0) sel.innerHTML = '<option value="">Nemate pacijenata</option>';

  if (allVjezbe.length === 0) loadVjezbe().then(() => renderPlanVjezbe());
  else renderPlanVjezbe();
  openModal('modalPlan');
}

function renderPlanVjezbe() {
  const container = document.getElementById('planVjezbeList');
  if (!container) return;
  if (planVjezbeIds.length === 0) {
    container.innerHTML = '<p style="color:var(--grey-mid);font-size:.82rem;padding:8px 0;">Nema dodanih vježbi.</p>';
    return;
  }
  container.innerHTML = planVjezbeIds.map((vid, idx) => {
    const v = allVjezbe.find(x => x.id === vid);
    if (!v) return '';
    return `
      <div class="plan-vjezba-item">
        <span style="color:var(--grey-mid);font-size:.75rem;min-width:20px;">${idx + 1}.</span>
        <span class="plan-vjezba-name">${escHtml(v.naziv)}</span>
        <span class="plan-vjezba-info">${v.serije}×${v.ponavljanja}</span>
        <button class="btn btn-danger btn-sm" onclick="removePlanVjezba(${idx})">×</button>
      </div>`;
  }).join('');
}

document.getElementById('dodajVjezbuPlanBtn')?.addEventListener('click', () => {
  if (allVjezbe.length === 0) { showToast('Nema vježbi u biblioteci', 'error'); return; }
  const opts = allVjezbe.map(v => `<option value="${v.id}">${escHtml(v.naziv)}</option>`).join('');
  const container = document.getElementById('planVjezbeList');
  const row = document.createElement('div');
  row.style.cssText = 'background:var(--teal-lighter);border:1px solid rgba(0,168,157,0.2);border-radius:6px;padding:10px;margin-bottom:6px;';
  row.innerHTML = `
    <select class="form-input plan-vjezba-sel" style="margin-bottom:6px;"><option value="">-- odaberi vježbu --</option>${opts}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
      <div><label style="font-size:.7rem;color:var(--grey-mid);font-weight:600;text-transform:uppercase;">Serije</label>
        <input type="number" class="form-input plan-vjezba-serije" value="3" min="1" /></div>
      <div><label style="font-size:.7rem;color:var(--grey-mid);font-weight:600;text-transform:uppercase;">Ponavljanja</label>
        <input type="number" class="form-input plan-vjezba-ponavlja" value="10" min="1" /></div>
      <div><label style="font-size:.7rem;color:var(--grey-mid);font-weight:600;text-transform:uppercase;">Trajanje (sek)</label>
        <input type="number" class="form-input plan-vjezba-trajanje" value="0" min="0" /></div>
    </div>
    <button class="btn btn-danger btn-sm" style="margin-top:6px;" onclick="this.parentElement.remove(); updatePlanVjezbeIds()">Ukloni</button>
  `;
  container.appendChild(row);
});

window.updatePlanVjezbeIds = function() {} // placeholder

document.getElementById('savePlanBtn')?.addEventListener('click', async () => {
  const naziv = document.getElementById('planNaziv').value.trim();
  const pacijentId = document.getElementById('planPacijent').value;
  const napomena = document.getElementById('planNapomena').value.trim();
  if (!naziv) { showToast('Unesite naziv plana', 'error'); return; }
  if (!pacijentId) { showToast('Odaberite pacijenta', 'error'); return; }

  // Skupi vježbe s njihovim serijama/ponavljanjima
  const rows = document.getElementById('planVjezbeList').querySelectorAll('.plan-vjezba-sel');
  if (rows.length === 0) { showToast('Dodajte barem jednu vježbu', 'error'); return; }

  const vjezbe = [];
  for (const sel of rows) {
    if (!sel.value) { showToast('Odaberite vježbu u svim redovima', 'error'); return; }
    const row = sel.parentElement;
    vjezbe.push({
      vjezbaId: sel.value,
      serije: parseInt(row.querySelector('.plan-vjezba-serije').value) || 3,
      ponavljanja: parseInt(row.querySelector('.plan-vjezba-ponavlja').value) || 10,
      trajanje: parseInt(row.querySelector('.plan-vjezba-trajanje').value) || 0
    });
  }

  try {
    if (editingPlanId) {
      await updateDoc(doc(db, 'planovi', editingPlanId), { naziv, pacijentId, napomena, vjezbe });
      showToast('Plan ažuriran!', 'success');
    } else {
      await addDoc(collection(db, 'planovi'), {
        naziv, pacijentId, napomena, vjezbe,
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
  await deleteDoc(doc(db, 'planovi', id));
  closeModal('modalPacijentDetalji');
  await loadPlanovi();
  showToast('Plan obrisan');
}

// ===== MOJ PLAN (pacijent) =====
async function loadMojPlan() {
  const container = document.getElementById('mojPlanContent');
  container.innerHTML = '<p style="color:var(--grey-mid);">Učitavanje...</p>';
  try {
    const q = query(collection(db, 'planovi'), where('pacijentId', '==', currentUser.uid));
    const snap = await getDocs(q);
    const planovi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (planovi.length === 0) {
      container.innerHTML = `<div class="moj-plan-empty"><div class="icon"><svg viewBox="0 0 24 24"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg></div><p>Vaš fizioterapeut još nije dodijelio plan vježbanja.</p></div>`;
      return;
    }
    const sveVjezbeIds = [...new Set(planovi.flatMap(p => (p.vjezbe || []).map(v => v.vjezbaId || v)))];
    const vjezbeMap = {};
    for (const vid of sveVjezbeIds) {
      if (!vid) continue;
      const vSnap = await getDoc(doc(db, 'vjezbe', vid));
      if (vSnap.exists()) vjezbeMap[vid] = { id: vid, ...vSnap.data() };
    }

    // Dohvati fizioterapeuta
    let fizioIme = '';
    if (planovi[0]?.fizioterapeutId) {
      const fSnap = await getDoc(doc(db, 'fizioterapeuti', planovi[0].fizioterapeutId));
      if (fSnap.exists()) fizioIme = fSnap.data().ime;
    }

    container.innerHTML = `
      ${fizioIme ? `<div class="fizioterapeut-info-box">Vaš fizioterapeut: <strong>${escHtml(fizioIme)}</strong></div>` : ''}
      ${planovi.map(plan => `
        <div class="plan-section">
          <div class="plan-section-title">${escHtml(plan.naziv)}</div>
          ${plan.napomena ? `<div class="plan-napomena-box">${escHtml(plan.napomena)}</div>` : ''}
          ${(plan.vjezbe || []).map((item, idx) => {
            const vid = item.vjezbaId || item;
            const v = vjezbeMap[vid];
            if (!v) return '';
            const serije = item.serije || '—';
            const ponavljanja = item.ponavljanja || '—';
            const trajanje = item.trajanje || 0;
            return `
              <div class="vjezba-pacijent-card">
                <div class="vjezba-pacijent-header">
                  <div class="vjezba-pacijent-name">${idx + 1}. ${escHtml(v.naziv)}</div>
                  <span class="vjezba-kategory">${kategorijeLabels[v.kategorija] || v.kategorija}</span>
                </div>
                ${v.opis ? `<div class="vjezba-pacijent-opis">${escHtml(v.opis)}</div>` : ''}
                <div class="vjezba-pacijent-meta">
                  <span class="meta-chip">${serije} serije</span>
                  <span class="meta-chip">${ponavljanja} ponavljanja</span>
                  ${trajanje > 0 ? `<span class="meta-chip">${trajanje}s</span>` : ''}
                  ${v.video ? `<button class="btn btn-primary btn-sm" onclick="playVideo('${escHtml(v.video)}', '${escHtml(v.naziv)}')">Pogledaj video</button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>`).join('')}`;
  } catch(e) {
    container.innerHTML = `<p style="color:var(--danger);">Greška: ${e.message}</p>`;
  }
}

// ===== VIDEO =====
window.playVideo = function(url, title) {
  document.getElementById('modalVideoTitle').textContent = title;
  document.getElementById('videoIframe').src = getEmbedUrl(url);
  openModal('modalVideo');
}
function getEmbedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}?autoplay=1`;
  return url;
}
document.getElementById('closeVideoBtn')?.addEventListener('click', () => {
  document.getElementById('videoIframe').src = '';
  closeModal('modalVideo');
});

// ===== MODAL =====
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
window.closeModal = function(id) {
  document.getElementById(id)?.classList.remove('open');
  if (id === 'modalVideo') document.getElementById('videoIframe').src = '';
}
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) { o.classList.remove('open'); if (o.id === 'modalVideo') document.getElementById('videoIframe').src = ''; }
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
