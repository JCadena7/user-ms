import { db, sql } from './pg';

// Utilidades de logging y tiempo
function now() {
  return Date.now();
}
function dur(msStart: number) {
  return `${Date.now() - msStart} ms`;
}

export async function initDatabase() {
  const t0 = now();

  // Diagnóstico simple
  console.log('📊 Inicializando base de datos (helper db/sql)');

  const client = await db.pool.connect();
  try {
    // Evitar ejecuciones concurrentes
    await client.query('SELECT pg_advisory_lock($1, $2)', [271828, 314159]);

    // Ajustes de sesión útiles
    await client.query(`SET TIME ZONE 'UTC'`);
    await client.query(`SET lock_timeout = '5s'`);
    await client.query(`SET idle_in_transaction_session_timeout = '60s'`);
    await client.query(`SET client_min_messages = WARNING`);
    await client.query(`SET application_name = 'init_db'`);

    console.log('⏳ Creación/verificación de tablas...');

    const t1 = now();
    await client.query('BEGIN');

    // ========== Tablas (SIN CAMBIOS de nombres/atributos) ==========
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        rol_id INTEGER REFERENCES roles(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS estados_publicacion (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT,
        slug VARCHAR(100) UNIQUE NOT NULL,
        color VARCHAR(10),
        icono VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        extracto TEXT,
        contenido TEXT,
        imagen_destacada VARCHAR(500),
        usuario_id INTEGER REFERENCES usuarios(id),
        estado_id INTEGER REFERENCES estados_publicacion(id),
        fecha_publicacion TIMESTAMP,
        palabras_clave TEXT[] DEFAULT '{}',
        tiempo_lectura INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS posts_categorias (
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, categoria_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        contenido TEXT NOT NULL,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id),
        parent_id INTEGER REFERENCES comentarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS revisiones_posts (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        contenido_anterior TEXT,
        estado_anterior INTEGER REFERENCES estados_publicacion(id),
        usuario_id INTEGER REFERENCES usuarios(id),
        comentario TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS permisos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS roles_permisos (
        rol_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permiso_id INTEGER REFERENCES permisos(id) ON DELETE CASCADE,
        PRIMARY KEY (rol_id, permiso_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tipos_reacciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        emoji VARCHAR(10),
        descripcion TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reacciones (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id),
        tipo_reaccion_id INTEGER REFERENCES tipos_reacciones(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log(`✅ Tablas verificadas (${dur(t1)})`);

    // ========== Índices recomendados (no alteran tablas/datos) ==========
    const t2 = now();
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_usuario_id ON posts(usuario_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_estado_id ON posts(estado_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_fecha_publicacion ON posts(fecha_publicacion)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_categorias_post_id ON posts_categorias(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_categorias_categoria_id ON posts_categorias(categoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_post_id ON comentarios(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_usuario_id ON comentarios(usuario_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_parent_id ON comentarios(parent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reacciones_post_id ON reacciones(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reacciones_usuario_id ON reacciones(usuario_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reacciones_tipo_reaccion_id ON reacciones(tipo_reaccion_id)`);
    console.log(`✅ Índices verificados (${dur(t2)})`);

    // ========== Seeds idempotentes ==========
    const t3 = now();

    const rolesDefault = [
      { nombre: 'administrador', descripcion: 'Control total del sistema' },
      { nombre: 'editor', descripcion: 'Puede crear y editar contenido, pero no administrar usuarios' },
      { nombre: 'autor', descripcion: 'Puede crear contenido pero necesita aprobación' },
      { nombre: 'comentador', descripcion: 'Solo puede comentar en posts publicados' },
    ];
    for (const rol of rolesDefault) {
      const q = sql`INSERT INTO roles (nombre, descripcion) VALUES (${rol.nombre}, ${rol.descripcion}) ON CONFLICT (nombre) DO NOTHING`;
      await client.query(q.text, q.values);
    }

    const estadosDefault = [
      { nombre: 'borrador', descripcion: 'Post en edición' },
      { nombre: 'en_revision', descripcion: 'Post en espera de aprobación' },
      { nombre: 'publicado', descripcion: 'Post publicado y visible' },
      { nombre: 'rechazado', descripcion: 'Post rechazado por los editores' },
      { nombre: 'archivado', descripcion: 'Post archivado (no visible)' },
    ];
    for (const estado of estadosDefault) {
      const q = sql`INSERT INTO estados_publicacion (nombre, descripcion) VALUES (${estado.nombre}, ${estado.descripcion}) ON CONFLICT (nombre) DO NOTHING`;
      await client.query(q.text, q.values);
    }

    const permisosDefault = [
      { nombre: 'crear_post', descripcion: 'Crear nuevos posts' },
      { nombre: 'editar_post_propio', descripcion: 'Editar sus propios posts' },
      { nombre: 'editar_post_cualquiera', descripcion: 'Editar cualquier post' },
      { nombre: 'publicar_post', descripcion: 'Cambiar estado a publicado' },
      { nombre: 'rechazar_post', descripcion: 'Cambiar estado a rechazado' },
      { nombre: 'asignar_roles', descripcion: 'Asignar roles a usuarios' },
      { nombre: 'comentar', descripcion: 'Añadir comentarios a posts publicados' },
      { nombre: 'reaccionar', descripcion: 'Añadir reacciones a posts publicados' },
      { nombre: 'crear_categoria', descripcion: 'Crear nuevas categorías' },
      { nombre: 'editar_categoria', descripcion: 'Editar las categorías' },
      { nombre: 'eliminar_categoria', descripcion: 'Elimina la categorías' },
    ];
    for (const permiso of permisosDefault) {
      const q = sql`INSERT INTO permisos (nombre, descripcion) VALUES (${permiso.nombre}, ${permiso.descripcion}) ON CONFLICT (nombre) DO NOTHING`;
      await client.query(q.text, q.values);
    }

    const tiposReaccionesDefault = [
      { nombre: 'me gusta', emoji: '👍', descripcion: 'Reacción positiva al contenido' },
      { nombre: 'me encanta', emoji: '❤️', descripcion: 'Reacción de amor al contenido' },
      { nombre: 'interesante', emoji: '🤔', descripcion: 'Contenido que hace pensar' },
      { nombre: 'celebrar', emoji: '🎉', descripcion: 'Contenido que merece celebración' },
      { nombre: 'informativo', emoji: '📚', descripcion: 'Contenido educativo o informativo' },
    ];
    for (const tipo of tiposReaccionesDefault) {
      const q = sql`INSERT INTO tipos_reacciones (nombre, emoji, descripcion) VALUES (${tipo.nombre}, ${tipo.emoji}, ${tipo.descripcion}) ON CONFLICT (nombre) DO NOTHING`;
      await client.query(q.text, q.values);
    }

    console.log(`✅ Seeds aplicados (${dur(t3)})`);

    await client.query('COMMIT');
    console.log(`✅ Inicialización de base de datos completada en ${dur(t0)}`);

    return { success: true, message: 'Base de datos inicializada correctamente' } as const;
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ Error al inicializar la base de datos:', error);
    return { success: false, message: 'Error al inicializar la base de datos', error: error?.message } as const;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1, $2)', [271828, 314159]); } catch {}
    client.release();
    // No cerramos el pool; se gestiona en DatabaseModule o manualmente con db.$disconnect()
  }
}

export default initDatabase;
