'use strict';
// 1) Pegue la Project URL SIN /rest/v1/ ni /auth/v1/.
const SUPABASE_URL = 'https://mrioxfvpvonmwrjgmkat.supabase.co';
// 2) Pegue la clave PUBLICABLE (sb_publishable_...). Nunca service_role/secret.
const SUPABASE_PUBLIC_KEY = 'sb_publishable_uVerMyyT6UM1yR1xoYCV3Q_5eciRQHc';
const $ = (id) => document.getElementById(id);
const estado = (mensaje, error = false) => {
$('estado').textContent = mensaje;
$('estado').classList.toggle('error', error);
};
let db;
let actual = { socios: [], cuotas: [], pagos: [] };
let usuario = null;
const dinero = (n) => 'S/ ' + Number(n).toFixed(2);
const mensajeError = (e) => e?.message || 'Error inesperado';
const formularioDatos = (form) => Object.fromEntries(new FormData(form).entries());
const crearCelda = (fila, dato) => { const td = fila.insertCell(); td.textContent = String(dato ?? ''); return td; };
const crearBoton = (contenedor, nombre, funcion) => {
const b = document.createElement('button'); b.type = 'button'; b.textContent = nombre;
b.addEventListener('click', funcion); contenedor.append(b);
};
function verPanel(nombre) {
document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== 'panel-' + nombre);
document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('activo', b.dataset.panel === nombre));
}
function mostrarAcceso(sesion) {
usuario = sesion?.user ?? null;
$('panelAcceso').hidden = Boolean(usuario);
$('aplicacion').hidden = !usuario;
$('identidad').textContent = usuario ? usuario.email : '';
if (usuario) { verPanel('socios'); cargarTodo(); } else estado('Inicie sesión para acceder al sistema.');}
function opciones(id, registros, etiqueta) {
const s = $(id); s.replaceChildren(new Option('Seleccione ' + etiqueta, ''));
registros.forEach(({ value, text }) => s.add(new Option(text, String(value))));
}
function pintar() {
const nombreSocio = id => actual.socios.find(s => s.id === id)?.nombre ?? 'Socio #' + id;
const detalles = actual.cuotas.map(c => {
const pagado = actual.pagos.filter(p => p.cuota_id === c.id).reduce((t,p) => t + Number(p.monto), 0);
return { ...c, pagado, saldo: Number(c.monto) - pagado };
});
const cuerpoSocios = $('listaSocios'); cuerpoSocios.replaceChildren();
actual.socios.forEach(s => {
const f = cuerpoSocios.insertRow(); crearCelda(f, s.codigo); crearCelda(f, s.nombre); crearCelda(f, s.local);
const td = f.insertCell(); crearBoton(td, 'Editar', () => {
const frm = $('formSocio'); for(const k of ['id','codigo','nombre','local']) frm.elements.namedItem(k).value = s[k];
verPanel('socios'); frm.scrollIntoView({ behavior: 'smooth' });
});
crearBoton(td, 'Eliminar', async () => {
if (!confirm('¿Eliminar este socio? Si tiene cuotas, la base de datos lo impedirá.')) return;
try { const {error} = await db.from('socios').delete().eq('id', s.id); if(error) throw error; await cargarTodo();
estado('Socio eliminado.'); }
catch(e) { estado('No se pudo eliminar: ' + mensajeError(e), true); }
});
});
opciones('seleccionSocio', actual.socios.map(s => ({value:s.id,text:s.nombre+' · '+s.local})), 'socio');
opciones('seleccionCuota', detalles.filter(c=>c.saldo > 0.009).map(c => ({ value:c.id, text:nombreSocio(c.socio_id)+' ·'+c.periodo+' · saldo '+dinero(c.saldo) })), 'cuota');
const cuerpoCuotas = $('listaCuotas'); cuerpoCuotas.replaceChildren();
detalles.forEach(c => { const f=cuerpoCuotas.insertRow();
[nombreSocio(c.socio_id),c.periodo,dinero(c.monto),dinero(c.pagado),dinero(c.saldo)].forEach(x=>crearCelda(f,x)); });
const cuerpoPagos = $('listaPagos'); cuerpoPagos.replaceChildren();
actual.pagos.forEach(p=>{const c=actual.cuotas.find(x=>x.id===p.cuota_id);const f=cuerpoPagos.insertRow();[new
Date(p.creado_en).toLocaleString('es-PE'),c?nombreSocio(c.socio_id):'—',c?.periodo??'— ',dinero(p.monto)].forEach(x=>crearCelda(f,x));});
const morosos=detalles.filter(c=>c.saldo>0.009); const cuerpoMorosos=$('listaMorosos');
cuerpoMorosos.replaceChildren();
morosos.forEach(c=>{const s=actual.socios.find(x=>x.id===c.socio_id);const
f=cuerpoMorosos.insertRow();[s?.nombre??'—',s?.local??'—',c.periodo,dinero(c.saldo)].forEach(x=>crearCelda(f,x));});
$('resumen').textContent = morosos.length+' cuota(s) pendientes · saldo global'+dinero(morosos.reduce((t,c)=>t+c.saldo,0));
}
async function cargarTodo() {
if(!usuario) return;
try {
for(const tabla of ['socios','cuotas','pagos']) {
const {data,error}=await db.from(tabla).select('*').order('id',{ascending:true});
if(error) throw Error(tabla+': '+error.message);
actual[tabla]=data || [];
}
pintar(); estado('Datos actualizados desde Supabase.');
} catch(e) {estado('Error al consultar: '+mensajeError(e),true);}
}
function inicio() {if (SUPABASE_URL.includes('TU-PROYECTO') || SUPABASE_PUBLIC_KEY.includes('TU_CLAVE')) {
estado('Primero configure SUPABASE_URL y SUPABASE_PUBLIC_KEY en app.js.', true); return;
}
try { db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY); }
catch(e) {estado('Configuración Supabase inválida: '+mensajeError(e),true); return;}
$('formAcceso').addEventListener('submit',async ev=>{
ev.preventDefault(); const {email,password}=formularioDatos(ev.currentTarget);
const {data,error}=await db.auth.signInWithPassword({email,password});
if(error) return estado('Acceso: '+error.message,true);
ev.currentTarget.reset(); mostrarAcceso(data.session);
});
$('salir').addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error)return
estado(error.message,true);actual={socios:[],cuotas:[],pagos:[]};mostrarAcceso(null);});
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>verPanel(b.dataset.panel)));
$('refrescar').addEventListener('click',cargarTodo);
$('formSocio').addEventListener('submit',async ev=>{
ev.preventDefault(); const f=ev.currentTarget; const {id,codigo,nombre,local}=formularioDatos(f);
const datos={codigo:codigo.trim().toUpperCase(),nombre:nombre.trim(),local:local.trim()};
if(!datos.codigo||datos.nombre.length<3||!datos.local)return estado('Revise los datos del socio.',true);
try {
const q=id ? db.from('socios').update(datos).eq('id',Number(id)) :
db.from('socios').insert({...datos,owner_id:usuario.id});
const {error}=await q;if(error)throw error;f.reset();await cargarTodo();estado(id?'Socio actualizado.':'Socioregistrado.');
}catch(e){estado('Socio: '+mensajeError(e),true);}
});
$('formCuota').addEventListener('submit',async ev=>{
ev.preventDefault();const f=ev.currentTarget;const d=formularioDatos(f);const monto=Number(d.monto);
if(!Number.isFinite(monto)||monto<=0)return estado('Monto inválido.',true);
try {
const {error}=await
db.from('cuotas').insert({owner_id:usuario.id,socio_id:Number(d.socio_id),periodo:d.periodo,monto});
if(error)throw error;f.reset();await cargarTodo();estado('Cuota generada.');
}catch(e){estado('Cuota: '+mensajeError(e),true);}
});
$('formPago').addEventListener('submit',async ev=>{
ev.preventDefault();const f=ev.currentTarget;const d=formularioDatos(f);const monto=Number(d.monto);
if(!Number.isFinite(monto)||monto<=0)return estado('Abono inválido.',true);
try {
const {data,error}=await db.rpc('registrar_pago',{p_cuota_id:Number(d.cuota_id),p_monto:monto});
if(error)throw error;f.reset();await cargarTodo();estado('Pago registrado. Saldo pendiente: '+dinero(data));
}catch(e){estado('Pago rechazado: '+mensajeError(e),true);}
});
db.auth.getSession().then(({data,error})=>{
if(error) return estado('Sesión: '+error.message,true);
mostrarAcceso(data.session);
});
}
document.addEventListener('DOMContentLoaded',inicio);