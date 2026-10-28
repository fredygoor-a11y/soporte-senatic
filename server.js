// Forzamos la eliminación de cualquier variable fantasma en la memoria del script
delete process.env.DATABASE_URL;
delete process.env.PGCONNECT_TIMEOUT;

const express = require('express');
const { Client } = require('pg');
const path = require('path');

const app = express();
const PORT = 3000;

// Tu configuración limpia que ya comprobamos que da conexión exitosa
const clienteConfig = {
  user: 'postgres.enkdkfjvzlrazlylxqgu',
  host: 'aws-0-us-east-1.pooler.supabase.com',
  database: 'postgres',
  password: 'Proyecto2026',
  port: 6543,
  ssl: { rejectUnauthorized: false }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. RUTA DE REGISTRO DE USUARIOS
// ==========================================
app.post('/api/registro', async (req, res) => {
  const { nombre, correo, contrasena } = req.body;
  const client = new Client(clienteConfig);
  try {
    await client.connect();
    const query = 'INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (\$1, \$2, \$3, \$4)';
    await client.query(query, [nombre, correo, contrasena, 'cliente']);
    await client.end();
    
    res.send(`
      <script src="https://jsdelivr.net"></script>
      <div style="background-color:#020617; height:100vh; display:flex; align-items:center; justify-content:center; font-family:sans-serif;" class="flex items-center justify-center">
        <div style="background-color:#0f172a; border:1px solid #334155; padding:40px; border-radius:24px; text-align:center; max-w:400px; margin:20px;">
          <div style="font-size:50px; margin-bottom:20px;">🎉</div>
          <h1 style="color:white; font-size:24px; font-weight:800; margin-bottom:10px;">¡Registro Exitoso!</h1>
          <p style="color:#94a3b8; font-size:14px; margin-bottom:24px;">Tu cuenta ha sido creada en la base de datos en la nube de Supabase.</p>
          <a href="/login.html" style="background:linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color:white; padding:14px; border-radius:14px; text-decoration:none; font-weight:700; display:block;">Ir al Inicio de Sesión</a>
        </div>
      </div>
    `);
  } catch (error) {
    console.error(error);
    res.send('<p style="color:white; font-family:sans-serif; text-align:center; margin-top:2rem;">Error al registrar en la base de datos.</p>');
  }
});

// ==========================================
// 2. RUTA DE INICIO DE SESIÓN (LOGIN)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  const client = new Client(clienteConfig);
  try {
    await client.connect();
    const query = 'SELECT * FROM usuarios WHERE correo = \$1';
    const resultado = await client.query(query, [correo]);
    await client.end();

    if (resultado.rows.length === 0 || resultado.rows[0].contrasena !== contrasena) {
      return res.send('<p style="font-family:sans-serif; text-align:center; margin-top:2rem; color:#ef4444; font-weight:bold;">❌ Credenciales inválidas. Verifica tu correo o clave.</p>');
    }

    // Si todo está bien, lo envía directo a su panel
    res.redirect('/panel-cliente.html');
  } catch (error) {
    console.error(error);
    res.send('<p style="color:white; font-family:sans-serif; text-align:center; margin-top:2rem;">Error en el servidor de login.</p>');
  }
});

// ==========================================
// 3. RUTA DE REGISTRO DE COMPUTADORAS Y TICKETS
// ==========================================
app.post('/api/registrar-equipo', async (req, res) => {
  const { tipo_equipo, marca, descripcion } = req.body;
  const client = new Client(clienteConfig);
  try {
    await client.connect();
    // Registramos el computador usando el ID de usuario 1 (El de tu prueba anterior)
    const queryEquipo = 'INSERT INTO equipos (usuario_id, tipo_equipo, marca) VALUES (\$1, \$2, \$3) RETURNING id';
    const resultadoEquipo = await client.query(queryEquipo, [1, tipo_equipo, marca]);
    const equipoId = resultadoEquipo.rows[0].id;

    // Vinculamos automáticamente el ticket técnico
    const queryTicket = 'INSERT INTO tickets (equipo_id, descripcion, estado) VALUES (\$1, \$2, \$3)';
    await client.query(queryTicket, [equipoId, descripcion, 'Recibido / En Diagnóstico']);
    await client.end();

    // Redirecciona al panel de inmediato para pintar la PC abajo en la lista
    res.redirect('/panel-cliente.html');
  } catch (error) {
    console.error(error);
    res.send('<p style="color:white; font-family:sans-serif; text-align:center; margin-top:2rem;">Error al registrar la computadora.</p>');
  }
});

// ==========================================
// 4. RUTA PARA QUE EL USUARIO CONSULTE SUS EQUIPOS Y VER EL ESTADO AL DÍA
// ==========================================
app.get('/api/mis-equipos', async (req, res) => {
  const client = new Client(clienteConfig);
  try {
    await client.connect();
    const query = `
      SELECT t.id, e.marca, e.tipo_equipo, t.descripcion, t.estado, t.fecha_ingreso 
      FROM tickets t 
      JOIN equipos e ON t.equipo_id = e.id 
      ORDER BY t.id DESC
    `;
    const resultado = await client.query(query);
    await client.end();
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar equipos desde internet' });
  }
});

// ==========================================
// 5. RUTA PARA EL PANEL TÉCNICO (ADMIN)
// ==========================================
app.get('/api/tickets', async (req, res) => {
  const client = new Client(clienteConfig);
  try {
    await client.connect();
    const resultado = await client.query('SELECT * FROM tickets ORDER BY id DESC');
    await client.end();
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar tickets globales' });
  }
});

// ==========================================
// 6. RUTA PARA CAMBIAR LA FASE DEL DIAGNÓSTICO
// ==========================================
app.post('/api/actualizar-ticket', async (req, res) => {
  const { id, estado } = req.body;
  const client = new Client(clienteConfig);
  try {
    await client.connect();
    await client.query('UPDATE tickets SET estado = \$1 WHERE id = \$2', [estado, id]);
    await client.end();
    res.json({ exito: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el estado en internet' });
  }
});

// Prueba de conexión blindada e independiente
const clientPrueba = new Client(clienteConfig);
clientPrueba.connect()
  .then(() => {
    console.log('⚡ ¡CONEXIÓN EXITOSA TOTAL A SUPABASE EN LA NUBE!');
    return clientPrueba.query('SELECT NOW()');
  })
  .then(() => clientPrueba.end())
  .catch(err => {
    console.log('❌ Error directo de conexión:', err.message);
  });

app.listen(PORT, () => {
  console.log(`🚀 Servidor activo con todas las funciones unificadas en http://localhost:${PORT}`);
});
