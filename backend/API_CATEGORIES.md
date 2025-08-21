# API de Categorías - TodoList

## Endpoints de Categorías

### 1. Crear Categoría
```
POST /api/categorias
Content-Type: application/json

{
    "name": "Nombre de la categoría",
    "description": "Descripción de la categoría"
}
```

**Respuesta exitosa (200):**
```json
{
    "message": "Se creó la categoría correctamente",
    "data": {
        "id": 1,
        "name": "Nombre de la categoría",
        "description": "Descripción de la categoría"
    }
}
```

**Error (400) - Campos vacíos:**
```json
{
    "message": "El nombre de la categoría no puede estar vacío"
}
```
```json
{
    "message": "La descripción de la categoría no puede estar vacía"
}
```

**Error (409) - Nombre duplicado:**
```json
{
    "message": "Ya existe una categoría con ese nombre"
}
```

### 2. Obtener Lista de Categorías
```
GET /api/categorias
```

**Respuesta exitosa (200):**
```json
{
    "message": "Se obtuvieron las categorías correctamente",
    "data": [
        {
            "id": 1,
            "name": "Personal",
            "description": "Tareas personales y de vida diaria"
        },
        {
            "id": 2,
            "name": "Trabajo",
            "description": "Tareas relacionadas con el trabajo y proyectos laborales"
        }
    ]
}
```

### 3. Eliminar Categoría
```
DELETE /api/categorias/{id}
```

**Respuesta exitosa (200):**
```json
{
    "message": "Se eliminó la categoría correctamente"
}
```

**Error (404) - Categoría no encontrada:**
```json
{
    "message": "Categoría no encontrada"
}
```

**Error (409) - Categoría tiene tareas:**
```json
{
    "message": "No se puede eliminar la categoría porque tiene tareas asociadas"
}
```

## Categorías por Defecto

Al iniciar la aplicación, se crean automáticamente las siguientes categorías:
- **Personal**: Tareas personales y de vida diaria
- **Trabajo**: Tareas relacionadas con el trabajo y proyectos laborales
- **Estudio**: Tareas académicas y de aprendizaje
- **Hogar**: Tareas domésticas y de mantenimiento del hogar
- **Salud**: Tareas relacionadas con la salud y bienestar

## Validaciones

- **Nombre único**: No se pueden crear categorías con nombres duplicados
- **Nombre obligatorio**: El nombre de la categoría no puede estar vacío
- **Descripción obligatoria**: La descripción de la categoría no puede estar vacía
- **Integridad referencial**: No se puede eliminar una categoría que tenga tareas asociadas

## Códigos de Estado HTTP

- **200**: Operación exitosa
- **400**: Bad Request (campos vacíos o datos inválidos)
- **404**: Categoría no encontrada
- **409**: Conflicto (nombre duplicado o categoría con tareas)
- **422**: Unprocessable Entity (error en el parsing del body)

## Ejemplos de Uso

### Crear una nueva categoría:
```bash
curl -X POST http://localhost:8080/api/categorias \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Proyectos",
    "description": "Tareas relacionadas con proyectos personales y profesionales"
  }'
```

### Obtener todas las categorías:
```bash
curl http://localhost:8080/api/categorias
```

### Eliminar una categoría:
```bash
curl -X DELETE http://localhost:8080/api/categorias/1
```