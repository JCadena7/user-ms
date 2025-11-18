# Módulo de Actividades de Usuario (User Activities Module)

Módulo completo para el registro y consulta de actividades de usuarios. Las actividades se registran **automáticamente** mediante triggers de la base de datos.

## 📋 Estructura

```
user-activities/
├── domain/
│   ├── user-activity.entity.ts        # Entidad UserActivity
│   └── user-activity.repository.ts    # Interfaz del repositorio
├── dto/
│   ├── create-user-activity.dto.ts    # DTO para crear actividades
│   └── find-user-activities.dto.ts    # DTO para búsqueda
├── entities/
│   └── user-activity.entity.ts        # Re-exportación de la entidad
├── infrastructure/
│   └── pg-user-activity.repository.ts # Implementación PostgreSQL
├── user-activities.controller.ts      # Controlador de microservicios
├── user-activities.service.ts         # Lógica de negocio
└── user-activities.module.ts          # Módulo NestJS
```

## 🎯 Tipos de Actividades

Las actividades se registran automáticamente mediante triggers de la BD:

| Tipo | Descripción | Trigger |
|------|-------------|---------|
| `post_created` | Usuario crea un post | ✅ Automático al INSERT en `posts` |
| `post_published` | Usuario publica un post | ✅ Automático al UPDATE estado a 'publicado' |
| `comment_added` | Usuario comenta en un post | ✅ Automático al INSERT en `comentarios` |
| `profile_updated` | Usuario actualiza su perfil | ⚠️ Manual desde el código |
| `follow` | Usuario sigue a otro | ✅ Automático al INSERT en `follows` |
| `like_given` | Usuario da like a un post | ✅ Automático al INSERT en `post_likes` |

## 🔧 Campos de UserActivity

- `id`: UUID único de la actividad
- `userId`: ID del usuario que realizó la actividad
- `type`: Tipo de actividad (ver tabla arriba)
- `description`: Descripción legible de la actividad
- `target`: Objetivo de la actividad (ej: slug del post)
- `content`: Contenido adicional (ej: extracto del comentario)
- `metadata`: Datos adicionales en formato JSON
- `createdAt`: Fecha de creación de la actividad

## 📡 Endpoints (Message Patterns)

### `createUserActivity`
Crea una actividad manualmente (para casos no cubiertos por triggers).

**Payload:**
```typescript
{
  userId: number;             // Requerido
  type: UserActivityType;     // Requerido
  description: string;        // Requerido
  target?: string;            // Opcional
  content?: string;           // Opcional
  metadata?: object;          // Opcional
}
```

**Ejemplo:**
```typescript
const activity = await client.send('createUserActivity', {
  userId: 1,
  type: 'profile_updated',
  description: 'Actualizó su foto de perfil',
  target: '/profile/juanperez',
  metadata: { field: 'avatar', oldValue: null, newValue: '/avatars/123.jpg' }
});
```

### `findAllUserActivities`
Busca actividades con filtros y paginación.

**Payload:**
```typescript
{
  userId?: number;            // Filtrar por usuario
  type?: UserActivityType;    // Filtrar por tipo
  startDate?: Date;           // Fecha inicio
  endDate?: Date;             // Fecha fin
  page?: number;              // Número de página (>= 1)
  limit?: number;             // Límite por página (1-100, default: 20)
}
```

**Respuesta:**
- Sin paginación: Array de actividades
- Con paginación: `{ data: UserActivity[], total: number, page: number, limit: number }`

**Ejemplos:**
```typescript
// Obtener últimas 50 actividades de un usuario
const activities = await client.send('findAllUserActivities', {
  userId: 1,
  limit: 50
});

// Obtener actividades de tipo 'post_created' con paginación
const result = await client.send('findAllUserActivities', {
  userId: 1,
  type: 'post_created',
  page: 1,
  limit: 20
});

// Obtener actividades en un rango de fechas
const activities = await client.send('findAllUserActivities', {
  userId: 1,
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});
```

### `findUserActivitiesByUserId`
Busca actividades de un usuario específico.

**Payload:**
```typescript
{
  userId: number;             // Requerido
  params?: {                  // Opcional
    type?: UserActivityType;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }
}
```

**Ejemplo:**
```typescript
const activities = await client.send('findUserActivitiesByUserId', {
  userId: 1,
  params: {
    type: 'comment_added',
    page: 1,
    limit: 10
  }
});
```

### `findOneUserActivity`
Busca una actividad por su ID.

**Payload:**
```typescript
{ id: string } // UUID
```

### `removeUserActivity`
Elimina una actividad específica.

**Payload:**
```typescript
{ id: string } // UUID
```

### `removeUserActivitiesByUserId`
Elimina todas las actividades de un usuario.

