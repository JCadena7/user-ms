# 🤖 Triggers Automáticos de User Activities

El módulo de actividades de usuario **aprovecha los triggers de la base de datos** para registrar automáticamente las acciones de los usuarios sin necesidad de código adicional.

## ✅ Triggers Implementados y Utilizados

### 1. **`trigger_log_post_created_activity`**
📍 **Tabla:** `posts`  
⚡ **Evento:** `AFTER INSERT`  
🎯 **Función:** `log_post_created_activity()`

**Qué hace:**
- Se ejecuta automáticamente cuando un usuario crea un post
- Inserta un registro en `user_activities` con tipo `post_created`

**SQL:**
```sql
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
```

**Ejemplo de actividad generada:**
```json
{
  "id": "uuid-123",
  "userId": 1,
  "type": "post_created",
  "description": "Creó el post: Mi primer artículo",
  "target": "/posts/mi-primer-articulo",
  "content": "Este es el extracto del post...",
  "createdAt": "2025-10-17T23:00:00Z"
}
```

---

### 2. **`trigger_log_post_published_activity`**
📍 **Tabla:** `posts`  
⚡ **Evento:** `AFTER UPDATE`  
🎯 **Función:** `log_post_published_activity()`

**Qué hace:**
- Se ejecuta cuando el estado de un post cambia a "publicado"
- Solo registra la actividad si el estado anterior NO era "publicado"

**SQL:**
```sql
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
```

**Ejemplo de actividad generada:**
```json
{
  "id": "uuid-456",
  "userId": 1,
  "type": "post_published",
  "description": "Publicó el post: Mi primer artículo",
  "target": "/posts/mi-primer-articulo",
  "createdAt": "2025-10-17T23:30:00Z"
}
```

---

### 3. **`trigger_log_comment_activity`**
📍 **Tabla:** `comentarios`  
⚡ **Evento:** `AFTER INSERT`  
🎯 **Función:** `log_comment_activity()`

**Qué hace:**
- Se ejecuta cuando un usuario añade un comentario
- Busca el título del post comentado
- Guarda los primeros 200 caracteres del comentario

**SQL:**
```sql
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
```

**Ejemplo de actividad generada:**
```json
{
  "id": "uuid-789",
  "userId": 2,
  "type": "comment_added",
  "description": "Comentó en: Mi primer artículo",
  "target": "/posts/mi-primer-articulo",
  "content": "Excelente artículo, me ayudó mucho...",
  "createdAt": "2025-10-17T23:45:00Z"
}
```

---

### 4. **`trigger_log_follow_activity`**
📍 **Tabla:** `follows`  
⚡ **Evento:** `AFTER INSERT`  
🎯 **Función:** `log_follow_activity()`

**Qué hace:**
- Se ejecuta cuando un usuario sigue a otro
- Busca el username del usuario seguido
- Registra la acción de seguir

**SQL:**
```sql
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
```

**Ejemplo de actividad generada:**
```json
{
  "id": "uuid-abc",
  "userId": 1,
  "type": "follow",
  "description": "Comenzó a seguir a @juanperez",
  "target": "/profile/juanperez",
  "createdAt": "2025-10-18T00:00:00Z"
}
```

---

### 5. **`trigger_log_like_activity`**
📍 **Tabla:** `post_likes`  
⚡ **Evento:** `AFTER INSERT`  
🎯 **Función:** `log_like_activity()`

**Qué hace:**
- Se ejecuta cuando un usuario da like a un post
- Busca el título del post
- Registra la acción de like

**SQL:**
```sql
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
```

**Ejemplo de actividad generada:**
```json
{
  "id": "uuid-def",
  "userId": 3,
  "type": "like_given",
  "description": "Le gustó: Mi primer artículo",
  "target": "/posts/mi-primer-articulo",
  "createdAt": "2025-10-18T00:15:00Z"
}
```

---

## 📊 Resumen de Triggers

| Trigger | Tabla | Evento | Tipo Actividad | Automático |
|---------|-------|--------|----------------|------------|
| `trigger_log_post_created_activity` | `posts` | INSERT | `post_created` | ✅ Sí |
| `trigger_log_post_published_activity` | `posts` | UPDATE | `post_published` | ✅ Sí |
| `trigger_log_comment_activity` | `comentarios` | INSERT | `comment_added` | ✅ Sí |
| `trigger_log_follow_activity` | `follows` | INSERT | `follow` | ✅ Sí |
| `trigger_log_like_activity` | `post_likes` | INSERT | `like_given` | ✅ Sí |

## 🎯 Ventajas de Usar Triggers

### ✅ **Registro Automático**
No necesitas escribir código para registrar actividades. La base de datos lo hace automáticamente.

### ✅ **Consistencia Garantizada**
Todas las acciones se registran sin importar desde dónde se ejecuten (API, admin panel, scripts, etc.)

### ✅ **Rendimiento**
Los triggers se ejecutan en la base de datos, sin overhead de red o aplicación.

### ✅ **Atomicidad**
Si la operación principal falla, la actividad tampoco se registra (transaccionalidad).

### ✅ **Auditoría Completa**
Historial completo de todas las acciones de los usuarios.

## 🔍 Cómo Verificar que los Triggers Funcionan

### 1. Crear un post
```typescript
// Al crear un post, automáticamente se registra la actividad
await client.send('createPost', {
  titulo: 'Mi nuevo post',
  contenido: 'Contenido del post...',
  usuario_id: 1
});

// Verificar actividad
const activities = await client.send('findUserActivitiesByUserId', {
  userId: 1,
  params: { type: 'post_created', limit: 1 }
});
// Resultado: [{ type: 'post_created', description: 'Creó el post: Mi nuevo post', ... }]
```

### 2. Publicar un post
```typescript
// Al cambiar estado a publicado, se registra automáticamente
await client.send('updatePost', {
  id: 1,
  estado_id: 3 // ID del estado 'publicado'
});

// Verificar actividad
const activities = await client.send('findUserActivitiesByUserId', {
  userId: 1,
  params: { type: 'post_published', limit: 1 }
});
```

### 3. Comentar
```typescript
// Al comentar, se registra automáticamente
await client.send('createComment', {
  post_id: 1,
  usuario_id: 2,
  contenido: 'Excelente post!'
});

// Verificar actividad
const activities = await client.send('findUserActivitiesByUserId', {
  userId: 2,
  params: { type: 'comment_added', limit: 1 }
});
```

## 📝 Actividades Manuales

Solo **`profile_updated`** requiere registro manual desde el código:

```typescript
// Al actualizar perfil, registrar manualmente
await client.send('updateUser', { id: 1, bio: 'Nueva bio' });

// Registrar actividad manualmente
await client.send('createUserActivity', {
  userId: 1,
  type: 'profile_updated',
  description: 'Actualizó su biografía',
  target: '/profile/username',
  metadata: { field: 'bio' }
});
```

## 🚀 Conclusión

El módulo de actividades **aprovecha al 100% los triggers de la base de datos**:

- ✅ **5 de 6 tipos de actividades** se registran automáticamente
- ✅ **0 líneas de código** necesarias para registrar actividades automáticas
- ✅ **100% confiable** gracias a la atomicidad de las transacciones
- ✅ **Listo para producción** sin configuración adicional

Los triggers ya están creados en `init-db.ts` y funcionan automáticamente. El módulo solo necesita **consultar** las actividades, no crearlas manualmente (excepto `profile_updated`).
