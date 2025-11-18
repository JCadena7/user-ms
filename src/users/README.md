# Módulo de Usuarios (User Module)

Módulo completo para la gestión de usuarios en el microservicio, totalmente sincronizado con la estructura de la base de datos.

## 📋 Estructura

```
users/
├── domain/
│   ├── user.entity.ts        # Entidad User con todos los campos
│   └── user.repository.ts    # Interfaz del repositorio
├── dto/
│   ├── create-user.dto.ts    # DTO para crear usuarios
│   ├── update-user.dto.ts    # DTO para actualizar usuarios
│   └── find-users.dto.ts     # DTO para búsqueda y filtrado
├── entities/
│   └── user.entity.ts        # Re-exportación de la entidad
├── infrastructure/
│   └── pg-user.repository.ts # Implementación PostgreSQL
├── users.controller.ts       # Controlador de microservicios
├── users.service.ts          # Lógica de negocio
└── users.module.ts           # Módulo NestJS
```

## 🔧 Campos de Usuario

### Campos Básicos
- `id`: ID único del usuario
- `clerkId`: ID de Clerk (autenticación externa)
- `username`: Nombre de usuario único
- `email`: Email único (requerido)
- `passwordHash`: Hash de contraseña

### Información Personal
- `firstName`: Nombre (requerido)
- `lastName`: Apellido (requerido)
- `avatar`: URL del avatar
- `coverImage`: URL de imagen de portada
- `bio`: Biografía del usuario
- `website`: Sitio web personal
- `location`: Ubicación
- `phone`: Teléfono
- `birthDate`: Fecha de nacimiento

### Estado y Permisos
- `rolId`: ID del rol asignado
- `status`: Estado del usuario (`active`, `inactive`, `suspended`)
- `isVerified`: Usuario verificado (boolean)
- `onlineStatus`: Estado en línea (`online`, `offline`, `away`)
- `lastLogin`: Última fecha de inicio de sesión

### Timestamps
- `createdAt`: Fecha de creación
- `updatedAt`: Fecha de última actualización

## 📡 Endpoints (Message Patterns)

### `createUser`
Crea un nuevo usuario.

**Payload:**
```typescript
{
  email: string;              // Requerido
  firstName: string;          // Requerido
  lastName: string;           // Requerido
  username?: string;          // Opcional
  clerkId?: string;           // Opcional
  passwordHash?: string;      // Opcional
  rolId?: number;             // Opcional
  avatar?: string;            // Opcional
  coverImage?: string;        // Opcional
  bio?: string;               // Opcional
  website?: string;           // Opcional
  location?: string;          // Opcional
  phone?: string;             // Opcional
  birthDate?: Date;           // Opcional
  status?: 'active' | 'inactive' | 'suspended';
  isVerified?: boolean;       // Opcional
  onlineStatus?: 'online' | 'offline' | 'away';
}
```

**Validaciones:**
- Email único
- Username único (si se proporciona)
- ClerkId único (si se proporciona)

### `findAllUsers`
Busca usuarios con filtros y paginación opcional.

**Payload:**
```typescript
{
  // Paginación
  page?: number;              // Número de página (>= 1)
  limit?: number;             // Límite por página (1-100)
  
  // Ordenamiento
  orderBy?: 'id' | 'first_name' | 'last_name' | 'email' | 'username' | 'created_at' | 'status';
  order?: 'asc' | 'desc';
  
  // Filtros
  search?: string;            // Búsqueda global
  email?: string;             // Email exacto
  nombre?: string;            // Busca en firstName y lastName
  username?: string;          // Username exacto
  clerkId?: string;           // ClerkId exacto
  rolId?: number;             // ID de rol
  status?: 'active' | 'inactive' | 'suspended';
  isVerified?: boolean;       // Usuario verificado
}
```

**Respuesta:**
- Sin paginación: Array de usuarios
- Con paginación: `{ data: User[], total: number, page: number, limit: number }`

### `findOneUser`
Busca un usuario por ID.

**Payload:**
```typescript
{ id: number }
```

### `findUserByUsername`
Busca un usuario por username.

**Payload:**
```typescript
{ username: string }
```

### `findUserByClerkId`
Busca un usuario por Clerk ID.

**Payload:**
```typescript
{ clerkId: string }
```

### `updateUser`
Actualiza un usuario existente.

**Payload:**
```typescript
{
  id: number;                 // Requerido
  // Todos los demás campos son opcionales
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  clerkId?: string;
  passwordHash?: string;
  rolId?: number;
  avatar?: string;
  coverImage?: string;
  bio?: string;
  website?: string;
  location?: string;
  phone?: string;
  birthDate?: Date;
  status?: 'active' | 'inactive' | 'suspended';
  isVerified?: boolean;
  onlineStatus?: 'online' | 'offline' | 'away';
  lastLogin?: Date;
}
```

### `removeUser`
Elimina un usuario.

**Payload:**
```typescript
{ id: number }
```

## 🔍 Búsqueda Global

El parámetro `search` busca en los siguientes campos:
- `first_name`
- `last_name`
- `email`
- `username`
- `clerk_id`

## 🗄️ Base de Datos

### Tabla: `usuarios`
El módulo está completamente sincronizado con la tabla `usuarios` de PostgreSQL.

### Triggers Automáticos
Al crear un usuario, la base de datos automáticamente crea registros en:
- `user_preferences`: Preferencias del usuario
- `user_stats`: Estadísticas del usuario
- `user_social_links`: Enlaces sociales del usuario

### Índices
La tabla tiene índices en:
- `clerk_id` (único)
- `username` (único)
- `email` (único)
- `rol_id`
- `status`

## 💡 Ejemplos de Uso

### Crear Usuario
```typescript
const user = await client.send('createUser', {
  email: 'juan@example.com',
  firstName: 'Juan',
  lastName: 'Pérez',
  username: 'juanperez',
  status: 'active',
  isVerified: true
});
```

### Buscar con Filtros
```typescript
const result = await client.send('findAllUsers', {
  page: 1,
  limit: 10,
  orderBy: 'created_at',
  order: 'desc',
  status: 'active',
  isVerified: true
});
```

### Buscar por Username
```typescript
const user = await client.send('findUserByUsername', {
  username: 'juanperez'
});
```

### Actualizar Usuario
```typescript
const updated = await client.send('updateUser', {
  id: 1,
  bio: 'Nueva biografía',
  location: 'México',
  onlineStatus: 'online'
});
```

## 🛡️ Validaciones

Todas las validaciones se realizan mediante `class-validator`:
- Email válido
- Longitudes máximas de campos
- Valores permitidos para enums (`status`, `onlineStatus`)
- Tipos de datos correctos
- Transformaciones automáticas (trim, lowercase para email)

## 🔄 Compatibilidad

El módulo mantiene compatibilidad con código existente:
- El filtro `nombre` busca en `firstName` y `lastName`
- Todos los campos opcionales tienen valores por defecto seguros