**Payload:**
```typescript
{ userId: number }
```

**Respuesta:**
```typescript
{ deleted: number } // Cantidad de actividades eliminadas
```

## 🤖 Triggers Automáticos de la BD

### 1. `trigger_log_post_created_activity`
Se ejecuta al crear un post.

```sql
INSERT INTO user_activities (user_id, type, description, target, content)
VALUES (
  NEW.usuario_id,
  'post_created',
  'Creó el post: ' || NEW.titulo,
  '/posts/' || NEW.slug,
  LEFT(NEW.extracto, 200)
);
```

### 2. `trigger_log_post_published_activity`
Se ejecuta al publicar un post.

```sql
INSERT INTO user_activities (user_id, type, description, target)
VALUES (
  NEW.usuario_id,
  'post_published',
  'Publicó el post: ' || NEW.titulo,
  '/posts/' || NEW.slug
);
```

### 3. `trigger_log_comment_activity`
Se ejecuta al comentar.

```sql
INSERT INTO user_activities (user_id, type, description, target, content)
VALUES (
  NEW.usuario_id,
  'comment_added',
  'Comentó en: ' || post_titulo,
  '/posts/' || post_slug,
  LEFT(NEW.contenido, 200)
);
```

### 4. `trigger_log_follow_activity`
Se ejecuta al seguir a alguien.

```sql
INSERT INTO user_activities (user_id, type, description, target)
VALUES (
  NEW.follower_id,
  'follow',
  'Comenzó a seguir a @' || followed_username,
  '/profile/' || followed_username
);
```

### 5. `trigger_log_like_activity`
Se ejecuta al dar like.

```sql
INSERT INTO user_activities (user_id, type, description, target)
VALUES (
  NEW.user_id,
  'like_given',
  'Le gustó: ' || post_titulo,
  '/posts/' || post_slug
);
```

## 🔍 Casos de Uso

### 1. Timeline de Actividades del Usuario
```typescript
// Obtener últimas 20 actividades para mostrar en el perfil
const timeline = await client.send('findUserActivitiesByUserId', {
  userId: 1,
  params: { page: 1, limit: 20 }
});
```

### 2. Estadísticas de Actividad
```typescript
// Contar actividades por tipo en el último mes
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 1);

const activities = await client.send('findAllUserActivities', {
  userId: 1,
  startDate,
  type: 'post_created'
});

console.log(`Posts creados en el último mes: ${activities.length}`);
```

### 3. Feed de Actividades Global
```typescript
// Obtener últimas actividades de todos los usuarios
const globalFeed = await client.send('findAllUserActivities', {
  page: 1,
  limit: 50
});
```

### 4. Registrar Actividad Manual
```typescript
// Registrar actualización de perfil
await client.send('createUserActivity', {
  userId: 1,
  type: 'profile_updated',
  description: 'Actualizó su biografía',
  target: '/profile/juanperez',
  metadata: {
    field: 'bio',
    oldValue: 'Biografía anterior',
    newValue: 'Nueva biografía'
  }
});
```

## 📊 Índices de BD

La tabla tiene los siguientes índices para optimizar consultas:

- `idx_user_activities_user_id` - Búsquedas por usuario
- `idx_user_activities_type` - Filtrado por tipo
- `idx_user_activities_created_at` - Ordenamiento por fecha (DESC)

## 🎨 Integración con Frontend

### Ejemplo de Timeline Component
```typescript
// React/Next.js
const UserTimeline = ({ userId }) => {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`/api/activities?userId=${userId}&page=${page}&limit=20`)
      .then(res => res.json())
      .then(data => setActivities(data.data));
  }, [userId, page]);

  return (
    <div className="timeline">
      {activities.map(activity => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
};
```

## 🔐 Consideraciones de Seguridad

- ✅ Las actividades se crean automáticamente por triggers (no manipulables)
- ✅ Solo se pueden consultar actividades propias o públicas
- ✅ La eliminación de actividades debe estar restringida
- ⚠️ Implementar autorización en el gateway/API

## 📈 Métricas y Analytics

Las actividades pueden usarse para:
- 📊 Dashboard de actividad del usuario
- 📈 Análisis de engagement
- 🎯 Recomendaciones personalizadas
- 🏆 Gamificación (badges, logros)
- 📧 Notificaciones de actividad

## 🚀 Próximas Mejoras

- [ ] Agregar más tipos de actividades
- [ ] Implementar sistema de notificaciones basado en actividades
- [ ] Crear agregaciones de actividades (resúmenes diarios/semanales)
- [ ] Implementar feed de actividades de usuarios seguidos
- [ ] Agregar filtros por relevancia/popularidad
