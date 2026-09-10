# Sistema de Conciliación de Pagos

Sitio web donde tú (master) y hasta 6 chicas (staff) registran los pagos
que van recibiendo, con la referencia de 6 dígitos — y la base de datos
**bloquea automáticamente** cualquier intento de registrar la misma
referencia dos veces, sin importar quién lo intente ni cuándo.

---

## 1. Corre el esquema en Supabase

1. Entra a tu proyecto de Supabase → "SQL Editor" → "New query"
2. Pega TODO el contenido de `schema.sql` → "Run"

Esto crea las 3 tablas (perfiles, cuentas de pago, conciliaciones) con
todos los permisos ya configurados.

---

## 2. Pega tu URL y clave en `config.js`

Abre `config.js` y reemplaza con los datos de tu proyecto
(Project Settings → API):
```js
const SUPABASE_CONFIG = {
  url: "https://tuproyecto.supabase.co",
  anonKey: "tu-clave-anon-public",
};
```

---

## 3. Crea los usuarios (tú + hasta 6 chicas)

1. En Supabase → **Authentication** → **Users** → **Add user** → **Create new user**
2. Pon el correo y una contraseña para cada persona (tú incluida)
3. Marca **"Auto Confirm User"** para que no tenga que confirmar el correo
4. Repite para cada una de las chicas (hasta 6 más)

Apenas creas un usuario, automáticamente se le crea su "perfil" con rol
**"staff"** (así queda por defecto todo el mundo, incluso tú al
principio).

### Convertirte a ti mismo en "master"

1. Ve a **Table Editor** → tabla **`profiles`**
2. Busca la fila con tu correo (o tu nombre)
3. Cambia la columna **`role`** de `staff` a `master`
4. Guarda

Listo — ahora cuando entres al sitio vas a ver el botón de "+ Nueva
cuenta" (que las chicas no ven), y vas a poder editar/borrar cosas que
ellas no pueden.

---

## 4. Sube el sitio (GitHub + Vercel, igual que tus otros sitios)

1. Crea un repositorio nuevo en GitHub (puede ser privado, ya que
   `config.js` no tiene datos súper sensibles — la clave "anon" está
   pensada para ser pública, la seguridad real la da Supabase con los
   permisos que ya configuramos)
2. Sube estos archivos: `index.html`, `styles.css`, `app.js`, `config.js`
3. Conecta el repo a Vercel (Import Project → selecciona el repo → Deploy)
4. Listo, ya tienes un link real para compartir con las chicas

---

## 5. Cómo se usa en el día a día

- **Cualquiera (master o staff)** puede:
  - Ver las cuentas de pago (para saber a dónde debe pagar el cliente)
  - Registrar un pago nuevo (fecha, referencia de 6 dígitos, monto, método)
  - Ver el historial completo de pagos registrados por todos
- **Solo el master** puede:
  - Crear, editar o desactivar cuentas de pago
  - Editar o borrar un pago ya registrado (por si hay que corregir un error)

Si alguien intenta registrar una referencia que **ya existe**, el
sistema se lo dice al instante y le muestra quién la registró primero —
no hay forma de que se cuele un pago duplicado, ni por accidente ni a
propósito.

---

## 6. Cosas importantes

- La referencia de 6 dígitos es **única en toda la base de datos** — ni
  siquiera dos personas escribiéndola exactamente al mismo segundo
  podrían ambas guardarla (la base de datos lo impide a nivel técnico,
  no solo con un mensaje de "cuidado").
- Las chicas **nunca pueden editar ni borrar** un pago, ni el propio ni
  el de otra — solo tú puedes corregir errores.
- Esto sigue sin conectarse directo a tu banco real — es un registro
  manual, pero a diferencia de antes, ahora es **imposible duplicar por
  accidente o a propósito** dentro del sistema.
