import { db, sql } from './pg';

// Utilidades de logging y tiempo
function now() {
  return Date.now();
}
function dur(msStart: number) {
  return `${Date.now() - msStart} ms`;
}

export async function initDatabaseEnhanced() {
  const t0 = now();

  console.log('📊 Inicializando base de datos mejorada (con clerk_id y roles)');

  const client = await db.pool.connect();
  try {
    // Evitar ejecuciones concurrentes
    await client.query('SELECT pg_advisory_lock($1, $2)', [271828, 314159]);

    // Ajustes de sesión
    await client.query(`SET TIME ZONE 'UTC'`);
    await client.query(`SET lock_timeout = '5s'`);
    await client.query(`SET idle_in_transaction_session_timeout = '60s'`);
    await client.query(`SET client_min_messages = WARNING`);
    await client.query(`SET application_name = 'init_db_enhanced'`);

    console.log('⏳ Creación/verificación de tablas mejoradas...');

    const t1 = now();
    await client.query('BEGIN');

    // ========== EXTENSIONES ==========
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    // ========== TABLAS BASE (con mejoras) ==========
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla usuarios mejorada con clerk_id (NORMALIZADA - 3FN)
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE,
        username VARCHAR(50) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        rol_id INTEGER REFERENCES roles(id),
        avatar TEXT,
        cover_image TEXT,
        bio TEXT,
        website VARCHAR(255),
        location VARCHAR(100),
        phone VARCHAR(20),
        birth_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
        is_verified BOOLEAN DEFAULT FALSE,
        online_status VARCHAR(20) DEFAULT 'offline' CHECK (online_status IN ('online', 'offline', 'away')),
        last_login TIMESTAMP WITH TIME ZONE,
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
        parent_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        posts_count INTEGER DEFAULT 0 CHECK (posts_count >= 0),
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES usuarios(id),
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
        tiempo_lectura INTEGER,
        views INTEGER DEFAULT 0 CHECK (views >= 0),
        likes INTEGER DEFAULT 0 CHECK (likes >= 0),
        comments_count INTEGER DEFAULT 0 CHECK (comments_count >= 0),
        shares INTEGER DEFAULT 0 CHECK (shares >= 0),
        featured BOOLEAN DEFAULT FALSE,
        allow_comments BOOLEAN DEFAULT TRUE,
        is_pinned BOOLEAN DEFAULT FALSE,
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
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
        likes INTEGER DEFAULT 0 CHECK (likes >= 0),
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP WITH TIME ZONE,
        moderated_by INTEGER REFERENCES usuarios(id),
        moderated_at TIMESTAMP WITH TIME ZONE,
        moderation_notes TEXT,
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

    // ========== TABLAS NUEVAS ==========
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        email_notifications BOOLEAN DEFAULT TRUE,
        push_notifications BOOLEAN DEFAULT TRUE,
        marketing_emails BOOLEAN DEFAULT FALSE,
        theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
        language VARCHAR(10) DEFAULT 'es',
        timezone VARCHAR(50) DEFAULT 'UTC',
        default_editor VARCHAR(20) DEFAULT 'hybrid' CHECK (default_editor IN ('markdown', 'wysiwyg', 'hybrid')),
        auto_save BOOLEAN DEFAULT TRUE,
        show_social_links BOOLEAN DEFAULT TRUE,
        show_email BOOLEAN DEFAULT FALSE,
        profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'users', 'followers', 'private')),
        allow_direct_messages VARCHAR(20) DEFAULT 'everyone' CHECK (allow_direct_messages IN ('everyone', 'followers', 'none')),
        show_online_status BOOLEAN DEFAULT TRUE,
        allow_analytics BOOLEAN DEFAULT TRUE,
        index_posts BOOLEAN DEFAULT TRUE,
        allow_comments BOOLEAN DEFAULT TRUE,
        moderate_comments BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_social_links (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        twitter VARCHAR(255),
        linkedin VARCHAR(255),
        github VARCHAR(255),
        instagram VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        posts_created INTEGER DEFAULT 0 CHECK (posts_created >= 0),
        posts_published INTEGER DEFAULT 0 CHECK (posts_published >= 0),
        posts_edited INTEGER DEFAULT 0 CHECK (posts_edited >= 0),
        comments_approved INTEGER DEFAULT 0 CHECK (comments_approved >= 0),
        comments_moderated INTEGER DEFAULT 0 CHECK (comments_moderated >= 0),
        users_managed INTEGER DEFAULT 0 CHECK (users_managed >= 0),
        total_views INTEGER DEFAULT 0 CHECK (total_views >= 0),
        total_likes INTEGER DEFAULT 0 CHECK (total_likes >= 0),
        total_comments INTEGER DEFAULT 0 CHECK (total_comments >= 0),
        followers INTEGER DEFAULT 0 CHECK (followers >= 0),
        following INTEGER DEFAULT 0 CHECK (following >= 0),
        likes_received INTEGER DEFAULT 0 CHECK (likes_received >= 0),
        comments_received INTEGER DEFAULT 0 CHECK (comments_received >= 0),
        profile_views INTEGER DEFAULT 0 CHECK (profile_views >= 0),
        posts_growth DECIMAL(5,2) DEFAULT 0,
        views_growth DECIMAL(5,2) DEFAULT 0,
        likes_growth DECIMAL(5,2) DEFAULT 0,
        followers_growth DECIMAL(5,2) DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        action_url VARCHAR(500),
        read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id),
        CHECK (follower_id != following_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS post_views (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ========== TABLAS ADICIONALES (de schema.sql) ==========
    
    // Tabla de permisos de usuario
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        permission VARCHAR(50) NOT NULL CHECK (permission IN (
          'admin_completo', 'asignar_roles', 'comentar', 'crear_categoria',
          'crear_post', 'editar_categoria', 'editar_post_cualquiera',
          'editar_post_propio', 'eliminar_categoria', 'publicar_post',
          'reaccionar', 'rechazar_post'
        )),
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, permission)
      );
    `);

    // Tabla de actividades de usuario
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN (
          'post_created', 'post_published', 'comment_added',
          'profile_updated', 'follow', 'like_given'
        )),
        description TEXT NOT NULL,
        target VARCHAR(255),
        content TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de tags
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de relación posts-tags (NORMALIZADA - 3FN)
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_tags (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, tag_id)
      );
    `);

    // Tabla de palabras clave (keywords) - NORMALIZADA para reemplazar el array
    await client.query(`
      CREATE TABLE IF NOT EXISTS keywords (
        id SERIAL PRIMARY KEY,
        keyword VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de relación posts-keywords (NORMALIZADA - 3FN)
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_keywords (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, keyword_id)
      );
    `);

    // Tabla de SEO para posts
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_seo (
        id SERIAL PRIMARY KEY,
        post_id INTEGER UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        meta_title VARCHAR(255),
        meta_description TEXT,
        focus_keyword VARCHAR(100),
        canonical_url VARCHAR(255),
        og_title VARCHAR(255),
        og_description TEXT,
        og_image TEXT,
        readability_score DECIMAL(5,2),
        seo_score DECIMAL(5,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de flujo editorial
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_editorial (
        id SERIAL PRIMARY KEY,
        post_id INTEGER UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        reviewer_id INTEGER REFERENCES usuarios(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        review_notes TEXT,
        approved_by INTEGER REFERENCES usuarios(id),
        submitted_at TIMESTAMP WITH TIME ZONE,
        editorial_status VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de likes en comentarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_id)
      );
    `);

    // Tabla de archivos multimedia
    await client.query(`
      CREATE TABLE IF NOT EXISTS media_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video', 'audio', 'document')),
        size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_by INTEGER NOT NULL REFERENCES usuarios(id),
        alt TEXT,
        caption TEXT,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de tráfico analytics
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_traffic (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        views INTEGER DEFAULT 0,
        users INTEGER DEFAULT 0,
        sessions INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date)
      );
    `);

    // Tabla de fuentes de tráfico
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_traffic_sources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        visitors INTEGER DEFAULT 0,
        percentage DECIMAL(5,2) DEFAULT 0,
        date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de configuración del sitio
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_config (
        id SERIAL PRIMARY KEY,
        site_name VARCHAR(255) NOT NULL,
        site_description TEXT,
        site_url VARCHAR(255) NOT NULL,
        logo TEXT,
        favicon TEXT,
        language VARCHAR(10) DEFAULT 'es',
        timezone VARCHAR(50) DEFAULT 'UTC',
        date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
        time_format VARCHAR(50) DEFAULT 'HH:mm:ss',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de configuración de email
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_config (
        id SERIAL PRIMARY KEY,
        smtp_host VARCHAR(255) NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_user VARCHAR(255) NOT NULL,
        smtp_password VARCHAR(255) NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de configuración SEO
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_config (
        id SERIAL PRIMARY KEY,
        default_meta_title VARCHAR(255),
        default_meta_description TEXT,
        default_og_image TEXT,
        twitter_handle VARCHAR(100),
        google_analytics_id VARCHAR(100),
        google_search_console_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de reseteo de contraseñas
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log(`✅ Tablas verificadas (${dur(t1)})`);

    // ========== MIGRACIONES DE COLUMNAS ==========
    console.log('⏳ Verificando y agregando columnas faltantes...');
    
    // Agregar last_login si no existe
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'usuarios' AND column_name = 'last_login'
        ) THEN
          ALTER TABLE usuarios ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `);

    console.log('✅ Columnas verificadas');

    // ========== ÍNDICES ==========
    const t2 = now();
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_clerk_id ON usuarios(clerk_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_status ON usuarios(status)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_usuario_id ON posts(usuario_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_estado_id ON posts(estado_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_fecha_publicacion ON posts(fecha_publicacion)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_views ON posts(views DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(featured) WHERE featured = true`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_categorias_parent_id ON categorias(parent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_categorias_is_active ON categorias(is_active)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_categorias_post_id ON posts_categorias(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_categorias_categoria_id ON posts_categorias(categoria_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_post_id ON comentarios(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_usuario_id ON comentarios(usuario_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_parent_id ON comentarios(parent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comentarios_status ON comentarios(status)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reacciones_post_id ON reacciones(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reacciones_usuario_id ON reacciones(usuario_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reacciones_tipo_reaccion_id ON reacciones(tipo_reaccion_id)`);
    
    // Índices para nuevas tablas
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_keywords_slug ON keywords(slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_keywords_usage_count ON keywords(usage_count DESC)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_keywords_post_id ON post_keywords(post_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_keywords_keyword_id ON post_keywords(keyword_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(type)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_traffic_date ON analytics_traffic(date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_traffic_sources_date ON analytics_traffic_sources(date DESC)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)`);
    
    console.log(`✅ Índices verificados (${dur(t2)})`);

    // ========== TRIGGERS ==========
    const t3 = now();
    
    // Trigger: updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const tablesWithUpdatedAt = [
      'usuarios', 'posts', 'categorias', 'comentarios', 
      'user_preferences', 'user_social_links', 'user_stats',
      'post_seo', 'post_editorial', 'site_config', 'email_config', 'seo_config'
    ];
    for (const table of tablesWithUpdatedAt) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Trigger: Crear defaults de usuario
    await client.query(`
      CREATE OR REPLACE FUNCTION create_user_defaults()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
          INSERT INTO user_stats (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
          INSERT INTO user_social_links (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_create_user_defaults ON usuarios;
      CREATE TRIGGER trigger_create_user_defaults
      AFTER INSERT ON usuarios
      FOR EACH ROW EXECUTE FUNCTION create_user_defaults();
    `);

    // Trigger: Actualizar contadores
    await client.query(`
      CREATE OR REPLACE FUNCTION update_category_posts_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE categorias SET posts_count = posts_count + 1 
              WHERE id IN (SELECT categoria_id FROM posts_categorias WHERE post_id = NEW.post_id);
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE categorias SET posts_count = GREATEST(0, posts_count - 1) 
              WHERE id IN (SELECT categoria_id FROM posts_categorias WHERE post_id = OLD.post_id);
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_category_posts_count ON posts_categorias;
      CREATE TRIGGER trigger_update_category_posts_count
      AFTER INSERT OR DELETE ON posts_categorias
      FOR EACH ROW EXECUTE FUNCTION update_category_posts_count();
    `);

    // Trigger: Actualizar contador de comentarios en post
    await client.query(`
      CREATE OR REPLACE FUNCTION update_post_comments_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_post_comments_count ON comentarios;
      CREATE TRIGGER trigger_update_post_comments_count
      AFTER INSERT OR DELETE ON comentarios
      FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();
    `);

    // Trigger: Actualizar contador de likes en post
    await client.query(`
      CREATE OR REPLACE FUNCTION update_post_likes_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE posts SET likes = GREATEST(0, likes - 1) WHERE id = OLD.post_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_post_likes_count ON post_likes;
      CREATE TRIGGER trigger_update_post_likes_count
      AFTER INSERT OR DELETE ON post_likes
      FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
    `);

    // Trigger: Actualizar estadísticas de seguidores
    await client.query(`
      CREATE OR REPLACE FUNCTION update_follow_stats()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE user_stats SET following = following + 1 WHERE user_id = NEW.follower_id;
              UPDATE user_stats SET followers = followers + 1 WHERE user_id = NEW.following_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE user_stats SET following = GREATEST(0, following - 1) WHERE user_id = OLD.follower_id;
              UPDATE user_stats SET followers = GREATEST(0, followers - 1) WHERE user_id = OLD.following_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_follow_stats ON follows;
      CREATE TRIGGER trigger_update_follow_stats
      AFTER INSERT OR DELETE ON follows
      FOR EACH ROW EXECUTE FUNCTION update_follow_stats();
    `);

    // Trigger: Incrementar vistas de post
    await client.query(`
      CREATE OR REPLACE FUNCTION increment_post_view()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE posts SET views = views + 1 WHERE id = NEW.post_id;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_increment_post_view ON post_views;
      CREATE TRIGGER trigger_increment_post_view
      AFTER INSERT ON post_views
      FOR EACH ROW EXECUTE FUNCTION increment_post_view();
    `);

    // Trigger: Notificar nuevo comentario
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_new_comment()
      RETURNS TRIGGER AS $$
      DECLARE
          post_author_id INTEGER;
          post_titulo TEXT;
          commenter_name TEXT;
      BEGIN
          SELECT usuario_id, titulo INTO post_author_id, post_titulo
          FROM posts WHERE id = NEW.post_id;
          
          SELECT nombre INTO commenter_name
          FROM usuarios WHERE id = NEW.usuario_id;
          
          IF post_author_id != NEW.usuario_id THEN
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  post_author_id,
                  'info',
                  'Nuevo comentario',
                  commenter_name || ' comentó en tu artículo "' || post_titulo || '"',
                  '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id)
              );
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_new_comment ON comentarios;
      CREATE TRIGGER trigger_notify_new_comment
      AFTER INSERT ON comentarios
      FOR EACH ROW EXECUTE FUNCTION notify_new_comment();
    `);

    // Trigger: Notificar nuevo like
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_post_like()
      RETURNS TRIGGER AS $$
      DECLARE
          post_author_id INTEGER;
          post_titulo TEXT;
          liker_name TEXT;
      BEGIN
          SELECT usuario_id, titulo INTO post_author_id, post_titulo
          FROM posts WHERE id = NEW.post_id;
          
          SELECT nombre INTO liker_name
          FROM usuarios WHERE id = NEW.user_id;
          
          IF post_author_id != NEW.user_id THEN
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  post_author_id,
                  'success',
                  'Nuevo like',
                  liker_name || ' le gustó tu artículo "' || post_titulo || '"',
                  '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id)
              );
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_post_like ON post_likes;
      CREATE TRIGGER trigger_notify_post_like
      AFTER INSERT ON post_likes
      FOR EACH ROW EXECUTE FUNCTION notify_post_like();
    `);

    // Trigger: Notificar nuevo seguidor
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_new_follower()
      RETURNS TRIGGER AS $$
      DECLARE
          follower_name TEXT;
      BEGIN
          SELECT nombre INTO follower_name
          FROM usuarios WHERE id = NEW.follower_id;
          
          INSERT INTO notifications (user_id, type, title, message, action_url)
          VALUES (
              NEW.following_id,
              'info',
              'Nuevo seguidor',
              follower_name || ' comenzó a seguirte',
              '/profile/' || (SELECT username FROM usuarios WHERE id = NEW.follower_id)
          );
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_new_follower ON follows;
      CREATE TRIGGER trigger_notify_new_follower
      AFTER INSERT ON follows
      FOR EACH ROW EXECUTE FUNCTION notify_new_follower();
    `);

    // Trigger: Prevenir auto-seguimiento
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_self_follow()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.follower_id = NEW.following_id THEN
              RAISE EXCEPTION 'Un usuario no puede seguirse a sí mismo';
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_prevent_self_follow ON follows;
      CREATE TRIGGER trigger_prevent_self_follow
      BEFORE INSERT ON follows
      FOR EACH ROW EXECUTE FUNCTION prevent_self_follow();
    `);

    // Trigger: Prevenir auto-like
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_self_like()
      RETURNS TRIGGER AS $$
      DECLARE
          post_author_id INTEGER;
      BEGIN
          SELECT usuario_id INTO post_author_id FROM posts WHERE id = NEW.post_id;
          
          IF post_author_id = NEW.user_id THEN
              RAISE EXCEPTION 'Un usuario no puede dar like a su propio post';
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_prevent_self_like ON post_likes;
      CREATE TRIGGER trigger_prevent_self_like
      BEFORE INSERT ON post_likes
      FOR EACH ROW EXECUTE FUNCTION prevent_self_like();
    `);

    // Trigger: Actualizar stats de usuario al crear post
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_stats_on_post_create()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE user_stats 
          SET posts_created = posts_created + 1
          WHERE user_id = NEW.usuario_id;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_user_stats_on_post_create ON posts;
      CREATE TRIGGER trigger_update_user_stats_on_post_create
      AFTER INSERT ON posts
      FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_post_create();
    `);

    // Trigger: Actualizar stats al publicar post
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_stats_on_post_publish()
      RETURNS TRIGGER AS $$
      DECLARE
          estado_publicado INTEGER;
      BEGIN
          SELECT id INTO estado_publicado FROM estados_publicacion WHERE nombre = 'publicado';
          
          IF NEW.estado_id = estado_publicado AND (OLD.estado_id IS NULL OR OLD.estado_id != estado_publicado) THEN
              UPDATE user_stats 
              SET posts_published = posts_published + 1
              WHERE user_id = NEW.usuario_id;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_user_stats_on_post_publish ON posts;
      CREATE TRIGGER trigger_update_user_stats_on_post_publish
      AFTER UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_post_publish();
    `);

    // Trigger: Marcar notificación como leída
    await client.query(`
      CREATE OR REPLACE FUNCTION mark_notification_read()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.read = TRUE AND (OLD.read IS NULL OR OLD.read = FALSE) THEN
              NEW.read_at := CURRENT_TIMESTAMP;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_mark_notification_read ON notifications;
      CREATE TRIGGER trigger_mark_notification_read
      BEFORE UPDATE ON notifications
      FOR EACH ROW EXECUTE FUNCTION mark_notification_read();
    `);

    // Trigger: Validar contenido de comentario
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_comment_content()
      RETURNS TRIGGER AS $$
      BEGIN
          IF LENGTH(TRIM(NEW.contenido)) < 3 THEN
              RAISE EXCEPTION 'El comentario debe tener al menos 3 caracteres';
          END IF;
          
          IF LENGTH(NEW.contenido) > 5000 THEN
              RAISE EXCEPTION 'El comentario no puede exceder 5000 caracteres';
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_comment_content ON comentarios;
      CREATE TRIGGER trigger_validate_comment_content
      BEFORE INSERT OR UPDATE ON comentarios
      FOR EACH ROW EXECUTE FUNCTION validate_comment_content();
    `);

    // Trigger: Marcar comentario como editado
    await client.query(`
      CREATE OR REPLACE FUNCTION mark_comment_edited()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.contenido != NEW.contenido THEN
              NEW.is_edited := TRUE;
              NEW.edited_at := CURRENT_TIMESTAMP;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_mark_comment_edited ON comentarios;
      CREATE TRIGGER trigger_mark_comment_edited
      BEFORE UPDATE OF contenido ON comentarios
      FOR EACH ROW EXECUTE FUNCTION mark_comment_edited();
    `);

    console.log(`✅ Triggers creados (${dur(t3)})`);

    // ========== SEEDS ==========
    const t4 = now();

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

    // Seeds para tags
    const tagsDefault = [
      { name: 'JavaScript', slug: 'javascript', description: 'Lenguaje de programación JavaScript' },
      { name: 'TypeScript', slug: 'typescript', description: 'Superset tipado de JavaScript' },
      { name: 'React', slug: 'react', description: 'Librería de UI de Facebook' },
      { name: 'Node.js', slug: 'nodejs', description: 'Runtime de JavaScript en el servidor' },
      { name: 'PostgreSQL', slug: 'postgresql', description: 'Base de datos relacional' },
      { name: 'Marketing', slug: 'marketing', description: 'Estrategias de marketing digital' },
      { name: 'SEO', slug: 'seo', description: 'Optimización para motores de búsqueda' },
      { name: 'Tutorial', slug: 'tutorial', description: 'Guías y tutoriales paso a paso' },
      { name: 'Noticias', slug: 'noticias', description: 'Últimas noticias del sector' },
      { name: 'Opinión', slug: 'opinion', description: 'Artículos de opinión' },
    ];
    for (const tag of tagsDefault) {
      const q = sql`INSERT INTO tags (name, slug, description) VALUES (${tag.name}, ${tag.slug}, ${tag.description}) ON CONFLICT (slug) DO NOTHING`;
      await client.query(q.text, q.values);
    }

    // Seeds para categorías (si no existen)
    const categoriasDefault = [
      { nombre: 'Tecnología', slug: 'tecnologia', descripcion: 'Artículos sobre tecnología', color: '#3B82F6', icono: '💻' },
      { nombre: 'Marketing', slug: 'marketing', descripcion: 'Estrategias de marketing', color: '#10B981', icono: '📈' },
      { nombre: 'Diseño', slug: 'diseno', descripcion: 'Diseño web y gráfico', color: '#8B5CF6', icono: '🎨' },
      { nombre: 'Negocios', slug: 'negocios', descripcion: 'Mundo empresarial', color: '#F59E0B', icono: '💼' },
      { nombre: 'Desarrollo', slug: 'desarrollo', descripcion: 'Desarrollo de software', color: '#EF4444', icono: '⚙️' },
    ];
    
    // Insertar categorías solo si la tabla está vacía
    const categoriasCount = await client.query('SELECT COUNT(*) FROM categorias');
    if (parseInt(categoriasCount.rows[0].count) === 0) {
      for (const cat of categoriasDefault) {
        await client.query(`
          INSERT INTO categorias (nombre, slug, descripcion, color, icono, is_active, display_order)
          VALUES ($1, $2, $3, $4, $5, true, 0)
          ON CONFLICT (slug) DO NOTHING
        `, [cat.nombre, cat.slug, cat.descripcion, cat.color, cat.icono]);
      }
    }

    // Seeds para configuración del sitio (solo si no existe)
    const siteConfigCount = await client.query('SELECT COUNT(*) FROM site_config');
    if (parseInt(siteConfigCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO site_config (
          site_name, site_description, site_url, 
          logo, favicon, language, timezone,
          date_format, time_format
        ) VALUES (
          'Blog Marketing',
          'Plataforma de contenido sobre marketing digital y tecnología',
          'https://blog-marketing.com',
          '/logo.png',
          '/favicon.ico',
          'es',
          'America/Mexico_City',
          'DD/MM/YYYY',
          'HH:mm:ss'
        )
      `);
    }

    // Seeds para configuración SEO (solo si no existe)
    const seoConfigCount = await client.query('SELECT COUNT(*) FROM seo_config');
    if (parseInt(seoConfigCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO seo_config (
          default_meta_title,
          default_meta_description,
          default_og_image,
          twitter_handle
        ) VALUES (
          'Blog Marketing - Contenido de Calidad',
          'Descubre las últimas tendencias en marketing digital, tecnología y desarrollo web',
          '/og-image.jpg',
          '@blogmarketing'
        )
      `);
    }

    // Seeds para configuración de email (solo si no existe)
    const emailConfigCount = await client.query('SELECT COUNT(*) FROM email_config');
    if (parseInt(emailConfigCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO email_config (
          smtp_host, smtp_port, smtp_user, smtp_password,
          from_email, from_name
        ) VALUES (
          'smtp.example.com',
          587,
          'noreply@blog-marketing.com',
          'CHANGE_THIS_PASSWORD',
          'noreply@blog-marketing.com',
          'Blog Marketing'
        )
      `);
    }

    // Seeds para usuario administrador demo (solo si no existe ningún usuario)
    const usuariosCount = await client.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(usuariosCount.rows[0].count) === 0) {
      const adminRolId = await client.query(`SELECT id FROM roles WHERE nombre = 'administrador' LIMIT 1`);
      if (adminRolId.rows.length > 0) {
        await client.query(`
          INSERT INTO usuarios (
            username, email, first_name, last_name,
            rol_id, status, is_verified, bio
          ) VALUES (
            'admin',
            'admin@blog-marketing.com',
            'Admin',
            'Sistema',
            $1,
            'active',
            true,
            'Cuenta de administrador del sistema'
          )
        `, [adminRolId.rows[0].id]);
      }
    }

    // Seeds para analytics_traffic (últimos 30 días con datos de ejemplo)
    const trafficCount = await client.query('SELECT COUNT(*) FROM analytics_traffic');
    if (parseInt(trafficCount.rows[0].count) === 0) {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Generar datos aleatorios pero realistas
        const baseViews = 1000 + Math.floor(Math.random() * 500);
        const views = baseViews + Math.floor(Math.random() * 200);
        const users = Math.floor(views * 0.7);
        const sessions = Math.floor(users * 1.3);
        
        await client.query(`
          INSERT INTO analytics_traffic (date, views, users, sessions)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (date) DO NOTHING
        `, [dateStr, views, users, sessions]);
      }
    }

    // Seeds para fuentes de tráfico
    const trafficSourcesCount = await client.query('SELECT COUNT(*) FROM analytics_traffic_sources');
    if (parseInt(trafficSourcesCount.rows[0].count) === 0) {
      const today = new Date().toISOString().split('T')[0];
      const sources = [
        { name: 'Google', visitors: 450, percentage: 45.0 },
        { name: 'Direct', visitors: 250, percentage: 25.0 },
        { name: 'Facebook', visitors: 150, percentage: 15.0 },
        { name: 'Twitter', visitors: 80, percentage: 8.0 },
        { name: 'LinkedIn', visitors: 70, percentage: 7.0 },
      ];
      
      for (const source of sources) {
        await client.query(`
          INSERT INTO analytics_traffic_sources (name, visitors, percentage, date)
          VALUES ($1, $2, $3, $4)
        `, [source.name, source.visitors, source.percentage, today]);
      }
    }

    // Asignar permisos al rol administrador
    const adminRol = await client.query(`SELECT id FROM roles WHERE nombre = 'administrador' LIMIT 1`);
    if (adminRol.rows.length > 0) {
      const allPermisos = await client.query('SELECT id FROM permisos');
      for (const permiso of allPermisos.rows) {
        await client.query(`
          INSERT INTO roles_permisos (rol_id, permiso_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [adminRol.rows[0].id, permiso.id]);
      }
    }

    // Asignar permisos al rol editor
    const editorRol = await client.query(`SELECT id FROM roles WHERE nombre = 'editor' LIMIT 1`);
    if (editorRol.rows.length > 0) {
      const editorPermisos = await client.query(`
        SELECT id FROM permisos 
        WHERE nombre IN ('crear_post', 'editar_post_propio', 'editar_post_cualquiera', 
                        'publicar_post', 'comentar', 'reaccionar', 'crear_categoria', 'editar_categoria')
      `);
      for (const permiso of editorPermisos.rows) {
        await client.query(`
          INSERT INTO roles_permisos (rol_id, permiso_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [editorRol.rows[0].id, permiso.id]);
      }
    }

    // Asignar permisos al rol autor
    const autorRol = await client.query(`SELECT id FROM roles WHERE nombre = 'autor' LIMIT 1`);
    if (autorRol.rows.length > 0) {
      const autorPermisos = await client.query(`
        SELECT id FROM permisos 
        WHERE nombre IN ('crear_post', 'editar_post_propio', 'comentar', 'reaccionar')
      `);
      for (const permiso of autorPermisos.rows) {
        await client.query(`
          INSERT INTO roles_permisos (rol_id, permiso_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [autorRol.rows[0].id, permiso.id]);
      }
    }

    // Asignar permisos al rol comentador
    const comentadorRol = await client.query(`SELECT id FROM roles WHERE nombre = 'comentador' LIMIT 1`);
    if (comentadorRol.rows.length > 0) {
      const comentadorPermisos = await client.query(`
        SELECT id FROM permisos 
        WHERE nombre IN ('comentar', 'reaccionar')
      `);
      for (const permiso of comentadorPermisos.rows) {
        await client.query(`
          INSERT INTO roles_permisos (rol_id, permiso_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [comentadorRol.rows[0].id, permiso.id]);
      }
    }

    console.log(`✅ Seeds aplicados (${dur(t4)})`);

    // ========== VISTAS ==========
    const t5 = now();
    
    // Vista: Usuarios con rol y nombre completo (NORMALIZADA)
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_con_rol AS
      SELECT 
          u.id,
          u.clerk_id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.first_name,
          u.last_name,
          u.email,
          u.avatar,
          u.status,
          u.is_verified,
          r.nombre as rol,
          r.descripcion as rol_descripcion,
          u.last_login,
          u.created_at,
          u.updated_at
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id;
    `);

    // Vista: Posts completos con información del autor y estado
    await client.query(`
      CREATE OR REPLACE VIEW posts_completos AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.extracto,
          p.contenido,
          p.imagen_destacada,
          p.views,
          p.likes,
          p.comments_count,
          p.shares,
          p.featured,
          p.is_pinned,
          p.fecha_publicacion,
          p.tiempo_lectura,
          u.id as autor_id,
          CONCAT(u.first_name, ' ', u.last_name) as autor_nombre,
          u.username as autor_username,
          u.avatar as autor_avatar,
          e.id as estado_id,
          e.nombre as estado,
          e.descripcion as estado_descripcion,
          p.created_at,
          p.updated_at
      FROM posts p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN estados_publicacion e ON p.estado_id = e.id;
    `);

    // Vista: Comentarios completos
    await client.query(`
      CREATE OR REPLACE VIEW comentarios_completos AS
      SELECT 
          c.id,
          c.contenido,
          c.status,
          c.likes,
          c.is_edited,
          c.edited_at,
          c.parent_id,
          u.id as autor_id,
          CONCAT(u.first_name, ' ', u.last_name) as autor_nombre,
          u.username as autor_username,
          u.avatar as autor_avatar,
          p.id as post_id,
          p.titulo as post_titulo,
          p.slug as post_slug,
          c.created_at,
          c.updated_at
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      LEFT JOIN posts p ON c.post_id = p.id;
    `);

    // Vista: Dashboard general
    await client.query(`
      CREATE OR REPLACE VIEW dashboard_overview AS
      SELECT 
          (SELECT COUNT(*) FROM posts WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')) as total_posts,
          (SELECT COUNT(*) FROM usuarios WHERE status = 'active') as total_users,
          (SELECT COUNT(*) FROM comentarios WHERE status = 'approved') as total_comments,
          (SELECT COALESCE(SUM(views), 0) FROM posts) as total_views,
          (SELECT COALESCE(SUM(likes), 0) FROM posts) as total_likes,
          (SELECT COUNT(*) FROM posts WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'en_revision')) as pending_posts,
          (SELECT COUNT(*) FROM comentarios WHERE status = 'pending') as pending_comments;
    `);

    // Vista: Posts populares
    await client.query(`
      CREATE OR REPLACE VIEW posts_populares AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.extracto,
          p.imagen_destacada,
          p.views,
          p.likes,
          p.comments_count,
          p.shares,
          u.username as autor,
          u.avatar as autor_avatar,
          (p.views + p.likes * 5 + p.comments_count * 3 + p.shares * 10) as popularity_score
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      ORDER BY popularity_score DESC
      LIMIT 20;
    `);

    // Vista: Posts trending (últimos 7 días)
    await client.query(`
      CREATE OR REPLACE VIEW posts_trending AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.extracto,
          p.imagen_destacada,
          p.fecha_publicacion,
          p.views,
          p.likes,
          p.comments_count,
          u.username as autor,
          (p.likes * 2 + p.comments_count * 3 + p.shares * 5)::float /
          GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.fecha_publicacion)) / 3600, 1) as trending_score
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND p.fecha_publicacion >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY trending_score DESC
      LIMIT 20;
    `);

    // Vista: Usuarios más activos
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_mas_activos AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.avatar,
          u.rol,
          COUNT(DISTINCT p.id) as posts_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT pl.id) as likes_given,
          (
              COUNT(DISTINCT p.id) * 10 +
              COUNT(DISTINCT c.id) * 3 +
              COUNT(DISTINCT pl.id) * 1
          ) as activity_score
      FROM usuarios_con_rol u
      LEFT JOIN posts p ON u.id = p.usuario_id
      LEFT JOIN comentarios c ON u.id = c.usuario_id
      LEFT JOIN post_likes pl ON u.id = pl.user_id
      WHERE u.status = 'active'
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar, u.rol
      ORDER BY activity_score DESC
      LIMIT 50;
    `);

    // Vista: Categorías con estadísticas
    await client.query(`
      CREATE OR REPLACE VIEW categorias_stats AS
      SELECT 
          c.id,
          c.nombre,
          c.slug,
          c.color,
          c.icono,
          c.posts_count,
          COUNT(DISTINCT p.id) as published_posts,
          COALESCE(SUM(p.views), 0) as total_views,
          COALESCE(SUM(p.likes), 0) as total_likes,
          COALESCE(SUM(p.comments_count), 0) as total_comments,
          COALESCE(AVG(p.views), 0) as avg_views
      FROM categorias c
      LEFT JOIN posts_categorias pc ON c.id = pc.categoria_id
      LEFT JOIN posts p ON pc.post_id = p.id 
          AND p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      WHERE c.is_active = true
      GROUP BY c.id, c.nombre, c.slug, c.color, c.icono, c.posts_count
      ORDER BY total_views DESC;
    `);

    // Vista: Comentarios pendientes de moderación
    await client.query(`
      CREATE OR REPLACE VIEW comentarios_pendientes AS
      SELECT 
          c.id,
          c.contenido,
          c.created_at,
          u.username as autor,
          u.email as autor_email,
          p.titulo as post_titulo,
          p.slug as post_slug,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.created_at)) / 3600 as hours_pending
      FROM comentarios c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN posts p ON c.post_id = p.id
      WHERE c.status = 'pending'
      ORDER BY c.created_at ASC;
    `);

    // Vista: Notificaciones no leídas por usuario
    await client.query(`
      CREATE OR REPLACE VIEW notificaciones_no_leidas AS
      SELECT 
          user_id,
          COUNT(*) as unread_count,
          MAX(created_at) as last_notification_at
      FROM notifications
      WHERE read = false
      GROUP BY user_id;
    `);

    // Vista: Estadísticas de autores
    await client.query(`
      CREATE OR REPLACE VIEW autores_stats AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.avatar,
          u.rol,
          COUNT(DISTINCT p.id) as total_posts,
          COUNT(DISTINCT CASE WHEN e.nombre = 'publicado' THEN p.id END) as published_posts,
          COUNT(DISTINCT CASE WHEN e.nombre = 'borrador' THEN p.id END) as draft_posts,
          COALESCE(SUM(p.views), 0) as total_views,
          COALESCE(SUM(p.likes), 0) as total_likes,
          COALESCE(SUM(p.comments_count), 0) as total_comments,
          COALESCE(AVG(p.views), 0) as avg_views_per_post,
          us.followers,
          us.following
      FROM usuarios_con_rol u
      LEFT JOIN posts p ON u.id = p.usuario_id
      LEFT JOIN estados_publicacion e ON p.estado_id = e.id
      LEFT JOIN user_stats us ON u.id = us.user_id
      WHERE u.rol IN ('administrador', 'editor', 'autor')
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar, u.rol, us.followers, us.following;
    `);

    // Vista: Posts por mes
    await client.query(`
      CREATE OR REPLACE VIEW posts_por_mes AS
      SELECT 
          DATE_TRUNC('month', fecha_publicacion) as mes,
          COUNT(*) as posts_count,
          COALESCE(SUM(views), 0) as total_views,
          COALESCE(SUM(likes), 0) as total_likes,
          COALESCE(AVG(views), 0) as avg_views
      FROM posts
      WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND fecha_publicacion IS NOT NULL
      GROUP BY DATE_TRUNC('month', fecha_publicacion)
      ORDER BY mes DESC;
    `);

    // Vista: Posts recientes con engagement
    await client.query(`
      CREATE OR REPLACE VIEW posts_recientes_engagement AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.extracto,
          p.imagen_destacada,
          p.fecha_publicacion,
          p.views,
          p.likes,
          p.comments_count,
          p.shares,
          u.username as autor,
          u.avatar as autor_avatar,
          CASE 
              WHEN p.views > 0 THEN 
                  ROUND(((p.likes + p.comments_count * 2)::float / p.views * 100)::numeric, 2)
              ELSE 0
          END as engagement_rate
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND p.fecha_publicacion >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY p.fecha_publicacion DESC
      LIMIT 20;
    `);

    // Vista: Usuarios con más seguidores
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_top_seguidores AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.avatar,
          u.rol,
          us.followers,
          us.following,
          us.posts_published,
          us.total_views,
          ROUND((us.followers::float / NULLIF(us.following, 0))::numeric, 2) as follower_ratio
      FROM usuarios_con_rol u
      JOIN user_stats us ON u.id = us.user_id
      WHERE u.status = 'active'
      ORDER BY us.followers DESC
      LIMIT 20;
    `);

    // Vista: Posts sin comentarios
    await client.query(`
      CREATE OR REPLACE VIEW posts_sin_comentarios AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.fecha_publicacion,
          p.views,
          p.likes,
          u.username as autor,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p.fecha_publicacion)) as dias_desde_publicacion
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND p.comments_count = 0
        AND p.fecha_publicacion >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY p.fecha_publicacion DESC;
    `);

    // Vista: Resumen de moderación
    await client.query(`
      CREATE OR REPLACE VIEW resumen_moderacion AS
      SELECT 
          'comentarios' as tipo,
          COUNT(*) as total_pendientes,
          MIN(created_at) as mas_antiguo,
          MAX(created_at) as mas_reciente,
          AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600) as promedio_horas_espera
      FROM comentarios
      WHERE status = 'pending'
      UNION ALL
      SELECT 
          'posts' as tipo,
          COUNT(*) as total_pendientes,
          MIN(created_at) as mas_antiguo,
          MAX(created_at) as mas_reciente,
          AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600) as promedio_horas_espera
      FROM posts
      WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'en_revision');
    `);

    // Vista: Actividad reciente del sistema
    await client.query(`
      CREATE OR REPLACE VIEW actividad_reciente AS
      SELECT 
          'post' as tipo,
          p.id,
          p.titulo as descripcion,
          u.username as usuario,
          p.created_at as fecha
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      UNION ALL
      SELECT 
          'comentario' as tipo,
          c.id,
          LEFT(c.contenido, 100) as descripcion,
          u.username as usuario,
          c.created_at as fecha
      FROM comentarios c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      UNION ALL
      SELECT 
          'like' as tipo,
          pl.id,
          'Like en: ' || p.titulo as descripcion,
          u.username as usuario,
          pl.created_at as fecha
      FROM post_likes pl
      JOIN usuarios u ON pl.user_id = u.id
      JOIN posts p ON pl.post_id = p.id
      WHERE pl.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY fecha DESC
      LIMIT 100;
    `);

    // Vista: Posts más compartidos
    await client.query(`
      CREATE OR REPLACE VIEW posts_mas_compartidos AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.extracto,
          p.imagen_destacada,
          p.shares,
          p.views,
          p.likes,
          u.username as autor,
          ROUND((p.shares::float / NULLIF(p.views, 0) * 100)::numeric, 2) as share_rate
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND p.shares > 0
      ORDER BY p.shares DESC
      LIMIT 20;
    `);

    // Vista: Usuarios inactivos
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_inactivos AS
      SELECT 
          u.id,
          u.username,
          u.email,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.rol,
          u.last_login,
          u.created_at,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(u.last_login, u.created_at))) as dias_inactivo
      FROM usuarios_con_rol u
      WHERE u.status = 'active'
        AND (u.last_login IS NULL OR u.last_login < CURRENT_DATE - INTERVAL '30 days')
      ORDER BY dias_inactivo DESC;
    `);

    // Vista: Posts en borrador antiguos
    await client.query(`
      CREATE OR REPLACE VIEW posts_borradores_antiguos AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.created_at,
          p.updated_at,
          u.username as autor,
          u.email as autor_email,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p.updated_at)) as dias_sin_actualizar
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'borrador')
        AND p.updated_at < CURRENT_DATE - INTERVAL '30 days'
      ORDER BY p.updated_at ASC;
    `);

    // Vista: Engagement por categoría
    await client.query(`
      CREATE OR REPLACE VIEW engagement_por_categoria AS
      SELECT 
          c.id,
          c.nombre,
          c.slug,
          c.color,
          COUNT(DISTINCT p.id) as posts_count,
          COALESCE(SUM(p.views), 0) as total_views,
          COALESCE(SUM(p.likes), 0) as total_likes,
          COALESCE(SUM(p.comments_count), 0) as total_comments,
          CASE 
              WHEN SUM(p.views) > 0 THEN 
                  ROUND(((SUM(p.likes) + SUM(p.comments_count) * 2)::float / SUM(p.views) * 100)::numeric, 2)
              ELSE 0
          END as engagement_rate
      FROM categorias c
      LEFT JOIN posts_categorias pc ON c.id = pc.categoria_id
      LEFT JOIN posts p ON pc.post_id = p.id 
          AND p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      WHERE c.is_active = true
      GROUP BY c.id, c.nombre, c.slug, c.color
      ORDER BY engagement_rate DESC;
    `);

    // Vista: Comentarios más populares
    await client.query(`
      CREATE OR REPLACE VIEW comentarios_mas_populares AS
      SELECT 
          c.id,
          c.contenido,
          c.likes,
          c.created_at,
          u.username as autor,
          u.avatar as autor_avatar,
          p.titulo as post_titulo,
          p.slug as post_slug
      FROM comentarios c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN posts p ON c.post_id = p.id
      WHERE c.status = 'approved'
        AND c.likes > 0
      ORDER BY c.likes DESC
      LIMIT 20;
    `);

    // Vista: Usuarios por rol
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_por_rol AS
      SELECT 
          rol,
          COUNT(*) as total_usuarios,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as usuarios_activos,
          COUNT(CASE WHEN is_verified = true THEN 1 END) as usuarios_verificados,
          ROUND(AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 86400)::numeric, 0) as promedio_dias_registrados
      FROM usuarios_con_rol
      GROUP BY rol
      ORDER BY total_usuarios DESC;
    `);

    // Vista: Tasa de conversión de borradores
    await client.query(`
      CREATE OR REPLACE VIEW tasa_conversion_borradores AS
      SELECT 
          u.username as autor,
          COUNT(CASE WHEN e.nombre = 'borrador' THEN 1 END) as borradores,
          COUNT(CASE WHEN e.nombre = 'publicado' THEN 1 END) as publicados,
          COUNT(*) as total_posts,
          ROUND((COUNT(CASE WHEN e.nombre = 'publicado' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as tasa_conversion
      FROM usuarios u
      LEFT JOIN posts p ON u.id = p.usuario_id
      LEFT JOIN estados_publicacion e ON p.estado_id = e.id
      WHERE u.rol_id IN (SELECT id FROM roles WHERE nombre IN ('administrador', 'editor', 'autor'))
      GROUP BY u.username
      HAVING COUNT(*) > 0
      ORDER BY tasa_conversion DESC;
    `);

    // Vista: Reacciones por tipo
    await client.query(`
      CREATE OR REPLACE VIEW reacciones_por_tipo AS
      SELECT 
          tr.nombre,
          tr.emoji,
          COUNT(r.id) as total_reacciones,
          COUNT(DISTINCT r.post_id) as posts_con_reaccion,
          COUNT(DISTINCT r.usuario_id) as usuarios_que_reaccionaron
      FROM tipos_reacciones tr
      LEFT JOIN reacciones r ON tr.id = r.tipo_reaccion_id
      GROUP BY tr.id, tr.nombre, tr.emoji
      ORDER BY total_reacciones DESC;
    `);

    // Vista: Posts con mejor rendimiento por autor
    await client.query(`
      CREATE OR REPLACE VIEW posts_mejor_rendimiento_autor AS
      SELECT 
          u.id as autor_id,
          u.username as autor,
          p.id as post_id,
          p.titulo,
          p.slug,
          p.views,
          p.likes,
          p.comments_count,
          p.shares,
          (p.views * 1 + p.likes * 5 + p.comments_count * 3 + p.shares * 10) as performance_score,
          ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY (p.views * 1 + p.likes * 5 + p.comments_count * 3 + p.shares * 10) DESC) as rank
      FROM usuarios u
      JOIN posts p ON u.id = p.usuario_id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      ORDER BY u.id, performance_score DESC;
    `);

    console.log(`✅ Vistas creadas (${dur(t5)})`);

    // ========== TRIGGERS ADICIONALES AVANZADOS ==========
    const t6 = now();

    // Trigger: Notificar cuando un comentario es aprobado
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_comment_approved()
      RETURNS TRIGGER AS $$
      DECLARE
          post_titulo TEXT;
      BEGIN
          IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
              SELECT titulo INTO post_titulo FROM posts WHERE id = NEW.post_id;
              
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  NEW.usuario_id,
                  'success',
                  'Comentario Aprobado',
                  'Tu comentario en "' || post_titulo || '" ha sido aprobado',
                  '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id)
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_comment_approved ON comentarios;
      CREATE TRIGGER trigger_notify_comment_approved
      AFTER UPDATE ON comentarios
      FOR EACH ROW EXECUTE FUNCTION notify_comment_approved();
    `);

    // Trigger: Notificar cuando un comentario es rechazado
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_comment_rejected()
      RETURNS TRIGGER AS $$
      DECLARE
          post_titulo TEXT;
      BEGIN
          IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
              SELECT titulo INTO post_titulo FROM posts WHERE id = NEW.post_id;
              
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  NEW.usuario_id,
                  'warning',
                  'Comentario Rechazado',
                  'Tu comentario en "' || post_titulo || '" ha sido rechazado',
                  '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id)
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_comment_rejected ON comentarios;
      CREATE TRIGGER trigger_notify_comment_rejected
      AFTER UPDATE ON comentarios
      FOR EACH ROW EXECUTE FUNCTION notify_comment_rejected();
    `);

    // Trigger: Actualizar stats de comentarios moderados
    await client.query(`
      CREATE OR REPLACE FUNCTION update_comments_moderated_stats()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
              IF NEW.moderated_by IS NOT NULL THEN
                  UPDATE user_stats 
                  SET comments_moderated = comments_moderated + 1
                  WHERE user_id = NEW.moderated_by;
              END IF;
              
              IF NEW.status = 'approved' THEN
                  UPDATE user_stats 
                  SET comments_approved = comments_approved + 1
                  WHERE user_id = NEW.moderated_by;
              END IF;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_comments_moderated_stats ON comentarios;
      CREATE TRIGGER trigger_update_comments_moderated_stats
      AFTER UPDATE ON comentarios
      FOR EACH ROW EXECUTE FUNCTION update_comments_moderated_stats();
    `);

    // Trigger: Notificar respuesta a comentario
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_comment_reply()
      RETURNS TRIGGER AS $$
      DECLARE
          parent_author_id INTEGER;
          post_titulo TEXT;
          replier_name TEXT;
      BEGIN
          IF NEW.parent_id IS NOT NULL THEN
              SELECT usuario_id INTO parent_author_id
              FROM comentarios WHERE id = NEW.parent_id;
              
              SELECT titulo INTO post_titulo
              FROM posts WHERE id = NEW.post_id;
              
              SELECT nombre INTO replier_name
              FROM usuarios WHERE id = NEW.usuario_id;
              
              IF parent_author_id != NEW.usuario_id THEN
                  INSERT INTO notifications (user_id, type, title, message, action_url)
                  VALUES (
                      parent_author_id,
                      'info',
                      'Respuesta a tu comentario',
                      replier_name || ' respondió a tu comentario en "' || post_titulo || '"',
                      '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id)
                  );
              END IF;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_comment_reply ON comentarios;
      CREATE TRIGGER trigger_notify_comment_reply
      AFTER INSERT ON comentarios
      FOR EACH ROW EXECUTE FUNCTION notify_comment_reply();
    `);

    // Trigger: Notificar cuando un post es destacado
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_post_featured()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.featured = TRUE AND (OLD.featured IS NULL OR OLD.featured = FALSE) THEN
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  NEW.usuario_id,
                  'success',
                  '¡Post Destacado!',
                  'Tu artículo "' || NEW.titulo || '" ha sido destacado',
                  '/posts/' || NEW.slug
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_post_featured ON posts;
      CREATE TRIGGER trigger_notify_post_featured
      AFTER UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION notify_post_featured();
    `);

    // Trigger: Actualizar total_views en user_stats
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_total_views()
      RETURNS TRIGGER AS $$
      DECLARE
          autor INTEGER;
      BEGIN
          SELECT usuario_id INTO autor FROM posts WHERE id = NEW.post_id;
          
          UPDATE user_stats 
          SET total_views = (
              SELECT COALESCE(SUM(views), 0) 
              FROM posts 
              WHERE usuario_id = autor 
                AND estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
          )
          WHERE user_id = autor;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_user_total_views ON post_views;
      CREATE TRIGGER trigger_update_user_total_views
      AFTER INSERT ON post_views
      FOR EACH ROW EXECUTE FUNCTION update_user_total_views();
    `);

    // Trigger: Actualizar total_likes en user_stats
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_total_likes()
      RETURNS TRIGGER AS $$
      DECLARE
          autor INTEGER;
      BEGIN
          SELECT usuario_id INTO autor FROM posts WHERE id = NEW.post_id;
          
          UPDATE user_stats 
          SET total_likes = (
              SELECT COALESCE(SUM(likes), 0) 
              FROM posts 
              WHERE usuario_id = autor 
                AND estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
          ),
          likes_received = likes_received + 1
          WHERE user_id = autor;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_user_total_likes ON post_likes;
      CREATE TRIGGER trigger_update_user_total_likes
      AFTER INSERT ON post_likes
      FOR EACH ROW EXECUTE FUNCTION update_user_total_likes();
    `);

    // Trigger: Decrementar total_likes al eliminar like
    await client.query(`
      CREATE OR REPLACE FUNCTION decrement_user_total_likes()
      RETURNS TRIGGER AS $$
      DECLARE
          autor INTEGER;
      BEGIN
          SELECT usuario_id INTO autor FROM posts WHERE id = OLD.post_id;
          
          UPDATE user_stats 
          SET total_likes = (
              SELECT COALESCE(SUM(likes), 0) 
              FROM posts 
              WHERE usuario_id = autor 
                AND estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
          ),
          likes_received = GREATEST(0, likes_received - 1)
          WHERE user_id = autor;
          
          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_decrement_user_total_likes ON post_likes;
      CREATE TRIGGER trigger_decrement_user_total_likes
      AFTER DELETE ON post_likes
      FOR EACH ROW EXECUTE FUNCTION decrement_user_total_likes();
    `);

    // Trigger: Actualizar total_comments en user_stats
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_total_comments()
      RETURNS TRIGGER AS $$
      DECLARE
          autor INTEGER;
      BEGIN
          SELECT usuario_id INTO autor FROM posts WHERE id = NEW.post_id;
          
          UPDATE user_stats 
          SET total_comments = (
              SELECT COUNT(*) 
              FROM comentarios 
              WHERE post_id IN (SELECT id FROM posts WHERE usuario_id = autor)
                AND status = 'approved'
          ),
          comments_received = comments_received + 1
          WHERE user_id = autor;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_user_total_comments ON comentarios;
      CREATE TRIGGER trigger_update_user_total_comments
      AFTER INSERT ON comentarios
      FOR EACH ROW EXECUTE FUNCTION update_user_total_comments();
    `);

    // Trigger: Validar título de post
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_post_title()
      RETURNS TRIGGER AS $$
      BEGIN
          IF LENGTH(TRIM(NEW.titulo)) < 10 THEN
              RAISE EXCEPTION 'El título debe tener al menos 10 caracteres';
          END IF;
          
          IF LENGTH(NEW.titulo) > 255 THEN
              RAISE EXCEPTION 'El título no puede exceder 255 caracteres';
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_post_title ON posts;
      CREATE TRIGGER trigger_validate_post_title
      BEFORE INSERT OR UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION validate_post_title();
    `);

    // Trigger: Prevenir eliminación de categoría con posts
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_category_deletion_with_posts()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.posts_count > 0 THEN
              RAISE EXCEPTION 'No se puede eliminar una categoría que tiene posts asociados';
          END IF;
          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_prevent_category_deletion_with_posts ON categorias;
      CREATE TRIGGER trigger_prevent_category_deletion_with_posts
      BEFORE DELETE ON categorias
      FOR EACH ROW EXECUTE FUNCTION prevent_category_deletion_with_posts();
    `);

    // Trigger: Validar email único (case insensitive)
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_unique_email()
      RETURNS TRIGGER AS $$
      BEGIN
          IF EXISTS (
              SELECT 1 FROM usuarios 
              WHERE LOWER(email) = LOWER(NEW.email) 
              AND id != COALESCE(NEW.id, 0)
          ) THEN
              RAISE EXCEPTION 'El email % ya está registrado', NEW.email;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_unique_email ON usuarios;
      CREATE TRIGGER trigger_validate_unique_email
      BEFORE INSERT OR UPDATE ON usuarios
      FOR EACH ROW EXECUTE FUNCTION validate_unique_email();
    `);

    // Trigger: Validar username único (case insensitive)
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_unique_username()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.username IS NOT NULL AND EXISTS (
              SELECT 1 FROM usuarios 
              WHERE LOWER(username) = LOWER(NEW.username) 
              AND id != COALESCE(NEW.id, 0)
          ) THEN
              RAISE EXCEPTION 'El username % ya está en uso', NEW.username;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_unique_username ON usuarios;
      CREATE TRIGGER trigger_validate_unique_username
      BEFORE INSERT OR UPDATE ON usuarios
      FOR EACH ROW EXECUTE FUNCTION validate_unique_username();
    `);

    // Trigger: Actualizar posts_edited al editar
    await client.query(`
      CREATE OR REPLACE FUNCTION update_posts_edited_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.contenido != NEW.contenido OR OLD.titulo != NEW.titulo THEN
              UPDATE user_stats 
              SET posts_edited = posts_edited + 1
              WHERE user_id = NEW.usuario_id;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_posts_edited_count ON posts;
      CREATE TRIGGER trigger_update_posts_edited_count
      AFTER UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION update_posts_edited_count();
    `);

    // Trigger: Actualizar contador de likes en comentarios
    await client.query(`
      CREATE OR REPLACE FUNCTION update_comment_likes_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE comentarios SET likes = likes + 1 WHERE id = NEW.comment_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE comentarios SET likes = GREATEST(0, likes - 1) WHERE id = OLD.comment_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Limpiar notificaciones antiguas
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_old_notifications()
      RETURNS TRIGGER AS $$
      BEGIN
          DELETE FROM notifications 
          WHERE read = TRUE 
            AND read_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_cleanup_old_notifications ON notifications;
      CREATE TRIGGER trigger_cleanup_old_notifications
      AFTER INSERT ON notifications
      FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_notifications();
    `);

    // Trigger: Validar contenido de post
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_post_content()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.contenido IS NOT NULL AND LENGTH(TRIM(NEW.contenido)) < 100 THEN
              RAISE EXCEPTION 'El contenido debe tener al menos 100 caracteres';
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_post_content ON posts;
      CREATE TRIGGER trigger_validate_post_content
      BEFORE INSERT OR UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION validate_post_content();
    `);

    // Trigger: Notificar post rechazado
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_post_rejected()
      RETURNS TRIGGER AS $$
      DECLARE
          estado_rechazado INTEGER;
      BEGIN
          SELECT id INTO estado_rechazado FROM estados_publicacion WHERE nombre = 'rechazado';
          
          IF NEW.estado_id = estado_rechazado AND (OLD.estado_id IS NULL OR OLD.estado_id != estado_rechazado) THEN
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  NEW.usuario_id,
                  'error',
                  'Post Rechazado',
                  'Tu artículo "' || NEW.titulo || '" ha sido rechazado',
                  '/posts/' || NEW.slug
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_post_rejected ON posts;
      CREATE TRIGGER trigger_notify_post_rejected
      AFTER UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION notify_post_rejected();
    `);

    // Trigger: Notificar post aprobado
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_post_approved()
      RETURNS TRIGGER AS $$
      DECLARE
          estado_publicado INTEGER;
          estado_revision INTEGER;
      BEGIN
          SELECT id INTO estado_publicado FROM estados_publicacion WHERE nombre = 'publicado';
          SELECT id INTO estado_revision FROM estados_publicacion WHERE nombre = 'en_revision';
          
          IF NEW.estado_id = estado_publicado AND OLD.estado_id = estado_revision THEN
              INSERT INTO notifications (user_id, type, title, message, action_url)
              VALUES (
                  NEW.usuario_id,
                  'success',
                  '¡Post Publicado!',
                  'Tu artículo "' || NEW.titulo || '" ha sido aprobado y publicado',
                  '/posts/' || NEW.slug
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_post_approved ON posts;
      CREATE TRIGGER trigger_notify_post_approved
      AFTER UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION notify_post_approved();
    `);

    // Trigger: Actualizar profile_views
    await client.query(`
      CREATE OR REPLACE FUNCTION increment_profile_view()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE user_stats 
          SET profile_views = profile_views + 1
          WHERE user_id = NEW.viewed_user_id;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Generar slug automáticamente para posts
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_post_slug()
      RETURNS TRIGGER AS $$
      DECLARE
          base_slug TEXT;
          final_slug TEXT;
          counter INTEGER := 0;
      BEGIN
          IF NEW.slug IS NULL OR NEW.slug = '' THEN
              base_slug := lower(regexp_replace(
                  regexp_replace(NEW.titulo, '[^a-zA-Z0-9\\s-]', '', 'g'),
                  '\\s+', '-', 'g'
              ));
              final_slug := base_slug;
              
              WHILE EXISTS (SELECT 1 FROM posts WHERE slug = final_slug AND id != COALESCE(NEW.id, 0)) LOOP
                  counter := counter + 1;
                  final_slug := base_slug || '-' || counter;
              END LOOP;
              
              NEW.slug := final_slug;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_generate_post_slug ON posts;
      CREATE TRIGGER trigger_generate_post_slug
      BEFORE INSERT OR UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION generate_post_slug();
    `);

    // Trigger: Generar slug automáticamente para categorías
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_category_slug()
      RETURNS TRIGGER AS $$
      DECLARE
          base_slug TEXT;
          final_slug TEXT;
          counter INTEGER := 0;
      BEGIN
          IF NEW.slug IS NULL OR NEW.slug = '' THEN
              base_slug := lower(regexp_replace(
                  regexp_replace(NEW.nombre, '[^a-zA-Z0-9\\s-]', '', 'g'),
                  '\\s+', '-', 'g'
              ));
              final_slug := base_slug;
              
              WHILE EXISTS (SELECT 1 FROM categorias WHERE slug = final_slug AND id != COALESCE(NEW.id, 0)) LOOP
                  counter := counter + 1;
                  final_slug := base_slug || '-' || counter;
              END LOOP;
              
              NEW.slug := final_slug;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_generate_category_slug ON categorias;
      CREATE TRIGGER trigger_generate_category_slug
      BEFORE INSERT OR UPDATE ON categorias
      FOR EACH ROW EXECUTE FUNCTION generate_category_slug();
    `);

    // Trigger: Calcular tiempo de lectura automáticamente
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_read_time()
      RETURNS TRIGGER AS $$
      DECLARE
          words_count INTEGER;
          words_per_minute INTEGER := 200;
      BEGIN
          IF NEW.contenido IS NOT NULL THEN
              words_count := array_length(regexp_split_to_array(NEW.contenido, '\\s+'), 1);
              NEW.tiempo_lectura := GREATEST(1, CEIL(words_count::float / words_per_minute));
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_calculate_read_time ON posts;
      CREATE TRIGGER trigger_calculate_read_time
      BEFORE INSERT OR UPDATE OF contenido ON posts
      FOR EACH ROW EXECUTE FUNCTION calculate_read_time();
    `);

    // Trigger: Actualizar usage_count en tags
    await client.query(`
      CREATE OR REPLACE FUNCTION update_tag_usage_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE tags SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.tag_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_tag_usage_count ON post_tags;
      CREATE TRIGGER trigger_update_tag_usage_count
      AFTER INSERT OR DELETE ON post_tags
      FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();
    `);

    // Trigger: Actualizar usage_count en keywords
    await client.query(`
      CREATE OR REPLACE FUNCTION update_keyword_usage_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE keywords SET usage_count = usage_count + 1 WHERE id = NEW.keyword_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE keywords SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.keyword_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_keyword_usage_count ON post_keywords;
      CREATE TRIGGER trigger_update_keyword_usage_count
      AFTER INSERT OR DELETE ON post_keywords
      FOR EACH ROW EXECUTE FUNCTION update_keyword_usage_count();
    `);

    // Trigger: Actualizar contador de likes en comentarios
    await client.query(`
      CREATE OR REPLACE FUNCTION update_comment_likes_count_v2()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE comentarios SET likes = likes + 1 WHERE id = NEW.comment_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE comentarios SET likes = GREATEST(0, likes - 1) WHERE id = OLD.comment_id;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_comment_likes_count_v2 ON comment_likes;
      CREATE TRIGGER trigger_update_comment_likes_count_v2
      AFTER INSERT OR DELETE ON comment_likes
      FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count_v2();
    `);

    // Trigger: Registrar actividad al crear post
    await client.query(`
      CREATE OR REPLACE FUNCTION log_post_created_activity()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO user_activities (user_id, type, description, target, content)
          VALUES (
              NEW.usuario_id,
              'post_created',
              'Creó el post: ' || NEW.titulo,
              '/posts/' || NEW.slug,
              LEFT(NEW.contenido, 200)
          );
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_log_post_created_activity ON posts;
      CREATE TRIGGER trigger_log_post_created_activity
      AFTER INSERT ON posts
      FOR EACH ROW EXECUTE FUNCTION log_post_created_activity();
    `);

    // Trigger: Registrar actividad al publicar post
    await client.query(`
      CREATE OR REPLACE FUNCTION log_post_published_activity()
      RETURNS TRIGGER AS $$
      DECLARE
          estado_publicado INTEGER;
      BEGIN
          SELECT id INTO estado_publicado FROM estados_publicacion WHERE nombre = 'publicado';
          
          IF NEW.estado_id = estado_publicado AND (OLD.estado_id IS NULL OR OLD.estado_id != estado_publicado) THEN
              INSERT INTO user_activities (user_id, type, description, target)
              VALUES (
                  NEW.usuario_id,
                  'post_published',
                  'Publicó el post: ' || NEW.titulo,
                  '/posts/' || NEW.slug
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_log_post_published_activity ON posts;
      CREATE TRIGGER trigger_log_post_published_activity
      AFTER UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION log_post_published_activity();
    `);

    // Trigger: Registrar actividad al comentar
    await client.query(`
      CREATE OR REPLACE FUNCTION log_comment_activity()
      RETURNS TRIGGER AS $$
      DECLARE
          post_titulo TEXT;
      BEGIN
          SELECT titulo INTO post_titulo FROM posts WHERE id = NEW.post_id;
          
          INSERT INTO user_activities (user_id, type, description, target, content)
          VALUES (
              NEW.usuario_id,
              'comment_added',
              'Comentó en: ' || post_titulo,
              '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id),
              LEFT(NEW.contenido, 200)
          );
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_log_comment_activity ON comentarios;
      CREATE TRIGGER trigger_log_comment_activity
      AFTER INSERT ON comentarios
      FOR EACH ROW EXECUTE FUNCTION log_comment_activity();
    `);

    // Trigger: Registrar actividad al seguir
    await client.query(`
      CREATE OR REPLACE FUNCTION log_follow_activity()
      RETURNS TRIGGER AS $$
      DECLARE
          followed_username TEXT;
      BEGIN
          SELECT username INTO followed_username FROM usuarios WHERE id = NEW.following_id;
          
          INSERT INTO user_activities (user_id, type, description, target)
          VALUES (
              NEW.follower_id,
              'follow',
              'Comenzó a seguir a @' || followed_username,
              '/profile/' || followed_username
          );
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_log_follow_activity ON follows;
      CREATE TRIGGER trigger_log_follow_activity
      AFTER INSERT ON follows
      FOR EACH ROW EXECUTE FUNCTION log_follow_activity();
    `);

    // Trigger: Registrar actividad al dar like
    await client.query(`
      CREATE OR REPLACE FUNCTION log_like_activity()
      RETURNS TRIGGER AS $$
      DECLARE
          post_titulo TEXT;
      BEGIN
          SELECT titulo INTO post_titulo FROM posts WHERE id = NEW.post_id;
          
          INSERT INTO user_activities (user_id, type, description, target)
          VALUES (
              NEW.user_id,
              'like_given',
              'Le gustó: ' || post_titulo,
              '/posts/' || (SELECT slug FROM posts WHERE id = NEW.post_id)
          );
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_log_like_activity ON post_likes;
      CREATE TRIGGER trigger_log_like_activity
      AFTER INSERT ON post_likes
      FOR EACH ROW EXECUTE FUNCTION log_like_activity();
    `);

    // Trigger: Validar token de password reset
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_password_reset_token()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.expires_at < CURRENT_TIMESTAMP THEN
              RAISE EXCEPTION 'El token de reseteo ha expirado';
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_password_reset_token ON password_resets;
      CREATE TRIGGER trigger_validate_password_reset_token
      BEFORE INSERT ON password_resets
      FOR EACH ROW EXECUTE FUNCTION validate_password_reset_token();
    `);

    // Trigger: Limpiar tokens expirados
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
      RETURNS TRIGGER AS $$
      BEGIN
          DELETE FROM password_resets 
          WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_cleanup_expired_tokens ON password_resets;
      CREATE TRIGGER trigger_cleanup_expired_tokens
      AFTER INSERT ON password_resets
      FOR EACH STATEMENT EXECUTE FUNCTION cleanup_expired_tokens();
    `);

    // Trigger: Calcular SEO score automáticamente
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_seo_score()
      RETURNS TRIGGER AS $$
      DECLARE
          score DECIMAL(5,2) := 0;
      BEGIN
          -- Meta title (20 puntos)
          IF NEW.meta_title IS NOT NULL AND LENGTH(NEW.meta_title) BETWEEN 50 AND 60 THEN
              score := score + 20;
          ELSIF NEW.meta_title IS NOT NULL THEN
              score := score + 10;
          END IF;
          
          -- Meta description (20 puntos)
          IF NEW.meta_description IS NOT NULL AND LENGTH(NEW.meta_description) BETWEEN 150 AND 160 THEN
              score := score + 20;
          ELSIF NEW.meta_description IS NOT NULL THEN
              score := score + 10;
          END IF;
          
          -- Focus keyword (20 puntos)
          IF NEW.focus_keyword IS NOT NULL THEN
              score := score + 20;
          END IF;
          
          -- OG tags (20 puntos)
          IF NEW.og_title IS NOT NULL AND NEW.og_description IS NOT NULL THEN
              score := score + 20;
          ELSIF NEW.og_title IS NOT NULL OR NEW.og_description IS NOT NULL THEN
              score := score + 10;
          END IF;
          
          -- OG image (20 puntos)
          IF NEW.og_image IS NOT NULL THEN
              score := score + 20;
          END IF;
          
          NEW.seo_score := score;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_calculate_seo_score ON post_seo;
      CREATE TRIGGER trigger_calculate_seo_score
      BEFORE INSERT OR UPDATE ON post_seo
      FOR EACH ROW EXECUTE FUNCTION calculate_seo_score();
    `);

    // Trigger: Validar tamaño de archivo multimedia
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_media_file_size()
      RETURNS TRIGGER AS $$
      BEGIN
          -- Límite de 50MB para imágenes
          IF NEW.type = 'image' AND NEW.size > 52428800 THEN
              RAISE EXCEPTION 'El archivo de imagen excede el límite de 50MB';
          END IF;
          
          -- Límite de 500MB para videos
          IF NEW.type = 'video' AND NEW.size > 524288000 THEN
              RAISE EXCEPTION 'El archivo de video excede el límite de 500MB';
          END IF;
          
          -- Límite de 100MB para audio
          IF NEW.type = 'audio' AND NEW.size > 104857600 THEN
              RAISE EXCEPTION 'El archivo de audio excede el límite de 100MB';
          END IF;
          
          -- Límite de 20MB para documentos
          IF NEW.type = 'document' AND NEW.size > 20971520 THEN
              RAISE EXCEPTION 'El documento excede el límite de 20MB';
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_validate_media_file_size ON media_files;
      CREATE TRIGGER trigger_validate_media_file_size
      BEFORE INSERT ON media_files
      FOR EACH ROW EXECUTE FUNCTION validate_media_file_size();
    `);

    console.log(`✅ Triggers adicionales creados (${dur(t6)})`);

    // ========== VISTAS ADICIONALES NIVEL 3 ==========
    const t7 = now();

    // Vista: Resumen de actividad diaria
    await client.query(`
      CREATE OR REPLACE VIEW resumen_actividad_diaria AS
      SELECT 
          DATE(fecha) as fecha,
          COUNT(CASE WHEN tipo = 'post' THEN 1 END) as posts_creados,
          COUNT(CASE WHEN tipo = 'comentario' THEN 1 END) as comentarios_creados,
          COUNT(CASE WHEN tipo = 'like' THEN 1 END) as likes_dados,
          COUNT(*) as total_actividades
      FROM actividad_reciente
      GROUP BY DATE(fecha)
      ORDER BY fecha DESC;
    `);

    // Vista: Posts con mejor ratio de engagement
    await client.query(`
      CREATE OR REPLACE VIEW posts_mejor_engagement AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          p.likes,
          p.comments_count,
          p.shares,
          u.username as autor,
          CASE 
              WHEN p.views > 0 THEN 
                  ROUND(((p.likes + p.comments_count * 2 + p.shares * 3)::float / p.views * 100)::numeric, 2)
              ELSE 0
          END as engagement_rate,
          ROUND((p.likes::float / NULLIF(p.views, 0) * 100)::numeric, 2) as like_rate,
          ROUND((p.comments_count::float / NULLIF(p.views, 0) * 100)::numeric, 2) as comment_rate
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND p.views >= 100
      ORDER BY engagement_rate DESC
      LIMIT 50;
    `);

    // Vista: Autores más prolíficos
    await client.query(`
      CREATE OR REPLACE VIEW autores_mas_prolificos AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.avatar,
          COUNT(p.id) as total_posts,
          COUNT(CASE WHEN e.nombre = 'publicado' THEN 1 END) as posts_publicados,
          ROUND(AVG(p.views)::numeric, 0) as promedio_views,
          ROUND(AVG(p.likes)::numeric, 0) as promedio_likes,
          MAX(p.fecha_publicacion) as ultimo_post,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(p.fecha_publicacion))) as dias_desde_ultimo_post
      FROM usuarios u
      JOIN posts p ON u.id = p.usuario_id
      JOIN estados_publicacion e ON p.estado_id = e.id
      WHERE u.rol_id IN (SELECT id FROM roles WHERE nombre IN ('administrador', 'editor', 'autor'))
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar
      HAVING COUNT(p.id) >= 5
      ORDER BY posts_publicados DESC;
    `);

    // Vista: Categorías con mejor rendimiento
    await client.query(`
      CREATE OR REPLACE VIEW categorias_mejor_rendimiento AS
      SELECT 
          c.id,
          c.nombre,
          c.slug,
          c.color,
          COUNT(DISTINCT p.id) as posts_count,
          COALESCE(AVG(p.views), 0) as avg_views,
          COALESCE(AVG(p.likes), 0) as avg_likes,
          COALESCE(AVG(p.comments_count), 0) as avg_comments,
          COALESCE(SUM(p.views), 0) as total_views,
          (COALESCE(AVG(p.views), 0) + COALESCE(AVG(p.likes), 0) * 5 + COALESCE(AVG(p.comments_count), 0) * 3) as performance_score
      FROM categorias c
      LEFT JOIN posts_categorias pc ON c.id = pc.categoria_id
      LEFT JOIN posts p ON pc.post_id = p.id 
          AND p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      WHERE c.is_active = true
      GROUP BY c.id, c.nombre, c.slug, c.color
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY performance_score DESC;
    `);

    // Vista: Posts con más interacción reciente
    await client.query(`
      CREATE OR REPLACE VIEW posts_interaccion_reciente AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.fecha_publicacion,
          COUNT(DISTINCT c.id) as comentarios_recientes,
          COUNT(DISTINCT pl.id) as likes_recientes,
          (COUNT(DISTINCT c.id) * 2 + COUNT(DISTINCT pl.id)) as interaccion_score
      FROM posts p
      LEFT JOIN comentarios c ON p.id = c.post_id 
          AND c.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      LEFT JOIN post_likes pl ON p.id = pl.post_id 
          AND pl.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      GROUP BY p.id, p.titulo, p.slug, p.fecha_publicacion
      HAVING (COUNT(DISTINCT c.id) * 2 + COUNT(DISTINCT pl.id)) > 0
      ORDER BY interaccion_score DESC
      LIMIT 20;
    `);

    // Vista: Usuarios con mejor tasa de aprobación
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_mejor_tasa_aprobacion AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          COUNT(p.id) as total_posts,
          COUNT(CASE WHEN e.nombre = 'publicado' THEN 1 END) as posts_aprobados,
          COUNT(CASE WHEN e.nombre = 'rechazado' THEN 1 END) as posts_rechazados,
          ROUND((COUNT(CASE WHEN e.nombre = 'publicado' THEN 1 END)::float / NULLIF(COUNT(p.id), 0) * 100)::numeric, 2) as tasa_aprobacion
      FROM usuarios u
      JOIN posts p ON u.id = p.usuario_id
      JOIN estados_publicacion e ON p.estado_id = e.id
      WHERE u.rol_id IN (SELECT id FROM roles WHERE nombre IN ('autor', 'escritor'))
      GROUP BY u.id, u.username, u.first_name, u.last_name
      HAVING COUNT(p.id) >= 3
      ORDER BY tasa_aprobacion DESC;
    `);

    // Vista: Comentarios por hora del día
    await client.query(`
      CREATE OR REPLACE VIEW comentarios_por_hora AS
      SELECT 
          EXTRACT(HOUR FROM created_at) as hora,
          COUNT(*) as total_comentarios,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as aprobados,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendientes,
          ROUND(AVG(LENGTH(contenido))::numeric, 0) as longitud_promedio
      FROM comentarios
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hora;
    `);

    // Vista: Posts por día de la semana
    await client.query(`
      CREATE OR REPLACE VIEW posts_por_dia_semana AS
      SELECT 
          EXTRACT(DOW FROM fecha_publicacion) as dia_semana,
          CASE EXTRACT(DOW FROM fecha_publicacion)
              WHEN 0 THEN 'Domingo'
              WHEN 1 THEN 'Lunes'
              WHEN 2 THEN 'Martes'
              WHEN 3 THEN 'Miércoles'
              WHEN 4 THEN 'Jueves'
              WHEN 5 THEN 'Viernes'
              WHEN 6 THEN 'Sábado'
          END as dia_nombre,
          COUNT(*) as posts_count,
          COALESCE(AVG(views), 0) as avg_views,
          COALESCE(AVG(likes), 0) as avg_likes,
          COALESCE(AVG(comments_count), 0) as avg_comments
      FROM posts
      WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND fecha_publicacion IS NOT NULL
      GROUP BY EXTRACT(DOW FROM fecha_publicacion)
      ORDER BY dia_semana;
    `);

    // Vista: Crecimiento mensual de usuarios
    await client.query(`
      CREATE OR REPLACE VIEW crecimiento_usuarios_mensual AS
      SELECT 
          DATE_TRUNC('month', created_at) as mes,
          COUNT(*) as nuevos_usuarios,
          COUNT(CASE WHEN rol_id = (SELECT id FROM roles WHERE nombre = 'administrador') THEN 1 END) as administradores,
          COUNT(CASE WHEN rol_id = (SELECT id FROM roles WHERE nombre = 'editor') THEN 1 END) as editores,
          COUNT(CASE WHEN rol_id = (SELECT id FROM roles WHERE nombre = 'autor') THEN 1 END) as autores,
          COUNT(CASE WHEN rol_id = (SELECT id FROM roles WHERE nombre = 'comentador') THEN 1 END) as comentadores,
          SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) as usuarios_acumulados
      FROM usuarios
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY mes DESC;
    `);

    // Vista: Métricas de calidad de contenido
    await client.query(`
      CREATE OR REPLACE VIEW metricas_calidad_contenido AS
      SELECT 
          u.username as autor,
          COUNT(p.id) as total_posts,
          ROUND(AVG(p.tiempo_lectura)::numeric, 1) as tiempo_lectura_promedio,
          ROUND(AVG(LENGTH(p.contenido))::numeric, 0) as longitud_promedio,
          ROUND(AVG(p.views)::numeric, 0) as views_promedio,
          ROUND(AVG(p.likes)::numeric, 1) as likes_promedio,
          ROUND(AVG(p.comments_count)::numeric, 1) as comentarios_promedio,
          ROUND((AVG(p.likes) / NULLIF(AVG(p.views), 0) * 100)::numeric, 2) as tasa_engagement
      FROM usuarios u
      JOIN posts p ON u.id = p.usuario_id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      GROUP BY u.id, u.username
      HAVING COUNT(p.id) >= 3
      ORDER BY tasa_engagement DESC;
    `);

    // Vista: Seguidores más activos
    await client.query(`
      CREATE OR REPLACE VIEW seguidores_mas_activos AS
      SELECT 
          f.following_id as usuario_seguido_id,
          u_seguido.username as usuario_seguido,
          f.follower_id as seguidor_id,
          u_seguidor.username as seguidor,
          COUNT(DISTINCT c.id) as comentarios_en_posts,
          COUNT(DISTINCT pl.id) as likes_en_posts,
          (COUNT(DISTINCT c.id) * 2 + COUNT(DISTINCT pl.id)) as actividad_score
      FROM follows f
      JOIN usuarios u_seguido ON f.following_id = u_seguido.id
      JOIN usuarios u_seguidor ON f.follower_id = u_seguidor.id
      LEFT JOIN posts p ON p.usuario_id = f.following_id
      LEFT JOIN comentarios c ON c.post_id = p.id AND c.usuario_id = f.follower_id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = f.follower_id
      GROUP BY f.following_id, u_seguido.username, f.follower_id, u_seguidor.username
      HAVING (COUNT(DISTINCT c.id) * 2 + COUNT(DISTINCT pl.id)) > 0
      ORDER BY actividad_score DESC
      LIMIT 50;
    `);

    // Vista: Resumen de rendimiento general
    await client.query(`
      CREATE OR REPLACE VIEW rendimiento_general AS
      SELECT 
          (SELECT COUNT(*) FROM usuarios WHERE status = 'active') as usuarios_activos,
          (SELECT COUNT(*) FROM posts WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')) as posts_publicados,
          (SELECT COUNT(*) FROM comentarios WHERE status = 'approved') as comentarios_aprobados,
          (SELECT COALESCE(SUM(views), 0) FROM posts) as total_views,
          (SELECT COALESCE(SUM(likes), 0) FROM posts) as total_likes,
          (SELECT COUNT(*) FROM follows) as total_follows,
          (SELECT COUNT(*) FROM reacciones) as total_reacciones,
          (SELECT ROUND(AVG(views)::numeric, 0) FROM posts WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')) as avg_views_por_post,
          (SELECT ROUND(AVG(comments_count)::numeric, 1) FROM posts WHERE estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')) as avg_comentarios_por_post;
    `);

    // Vista: Tags más populares
    await client.query(`
      CREATE OR REPLACE VIEW tags_mas_populares AS
      SELECT 
          t.id,
          t.name,
          t.slug,
          t.description,
          t.usage_count,
          COUNT(DISTINCT pt.post_id) as posts_count,
          COUNT(DISTINCT p.usuario_id) as autores_count
      FROM tags t
      LEFT JOIN post_tags pt ON t.id = pt.tag_id
      LEFT JOIN posts p ON pt.post_id = p.id
      GROUP BY t.id, t.name, t.slug, t.description, t.usage_count
      HAVING t.usage_count > 0
      ORDER BY t.usage_count DESC
      LIMIT 50;
    `);

    // Vista: Posts con SEO completo
    await client.query(`
      CREATE OR REPLACE VIEW posts_seo_completo AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          ps.meta_title,
          ps.meta_description,
          ps.focus_keyword,
          ps.og_title,
          ps.og_description,
          ps.og_image,
          ps.seo_score,
          ps.readability_score,
          CASE 
              WHEN ps.seo_score >= 80 THEN 'Excelente'
              WHEN ps.seo_score >= 60 THEN 'Bueno'
              WHEN ps.seo_score >= 40 THEN 'Regular'
              ELSE 'Necesita mejoras'
          END as seo_status
      FROM posts p
      LEFT JOIN post_seo ps ON p.id = ps.post_id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      ORDER BY ps.seo_score DESC NULLS LAST;
    `);

    // Vista: Posts pendientes de revisión editorial
    await client.query(`
      CREATE OR REPLACE VIEW posts_revision_editorial AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.created_at,
          u.username as autor,
          pe.submitted_at,
          pe.editorial_status,
          pe.reviewer_id,
          r.username as revisor,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - pe.submitted_at)) as dias_en_revision
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN post_editorial pe ON p.id = pe.post_id
      LEFT JOIN usuarios r ON pe.reviewer_id = r.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'en_revision')
      ORDER BY pe.submitted_at ASC NULLS LAST;
    `);

    // Vista: Actividades recientes de usuarios
    await client.query(`
      CREATE OR REPLACE VIEW actividades_usuarios_recientes AS
      SELECT 
          ua.id,
          ua.type,
          ua.description,
          ua.target,
          ua.created_at,
          u.username,
          u.avatar,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ua.created_at)) / 3600 as horas_transcurridas
      FROM user_activities ua
      JOIN usuarios u ON ua.user_id = u.id
      WHERE ua.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY ua.created_at DESC
      LIMIT 100;
    `);

    // Vista: Usuarios con más permisos
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_permisos_detalle AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.rol_id,
          r.nombre as rol,
          COUNT(up.permission) as total_permisos,
          ARRAY_AGG(up.permission ORDER BY up.permission) as permisos
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN user_permissions up ON u.id = up.user_id
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.rol_id, r.nombre
      ORDER BY total_permisos DESC;
    `);

    // Vista: Archivos multimedia por tipo
    await client.query(`
      CREATE OR REPLACE VIEW media_files_stats AS
      SELECT 
          type,
          COUNT(*) as total_files,
          SUM(size) as total_size_bytes,
          ROUND(SUM(size)::numeric / 1024 / 1024, 2) as total_size_mb,
          ROUND(AVG(size)::numeric / 1024 / 1024, 2) as avg_size_mb,
          MAX(uploaded_at) as last_upload
      FROM media_files
      GROUP BY type
      ORDER BY total_files DESC;
    `);

    // Vista: Archivos multimedia recientes
    await client.query(`
      CREATE OR REPLACE VIEW media_files_recientes AS
      SELECT 
          mf.id,
          mf.name,
          mf.url,
          mf.type,
          ROUND(mf.size::numeric / 1024 / 1024, 2) as size_mb,
          mf.mime_type,
          mf.uploaded_at,
          u.username as uploaded_by_username,
          u.avatar as uploaded_by_avatar
      FROM media_files mf
      JOIN usuarios u ON mf.uploaded_by = u.id
      ORDER BY mf.uploaded_at DESC
      LIMIT 50;
    `);

    // Vista: Tráfico semanal
    await client.query(`
      CREATE OR REPLACE VIEW trafico_semanal AS
      SELECT 
          DATE_TRUNC('week', date) as semana,
          SUM(views) as total_views,
          SUM(users) as total_users,
          SUM(sessions) as total_sessions,
          ROUND(AVG(views)::numeric, 0) as avg_views_dia,
          MAX(views) as max_views_dia
      FROM analytics_traffic
      WHERE date >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY semana DESC;
    `);

    // Vista: Fuentes de tráfico principales
    await client.query(`
      CREATE OR REPLACE VIEW fuentes_trafico_principales AS
      SELECT 
          name as fuente,
          SUM(visitors) as total_visitors,
          ROUND(AVG(percentage)::numeric, 2) as avg_percentage,
          MAX(date) as ultima_actualizacion
      FROM analytics_traffic_sources
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY name
      ORDER BY total_visitors DESC;
    `);

    // Vista: Comentarios con más likes
    await client.query(`
      CREATE OR REPLACE VIEW comentarios_top_likes AS
      SELECT 
          c.id,
          c.contenido,
          c.likes,
          c.created_at,
          u.username as autor,
          u.avatar as autor_avatar,
          p.titulo as post_titulo,
          p.slug as post_slug,
          COUNT(cl.id) as total_likes_registrados
      FROM comentarios c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN posts p ON c.post_id = p.id
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.status = 'approved'
      GROUP BY c.id, c.contenido, c.likes, c.created_at, u.username, u.avatar, p.titulo, p.slug
      HAVING c.likes > 0
      ORDER BY c.likes DESC
      LIMIT 20;
    `);

    // Vista: Posts por tag
    await client.query(`
      CREATE OR REPLACE VIEW posts_por_tag AS
      SELECT 
          t.id as tag_id,
          t.name as tag_name,
          t.slug as tag_slug,
          COUNT(DISTINCT pt.post_id) as posts_count,
          COALESCE(SUM(p.views), 0) as total_views,
          COALESCE(AVG(p.views), 0) as avg_views,
          MAX(p.fecha_publicacion) as ultimo_post
      FROM tags t
      LEFT JOIN post_tags pt ON t.id = pt.tag_id
      LEFT JOIN posts p ON pt.post_id = p.id 
          AND p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      GROUP BY t.id, t.name, t.slug
      HAVING COUNT(DISTINCT pt.post_id) > 0
      ORDER BY posts_count DESC;
    `);

    // Vista: Tokens de password activos
    await client.query(`
      CREATE OR REPLACE VIEW password_resets_activos AS
      SELECT 
          pr.id,
          pr.token,
          pr.expires_at,
          pr.created_at,
          u.username,
          u.email,
          EXTRACT(EPOCH FROM (pr.expires_at - CURRENT_TIMESTAMP)) / 3600 as horas_restantes
      FROM password_resets pr
      JOIN usuarios u ON pr.user_id = u.id
      WHERE pr.used = FALSE
        AND pr.expires_at > CURRENT_TIMESTAMP
      ORDER BY pr.created_at DESC;
    `);

    // Vista: Resumen de configuración del sitio
    await client.query(`
      CREATE OR REPLACE VIEW configuracion_sitio_completa AS
      SELECT 
          sc.site_name,
          sc.site_description,
          sc.site_url,
          sc.language,
          sc.timezone,
          seoc.google_analytics_id,
          seoc.google_search_console_id,
          seoc.twitter_handle,
          ec.from_email,
          ec.from_name,
          sc.updated_at as site_config_updated,
          seoc.updated_at as seo_config_updated,
          ec.updated_at as email_config_updated
      FROM site_config sc
      CROSS JOIN seo_config seoc
      CROSS JOIN email_config ec
      LIMIT 1;
    `);

    // Vista: Posts con mejor SEO score
    await client.query(`
      CREATE OR REPLACE VIEW posts_mejor_seo AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          p.likes,
          ps.seo_score,
          ps.readability_score,
          ps.focus_keyword,
          u.username as autor,
          p.fecha_publicacion
      FROM posts p
      JOIN post_seo ps ON p.id = ps.post_id
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND ps.seo_score IS NOT NULL
      ORDER BY ps.seo_score DESC, p.views DESC
      LIMIT 20;
    `);

    // Vista: Actividad de usuarios por tipo
    await client.query(`
      CREATE OR REPLACE VIEW actividad_usuarios_por_tipo AS
      SELECT 
          type as tipo_actividad,
          COUNT(*) as total_actividades,
          COUNT(DISTINCT user_id) as usuarios_unicos,
          MAX(created_at) as ultima_actividad,
          DATE_TRUNC('day', created_at) as dia
      FROM user_activities
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY type, DATE_TRUNC('day', created_at)
      ORDER BY dia DESC, total_actividades DESC;
    `);

    // Vista: Dashboard de SEO
    await client.query(`
      CREATE OR REPLACE VIEW dashboard_seo AS
      SELECT 
          COUNT(*) as total_posts_con_seo,
          COUNT(CASE WHEN seo_score >= 80 THEN 1 END) as posts_excelente,
          COUNT(CASE WHEN seo_score >= 60 AND seo_score < 80 THEN 1 END) as posts_bueno,
          COUNT(CASE WHEN seo_score >= 40 AND seo_score < 60 THEN 1 END) as posts_regular,
          COUNT(CASE WHEN seo_score < 40 THEN 1 END) as posts_necesita_mejoras,
          ROUND(AVG(seo_score)::numeric, 2) as promedio_seo_score,
          ROUND(AVG(readability_score)::numeric, 2) as promedio_readability_score,
          COUNT(CASE WHEN focus_keyword IS NOT NULL THEN 1 END) as posts_con_keyword,
          COUNT(CASE WHEN og_image IS NOT NULL THEN 1 END) as posts_con_og_image
      FROM post_seo;
    `);

    // Vista: Usuarios más activos (basado en user_activities)
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_mas_activos_v2 AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.avatar,
          COUNT(ua.id) as total_actividades,
          COUNT(CASE WHEN ua.type = 'post_created' THEN 1 END) as posts_creados,
          COUNT(CASE WHEN ua.type = 'post_published' THEN 1 END) as posts_publicados,
          COUNT(CASE WHEN ua.type = 'comment_added' THEN 1 END) as comentarios,
          COUNT(CASE WHEN ua.type = 'follow' THEN 1 END) as follows,
          COUNT(CASE WHEN ua.type = 'like_given' THEN 1 END) as likes,
          MAX(ua.created_at) as ultima_actividad
      FROM usuarios u
      LEFT JOIN user_activities ua ON u.id = ua.user_id
      WHERE ua.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar
      ORDER BY total_actividades DESC
      LIMIT 50;
    `);

    // Vista: Tags trending (más usados recientemente)
    await client.query(`
      CREATE OR REPLACE VIEW tags_trending AS
      SELECT 
          t.id,
          t.name,
          t.slug,
          t.usage_count,
          COUNT(DISTINCT pt.post_id) as posts_recientes,
          COUNT(DISTINCT p.usuario_id) as autores_recientes,
          COALESCE(SUM(p.views), 0) as total_views_recientes
      FROM tags t
      LEFT JOIN post_tags pt ON t.id = pt.tag_id
      LEFT JOIN posts p ON pt.post_id = p.id 
          AND p.fecha_publicacion >= CURRENT_TIMESTAMP - INTERVAL '30 days'
          AND p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      GROUP BY t.id, t.name, t.slug, t.usage_count
      HAVING COUNT(DISTINCT pt.post_id) > 0
      ORDER BY posts_recientes DESC, total_views_recientes DESC
      LIMIT 20;
    `);

    // Vista: Posts sin SEO
    await client.query(`
      CREATE OR REPLACE VIEW posts_sin_seo AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          p.fecha_publicacion,
          u.username as autor,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p.fecha_publicacion)) as dias_publicado
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN post_seo ps ON p.id = ps.post_id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND ps.id IS NULL
      ORDER BY p.views DESC;
    `);

    // Vista: Archivos multimedia grandes
    await client.query(`
      CREATE OR REPLACE VIEW media_files_grandes AS
      SELECT 
          mf.id,
          mf.name,
          mf.type,
          ROUND(mf.size::numeric / 1024 / 1024, 2) as size_mb,
          mf.uploaded_at,
          u.username as uploaded_by,
          CASE 
              WHEN mf.type = 'image' AND mf.size > 10485760 THEN 'Considerar optimizar'
              WHEN mf.type = 'video' AND mf.size > 104857600 THEN 'Considerar optimizar'
              WHEN mf.type = 'audio' AND mf.size > 20971520 THEN 'Considerar optimizar'
              WHEN mf.type = 'document' AND mf.size > 5242880 THEN 'Considerar optimizar'
              ELSE 'Tamaño OK'
          END as recomendacion
      FROM media_files mf
      JOIN usuarios u ON mf.uploaded_by = u.id
      WHERE 
          (mf.type = 'image' AND mf.size > 10485760) OR
          (mf.type = 'video' AND mf.size > 104857600) OR
          (mf.type = 'audio' AND mf.size > 20971520) OR
          (mf.type = 'document' AND mf.size > 5242880)
      ORDER BY mf.size DESC;
    `);

    // Vista: Tráfico por día de la semana
    await client.query(`
      CREATE OR REPLACE VIEW trafico_por_dia_semana AS
      SELECT 
          EXTRACT(DOW FROM date) as dia_semana,
          CASE EXTRACT(DOW FROM date)
              WHEN 0 THEN 'Domingo'
              WHEN 1 THEN 'Lunes'
              WHEN 2 THEN 'Martes'
              WHEN 3 THEN 'Miércoles'
              WHEN 4 THEN 'Jueves'
              WHEN 5 THEN 'Viernes'
              WHEN 6 THEN 'Sábado'
          END as dia_nombre,
          ROUND(AVG(views)::numeric, 0) as avg_views,
          ROUND(AVG(users)::numeric, 0) as avg_users,
          ROUND(AVG(sessions)::numeric, 0) as avg_sessions,
          MAX(views) as max_views,
          MIN(views) as min_views
      FROM analytics_traffic
      WHERE date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY EXTRACT(DOW FROM date)
      ORDER BY dia_semana;
    `);

    // Vista: Comparación mensual de tráfico
    await client.query(`
      CREATE OR REPLACE VIEW trafico_comparacion_mensual AS
      SELECT 
          DATE_TRUNC('month', date) as mes,
          SUM(views) as total_views,
          SUM(users) as total_users,
          SUM(sessions) as total_sessions,
          ROUND(AVG(views)::numeric, 0) as avg_views_dia,
          LAG(SUM(views)) OVER (ORDER BY DATE_TRUNC('month', date)) as views_mes_anterior,
          ROUND(((SUM(views) - LAG(SUM(views)) OVER (ORDER BY DATE_TRUNC('month', date)))::float / 
                 NULLIF(LAG(SUM(views)) OVER (ORDER BY DATE_TRUNC('month', date)), 0) * 100)::numeric, 2) as crecimiento_porcentaje
      FROM analytics_traffic
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY mes DESC
      LIMIT 12;
    `);

    // Vista: Posts con tags (NORMALIZADA)
    await client.query(`
      CREATE OR REPLACE VIEW posts_con_tags AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          p.likes,
          CONCAT(u.first_name, ' ', u.last_name) as autor,
          u.username as autor_username,
          ARRAY_AGG(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL) as tags,
          COUNT(DISTINCT pt.tag_id) as total_tags
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      GROUP BY p.id, p.titulo, p.slug, p.views, p.likes, u.first_name, u.last_name, u.username
      ORDER BY p.fecha_publicacion DESC;
    `);

    // Vista: Posts con keywords (NORMALIZADA - reemplaza el array palabras_clave)
    await client.query(`
      CREATE OR REPLACE VIEW posts_con_keywords AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          p.likes,
          CONCAT(u.first_name, ' ', u.last_name) as autor,
          u.username as autor_username,
          ARRAY_AGG(DISTINCT k.keyword ORDER BY k.keyword) FILTER (WHERE k.keyword IS NOT NULL) as keywords,
          COUNT(DISTINCT pk.keyword_id) as total_keywords
      FROM posts p
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN post_keywords pk ON p.id = pk.post_id
      LEFT JOIN keywords k ON pk.keyword_id = k.id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
      GROUP BY p.id, p.titulo, p.slug, p.views, p.likes, u.first_name, u.last_name, u.username
      ORDER BY p.fecha_publicacion DESC;
    `);

    // Vista: Keywords más usadas
    await client.query(`
      CREATE OR REPLACE VIEW keywords_mas_usadas AS
      SELECT 
          k.id,
          k.keyword,
          k.slug,
          k.usage_count,
          COUNT(DISTINCT pk.post_id) as posts_count,
          COUNT(DISTINCT p.usuario_id) as autores_count
      FROM keywords k
      LEFT JOIN post_keywords pk ON k.id = pk.keyword_id
      LEFT JOIN posts p ON pk.post_id = p.id
      GROUP BY k.id, k.keyword, k.slug, k.usage_count
      HAVING k.usage_count > 0
      ORDER BY k.usage_count DESC
      LIMIT 50;
    `);

    // Vista: Comentarios por usuario
    await client.query(`
      CREATE OR REPLACE VIEW comentarios_por_usuario AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.avatar,
          COUNT(c.id) as total_comentarios,
          COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as comentarios_aprobados,
          COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as comentarios_pendientes,
          COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as comentarios_rechazados,
          COALESCE(SUM(c.likes), 0) as total_likes_recibidos,
          MAX(c.created_at) as ultimo_comentario
      FROM usuarios u
      LEFT JOIN comentarios c ON u.id = c.usuario_id
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar
      HAVING COUNT(c.id) > 0
      ORDER BY total_comentarios DESC;
    `);

    // Vista: Posts en revisión por tiempo
    await client.query(`
      CREATE OR REPLACE VIEW posts_revision_por_tiempo AS
      SELECT 
          rango_tiempo,
          COUNT(*) as total_posts,
          ARRAY_AGG(titulo ORDER BY dias_en_revision DESC) as posts
      FROM (
          SELECT 
              p.titulo,
              EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(pe.submitted_at, p.created_at))) as dias_en_revision,
              CASE 
                  WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(pe.submitted_at, p.created_at))) <= 1 THEN '0-1 días'
                  WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(pe.submitted_at, p.created_at))) <= 3 THEN '2-3 días'
                  WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(pe.submitted_at, p.created_at))) <= 7 THEN '4-7 días'
                  WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(pe.submitted_at, p.created_at))) <= 14 THEN '8-14 días'
                  ELSE 'Más de 14 días'
              END as rango_tiempo
          FROM posts p
          LEFT JOIN post_editorial pe ON p.id = pe.post_id
          WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'en_revision')
      ) subquery
      GROUP BY rango_tiempo
      ORDER BY 
          CASE rango_tiempo
              WHEN '0-1 días' THEN 1
              WHEN '2-3 días' THEN 2
              WHEN '4-7 días' THEN 3
              WHEN '8-14 días' THEN 4
              ELSE 5
          END;
    `);

    // Vista: Usuarios con permisos específicos
    await client.query(`
      CREATE OR REPLACE VIEW usuarios_con_permiso_admin AS
      SELECT 
          u.id,
          u.username,
          CONCAT(u.first_name, ' ', u.last_name) as nombre,
          u.email,
          r.nombre as rol,
          up.permission,
          up.granted_at
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      JOIN user_permissions up ON u.id = up.user_id
      WHERE up.permission IN ('admin_completo', 'asignar_roles', 'eliminar_categoria')
      ORDER BY up.permission, u.username;
    `);

    // Vista: Resumen de multimedia por usuario
    await client.query(`
      CREATE OR REPLACE VIEW media_resumen_por_usuario AS
      SELECT 
          u.id,
          u.username,
          COUNT(mf.id) as total_archivos,
          COUNT(CASE WHEN mf.type = 'image' THEN 1 END) as imagenes,
          COUNT(CASE WHEN mf.type = 'video' THEN 1 END) as videos,
          COUNT(CASE WHEN mf.type = 'audio' THEN 1 END) as audios,
          COUNT(CASE WHEN mf.type = 'document' THEN 1 END) as documentos,
          ROUND(SUM(mf.size)::numeric / 1024 / 1024, 2) as total_mb,
          MAX(mf.uploaded_at) as ultima_subida
      FROM usuarios u
      LEFT JOIN media_files mf ON u.id = mf.uploaded_by
      GROUP BY u.id, u.username
      HAVING COUNT(mf.id) > 0
      ORDER BY total_mb DESC;
    `);

    // Vista: Actividad de moderación
    await client.query(`
      CREATE OR REPLACE VIEW actividad_moderacion AS
      SELECT 
          u.id as moderador_id,
          u.username as moderador,
          COUNT(DISTINCT c.id) as comentarios_moderados,
          COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as aprobados,
          COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rechazados,
          ROUND((COUNT(CASE WHEN c.status = 'approved' THEN 1 END)::float / 
                 NULLIF(COUNT(DISTINCT c.id), 0) * 100)::numeric, 2) as tasa_aprobacion,
          MAX(c.moderated_at) as ultima_moderacion
      FROM usuarios u
      JOIN comentarios c ON u.id = c.moderated_by
      WHERE c.moderated_at IS NOT NULL
      GROUP BY u.id, u.username
      ORDER BY comentarios_moderados DESC;
    `);

    // Vista: Posts con mejor relación SEO/Engagement
    await client.query(`
      CREATE OR REPLACE VIEW posts_seo_engagement AS
      SELECT 
          p.id,
          p.titulo,
          p.slug,
          p.views,
          p.likes,
          p.comments_count,
          ps.seo_score,
          CASE 
              WHEN p.views > 0 THEN 
                  ROUND(((p.likes + p.comments_count * 2)::float / p.views * 100)::numeric, 2)
              ELSE 0
          END as engagement_rate,
          ROUND(((ps.seo_score + 
                 CASE WHEN p.views > 0 THEN ((p.likes + p.comments_count * 2)::float / p.views * 100) ELSE 0 END
                ) / 2)::numeric, 2) as score_combinado
      FROM posts p
      JOIN post_seo ps ON p.id = ps.post_id
      WHERE p.estado_id = (SELECT id FROM estados_publicacion WHERE nombre = 'publicado')
        AND ps.seo_score IS NOT NULL
        AND p.views >= 100
      ORDER BY score_combinado DESC
      LIMIT 30;
    `);

    // Vista: Tokens expirados por limpiar
    await client.query(`
      CREATE OR REPLACE VIEW password_resets_expirados AS
      SELECT 
          pr.id,
          pr.user_id,
          u.username,
          u.email,
          pr.created_at,
          pr.expires_at,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - pr.expires_at)) as dias_expirado
      FROM password_resets pr
      JOIN usuarios u ON pr.user_id = u.id
      WHERE pr.expires_at < CURRENT_TIMESTAMP
        AND pr.used = FALSE
      ORDER BY pr.expires_at ASC;
    `);

    console.log(`✅ Vistas adicionales nivel 3 creadas (${dur(t7)})`);

    await client.query('COMMIT');
    console.log(`✅ Inicialización de base de datos mejorada completada en ${dur(t0)}`);

    return { success: true, message: 'Base de datos mejorada inicializada correctamente' } as const;
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ Error al inicializar la base de datos:', error);
    return { success: false, message: 'Error al inicializar la base de datos', error: error?.message } as const;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1, $2)', [271828, 314159]); } catch {}
    client.release();
  }
}

export default initDatabaseEnhanced;

// Ejecutar si se llama directamente
if (require.main === module) {
  initDatabaseEnhanced()
    .then((result) => {
      console.log('✅ Resultado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}
