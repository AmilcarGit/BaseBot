# Política de seguridad

## Reportar vulnerabilidades

No publiques vulnerabilidades explotables, tokens ni credenciales en Issues públicos. Si GitHub muestra la opción **Report a vulnerability** en la pestaña Security, utilízala. Si no está disponible, contacta al mantenedor por un canal privado vinculado al perfil de GitHub.

Incluye el repositorio, commit o versión afectados, pasos mínimos de reproducción e impacto. No incluyas información privada que no sea necesaria.

## Datos sensibles

Nunca publiques archivos de sesión, `.env`, contraseñas, tokens, claves privadas o datos personales. Si se filtra un secreto, revócalo y genera uno nuevo; borrar el archivo del repositorio no invalida el secreto.

## Dependencias

Revisa alertas de Dependabot y las dependencias antes de actualizar. Las actualizaciones deben probarse antes de integrarse, especialmente si afectan a bibliotecas de conexión, autenticación o datos.
