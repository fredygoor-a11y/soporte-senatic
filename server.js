
const express = require('express');
const { Client } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURACIÓN DE SUPABASE
// Los datos de conexión se configuran en Render.
// ==========================================

const clienteConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 6543),
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 15000
};

// ==========================================
// CONFIGURACIÓN GENERAL DEL SERVIDOR
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Página principal
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Archivos HTML, CSS, JS e imágenes
app.use(express.static(path.join(__dirname, 'public')));

// Función para crear una conexión a Supabase
async function conectarBD() {
    const client = new Client(clienteConfig);
    await client.connect();
    return client;
}

// Página para mostrar mensajes al usuario
function mostrarMensaje(res, titulo, mensaje, color = '#ef4444', enlace = '/login.html', textoEnlace = 'Volver al inicio de sesión') {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${titulo} - Soporte SENATIC</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: #020617;
                    color: white;
                    font-family: 'Segoe UI', sans-serif;
                }
                .card {
                    width: 100%;
                    max-width: 450px;
                    padding: 40px;
                    border-radius: 22px;
                    text-align: center;
                    background: #0f172a;
                    border: 1px solid #334155;
                    box-shadow: 0 20px 50px rgba(0,0,0,.4);
                }
                h1 { font-size: 25px; }
                p { color: #cbd5e1; line-height: 1.6; }
                a {
                    display: block;
                    margin-top: 25px;
                    padding: 14px;
                    color: white;
                    text-decoration: none;
                    font-weight: bold;
                    border-radius: 12px;
                    background: linear-gradient(135deg,#2563eb,#06b6d4);
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div style="font-size:48px;">${color === '#16a34a' ? '🎉' : '⚠️'}</div>
                <h1>${titulo}</h1>
                <p>${mensaje}</p>
                <a href="${enlace}">${textoEnlace}</a>
            </div>
        </body>
        </html>
    `);
}

// ==========================================
// 1. REGISTRO DE USUARIOS
// Tabla: usuarios
// Campos: nombre, correo, contrasena, rol
// ==========================================

app.post('/api/registro', async (req, res) => {
    const { nombre, correo, contrasena } = req.body;

    if (!nombre || !correo || !contrasena) {
        return mostrarMensaje(
            res,
            'Datos incompletos',
            'Por favor completa todos los campos del formulario.'
        );
    }

    let client;

    try {
        client = await conectarBD();

        // Comprobar si el correo ya está registrado
        const consultaCorreo = await client.query(
            'SELECT id FROM usuarios WHERE correo = $1',
            [correo]
        );

        if (consultaCorreo.rows.length > 0) {
            return mostrarMensaje(
                res,
                'Correo ya registrado',
                'Este correo electrónico ya tiene una cuenta. Intenta iniciar sesión.'
            );
        }

        // Registrar usuario conservando la estructura existente
        await client.query(
            'INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES ($1, $2, $3, $4)',
            [nombre, correo, contrasena, 'cliente']
        );

        return mostrarMensaje(
            res,
            '¡Registro exitoso!',
            'Tu cuenta ha sido creada correctamente. Ya puedes ingresar a la plataforma.',
            '#16a34a',
            '/login.html',
            'Ir al inicio de sesión'
        );

    } catch (error) {
        console.error('ERROR EN REGISTRO:', error.message);

        return mostrarMensaje(
            res,
            'No se pudo completar el registro',
            'Ocurrió un problema al guardar tu información. Verifica la conexión con el servidor e intenta nuevamente.'
        );

    } finally {
        if (client) {
            await client.end().catch(err =>
                console.error('Error cerrando conexión:', err.message)
            );
        }
    }
});

// ==========================================
// 2. INICIO DE SESIÓN
// Tabla: usuarios
// ==========================================

app.post('/api/login', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return mostrarMensaje(
            res,
            'Datos incompletos',
            'Debes ingresar tu correo y contraseña.'
        );
    }

    let client;

    try {
        client = await conectarBD();

        const resultado = await client.query(
            'SELECT * FROM usuarios WHERE correo = $1',
            [correo]
        );

        if (
            resultado.rows.length === 0 ||
            resultado.rows[0].contrasena !== contrasena
        ) {
            return mostrarMensaje(
                res,
                'Credenciales incorrectas',
                'Verifica tu correo electrónico y contraseña.'
            );
        }

        // Acceso al panel del cliente
        return res.redirect('/panel-cliente.html');

    } catch (error) {
        console.error('ERROR EN LOGIN:', error.message);

        return mostrarMensaje(
            res,
            'Error de inicio de sesión',
            'No fue posible consultar la base de datos. Intenta nuevamente más tarde.'
        );

    } finally {
        if (client) {
            await client.end().catch(err =>
                console.error('Error cerrando conexión:', err.message)
            );
        }
    }
});

// ==========================================
// 3. REGISTRO DE EQUIPOS Y TICKETS
// Tablas: equipos y tickets
// ==========================================

app.post('/api/registrar-equipo', async (req, res) => {
    const { tipo_equipo, marca, descripcion } = req.body;

    let client;

    try {
        client = await conectarBD();

        await client.query('BEGIN');

        // Se conserva el usuario_id = 1 de tu código original.
        const resultadoEquipo = await client.query(
            'INSERT INTO equipos (usuario_id, tipo_equipo, marca) VALUES ($1, $2, $3) RETURNING id',
            [1, tipo_equipo, marca]
        );

        const equipoId = resultadoEquipo.rows[0].id;

        await client.query(
            'INSERT INTO tickets (equipo_id, descripcion, estado) VALUES ($1, $2, $3)',
            [equipoId, descripcion, 'Recibido / En Diagnóstico']
        );

        await client.query('COMMIT');

        return res.redirect('/panel-cliente.html');

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
        }

        console.error('ERROR REGISTRANDO EQUIPO:', error.message);

        return mostrarMensaje(
            res,
            'Error al registrar el equipo',
            'No fue posible guardar el equipo y su ticket técnico.'
        );

    } finally {
        if (client) {
            await client.end().catch(err =>
                console.error('Error cerrando conexión:', err.message)
            );
        }
    }
});

// ==========================================
// 4. CONSULTAR EQUIPOS Y TICKETS
// ==========================================

app.get('/api/mis-equipos', async (req, res) => {
    let client;

    try {
        client = await conectarBD();

        const resultado = await client.query(`
            SELECT
                t.id,
                e.marca,
                e.tipo_equipo,
                t.descripcion,
                t.estado,
                t.fecha_ingreso
            FROM tickets t
            JOIN equipos e ON t.equipo_id = e.id
            ORDER BY t.id DESC
        `);

        return res.json(resultado.rows);

    } catch (error) {
        console.error('ERROR CONSULTANDO EQUIPOS:', error.message);

        return res.status(500).json({
            error: 'Error al consultar los equipos desde la base de datos.'
        });

    } finally {
        if (client) {
            await client.end().catch(err =>
                console.error('Error cerrando conexión:', err.message)
            );
        }
    }
});

// ==========================================
// 5. CONSULTAR TODOS LOS TICKETS
// ==========================================

app.get('/api/tickets', async (req, res) => {
    let client;

    try {
        client = await conectarBD();

        const resultado = await client.query(
            'SELECT * FROM tickets ORDER BY id DESC'
        );

        return res.json(resultado.rows);

    } catch (error) {
        console.error('ERROR CONSULTANDO TICKETS:', error.message);

        return res.status(500).json({
            error: 'Error al consultar los tickets.'
        });

    } finally {
        if (client) {
            await client.end().catch(err =>
                console.error('Error cerrando conexión:', err.message)
            );
        }
    }
});

// ==========================================
// 6. ACTUALIZAR ESTADO DEL TICKET
// ==========================================

app.post('/api/actualizar-ticket', async (req, res) => {
    const { id, estado } = req.body;

    let client;

    try {
        client = await conectarBD();

        const resultado = await client.query(
            'UPDATE tickets SET estado = $1 WHERE id = $2',
            [estado, id]
        );

        return res.json({
            exito: true,
            filasActualizadas: resultado.rowCount
        });

    } catch (error) {
        console.error('ERROR ACTUALIZANDO TICKET:', error.message);

        return res.status(500).json({
            exito: false,
            error: 'No fue posible actualizar el estado del ticket.'
        });

    } finally {
        if (client) {
            await client.end().catch(err =>
                console.error('Error cerrando conexión:', err.message)
            );
        }
    }
});

// ==========================================
// 7. COMPROBAR CONEXIÓN CON SUPABASE
// ==========================================

app.get('/api/estado-servidor', async (req, res) => {
    let client;

    try {
        client = await conectarBD();
        await client.query('SELECT NOW()');

        return res.json({
            servidor: 'Funcionando',
            baseDatos: 'Conectada'
        });

    } catch (error) {
        console.error('ERROR DE CONEXIÓN SUPABASE:', error.message);

        return res.status(500).json({
            servidor: 'Funcionando',
            baseDatos: 'Error de conexión'
        });

    } finally {
        if (client) {
            await client.end().catch(() => {});
        }
    }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Soporte SENATIC activo en el puerto ${PORT}`);

    if (
        !clienteConfig.user ||
        !clienteConfig.host ||
        !clienteConfig.password
    ) {
        console.error('FALTAN VARIABLES DE CONEXIÓN DE SUPABASE EN RENDER.');
    }
});
